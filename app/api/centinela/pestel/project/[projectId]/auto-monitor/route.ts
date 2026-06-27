// app/api/centinela/pestel/project/[projectId]/auto-centinela/route.ts
// PATCH — toggle autoMonitorEnabled for a PESTEL project

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await params;
  const body = (await request.json()) as { enabled: boolean };

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "El campo 'enabled' es requerido y debe ser boolean" },
      { status: 400 }
    );
  }

  const ref = adminDb.collection("pestel_projects").doc(projectId);
  const snap = await ref.get();

  if (!snap.exists) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  if (snap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await ref.update({
    autoMonitorEnabled: body.enabled,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ autoMonitorEnabled: body.enabled });
}
