// app/api/moddulo/f3/resultados/aprobar/route.ts
// POST { projectId, resultadoId, pipItemId, asignacionId, aprobado, notasUsuario? }
// M2 — el usuario aprueba (o rechaza) un resultado recibido y confirma a
// qué asignación de qué tarea del PIP responde. Si aprobado, marca esa
// AsignacionCanal específica como "recibido" y la vincula a este
// resultadoId — es el enlace real entre "llegó un resultado" y "la
// asignación del tablero M1 quedó cubierta", que la regla de suficiencia
// de M4 necesita. asignacionId es obligatorio porque una tarea puede tener
// más de una asignación (primaria + complementaria). Identidad por
// pipItemId, no numero (ver lib/moddulo/pipPropagation.ts).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject, normalizeTareaPIP } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { aplicarVersion, prepararVersion, type CambioArtefacto } from "@/lib/versionado/registrar";
import {
  AMBITO_F3, FASE_F3, PUNTERO_F3, estadoAsignacion, estadoResultado, nombreAsignacion, nombreResultado,
  selloDeAprobacion, vivoAsignacion, vivoResultado,
} from "@/lib/moddulo/versionado/artefactosF3";
import { respuestaDeErrorHistorial } from "@/lib/moddulo/versionado/respuestaHistorial";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; resultadoId?: string; pipItemId?: string; asignacionId?: string; aprobado?: boolean; notasUsuario?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, resultadoId, pipItemId, asignacionId, aprobado, notasUsuario } = body;
  if (!projectId || !resultadoId || !pipItemId || !asignacionId || typeof aprobado !== "boolean") {
    return NextResponse.json(
      { error: "projectId, resultadoId, pipItemId, asignacionId y aprobado son requeridos" },
      { status: 400 }
    );
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const proyectoRef = adminDb.collection("moddulo_projects").doc(projectId);
  const resultadoRef = proyectoRef.collection("f3Resultados").doc(resultadoId);

  // 7b-4 (H25): VALIDAR PRIMERO, ESCRIBIR DESPUÉS, todo en una transacción. Antes la ruta escribía
  // `aprobado` en el resultado y solo después buscaba la asignación en el tablero (un 404 llegaba con
  // la escritura ya hecha), y el tablero que escribía venía de una lectura anterior (podía pisar uno
  // más nuevo). Ahora el tablero se relee CRUDO dentro de la transacción y se normaliza con la misma
  // función que getProject, así lo escrito es idéntico a lo de siempre ({pipItemId, asignaciones}).
  // El callback puede reintentarse: lee antes de escribir, sin efectos externos; la respuesta se
  // arma afuera. getProject (arriba) queda solo como acceso.
  // C3a-2: la aprobación (o su retiro) queda en el HISTORIAL unificado en esta misma transacción. El sello
  // (quién/cuándo/huella) vive SOLO en la versión: el documento vivo del resultado conserva su forma de
  // siempre ({aprobado, notasUsuario}) porque la síntesis M3 lo serializa completo al modelo. Por eso la ruta
  // ahora lee SIEMPRE el proyecto (también con aprobado:false): ahí vive el puntero del historial.
  type Resultado = "ok" | "resultado_no_encontrado" | "proyecto_no_encontrado" | "asignacion_no_encontrada";
  let resultado: Resultado;
  try {
    resultado = await adminDb.runTransaction(async (tx): Promise<Resultado> => {
    const resultadoSnap = await tx.get(resultadoRef);
    const proyectoSnap = await tx.get(proyectoRef);
    if (!resultadoSnap.exists) return "resultado_no_encontrado";
    // Cambio declarado (C3a-2): con aprobado:false un proyecto ausente o en la papelera AHORA es 404 (antes
    // se escribía solo el resultado); el puntero del historial no tiene dónde escribirse.
    if (!proyectoSnap.exists || proyectoSnap.data()?.deletedAt) return "proyecto_no_encontrado";

    const escrituraResultado = { aprobado, ...(notasUsuario !== undefined ? { notasUsuario } : {}) };
    const resultadoPrevio = resultadoSnap.data() as Record<string, unknown>;

    let tareas: ReturnType<typeof normalizeTareaPIP>[] = [];
    let asignacionPrevia: ReturnType<typeof normalizeTareaPIP>["asignaciones"][number] | undefined;
    if (aprobado) {
      const crudas = proyectoSnap.data()?.phases?.investigacion?.f3TareasPIP;
      tareas = (Array.isArray(crudas) ? crudas : []).map((t: unknown) => normalizeTareaPIP(t as never));
      const tarea = tareas.find((t) => t.pipItemId === pipItemId);
      asignacionPrevia = tarea?.asignaciones.find((a) => a.asignacionId === asignacionId);
      if (!asignacionPrevia) return "asignacion_no_encontrada";
    }

    // ---- Historial (las lecturas van ANTES de la primera escritura) ----
    const resultadoNuevo = { ...resultadoPrevio, ...escrituraResultado };
    const sello = selloDeAprobacion(resultadoNuevo, session.uid, new Date().toISOString());
    const artefactos: CambioArtefacto[] = [
      {
        artefacto: nombreResultado(resultadoId),
        ...estadoResultado(resultadoNuevo, sello),
        vivo: vivoResultado(resultadoNuevo),
        estadoPrevio: estadoResultado(resultadoPrevio),
        vivoPrevio: vivoResultado(resultadoPrevio),
      },
    ];
    const asignacionNueva = asignacionPrevia
      ? { ...asignacionPrevia, estado: "recibido" as const, resultadoId }
      : undefined;
    if (asignacionPrevia && asignacionNueva) {
      artefactos.push({
        artefacto: nombreAsignacion(asignacionId),
        ...estadoAsignacion(asignacionNueva),
        vivo: vivoAsignacion(asignacionNueva),
        estadoPrevio: estadoAsignacion(asignacionPrevia),
        vivoPrevio: vivoAsignacion(asignacionPrevia),
      });
    }
    const plan = await prepararVersion(tx, {
      raiz: proyectoRef,
      datosRaiz: proyectoSnap.data() as Record<string, unknown> | undefined,
      punteroCampo: PUNTERO_F3,
      ambito: AMBITO_F3,
      fase: FASE_F3,
      tipoCambio: "ajuste_manual",
      por: session.uid,
      fuente: "usuario",
      // Código interno (no es texto de pantalla): aprobación, retiro de una aprobación previa o rechazo.
      motivo: aprobado ? "aprobacion" : resultadoPrevio.aprobado === true ? "aprobacion_retirada" : "resultado_rechazado",
      artefactos,
    });
    const versionado = aplicarVersion(tx, plan);

    tx.update(resultadoRef, escrituraResultado);
    if (!aprobado) {
      // Solo el puntero: NO se toca `updatedAt` (retirar una aprobación no movía el proyecto en las listas).
      if (versionado.cambio) tx.update(proyectoRef, versionado.updatesRaiz);
      return "ok";
    }

    // Payload explícito { pipItemId, asignaciones } — nunca spread (...t).
    const tareasActualizadas = tareas.map((t) => ({
      pipItemId: t.pipItemId,
      asignaciones: t.pipItemId !== pipItemId ? t.asignaciones : t.asignaciones.map((a) =>
        a.asignacionId === asignacionId ? (asignacionNueva as typeof a) : a
      ),
    }));
    tx.update(proyectoRef, {
      "phases.investigacion.f3TareasPIP": tareasActualizadas,
      updatedAt: FieldValue.serverTimestamp(),
      ...versionado.updatesRaiz,
    });
    return "ok";
    });
  } catch (err) {
    const respuesta = respuestaDeErrorHistorial(err, { projectId, fase: FASE_F3, ruta: "resultados/aprobar" });
    if (respuesta) return respuesta;
    throw err;
  }

  if (resultado === "resultado_no_encontrado") {
    return NextResponse.json({ error: "Resultado no encontrado" }, { status: 404 });
  }
  if (resultado === "proyecto_no_encontrado") {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (resultado === "asignacion_no_encontrada") {
    return NextResponse.json({ error: "Asignación no encontrada en el tablero" }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
