// app/api/moddulo/f3/canal1/entregar/route.ts
// POST { projectId, sesionId, storagePath }
// Pieza 5 del plan de escenarios (b)/(c) (2026-08-19) — primera
// implementación real de Canal 1 (api-push), declarada por contrato en
// APP_TO_F3_CONTRACTS (T10) pero nunca antes construida (ver comentario de
// ese contrato). Un clic en Escenario (a), sin formulario — moduloPIP y
// cobertura se derivan server-side (mismo criterio ya usado sin excepción
// por Canal 2/3 para cobertura: { completa: true }). pipItemId NUNCA viaja
// desde el cliente — se deriva de sesion.tareaPipIds[0] (confirmado por
// grep: siempre exactamente 1 elemento, escrito una sola vez al crear la
// sesión). Upsert sobre el mismo resultadoId en reentregas — ver Punto 3.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject, normalizeTareaPIP, type LegacyTareaPIP } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { esStoragePathDeUsuario } from "@/lib/moddulo/storagePathAuth";
import type { TareaPIP, PIPItem, ModduloProject, AsignacionCanal } from "@/types/moddulo.types";
import type { ResultadoCanal1 } from "@/types/f3.types";
import type { FontanaSesion } from "@/types/fontana.types";
import { aplicarVersion, prepararVersion, type CambioArtefacto } from "@/lib/versionado/registrar";
import {
  AMBITO_F3, FASE_F3, PUNTERO_F3, estadoAsignacion, estadoResultado, nombreAsignacion, nombreResultado,
  vivoAsignacion, vivoResultado,
} from "@/lib/moddulo/versionado/artefactosF3";
import { respuestaDeErrorHistorial } from "@/lib/moddulo/versionado/respuestaHistorial";

interface Body {
  projectId?: string;
  sesionId?: string;
  storagePath?: string;
  // Opción A (26-09-09) — storagePath del .md con el reporte interpretativo
  // de Fontana. Opcional; capa adicional para la revisión humana en M2, la
  // síntesis M3 nunca la lee (serializa el string, nunca lo resuelve).
  reporteStoragePath?: string;
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, sesionId, storagePath, reporteStoragePath } = body;
  if (!projectId || !sesionId || !storagePath) {
    return NextResponse.json({ error: "projectId, sesionId y storagePath son requeridos" }, { status: 400 });
  }

  if (
    !esStoragePathDeUsuario(storagePath, session.uid, projectId) ||
    (reporteStoragePath && !esStoragePathDeUsuario(reporteStoragePath, session.uid, projectId))
  ) {
    return NextResponse.json({ error: "storagePath no autorizado" }, { status: 403 });
  }

  const sesionRef = adminDb.collection("fontana_sesiones").doc(sesionId);
  const sesionSnap = await sesionRef.get();
  if (!sesionSnap.exists || sesionSnap.data()?.uid !== session.uid) {
    return NextResponse.json({ error: "Sesión de Fontana no encontrada" }, { status: 404 });
  }
  const sesion = sesionSnap.data() as FontanaSesion;

  if (sesion.modduloProjectId !== projectId) {
    return NextResponse.json({ error: "La sesión no está vinculada a este proyecto" }, { status: 404 });
  }
  const pipItemId = sesion.tareaPipIds[0];
  if (!pipItemId) {
    return NextResponse.json({ error: "Esta sesión no corresponde a una tarea del PIP (Escenario a)" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
  const tarea = tareas.find((t) => t.pipItemId === pipItemId);
  const asignacion = tarea?.asignaciones.find((a) => a.canal === "canal1" && a.tecnicaId === "T10");
  if (!tarea || !asignacion) {
    return NextResponse.json({ error: "Asignación de Canal 1 (T10) no encontrada en el tablero" }, { status: 404 });
  }

  const extractoTexto = await extractTextPerFile({
    nombre: "fontana-contexto.json", tipo: "application/json", url: "", storagePath,
  });

  // 7b-7 (H25): resultado, tablero y entregaCanal1 de la sesión se escriben en UNA transacción
  // (antes eran 3 escrituras sueltas: si fallaba la 2.ª —p. ej. por un `undefined` que el Admin SDK
  // rechaza— el resultado ya estaba pisado y la sesión sin actualizar). Las comprobaciones de arriba
  // se conservan SOLO para ordenar las respuestas; toda decisión que depende del estado vigente
  // (¿ya hay entrega?, ¿la asignación está aprobada?) se toma DENTRO, sobre lo releído. El callback
  // no tiene efectos externos (puede reintentarse) y lee todo antes de escribir.
  const proyectoRef = adminDb.collection("moddulo_projects").doc(projectId);
  const resultadoIdNuevo = crypto.randomUUID();
  const fechaEntrega = new Date().toISOString();

  const rechazo = (status: number, error: string) => ({ tipo: "rechazo" as const, status, error });

  // C3a: la entrega queda en el HISTORIAL unificado en esta misma transacción (versión del resultado y, si la
  // reentrega reinicia la asignación, versión de la asignación). Un fallo del historial aborta todo.
  let salida;
  try {
    salida = await adminDb.runTransaction(async (tx) => {
    const sesionTx = await tx.get(sesionRef);
    const proyectoTx = await tx.get(proyectoRef);

    if (!sesionTx.exists || sesionTx.data()?.uid !== session.uid) {
      return rechazo(404, "Sesión de Fontana no encontrada");
    }
    const sesionActual = sesionTx.data() as FontanaSesion;
    if (sesionActual.modduloProjectId !== projectId) {
      return rechazo(404, "La sesión no está vinculada a este proyecto");
    }
    const pipItemIdTx = sesionActual.tareaPipIds?.[0];
    if (!pipItemIdTx) {
      return rechazo(400, "Esta sesión no corresponde a una tarea del PIP (Escenario a)");
    }

    const proyectoActual = proyectoTx.data() as
      | { deletedAt?: unknown; phases?: ModduloProject["phases"] }
      | undefined;
    if (!proyectoTx.exists || !proyectoActual || proyectoActual.deletedAt) {
      return rechazo(404, "Proyecto no encontrado");
    }

    // Tablero CRUDO normalizado con la misma función que usa getProject (lo escrito es idéntico
    // al de siempre), no la copia que leyó getProject antes.
    const tareasTx = ((proyectoActual.phases?.investigacion?.f3TareasPIP ?? []) as LegacyTareaPIP[]).map(
      normalizeTareaPIP
    );
    const tareaTx = tareasTx.find((t) => t.pipItemId === pipItemIdTx);
    const asignacionTx = tareaTx?.asignaciones.find((a) => a.canal === "canal1" && a.tecnicaId === "T10");
    if (!tareaTx || !asignacionTx) {
      return rechazo(404, "Asignación de Canal 1 (T10) no encontrada en el tablero");
    }

    const pip = (proyectoActual.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];
    const moduloPIP = pip.find((p) => p.pipItemId === pipItemIdTx)?.pregunta ?? "Resultado de Fontana";

    const resultadoId = sesionActual.entregaCanal1?.resultadoId ?? resultadoIdNuevo;
    const esReentrega = !!sesionActual.entregaCanal1?.resultadoId;
    const resultadoRef = proyectoRef.collection("f3Resultados").doc(resultadoId);
    // Estado VIVO del resultado antes de reescribirlo (solo si ya existía): es la «versión previa» del historial.
    const resultadoPrevioSnap = esReentrega ? await tx.get(resultadoRef) : null;
    const resultadoPrevio = resultadoPrevioSnap?.exists ? (resultadoPrevioSnap.data() as Record<string, unknown>) : undefined;

    const resultado: ResultadoCanal1 = {
      moduloPIP,
      origen: { sourceKind: "T10", componente: "centinela", analisisId: resultadoId, fechaEntrega },
      cobertura: { completa: true },
      payload: {
        archivoUrl: storagePath,
        extractoTexto,
        ...(reporteStoragePath ? { reporteInterpretativoUrl: reporteStoragePath } : {}),
      },
    };

    const reiniciaAsignacion = esReentrega && asignacionTx.resultadoId === resultadoId;
    const asignacionNueva = reiniciaAsignacion ? reiniciarAsignacion(asignacionTx) : undefined;

    // ---- Historial (lee el manifiesto vigente; las lecturas van ANTES de la primera escritura) ----
    const artefactos: CambioArtefacto[] = [
      {
        artefacto: nombreResultado(resultadoId),
        ...estadoResultado(resultado as unknown as Record<string, unknown>),
        vivo: vivoResultado(resultado as unknown as Record<string, unknown>),
        ...(resultadoPrevio
          ? { estadoPrevio: estadoResultado(resultadoPrevio), vivoPrevio: vivoResultado(resultadoPrevio) }
          : {}),
      },
    ];
    if (asignacionNueva) {
      artefactos.push({
        artefacto: nombreAsignacion(asignacionTx.asignacionId),
        ...estadoAsignacion(asignacionNueva),
        vivo: vivoAsignacion(asignacionNueva),
        estadoPrevio: estadoAsignacion(asignacionTx),
        vivoPrevio: vivoAsignacion(asignacionTx),
      });
    }
    const plan = await prepararVersion(tx, {
      raiz: proyectoRef,
      datosRaiz: proyectoTx.data() as Record<string, unknown> | undefined,
      punteroCampo: PUNTERO_F3,
      ambito: AMBITO_F3,
      fase: FASE_F3,
      tipoCambio: esReentrega ? "reentrega" : "entrega",
      por: session.uid,
      fuente: "usuario",
      artefactos,
    });

    tx.set(resultadoRef, {
      ...resultado,
      createdAt: FieldValue.serverTimestamp(),
    });

    const versionado = aplicarVersion(tx, plan);
    // Reentrega sobre un resultado que ya había sido aprobado en M2: invalida
    // esa aprobación anterior (misma lógica que la propagación de staleness
    // ya usada en el proyecto — el contenido de origen cambió, la aprobación
    // humana previa no se hereda en silencio) y limpia resultadoId de la
    // asignación para que vuelva a aparecer como candidata en el picker de M2
    // (F3ResultadosRecibidos filtra por `!a.resultadoId`).
    // NOTA (7b-7): la semántica NO cambia en este corte (se rediseña en la ronda Fontana ↔ F3);
    // solo se corrige la FORMA: la clave `resultadoId` se OMITE, nunca se escribe como `undefined`
    // (el Admin SDK rechaza `undefined` y la entrega daba 500 después de pisar el resultado).
    if (reiniciaAsignacion) {
      const tareasActualizadas = tareasTx.map((t) => ({
        pipItemId: t.pipItemId,
        asignaciones:
          t.pipItemId !== pipItemIdTx
            ? t.asignaciones
            : t.asignaciones.map((a) => (a.asignacionId === asignacionTx.asignacionId ? (asignacionNueva as AsignacionCanal) : a)),
      }));
      tx.update(proyectoRef, {
        "phases.investigacion.f3TareasPIP": tareasActualizadas,
        updatedAt: FieldValue.serverTimestamp(),
        ...versionado.updatesRaiz,
      });
    } else if (versionado.cambio) {
      // Solo el puntero del historial: NO se toca `updatedAt` (entregar no movía el proyecto en las listas).
      tx.update(proyectoRef, versionado.updatesRaiz);
    }

    tx.update(sesionRef, { entregaCanal1: { fecha: fechaEntrega, resultadoId } });

    return { tipo: "ok" as const, resultadoId };
    });
  } catch (err) {
    const respuesta = respuestaDeErrorHistorial(err, { projectId, fase: FASE_F3, ruta: "canal1/entregar" });
    if (respuesta) return respuesta;
    throw err;
  }

  if (salida.tipo === "rechazo") {
    return NextResponse.json({ error: salida.error }, { status: salida.status });
  }
  return NextResponse.json({ resultadoId: salida.resultadoId, fecha: fechaEntrega }, { status: 200 });
}

// Copia de la asignación en `en_curso` y SIN la clave `resultadoId` (omitida, no `undefined`).
function reiniciarAsignacion(a: AsignacionCanal): AsignacionCanal {
  const copia: AsignacionCanal = { ...a, estado: "en_curso" };
  delete copia.resultadoId;
  return copia;
}
