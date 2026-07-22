// app/api/moddulo/f3/veredicto/aprobar/route.ts
// POST { projectId }
// M4 — el usuario aprueba el veredicto draft ya generado. Ensambla el DIE
// final (snapshot análogo a `dvs` en F2 — ver finalize-dvs/route.ts) y
// marca la fase como "lista".

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { SintesisF3, TareaPIP, VeredictoHEI, DIE } from "@/types/moddulo.types";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const veredictoDraft = project.phases?.investigacion?.f3Veredicto as VeredictoHEI | undefined;
  const sintesis = project.phases?.investigacion?.f3Sintesis as SintesisF3 | undefined;
  const tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];

  if (!veredictoDraft) {
    return NextResponse.json({ error: "No hay veredicto generado para aprobar" }, { status: 400 });
  }
  if (!sintesis) {
    return NextResponse.json({ error: "No hay síntesis (M3) generada" }, { status: 400 });
  }

  const veredicto: VeredictoHEI = { ...veredictoDraft, aprobadoPorUsuario: true };
  const die: DIE = {
    sintesisPorDimension: sintesis,
    tableroTareasPIP: tareas,
    veredictoHEI: veredicto,
  };

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.investigacion.f3Veredicto": veredicto,
    "phases.investigacion.f3DIE": die,
    "phases.investigacion.estado": "lista",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ die }, { status: 200 });
}
