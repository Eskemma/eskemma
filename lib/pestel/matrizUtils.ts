// lib/pestel/matrizUtils.ts
// Utility functions for the E6 impact/probability matrix and E7 scorecard.
// No external dependencies — pure deterministic calculations.

import type {
  DimensionAnalysis,
  HumanAdjustment,
  DimensionCode,
  Intensity,
  Classification,
  Trend,
  PestlDimensionConfig,
} from "@/types/pestel.types";

// ─────────────────────────────────────────────────────────────
// Matrix coordinate derivation (no Cloud Function changes needed)
// ─────────────────────────────────────────────────────────────

/**
 * Returns the AI-proposed (x, y) coordinates for a dimension on the
 * impact/probability matrix, derived deterministically from its
 * intensity + classification (Y = impact, 0–100) and
 * trend (X = probability, 0–100).
 *
 * Higher X = higher probability of occurring.
 * Higher Y = higher impact if it occurs.
 */
export function getDimensionCoordinates(
  dim: Pick<DimensionAnalysis, "intensity" | "classification" | "trend">
): { x: number; y: number } {
  return {
    x: probabilityFromTrend(dim.trend),
    y: impactFromIntensityClassification(dim.intensity, dim.classification),
  };
}

/**
 * Returns the effective (x, y) for a dimension, applying any human
 * adjustment if one exists for that dimension code.
 */
export function getAdjustedCoordinates(
  dim: DimensionAnalysis,
  adjustments: HumanAdjustment[] | undefined
): { x: number; y: number } {
  const adj = adjustments?.find((a) => a.dimensionCode === dim.code);
  return adj ? adj.newPosition : getDimensionCoordinates(dim);
}

function probabilityFromTrend(trend: Trend): number {
  switch (trend) {
    case "ASCENDENTE":
      return 75;
    case "ESTABLE":
      return 50;
    case "DESCENDENTE":
      return 25;
  }
}

function impactFromIntensityClassification(
  intensity: Intensity,
  classification: Classification
): number {
  if (intensity === "ALTA") {
    if (classification === "AMENAZA") return 85;
    if (classification === "NEUTRAL") return 70;
    return 65; // OPORTUNIDAD
  }
  if (intensity === "MEDIA") {
    if (classification === "AMENAZA") return 60;
    if (classification === "NEUTRAL") return 45;
    return 40; // OPORTUNIDAD
  }
  // BAJA
  if (classification === "AMENAZA") return 35;
  if (classification === "NEUTRAL") return 20;
  return 15; // OPORTUNIDAD
}

// ─────────────────────────────────────────────────────────────
// Scorecard (used in E7)
// ─────────────────────────────────────────────────────────────

export interface DimensionScore {
  code: DimensionCode;
  dimWeight: number;       // sum of variable weights for this dimension
  confidence: number;      // 0-100 from DimensionAnalysis
  classMultiplier: number; // +1.0 | 0.0 | -1.0
  score: number;           // (confidence/100) * classMultiplier * 100, range -100..+100
}

export interface Scorecard {
  dimensions: DimensionScore[];
  totalWeight: number;
  globalScore: number;     // weighted average, range -100..+100
}

/**
 * Builds the weighted scorecard combining analysis results with the
 * variable config weights defined in E3.
 */
export function buildScorecard(
  dimensions: DimensionAnalysis[],
  variableConfigs: PestlDimensionConfig[]
): Scorecard {
  const dimScores: DimensionScore[] = dimensions.map((dim) => {
    const config = variableConfigs.find((c) => c.code === dim.code);
    const dimWeight = config
      ? config.variables.reduce((sum, v) => sum + v.weight, 0)
      : 5; // fallback if config missing

    const classMultiplier = classificationMultiplier(dim.classification);
    // score: -100..+100 (bipolar scale — negative = threat, positive = opportunity)
    const score = Math.round((dim.confidence / 100) * classMultiplier * 100);

    return {
      code: dim.code,
      dimWeight,
      confidence: dim.confidence,
      classMultiplier,
      score,
    };
  });

  const totalWeight = dimScores.reduce((sum, d) => sum + d.dimWeight, 0);
  const weightedSum = dimScores.reduce(
    (sum, d) => sum + d.score * d.dimWeight,
    0
  );
  // globalScore: -100..+100 weighted average
  const globalScore =
    totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return { dimensions: dimScores, totalWeight, globalScore };
}

function classificationMultiplier(c: Classification): number {
  if (c === "OPORTUNIDAD") return 1.0;
  if (c === "NEUTRAL") return 0.0;
  return -1.0; // AMENAZA
}

// ─────────────────────────────────────────────────────────────
// Scenario filtering (used in E7 scenarios report)
// ─────────────────────────────────────────────────────────────

/**
 * Returns dimensions considered high-stakes: those whose AI-proposed
 * impact AND probability are both above the given threshold (default 60).
 * Used to focus scenario prompts on the most relevant factors.
 */
export function getHighStakeDimensions(
  dimensions: DimensionAnalysis[],
  adjustments: HumanAdjustment[] | undefined,
  threshold = 60
): DimensionAnalysis[] {
  return dimensions.filter((dim) => {
    const coords = getAdjustedCoordinates(dim, adjustments);
    return coords.x >= threshold && coords.y >= threshold;
  });
}
