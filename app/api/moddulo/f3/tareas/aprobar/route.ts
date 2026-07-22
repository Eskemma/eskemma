// app/api/moddulo/f3/tareas/aprobar/route.ts
// POST { projectId, numero, asignacionId, canal?, estado?, activada? }
// El usuario aprueba una asignación específica de una tarea (reasignándola
// a otro canal y/o avanzando su estado), y/o activa/desactiva esa vía de
// forma independiente de las demás asignaciones de la misma tarea — no es
// una selección exclusiva tipo radio button. Localiza por asignacionId, no
// solo por numero — una tarea puede tener varias asignaciones.
//
// Activar/desactivar NUNCA modifica `estado`: si el body solo trae
// `activada` (sin `canal` ni `estado`), el auto-avance pendiente→en_curso
// de abajo no debe dispararse — ese auto-avance es exclusivo de una
// reasignación real de canal/estado.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { TareaPIP, AsignacionCanal } from "@/types/moddulo.types";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: {
    projectId?: string; numero?: number; asignacionId?: string;
    canal?: AsignacionCanal["canal"]; estado?: AsignacionCanal["estado"];
    activada?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, numero, asignacionId, canal, estado, activada } = body;
  if (!projectId || typeof numero !== "number" || !asignacionId) {
    return NextResponse.json({ error: "projectId, numero y asignacionId son requeridos" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
  const tarea = tareas.find((t) => t.numero === numero);
  const asignacion = tarea?.asignaciones.find((a) => a.asignacionId === asignacionId);
  if (!tarea || !asignacion) {
    return NextResponse.json({ error: "Asignación no encontrada en el tablero" }, { status: 404 });
  }

  const tareasActualizadas: TareaPIP[] = tareas.map((t) =>
    t.numero === numero
      ? {
          ...t,
          asignaciones: t.asignaciones.map((a) => {
            if (a.asignacionId !== asignacionId) return a;
            const actualizada: AsignacionCanal = { ...a };
            if (typeof activada === "boolean") {
              actualizada.activada = activada;
            }
            // El auto-avance pendiente→en_curso solo aplica cuando esta
            // llamada es una reasignación real (canal y/o estado
            // explícitos) — no cuando solo se está activando/desactivando.
            if (canal || estado) {
              actualizada.estado = estado ?? (a.estado === "pendiente" ? "en_curso" : a.estado);
            }
            if (canal) {
              actualizada.canal = canal;
              // Firestore no acepta `undefined` explícito — se omiten las
              // claves en vez de asignarlas a undefined al cambiar de canal1.
              if (canal !== "canal1") {
                delete actualizada.tecnicaId;
                delete actualizada.estadoApp;
              }
            }
            return actualizada;
          }),
        }
      : t
  );

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.investigacion.f3TareasPIP": tareasActualizadas,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ tareas: tareasActualizadas }, { status: 200 });
}
