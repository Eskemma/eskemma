// app/api/moddulo/projects/[projectId]/rda/accept/route.ts
// POST { itemId }
// Marca un RDAItem "activo" como "aceptado" — decisión explícita del
// usuario de asumir una deficiencia como condición del proyecto en vez de
// resolverla. Estado terminal: no se sobrescribe por la reconciliación
// automática de complete-phase (ver lib/moddulo/rda.ts).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await params;

  let body: { itemId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { itemId } = body;
  if (!itemId) {
    return NextResponse.json({ error: "itemId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const item = project.rda?.[itemId];
  if (!item || item.estado !== "activo") {
    return NextResponse.json(
      { error: "item_no_activo", message: "Este ítem del RDA no existe o ya no está activo." },
      { status: 400 }
    );
  }

  await adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .update({
      [`rda.${itemId}.estado`]: "aceptado",
      [`rda.${itemId}.fechaResolucion`]: FieldValue.serverTimestamp(),
      [`rda.${itemId}.resueltoPor`]: "usuario",
      updatedAt: FieldValue.serverTimestamp(),
    });

  return NextResponse.json({ success: true });
}
