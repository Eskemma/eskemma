// app/api/moddulo/f2/save-draft/route.ts
// POST { projectId, draftDVS }
// Persiste el draftDVS actual sin finalizar (usado por re-edición de motores).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { DVSF2 } from "@/types/moddulo.types";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; draftDVS?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, draftDVS } = body;
  if (!projectId || !draftDVS) {
    return NextResponse.json(
      { error: "projectId y draftDVS son requeridos" },
      { status: 400 }
    );
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.draftDVS": draftDVS as DVSF2,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
