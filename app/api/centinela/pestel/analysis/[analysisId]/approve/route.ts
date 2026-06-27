// app/api/centinela/pestel/analysis/[analysisId]/approve/route.ts
// POST — marks an analysis as APPROVED and advances the project to stage 6.
// Prerequisites: all bias alerts must be acknowledged.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { BiasAlert } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;

  const analysisRef = adminDb.collection("pestel_analyses").doc(analysisId);
  const analysisSnap = await analysisRef.get();

  if (!analysisSnap.exists) {
    return NextResponse.json(
      { error: "Análisis no encontrado" },
      { status: 404 }
    );
  }

  const data = analysisSnap.data()!;
  if (data.userId !== session.uid) {
    return NextResponse.json(
      { error: "Análisis no encontrado" },
      { status: 404 }
    );
  }

  // Verify all bias alerts have been acknowledged before approving
  const biasAlerts = (data.biasAlerts ?? []) as BiasAlert[];
  const unacknowledged = biasAlerts.filter((a) => !a.acknowledgedAt);
  if (unacknowledged.length > 0) {
    return NextResponse.json(
      {
        error: `Hay ${unacknowledged.length} alerta(s) de sesgo sin revisar. Márcalas como revisadas antes de aprobar.`,
      },
      { status: 422 }
    );
  }

  // Mark analysis as APPROVED
  await analysisRef.update({
    status: "APPROVED",
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: session.uid,
  });

  // Advance project stage to 7 (interpretation complete → informes)
  await adminDb
    .collection("pestel_projects")
    .doc(data.projectId)
    .update({
      currentStage: 7,
      updatedAt: FieldValue.serverTimestamp(),
    });

  return NextResponse.json({ ok: true }, { status: 200 });
}
