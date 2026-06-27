// functions/src/pestel/risk/vectorCalculator.ts
// Calcula el Vector de Riesgo y los índices derivados a partir de los
// artículos clasificados y los indicadores económicos.
// Cálculo determinista — no requiere Claude API.

import type {ClassifiedArticle} from "../classifier/claudePESTL";
import type {InegiDataPoint} from "../scrapers/inegi";
import type {BanxicoDataPoint} from "../scrapers/banxico";

// Series de referencia para penalizaciones económicas
const INEGI_INPC_SERIE = "628229";
const BANXICO_FX_SERIE = "SF43718";
const INFLATION_THRESHOLD = 5.0; // % anual
const FX_INCREASE_THRESHOLD = 3.0; // % de incremento en tipo de cambio

export interface RiskInput {
  classifiedArticles: ClassifiedArticle[];
  economicData: {
    inegi: InegiDataPoint[];
    banxico: BanxicoDataPoint[];
  };
  modo: "ciudadano" | "gubernamental";
}

export interface RiskOutput {
  vectorRiesgo: number;
  indicePresionSocial: number;
  indiceClimaInversion: number;
}

/**
 * Convierte un valor de sentimiento [-1, 1] a escala de riesgo [0, 100].
 * Sentimiento negativo → mayor riesgo.
 * @param {number} sentiment Valor de sentimiento
 * @return {number} Puntuación de riesgo en escala 0-100
 */
function sentimentToRisk(sentiment: number): number {
  return (sentiment * -50) + 50;
}

/**
 * Limita un valor al rango [0, 100] y lo redondea a entero.
 * @param {number} value Valor a normalizar
 * @return {number} Valor normalizado
 */
function clamp(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

/**
 * Calcula el promedio de un arreglo numérico.
 * Retorna 50 (neutral) si el arreglo está vacío.
 * @param {number[]} values Valores a promediar
 * @return {number} Promedio o 50 si vacío
 */
function average(values: number[]): number {
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calcula el Vector de Riesgo de Entorno y los índices derivados
 * a partir de artículos clasificados e indicadores económicos.
 * @param {RiskInput} input Datos de entrada
 * @return {RiskOutput} Índices calculados (0-100)
 */
export function calculateRiskVector(input: RiskInput): RiskOutput {
  const {classifiedArticles, economicData} = input;

  if (classifiedArticles.length === 0) {
    return {
      vectorRiesgo: 50,
      indicePresionSocial: 50,
      indiceClimaInversion: 50,
    };
  }

  // Puntuaciones de riesgo por artículo (0-100, donde 100 = máximo riesgo)
  const allScores = classifiedArticles.map((a) => sentimentToRisk(a.sentiment));

  // Filtrar por categoría
  const politicalScores = classifiedArticles
    .filter((a) =>
      a.categories.includes("Político") || a.categories.includes("Legal")
    )
    .map((a) => sentimentToRisk(a.sentiment));

  const socialScores = classifiedArticles
    .filter((a) => a.categories.includes("Social"))
    .map((a) => sentimentToRisk(a.sentiment));

  const economicScores = classifiedArticles
    .filter((a) => a.categories.includes("Económico"))
    .map((a) => sentimentToRisk(a.sentiment));

  // Puntuación base por categoría
  const sentimentScore = average(allScores);
  const politicalScore = average(politicalScores);
  let economicScore = average(economicScores);

  // Penalización económica por inflación elevada (INEGI)
  const inegiInpc = economicData.inegi.find(
    (d) => d.serieId === INEGI_INPC_SERIE
  );
  if (inegiInpc && inegiInpc.value > INFLATION_THRESHOLD) {
    const penalty = Math.min(20, (inegiInpc.value - INFLATION_THRESHOLD) * 4);
    economicScore = Math.min(100, economicScore + penalty);
  }

  // Penalización económica por tipo de cambio elevado (Banxico)
  const banxicoFx = economicData.banxico.find(
    (d) => d.date === BANXICO_FX_SERIE
  );
  if (banxicoFx && banxicoFx.value > FX_INCREASE_THRESHOLD) {
    economicScore = Math.min(100, economicScore + 10);
  }

  // Vector de Riesgo ponderado
  const vectorRiesgo =
    sentimentScore * 0.5 +
    politicalScore * 0.3 +
    economicScore * 0.2;

  // Índice de Presión Social
  const indicePresionSocial = average(socialScores);

  // Índice de Clima de Inversión — inversamente proporcional al riesgo
  const indiceClimaInversion = 100 - economicScore;

  return {
    vectorRiesgo: clamp(vectorRiesgo),
    indicePresionSocial: clamp(indicePresionSocial),
    indiceClimaInversion: clamp(indiceClimaInversion),
  };
}
