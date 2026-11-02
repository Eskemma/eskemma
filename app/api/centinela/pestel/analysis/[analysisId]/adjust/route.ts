// app/api/centinela/pestel/analysis/[analysisId]/adjust/route.ts
// POST — saves or replaces a HumanAdjustment for one dimension.
// Uses a Firestore transaction to replace any existing adjustment for
// the same dimensionCode (avoids duplicates in the adjustments array).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getAnalisisPropio } from "@/lib/centinela/pestel/analisisPropio";
import { planRetiroAprobacion, validarJustificacionAjuste } from "@/lib/centinela/pestel/aprobacion";
import type {
  Classification,
  DimensionCode,
  HumanAdjustment,
} from "@/types/pestel.types";
import { DIMENSION_ORDER } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

const VALID_DIMENSION_CODES: DimensionCode[] = DIMENSION_ORDER;
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

  // Validate justification: 20 a 1 000 caracteres (recortada)
  const justif = validarJustificacionAjuste(justification);
  if (!justif.ok) {
    return NextResponse.json({ error: justif.mensaje }, { status: 400 });
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

  // Propiedad POR PROYECTO (`getAnalisisPropio`, el mismo criterio que `approve`, `acknowledge-bias`,
  // `impact-chain` e `informes`) en vez de la copia `userId` del análisis; 404 igual para inexistente o
  // ajeno. Esta lectura previa solo decide el 404 y da las dimensiones para el ajuste; el estado que
  // cuenta (ajustes previos, status) es el que se lee DENTRO de la transacción de abajo.
  const analysisRef = adminDb.collection("pestel_analyses").doc(analysisId);
  const propio = await getAnalisisPropio(analysisId, session.uid);
  if (!propio) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  const analysisData = propio.analysis as unknown as Record<string, unknown>;

  // Build the adjustment object. originalPosition and originalClassification
  // are derived from the stored dimension data.
  const dimensions = (analysisData.dimensions ?? []) as Array<{
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
  const originalPosition = getAIPosition(
    dimensions as unknown as Parameters<typeof getAIPosition>[0],
    dimensionCode as DimensionCode
  );

  const adjustment: HumanAdjustment = {
    dimensionCode: dimensionCode as DimensionCode,
    adjustedBy: session.uid,
    adjustedAt: new Date().toISOString(),
    originalClassification: originalDim.classification,
    newClassification: (newClassification as Classification) ?? originalDim.classification,
    justification: justif.valor,
    originalPosition,
    newPosition: pos,
  };

  // UNA transacción, UN `tx.update`: reemplaza el ajuste previo de esa dimensión y, si el análisis estaba
  // APPROVED, retira la aprobación en el mismo write (copiándola a `aprobacionAnterior` antes de borrar
  // `approvedAt/approvedBy`): los dos cambios se aplican juntos o no se aplican. El callback puede
  // reintentarse: relee el documento, y si otra petición ya retiró la aprobación el status ya no es
  // APPROVED, no se vuelve a copiar (no se pisa `aprobacionAnterior`) y solo se agrega el ajuste. No tiene
  // efectos fuera de `tx`; la respuesta se arma fuera. `currentStage` del proyecto no se toca.
  const resultado = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(analysisRef);
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const existing = (data.adjustments ?? []) as HumanAdjustment[];
    const filtered = existing.filter((a) => a.dimensionCode !== dimensionCode);
    filtered.push(adjustment);
    const update: Record<string, unknown> = {
      adjustments: filtered,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const retiro = planRetiroAprobacion(data);
    if (retiro) {
      Object.assign(update, {
        status: "REVIEWED",
        approvedAt: FieldValue.delete(),
        approvedBy: FieldValue.delete(),
        aprobacionJustificacion: FieldValue.delete(),
        aprobacionConfianza: FieldValue.delete(),
        aprobacionAnterior: retiro.anterior,
        aprobacionRetirada: {
          en: FieldValue.serverTimestamp(),
          porDimension: dimensionCode,
          ajustadoPor: session.uid,
        },
      });
    }
    tx.update(analysisRef, update);
    return {
      status: retiro ? "REVIEWED" : (data.status as string | undefined) ?? null,
      aprobacionRetirada: retiro !== null,
      vigente: data.vigente !== false,
    };
  });

  return NextResponse.json({ ok: true, adjustment, ...resultado }, { status: 200 });
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
