// app/api/moddulo/f3/chat-visita/route.ts
// POST { projectId }
// Registra que el usuario acaba de visitar el chat de F3 — usado para
// comparar contra fechaEntrega de f3Resultados y avisar de resultados
// nuevos al siguiente montaje (ver page.tsx). Sin lectura previa: la
// comparación ya la hizo el cliente con el valor que trajo antes de llamar
// este endpoint.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.investigacion.chatUltimaVisita": new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
