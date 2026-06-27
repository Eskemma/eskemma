// app/api/centinela/pestel/analysis/[analysisId]/adjust/route.ts
// POST — saves or replaces a HumanAdjustment for one dimension.
// Uses a Firestore transaction to replace any existing adjustment for
// the same dimensionCode (avoids duplicates in the adjustments array).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  Classification,
  DimensionCode,
  HumanAdjustment,
} from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

const VALID_DIMENSION_CODES: DimensionCode[] = ["P", "E", "S", "T", "L"];
const VALID_CLASSIFICATIONS: Classification[] = [
  "OPORTUNIDAD",
  "AMENAZA",
  "NEUTRAL",
];

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    dimensionCode,
    newPosition,
    newClassification,
    justification,
  } = body as {
    dimensionCode?: unknown;
    newPosition?: unknown;
    newClassification?: unknown;
    justification?: unknown;
  };

  // Validate dimensionCode
  if (
    !dimensionCode ||
    !VALID_DIMENSION_CODES.includes(dimensionCode as DimensionCode)
  ) {
    return NextResponse.json(
      { error: "dimensionCode inválido" },
      { status: 400 }
    );
  }

  // Validate justification (min 20 chars)
  if (
    typeof justification !== "string" ||
    justification.trim().length < 20
  ) {
    return NextResponse.json(
      { error: "La justificación debe tener al menos 20 caracteres." },
      { status: 400 }
    );
  }

  // Validate newPosition
  if (
    !newPosition ||
    typeof (newPosition as { x?: unknown }).x !== "number" ||
    typeof (newPosition as { y?: unknown }).y !== "number"
  ) {
    return NextResponse.json(
      { error: "newPosition debe tener x e y numéricos." },
      { status: 400 }
    );
  }
  const pos = newPosition as { x: number; y: number };
  if (pos.x < 0 || pos.x > 100 || pos.y < 0 || pos.y > 100) {
    return NextResponse.json(
      { error: "newPosition x e y deben estar entre 0 y 100." },
      { status: 400 }
    );
  }

  // Validate optional newClassification
  if (
    newClassification !== undefined &&
    !VALID_CLASSIFICATIONS.includes(newClassification as Classification)
  ) {
    return NextResponse.json(
      { error: "newClassification inválido" },
      { status: 400 }
    );
  }

  // Verify analysis ownership
  const analysisRef = adminDb.collection("pestel_analyses").doc(analysisId);
  const analysisSnap = await analysisRef.get();

  if (!analysisSnap.exists) {
    return NextResponse.json(
      { error: "Análisis no encontrado" },
      { status: 404 }
    );
  }

  const analysisData = analysisSnap.data()!;
  if (analysisData.userId !== session.uid) {
    return NextResponse.json(
      { error: "Análisis no encontrado" },
      { status: 404 }
    );
  }

  // Build the adjustment object. originalPosition and originalClassification
  // are derived from the stored dimension data.
  const dimensions = analysisData.dimensions as Array<{
    code: string;
    classification: Classification;
  }>;
  const originalDim = dimensions.find((d) => d.code === dimensionCode);
  if (!originalDim) {
    return NextResponse.json(
      { error: "Dimensión no encontrada en el análisis" },
      { status: 404 }
    );
  }

  // Read original AI-proposed position from matrizUtils logic
  // (replicated inline here to avoid importing client-side utils in server code)
  const originalPosition = getAIPosition(analysisData.dimensions, dimensionCode as DimensionCode);

  const adjustment: HumanAdjustment = {
    dimensionCode: dimensionCode as DimensionCode,
    adjustedBy: session.uid,
    adjustedAt: new Date().toISOString(),
    originalClassification: originalDim.classification,
    newClassification: (newClassification as Classification) ?? originalDim.classification,
    justification: justification.trim(),
    originalPosition,
    newPosition: pos,
  };

  // Transaction: replace existing adjustment for this dimension (if any),
  // then add the new one.
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(analysisRef);
    const existing = (snap.data()?.adjustments ?? []) as HumanAdjustment[];
    const filtered = existing.filter(
      (a) => a.dimensionCode !== dimensionCode
    );
    filtered.push(adjustment);
    tx.update(analysisRef, {
      adjustments: filtered,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({ ok: true, adjustment }, { status: 200 });
}

// Deterministic AI position (mirrors matrizUtils.ts logic — kept in sync manually)
function getAIPosition(
  dimensions: Array<{
    code: string;
    intensity: string;
    classification: string;
    trend: string;
  }>,
  code: DimensionCode
): { x: number; y: number } {
  const dim = dimensions.find((d) => d.code === code);
  if (!dim) return { x: 50, y: 50 };

  const trendMap: Record<string, number> = {
    ASCENDENTE: 75,
    ESTABLE: 50,
    DESCENDENTE: 25,
  };
  const impactMap: Record<string, Record<string, number>> = {
    ALTA: { AMENAZA: 85, NEUTRAL: 70, OPORTUNIDAD: 65 },
    MEDIA: { AMENAZA: 60, NEUTRAL: 45, OPORTUNIDAD: 40 },
    BAJA: { AMENAZA: 35, NEUTRAL: 20, OPORTUNIDAD: 15 },
  };

  return {
    x: trendMap[dim.trend] ?? 50,
    y: impactMap[dim.intensity]?.[dim.classification] ?? 50,
  };
}
