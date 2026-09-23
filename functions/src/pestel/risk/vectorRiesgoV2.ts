// functions/src/pestel/risk/vectorRiesgoV2.ts
// Cálculo determinista del Vector de Riesgo para PestlAnalysisV2 — sin
// llamadas a Claude, sobre datos que las 6 dimensiones YA producen
// (classification/intensity/trend/confidence). Distinto de
// calculateRiskVector (vectorCalculator.ts), que requiere
// ClassifiedArticle[] con sentimiento por artículo — un shape que el
// camino V2 nunca genera (enruta por palabra clave, no clasifica por
// artículo).
//
// Backtesting (26-09-22, solo lectura, 141 análisis reales de
// pestel_analyses): la fórmula no mostró falsos positivos/negativos
// evidentes, pero 128/141 análisis (91%) vienen de UN SOLO proyecto de
// prueba con clasificación mayoritariamente AMENAZA — no es una muestra
// suficiente para calibrar los parámetros con confianza. Se deja la
// fórmula tal como fue diseñada y aprobada, sin ajustar números, a la
// espera de observar el comportamiento real en producción. Si las
// alertas se disparan con más frecuencia de la esperada, el primer
// lugar a revisar es la tendencia de clasificación del análisis por
// dimensión (E5, prompts de analyzeDimension) — NO necesariamente esta
// fórmula; son responsabilidades distintas del sistema.

import type {DimensionAnalysisResult} from "../classifier/claudePESTL";

export interface VectorRiesgoInput {
  code: string;
  classification: "OPORTUNIDAD" | "AMENAZA" | "NEUTRAL";
  intensity: "ALTA" | "MEDIA" | "BAJA";
  trend: "ASCENDENTE" | "DESCENDENTE" | "ESTABLE";
  confidence: number;
}

export interface VectorRiesgoOutput {
  vectorRiesgo: number;
  isCrisis: boolean;
  /** Dimensiones con mayor riesgo, para citar en la descripción. */
  dimensionesDominantes: string[];
}

const BASE_POR_CLASIFICACION: Record<string, number> = {
  AMENAZA: 80,
  NEUTRAL: 40,
  OPORTUNIDAD: 15,
};

const MODIFICADOR_POR_INTENSIDAD: Record<string, number> = {
  ALTA: 1.0,
  MEDIA: 0.6,
  BAJA: 0.3,
};

/** Umbral extra sobre el umbral del proyecto para considerar "crisis". */
const MARGEN_CRISIS = 15;
/** Mínimo de dimensiones en AMENAZA+ALTA simultáneas para "crisis". */
const MIN_DIMENSIONES_ALTA_AMENAZA_CRISIS = 2;

/**
 * Limita un valor al rango [0, 100] y lo redondea a entero.
 * @param {number} value Valor a normalizar
 * @return {number} Valor normalizado
 */
function clamp(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

/**
 * Puntaje de riesgo (0-100) de UNA dimensión, a partir de su
 * clasificación, intensidad y tendencia — sin llamadas a Claude,
 * determinista.
 * @param {VectorRiesgoInput} dim Dimensión analizada
 * @return {number} Riesgo de la dimensión, 0-100
 */
function riesgoPorDimension(dim: VectorRiesgoInput): number {
  const base = BASE_POR_CLASIFICACION[dim.classification] ?? 40;
  const modificador = MODIFICADOR_POR_INTENSIDAD[dim.intensity] ?? 0.6;
  let riesgo = 50 + (base - 50) * modificador;
  if (dim.classification === "AMENAZA") {
    if (dim.trend === "ASCENDENTE") riesgo += 10;
    if (dim.trend === "DESCENDENTE") riesgo -= 10;
  }
  return clamp(riesgo);
}

/**
 * Calcula el Vector de Riesgo agregado del proyecto (promedio ponderado
 * por `confidence` de cada dimensión) y si cumple el criterio sustituto
 * de "crisis".
 *
 * `isCrisis` NO implementa el criterio original de la spec 08 (spike de
 * menciones > 300% sobre la media de 7 días) — ese requiere tracking de
 * volumen diario que el pipeline no guarda hoy. Es un sustituto
 * deliberado, más agresivo que el umbral normal, pendiente de revisión
 * cuando se retome la versión fortalecida de PESTEL (ver CLAUDE.md,
 * sección E8).
 *
 * @param {VectorRiesgoInput[]} dimensiones Dimensiones ya analizadas
 * @param {number} umbral `alertas.vectorRiesgoUmbral` del proyecto
 * @return {VectorRiesgoOutput} Score agregado y si dispara crisis
 */
export function calcularVectorRiesgoV2(
  dimensiones: VectorRiesgoInput[],
  umbral: number
): VectorRiesgoOutput {
  if (dimensiones.length === 0) {
    return {vectorRiesgo: 50, isCrisis: false, dimensionesDominantes: []};
  }

  let numerador = 0;
  let denominador = 0;
  const porDimension: {code: string; riesgo: number}[] = [];
  for (const dim of dimensiones) {
    const riesgo = riesgoPorDimension(dim);
    porDimension.push({code: dim.code, riesgo});
    numerador += riesgo * dim.confidence;
    denominador += dim.confidence;
  }

  const vectorRiesgo =
    denominador === 0 ? 50 : clamp(numerador / denominador);

  const dimensionesAltaAmenaza = dimensiones.filter(
    (d) => d.classification === "AMENAZA" && d.intensity === "ALTA"
  );
  const isCrisis =
    vectorRiesgo >= umbral + MARGEN_CRISIS &&
    dimensionesAltaAmenaza.length >= MIN_DIMENSIONES_ALTA_AMENAZA_CRISIS;

  const dimensionesDominantes = porDimension
    .slice()
    .sort((a, b) => b.riesgo - a.riesgo)
    .slice(0, 2)
    .map((d) => d.code);

  return {vectorRiesgo, isCrisis, dimensionesDominantes};
}

/**
 * Adapta `DimensionAnalysisResult[]` (el shape real de
 * `generateAnalysisV2`) al input de `calcularVectorRiesgoV2`, sin
 * acoplar el cálculo al tipo del clasificador.
 * @param {DimensionAnalysisResult[]} dimResults Resultado de las 6
 *   llamadas a Claude
 * @return {VectorRiesgoInput[]} Input listo para `calcularVectorRiesgoV2`
 */
export function dimensionAnalysisAVectorRiesgoInput(
  dimResults: DimensionAnalysisResult[]
): VectorRiesgoInput[] {
  return dimResults.map((d) => ({
    code: d.code,
    classification: d.classification,
    intensity: d.intensity,
    trend: d.trend,
    confidence: d.confidence,
  }));
}
