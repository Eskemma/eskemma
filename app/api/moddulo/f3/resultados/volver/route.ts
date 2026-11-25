// app/api/moddulo/f3/resultados/volver/route.ts
// POST { projectId, resultadoId, versionId, confirmarReemplazo?, huella? }
// C4b-1b — «Volver a una versión anterior» de un RESULTADO de F3 (artefacto `f3Resultado:{id}` del historial
// unificado). SOLO el resultado se restaura; las tareas que lo usaban se ajustan por regla (D1 = C: toda asignación
// cuyo `resultadoId` es este vuelve a «en_curso» y sin `resultadoId`). Lo restaurado queda SIN aprobar.
//
// Orden de decisiones (404/400/403 ANTES de cualquier 409 de pregunta; todo lo demás releído DENTRO de la transacción):
//   401 → 400 parametro_invalido → 404 Proyecto no encontrado → 403 sin_permiso (analyst/client)
//   → [transacción] 404 Resultado → 404 Versión → 409 version_no_restaurable → 409 reemplazo_bloqueado (Reporte F3 /
//   veredicto aprobado) → 409 sin_cambios → 409 reemplazo_requiere_confirmacion | reemplazo_huella_vencida → escribe.
// Escritura en UNA transacción: tx.set del resultado + versiones (resultado y cada asignación reiniciada) + revisión +
// evento + puntero + tablero. Un fallo del historial aborta TODO (`historial_no_confirmado`).
//
// El archivo de Storage SOLO informa (nunca bloquea y NO entra en la huella). La fecha NO se formatea aquí: la frase
// «volver a la versión del {fecha}» la compone la interfaz con la fecha de la fila del panel.

import { type NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject, normalizeTareaPIP } from "@/lib/moddulo/project";
import { aplicarVersion, idRevision, prepararVersion } from "@/lib/versionado/registrar";
import { huellaContenido } from "@/lib/versionado/huella";
import { estadoF3Desde } from "@/lib/moddulo/impactoRegeneracionF3";
import { respuestaCandado } from "@/lib/moddulo/respuestaCandado";
import { AMBITO_F3, FASE_F3, PUNTERO_F3, nombreResultado, vivoResultado } from "@/lib/moddulo/versionado/artefactosF3";
import { respuestaDeErrorHistorial } from "@/lib/moddulo/versionado/respuestaHistorial";
import { huellaRestauracion, leerVersionObjetivo, versionIdValido } from "@/lib/moddulo/versionado/restaurar";
import {
  MOTIVO_RESTAURACION, artefactosDeVolver, asignacionesDelResultado, decidirConfirmacionVolver, decidirVolverF3,
  detalleDeVolver, documentoRestaurado, esSinCambios, extrasHuellaVolver, lineasDeVolver, nombreDeResultado,
  reiniciarAsignacionesDelResultado, rutaDeArchivoVerificable, type TareaTablero,
} from "@/lib/moddulo/versionado/restaurarF3";
import { puedeVolverAVersion } from "@/lib/moddulo/versionado/visibilidadHistorial";

type Doc = Record<string, unknown>;

const idSeguro = (v: unknown): v is string => versionIdValido(v);

/** ¿Existe el archivo? Solo informa: cualquier fallo de la consulta es «no se pudo comprobar» (null), nunca bloquea. */
async function archivoFaltante(ruta: string | null): Promise<boolean | null> {
  if (!ruta) return null;
  try {
    const [existe] = await adminStorage.bucket().file(ruta).exists();
    return !existe;
  } catch {
    return null;
  }
}

type Resultado =
  | { tipo: "proyecto_no_encontrado" }
  | { tipo: "resultado_no_encontrado" }
  | { tipo: "version_no_encontrada" }
  | { tipo: "version_no_restaurable" }
  | { tipo: "bloqueado"; mensaje: string }
  | { tipo: "sin_cambios" }
  | {
      tipo: "pregunta";
      accion: "requiere_confirmacion" | "huella_vencida";
      huella: string;
      lineasBase: Omit<Parameters<typeof lineasDeVolver>[0], "archivoFaltaba">;
      nombre: string | undefined;
      archivoRuta: string | null;
    }
  | { tipo: "ok"; versionNueva: number | null; reiniciadas: string[] };

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { projectId?: unknown; resultadoId?: unknown; versionId?: unknown; confirmarReemplazo?: unknown; huella?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { projectId, resultadoId, versionId } = body;
  // ids que llegan del cliente y se usan con el Admin SDK: texto no vacío, sin «/».
  if (!idSeguro(projectId) || !idSeguro(resultadoId) || !idSeguro(versionId)) {
    return NextResponse.json({ error: "parametro_invalido" }, { status: 400 });
  }

  // Acceso (inexistente, papelera o no colaborador → el mismo 404) y rol (D3: owner y co-consultant).
  const project = await getProject(projectId, session.uid);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const rol = project.collaborators?.find((c) => c.uid === session.uid)?.role;
  if (!rol || !puedeVolverAVersion(rol)) return NextResponse.json({ error: "sin_permiso" }, { status: 403 });

  const proyectoRef = adminDb.collection("moddulo_projects").doc(projectId);
  const resultadoRef = proyectoRef.collection("f3Resultados").doc(resultadoId);
  const artefacto = nombreResultado(resultadoId);
  const confirmando = body.confirmarReemplazo === true;

  // Archivo de la versión elegida: SOLO se comprueba aquí (fuera de la transacción) cuando se va a escribir, para
  // alimentar `archivoNoEncontrado` del evento. En la pregunta se comprueba después, con la ruta que devuelve la transacción.
  let archivoFaltabaPrevio: boolean | null = null;
  if (confirmando) {
    const v = await proyectoRef.collection("versiones").doc(versionId).get();
    const d = v.exists ? (v.data() as Doc) : undefined;
    const payload = (d?.contenido as Doc | undefined)?.payload as Doc | undefined;
    archivoFaltabaPrevio = await archivoFaltante(rutaDeArchivoVerificable(payload?.archivoUrl, projectId));
  }

  let resultado: Resultado;
  try {
    resultado = await adminDb.runTransaction(async (tx): Promise<Resultado> => {
      // ---- LECTURAS (todas antes de la primera escritura; el callback puede reintentarse) ----
      const resultadoSnap = await tx.get(resultadoRef);
      const proyectoSnap = await tx.get(proyectoRef);
      if (!proyectoSnap.exists || proyectoSnap.data()?.deletedAt) return { tipo: "proyecto_no_encontrado" };
      if (!resultadoSnap.exists) return { tipo: "resultado_no_encontrado" };
      const datos = proyectoSnap.data() as Doc;
      const inv = ((datos.phases as Doc | undefined)?.investigacion ?? {}) as Doc;
      const puntero = inv.revision as { n?: unknown } | undefined;

      // Manifiesto vigente (si hay historial): de él salen la versión vigente y la huella viva guardada.
      let entrada: { versionId?: string; vivo?: string } | undefined;
      if (typeof puntero?.n === "number") {
        const m = await tx.get(proyectoRef.collection("revisiones").doc(idRevision(FASE_F3, puntero.n)));
        entrada = (m.data() as { artefactos?: Record<string, { versionId?: string; vivo?: string }> } | undefined)?.artefactos?.[artefacto];
      }
      const objetivo = await leerVersionObjetivo(tx, proyectoRef, artefacto, versionId);
      if (!objetivo.ok) return { tipo: objetivo.codigo === "version_no_restaurable" ? "version_no_restaurable" : "version_no_encontrada" };

      const vivo = resultadoSnap.data() as Doc;
      const estado = estadoF3Desde(inv);

      // ---- DECISIONES (puras) ----
      const bloqueo = decidirVolverF3(estado);
      if (bloqueo.accion === "bloqueado") return { tipo: "bloqueado", mensaje: bloqueo.mensaje };

      // Tablero crudo → misma normalización que `getProject` y `resultados/aprobar` (añade `estadoApp`, `activada`).
      const crudo = inv.f3TareasPIP;
      const tablero = (Array.isArray(crudo) ? crudo : []).map((t: unknown) => normalizeTareaPIP(t as never)) as TareaTablero[];
      const afectadas = asignacionesDelResultado(tablero, resultadoId);
      const vigenteId = typeof entrada?.versionId === "string" ? entrada.versionId : null;
      const deriva = typeof entrada?.vivo === "string" ? huellaContenido(vivoResultado(vivo)) !== entrada.vivo : null;

      if (esSinCambios({ objetivo: versionId, vigente: vigenteId, deriva, vivo, afectadas })) return { tipo: "sin_cambios" };

      const huellaActual = huellaRestauracion({
        puntero,
        objetivo: versionId,
        vigente: vigenteId,
        extras: extrasHuellaVolver(vivo, afectadas, false),
      });
      const decision = decidirConfirmacionVolver({ confirmar: body.confirmarReemplazo, huellaRecibida: body.huella, huellaActual });
      const nombre = nombreDeResultado(vivo.moduloPIP ?? (objetivo.contenido as Doc | undefined)?.moduloPIP);
      const payloadObjetivo = (objetivo.contenido as Doc | undefined)?.payload as Doc | undefined;
      const entradaLineas = {
        estabaAprobado: vivo.aprobado === true,
        teniaNotas: typeof vivo.notasUsuario === "string" && vivo.notasUsuario.length > 0,
        tareasReiniciadas: afectadas.length,
        haySintesis: !!estado.sintesis,
        hayVeredicto: !!estado.veredicto,
      };
      if (decision !== "continuar") {
        return {
          tipo: "pregunta",
          accion: decision,
          huella: huellaActual,
          lineasBase: entradaLineas,
          nombre,
          archivoRuta: rutaDeArchivoVerificable(payloadObjetivo?.archivoUrl, projectId),
        };
      }

      // ---- ESCRITURA (una sola transacción) ----
      const docNuevo = documentoRestaurado(objetivo.contenido, vivo);
      const reinicio = reiniciarAsignacionesDelResultado(tablero, resultadoId);
      const en = new Date().toISOString(); // UN instante por operación
      const plan = await prepararVersion(tx, {
        raiz: proyectoRef,
        datosRaiz: datos,
        punteroCampo: PUNTERO_F3,
        ambito: AMBITO_F3,
        fase: FASE_F3,
        tipoCambio: "restauracion",
        motivo: MOTIVO_RESTAURACION,
        por: session.uid,
        fuente: "usuario",
        detalle: detalleDeVolver({ ...entradaLineas, tareasReiniciadas: reinicio.reiniciadas.length, archivoFaltaba: archivoFaltabaPrevio }),
        artefactos: artefactosDeVolver({ resultadoId, vivoPrevio: vivo, docNuevo, reiniciadas: reinicio.reiniciadas, por: session.uid, en }),
      });
      const versionado = aplicarVersion(tx, plan);

      tx.set(resultadoRef, docNuevo);
      tx.update(proyectoRef, {
        ...(reinicio.reiniciadas.length > 0 ? { "phases.investigacion.f3TareasPIP": reinicio.tablero } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        ...versionado.updatesRaiz,
      });
      const idNuevo = versionado.versionIds[artefacto];
      const n = typeof idNuevo === "string" ? Number(idNuevo.split("__").pop()) : NaN;
      return { tipo: "ok", versionNueva: Number.isFinite(n) ? n : null, reiniciadas: reinicio.reiniciadas.map((r) => r.nueva.asignacionId) };
    });
  } catch (err) {
    const respuesta = respuestaDeErrorHistorial(err, { projectId, fase: FASE_F3, ruta: "resultados/volver" });
    if (respuesta) return respuesta;
    // El commit pudo haberse aplicado o no: no se afirma que no se hizo.
    console.error("[resultados/volver] no se pudo confirmar la escritura:", { projectId, clase: (err as Error)?.name });
    return NextResponse.json(
      { error: "reemplazo_escritura_incierta", mensaje: "No se pudo confirmar que se haya vuelto a la versión anterior. Abre el historial para verificar el estado." },
      { status: 500 }
    );
  }

  switch (resultado.tipo) {
    case "proyecto_no_encontrado":
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    case "resultado_no_encontrado":
      return NextResponse.json({ error: "Resultado no encontrado" }, { status: 404 });
    case "version_no_encontrada":
      return NextResponse.json({ error: "Versión no encontrada" }, { status: 404 });
    case "version_no_restaurable":
      return NextResponse.json({ error: "version_no_restaurable" }, { status: 409 });
    case "sin_cambios":
      return NextResponse.json({ error: "sin_cambios" }, { status: 409 });
    case "bloqueado":
      return respuestaCandado("bloqueado", { motivoBloqueo: resultado.mensaje, hayImpactoF3: false, huella: "" });
    case "pregunta": {
      // El archivo SOLO informa: se comprueba aquí, después de decidir, y no entra en la huella.
      const faltaba = await archivoFaltante(resultado.archivoRuta);
      const lineas = lineasDeVolver({ ...resultado.lineasBase, archivoFaltaba: faltaba === true });
      const hayImpactoF3 = resultado.lineasBase.tareasReiniciadas > 0 || resultado.lineasBase.haySintesis || resultado.lineasBase.hayVeredicto;
      return respuestaCandado(
        resultado.accion,
        { motivoBloqueo: null, hayImpactoF3, huella: resultado.huella },
        { lineas, ...(resultado.nombre ? { nombre: resultado.nombre } : {}) }
      );
    }
    case "ok":
      return NextResponse.json(
        { ok: true, resultadoId, versionNueva: { n: resultado.versionNueva }, asignacionesReiniciadas: resultado.reiniciadas },
        { status: 200 }
      );
  }
}
