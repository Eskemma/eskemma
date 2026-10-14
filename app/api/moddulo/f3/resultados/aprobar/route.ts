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
  type Resultado = "ok" | "resultado_no_encontrado" | "proyecto_no_encontrado" | "asignacion_no_encontrada";
  const resultado = await adminDb.runTransaction(async (tx): Promise<Resultado> => {
    const resultadoSnap = await tx.get(resultadoRef);
    const proyectoSnap = aprobado ? await tx.get(proyectoRef) : null;
    if (!resultadoSnap.exists) return "resultado_no_encontrado";

    const escrituraResultado = { aprobado, ...(notasUsuario !== undefined ? { notasUsuario } : {}) };
    if (!aprobado) {
      tx.update(resultadoRef, escrituraResultado);
      return "ok";
    }

    if (!proyectoSnap?.exists || proyectoSnap.data()?.deletedAt) return "proyecto_no_encontrado";
    const crudas = proyectoSnap.data()?.phases?.investigacion?.f3TareasPIP;
    const tareas = (Array.isArray(crudas) ? crudas : []).map((t: unknown) => normalizeTareaPIP(t as never));
    const tarea = tareas.find((t) => t.pipItemId === pipItemId);
    if (!tarea?.asignaciones.some((a) => a.asignacionId === asignacionId)) return "asignacion_no_encontrada";

    // Payload explícito { pipItemId, asignaciones } — nunca spread (...t).
    const tareasActualizadas = tareas.map((t) => ({
      pipItemId: t.pipItemId,
      asignaciones: t.pipItemId !== pipItemId ? t.asignaciones : t.asignaciones.map((a) =>
        a.asignacionId === asignacionId ? { ...a, estado: "recibido" as const, resultadoId } : a
      ),
    }));
    tx.update(resultadoRef, escrituraResultado);
    tx.update(proyectoRef, {
      "phases.investigacion.f3TareasPIP": tareasActualizadas,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return "ok";
  });

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
