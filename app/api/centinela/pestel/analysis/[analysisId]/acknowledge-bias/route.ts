// app/api/centinela/pestel/analysis/[analysisId]/acknowledge-bias/route.ts
// POST /api/centinela/pestel/analysis/[analysisId]/acknowledge-bias
// Mark a specific bias alert as reviewed by the analyst.
// Body: { biasType: string }

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;

  const analysisSnap = await adminDb
    .collection("pestel_analyses")
    .doc(analysisId)
    .get();

  if (!analysisSnap.exists) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }

  const data = analysisSnap.data()!;

  // Verify ownership via project
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(data.projectId as string)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = (await request.json()) as { biasType?: string };
  const { biasType } = body;

  if (!biasType) {
    return NextResponse.json({ error: "biasType es requerido" }, { status: 400 });
  }

  // Update the matching bias alert inside the array
  const biasAlerts = (data.biasAlerts ?? []) as Array<{
    type: string;
    acknowledgedAt?: unknown;
    acknowledgedBy?: string;
  }>;

  const alertIndex = biasAlerts.findIndex((b) => b.type === biasType);
  if (alertIndex === -1) {
    return NextResponse.json(
      { error: "Alerta de sesgo no encontrada" },
      { status: 404 }
    );
  }

  biasAlerts[alertIndex] = {
    ...biasAlerts[alertIndex],
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: session.uid,
  };

  await adminDb.collection("pestel_analyses").doc(analysisId).update({
    biasAlerts,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // If all bias alerts are acknowledged, set status to REVIEWED
  const allAcknowledged = biasAlerts.every((b) => b.acknowledgedAt);
  if (allAcknowledged) {
    await adminDb
      .collection("pestel_analyses")
      .doc(analysisId)
      .update({ status: "REVIEWED" });
  }

  return NextResponse.json({ ok: true });
}
