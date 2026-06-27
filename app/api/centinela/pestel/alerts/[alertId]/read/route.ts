// app/api/centinela/pestel/alerts/[alertId]/read/route.ts
// POST — marks an alert as read (sets readAt timestamp).
// Verifies that the alert belongs to a project owned by the session user.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface RouteContext {
  params: Promise<{ alertId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { alertId } = await context.params;

  const alertRef = adminDb.collection("pestel_alerts").doc(alertId);
  const alertSnap = await alertRef.get();

  if (!alertSnap.exists) {
    return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
  }

  const alertData = alertSnap.data()!;

  // Verify the alert's project belongs to the session user
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(alertData.projectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  await alertRef.update({
    readAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
