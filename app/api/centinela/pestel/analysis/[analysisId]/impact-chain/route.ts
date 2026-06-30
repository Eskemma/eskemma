// app/api/centinela/pestel/analysis/[analysisId]/impact-chain/route.ts
// POST  — Add an analyst-created impact chain to pestel_analyses.impactChains
// DELETE — Remove an analyst-created impact chain by its index

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { DimensionCode, RiskLevel, ImpactChain } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

async function verifyOwnership(analysisId: string, uid: string) {
  const snap = await adminDb.collection("pestel_analyses").doc(analysisId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(data.projectId as string)
    .get();
  if (!projectSnap.exists || projectSnap.data()?.userId !== uid) return null;
  return { snap, data };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;
  const ownership = await verifyOwnership(analysisId, session.uid);
  if (!ownership) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = (await request.json()) as {
    dimensions?: DimensionCode[];
    description?: string;
    riskLevel?: RiskLevel;
    recommendation?: string;
  };

  const { dimensions, description, riskLevel, recommendation } = body;

  if (!dimensions || dimensions.length === 0 || !description?.trim() || !riskLevel) {
    return NextResponse.json(
      { error: "dimensions, description y riskLevel son requeridos" },
      { status: 400 }
    );
  }

  const newChain: ImpactChain = {
    dimensions,
    description: description.slice(0, 200),
    riskLevel,
    recommendation: (recommendation ?? "").slice(0, 100),
    source: "analyst",
    addedByUserId: session.uid,
  };

  await adminDb.collection("pestel_analyses").doc(analysisId).update({
    impactChains: FieldValue.arrayUnion(newChain),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, chain: newChain });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;
  const ownership = await verifyOwnership(analysisId, session.uid);
  if (!ownership) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = (await request.json()) as { index?: number };
  if (typeof body.index !== "number") {
    return NextResponse.json({ error: "index es requerido" }, { status: 400 });
  }

  const chains = (ownership.data.impactChains ?? []) as ImpactChain[];
  const chain = chains[body.index];

  if (!chain) {
    return NextResponse.json({ error: "Cadena no encontrada" }, { status: 404 });
  }

  // Only allow deleting analyst-created chains
  if (chain.source !== "analyst") {
    return NextResponse.json(
      { error: "Solo se pueden eliminar cadenas creadas por el analista" },
      { status: 403 }
    );
  }

  chains.splice(body.index, 1);

  await adminDb.collection("pestel_analyses").doc(analysisId).update({
    impactChains: chains,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
