// app/api/moddulo/f3/resultados/aprobar/route.ts
// POST { projectId, resultadoId, numero, asignacionId, aprobado, notasUsuario? }
// M2 — el usuario aprueba (o rechaza) un resultado recibido y confirma a
// qué asignación de qué tarea del PIP responde. Si aprobado, marca esa
// AsignacionCanal específica como "recibido" y la vincula a este
// resultadoId — es el enlace real entre "llegó un resultado" y "la
// asignación del tablero M1 quedó cubierta", que la regla de suficiencia
// de M4 necesita. asignacionId es obligatorio porque una tarea puede tener
// más de una asignación (primaria + complementaria).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { TareaPIP } from "@/types/moddulo.types";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; resultadoId?: string; numero?: number; asignacionId?: string; aprobado?: boolean; notasUsuario?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, resultadoId, numero, asignacionId, aprobado, notasUsuario } = body;
  if (!projectId || !resultadoId || typeof numero !== "number" || !asignacionId || typeof aprobado !== "boolean") {
    return NextResponse.json(
      { error: "projectId, resultadoId, numero, asignacionId y aprobado son requeridos" },
      { status: 400 }
    );
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const resultadoRef = adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .collection("f3Resultados")
    .doc(resultadoId);

  const resultadoSnap = await resultadoRef.get();
  if (!resultadoSnap.exists) {
    return NextResponse.json({ error: "Resultado no encontrado" }, { status: 404 });
  }

  await resultadoRef.update({
    aprobado,
    ...(notasUsuario !== undefined ? { notasUsuario } : {}),
  });

  if (aprobado) {
    const tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
    const tarea = tareas.find((t) => t.numero === numero);
    const asignacion = tarea?.asignaciones.find((a) => a.asignacionId === asignacionId);
    if (!tarea || !asignacion) {
      return NextResponse.json({ error: "Asignación no encontrada en el tablero" }, { status: 404 });
    }
    const tareasActualizadas = tareas.map((t) =>
      t.numero === numero
        ? {
            ...t,
            asignaciones: t.asignaciones.map((a) =>
              a.asignacionId === asignacionId ? { ...a, estado: "recibido" as const, resultadoId } : a
            ),
          }
        : t
    );
    await adminDb.collection("moddulo_projects").doc(projectId).update({
      "phases.investigacion.f3TareasPIP": tareasActualizadas,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
