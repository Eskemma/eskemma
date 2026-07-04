// functions/src/pestel/generateFeed.ts
// Two orquestrators:
// V2 (new): generateAnalysisV2 — 6 parallel dimension calls + chains + bias
// V1 (legacy): generateFeedFromRawData — kept for existing feeds

import * as admin from "firebase-admin";
import type {Firestore} from "firebase-admin/firestore";
import {
  analyzeDimension,
  buildImpactChains,
  classifyArticlesWithClaude,
} from "./classifier/claudePESTL";
import type {
  ClassifiedArticle,
  PESTLCategory,
  DimensionCode,
  DimensionAnalysisResult,
  EconomicDataPoint,
} from "./classifier/claudePESTL";
import {calculateRiskVector} from "./risk/vectorCalculator";
import type {InegiDataPoint} from "./scrapers/inegi";
import type {BanxicoDataPoint} from "./scrapers/banxico";

// ============================================================
// SHARED TYPES
// ============================================================

interface RawArticlesDoc {
  articles: Array<{
    title: string;
    link: string;
    pubDate: string;
    content: string;
    source: "google_news" | "dof";
  }>;
  economicData: {
    inegi: InegiDataPoint[];
    banxico: BanxicoDataPoint[];
  };
  territorio: string;
}

interface PestlVariableConfig {
  id: string;
  name: string;
  weight: number;
}

interface PestlDimensionConfig {
  code: DimensionCode;
  variables: PestlVariableConfig[];
}

// ============================================================
// V2: BIAS DETECTION (deterministic — no Claude call)
// ============================================================

interface BiasAlert {
  type: string;
  description: string;
}

/**
 * Detects bias patterns in the collected data.
 * @param {object} params Detection parameters
 * @param {DimensionAnalysisResult[]} params.dimensions Analyzed dimensions
 * @param {number} params.manualSourcesCount Number of manual data entries
 * @param {number} params.totalArticles Total articles scraped
 * @return {BiasAlert[]} Detected bias alerts
 */
function detectBiases(params: {
  dimensions: DimensionAnalysisResult[];
  manualSourcesCount: number;
  totalArticles: number;
}): BiasAlert[] {
  const {dimensions, manualSourcesCount, totalArticles} = params;
  const alerts: BiasAlert[] = [];

  // Urban bias: if territory is a capital/metro area
  // (heuristic: check all dimensions have low confidence without manual data)
  const avgConfidence =
    dimensions.reduce((s, d) => s + d.confidence, 0) / dimensions.length;

  if (avgConfidence < 60 && manualSourcesCount === 0) {
    alerts.push({
      type: "sesgo_digital",
      description:
        "El análisis se basa únicamente en fuentes digitales. " +
        "Considera agregar datos de campo o encuestas propias " +
        "para reducir el sesgo digital.",
    });
  }

  // Coverage bias: dimensions with very low confidence
  const lowConfDims = dimensions.filter((d) => d.confidence < 40);
  if (lowConfDims.length > 0) {
    const names = lowConfDims.map((d) => d.code).join(", ");
    alerts.push({
      type: "cobertura_insuficiente",
      description:
        `Dimensiones con cobertura insuficiente: ${names}. ` +
        "Confianza menor al 40%. Agrega más fuentes antes de " +
        "avanzar a la interpretación.",
    });
  }

  // Age bias: no manual data after many articles (all digital)
  const digitalRatio =
    totalArticles > 0 ?
      (totalArticles - manualSourcesCount) / totalArticles :
      1;

  if (digitalRatio > 0.85 && totalArticles > 10) {
    alerts.push({
      type: "sesgo_etario",
      description:
        "Más del 85% de las fuentes son digitales. Los grupos " +
        "sin acceso a internet pueden estar subrepresentados " +
        "en el análisis.",
    });
  }

  return alerts;
}

// ============================================================
// V2: MAIN ORCHESTRATOR
// ============================================================

interface SefixResultadoNorm {
  estado: string;
  cargo: string;
  anio: number;
  totalVotos: number;
  participacion: number;
  partidos: { partido: string; votos: number; porcentaje: number }[];
  fuente: string;
}

interface SefixData {
  // Up to 4 electoral datasets ordered by priority (new format)
  resultadosList?: SefixResultadoNorm[];
  // Legacy single-result field (kept for backward compat)
  resultados?: SefixResultadoNorm | null;
  padron: {
    estado: string;
    padronElectoral: number;
    listaNominal: number;
    corte: string;
    fuente: string;
  } | null;
}

/**
 * Formats Sefix electoral data as text for the Political dimension prompt.
 * Handles both the new resultadosList format and the legacy resultados field.
 * @param {SefixData|null} data Sefix data
 * @return {string} Formatted text block or empty string
 */
function formatSefixForPrompt(data: SefixData | null): string {
  if (!data) return "";

  // Normalize: prefer resultadosList, fall back to wrapping legacy resultados
  const list: SefixResultadoNorm[] =
    data.resultadosList ??
    (data.resultados ? [data.resultados] : []);

  if (list.length === 0 && !data.padron) return "";

  const parts: string[] = ["DATOS ELECTORALES (INE / DERFE):"];

  for (const r of list) {
    const top3 = r.partidos
      .slice(0, 3)
      .map((p) => `${p.partido}: ${p.porcentaje}%`)
      .join(", ");
    parts.push(
      `- ${r.cargo} ${r.anio} | ` +
      `Participación: ${r.participacion}% | ` +
      `Top partidos: ${top3} | Fuente: ${r.fuente}`
    );
  }

  if (data.padron) {
    const p = data.padron;
    parts.push(
      `- Padrón electoral: ${p.padronElectoral.toLocaleString()} | ` +
      `Lista nominal: ${p.listaNominal.toLocaleString()} | ` +
      `Corte: ${p.corte} | Fuente: ${p.fuente}`
    );
  }

  return parts.join("\n");
}

/**
 * Generates a V2 analysis (PestlAnalysisV2) from project data.
 * Runs 5 parallel Claude calls (one per PEST-L dimension) plus
 * 1 call for impact chains. Saves to pestel_analyses.
 * @param {object} params Orchestration parameters
 * @param {string} params.jobId Job document ID (= raw_articles doc)
 * @param {string} params.projectId Project ID
 * @param {string} params.userId User UID
 * @param {string} params.tipo Project type
 * @param {string} params.territorio Territory name
 * @param {number} params.horizonte Horizon in months
 * @param {PestlDimensionConfig[]} params.variableConfigs Variable configs
 * @param {SefixData|null} params.sefixData Electoral data (optional)
 * @param {string} params.anthropicKey Anthropic API key
 * @param {Firestore} params.db Firestore instance
 * @return {Promise<string>} analysisId of the created document
 */
export async function generateAnalysisV2(params: {
  jobId: string;
  projectId: string;
  userId: string;
  tipo: string;
  territorio: string;
  horizonte: number;
  variableConfigs: PestlDimensionConfig[];
  sefixData?: SefixData | null;
  anthropicKey: string;
  db: Firestore;
}): Promise<string> {
  const {
    jobId,
    projectId,
    userId,
    tipo,
    territorio,
    horizonte,
    variableConfigs,
    sefixData,
    anthropicKey,
    db,
  } = params;

  // 1. Read scraped articles and economic data
  const rawSnap = await db
    .collection("pestel_raw_articles")
    .doc(jobId)
    .get();

  const rawDoc = rawSnap.exists ?
    (rawSnap.data() as RawArticlesDoc) :
    null;

  const rawArticles: RawArticlesDoc["articles"] = rawDoc?.articles ?? [];
  const inegiData: EconomicDataPoint[] =
    (rawDoc?.economicData?.inegi as EconomicDataPoint[] | undefined) ?? [];
  const banxicoData: EconomicDataPoint[] =
    (rawDoc?.economicData?.banxico as EconomicDataPoint[] | undefined) ?? [];

  // 2. Read manual data sources
  const sourcesSnap = await db
    .collection("pestel_data_sources")
    .where("projectId", "==", projectId)
    .get();

  const manualByDim: Record<DimensionCode, string[]> = {
    P: [], E: [], S: [], T: [], L: [], Ec: [],
  };
  for (const doc of sourcesSnap.docs) {
    const d = doc.data();
    const code = d.dimensionCode as DimensionCode;
    if (manualByDim[code]) {
      manualByDim[code].push(d.content as string);
    }
  }

  // 3. Build raw data text per dimension
  const articlesByDim: Record<DimensionCode, string[]> = {
    P: [], E: [], S: [], T: [], L: [], Ec: [],
  };

  const dimKeywords: Record<DimensionCode, string[]> = {
    P: [
      "político", "gobierno", "partido", "elección", "candidato",
      "congreso", "diputado", "senador", "presidente",
    ],
    E: [
      "economía", "inflación", "empleo", "desempleo", "peso",
      "inversión", "pib", "precio", "banco", "finanza",
    ],
    S: [
      "social", "inseguridad", "violencia", "comunidad", "salud",
      "educación", "pobreza", "migración", "protesta",
    ],
    T: [
      "tecnología", "digital", "internet", "red social", "app",
      "ia", "inteligencia artificial", "datos", "ciberseguridad",
    ],
    L: [
      "ley", "legal", "reforma", "constitución", "decreto",
      "reglamento", "norma", "resolución", "jurídico",
    ],
    Ec: [
      "ambiental", "medio ambiente", "clima", "sequía", "inundación",
      "contaminación", "agua", "ecológico", "desastre natural",
      "cambio climático", "biodiversidad", "emisiones",
    ],
  };

  for (const article of rawArticles) {
    const text =
      `${article.title} ${article.content}`.toLowerCase();
    const assigned = new Set<DimensionCode>();
    for (const [code, kws] of Object.entries(dimKeywords)) {
      if (kws.some((kw) => text.includes(kw))) {
        assigned.add(code as DimensionCode);
      }
    }
    if (assigned.size === 0) assigned.add("P");
    for (const code of assigned) {
      const url = article.link ? ` | url: ${article.link}` : "";
      // Truncate content to keep prompts lean and within latency budget.
      const snippet = article.content.slice(0, 400);
      articlesByDim[code].push(
        `[${article.source}] ${article.title}${url}: ${snippet}`
      );
    }
  }

  // Per-dimension prompt budgets (chars):
  // - Max 8 articles × ~440 chars each ≈ 3,500 chars of news
  // - Each manual entry capped at 3,000 chars (PDFs can store up to 50,000)
  // Together these keep input tokens under ~2,000 per dimension,
  // ensuring Claude responds within the 90 s timeout.
  const MAX_ARTICLES_PER_DIM = 8;
  const MAX_MANUAL_CHARS = 3000;

  const rawDataPerDim: Record<DimensionCode, string> = {
    P: "", E: "", S: "", T: "", L: "", Ec: "",
  };
  const CODES: DimensionCode[] = ["P", "E", "S", "T", "L", "Ec"];
  const sefixText = formatSefixForPrompt(sefixData ?? null);

  for (const code of CODES) {
    const parts: string[] = [];
    if (articlesByDim[code].length > 0) {
      parts.push(
        "NOTICIAS:\n" +
        articlesByDim[code].slice(0, MAX_ARTICLES_PER_DIM).join("\n")
      );
    }
    if (manualByDim[code].length > 0) {
      const truncatedManual = manualByDim[code]
        .map((m) => m.slice(0, MAX_MANUAL_CHARS));
      parts.push("DATOS MANUALES:\n" + truncatedManual.join("\n\n"));
    }
    // Append Sefix electoral data to Political dimension
    if (code === "P" && sefixText) {
      parts.push(sefixText);
    }
    rawDataPerDim[code] = parts.join("\n\n");
  }

  // 4. Batch-parallel dimension calls (2 at a time).
  // 6-parallel caused rate-limit failures; pure sequential caused timeouts.
  // 2 concurrent per round balances speed vs. API rate limits (~5 min total).
  const BATCH_SIZE_DIM = 2;
  console.log(
    "[generateFeed] Starting dimension analyses " +
    `(${BATCH_SIZE_DIM} concurrent per batch)...`
  );
  const dimResults: DimensionAnalysisResult[] = [];
  for (let i = 0; i < CODES.length; i += BATCH_SIZE_DIM) {
    const batch = CODES.slice(i, i + BATCH_SIZE_DIM);
    console.log(`[generateFeed] Batch: ${batch.join(", ")}`);
    const batchResults = await Promise.all(
      batch.map((code) => {
        const dimConfig = variableConfigs.find((d) => d.code === code);
        const variables = dimConfig ?
          dimConfig.variables.map((v) => ({name: v.name, weight: v.weight})) :
          [];
        return analyzeDimension({
          code,
          tipo,
          territorio,
          horizonte,
          variables,
          rawData: rawDataPerDim[code],
          inegiData: code === "E" ? inegiData : undefined,
          banxicoData: code === "E" ? banxicoData : undefined,
          anthropicKey,
        }).then((result) => {
          console.log(
            `[generateFeed] ${code} done — ` +
            `confidence: ${result.confidence}, ` +
            `signal: ${result.mainSignal.slice(0, 60)}`
          );
          return result;
        });
      })
    );
    dimResults.push(...batchResults);
    // 1 s gap between batches to stay within Claude rate limits
    if (i + BATCH_SIZE_DIM < CODES.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.log("[generateFeed] Dimension analyses completed");

  // 5. Impact chains (1 additional call)
  const impactChains = await buildImpactChains({
    dimensions: dimResults,
    tipo,
    territorio,
    anthropicKey,
  });

  // 6. Bias detection (deterministic)
  const biasAlerts = detectBiases({
    dimensions: dimResults,
    manualSourcesCount: sourcesSnap.size,
    totalArticles: rawArticles.length + sourcesSnap.size,
  });

  // 7. Weighted global confidence
  let totalWeight = 0;
  let weightedSum = 0;
  for (const dim of dimResults) {
    const dimConfig = variableConfigs.find((d) => d.code === dim.code);
    const dimWeight = dimConfig ?
      dimConfig.variables.reduce((s, v) => s + v.weight, 0) :
      3;
    weightedSum += dim.confidence * dimWeight;
    totalWeight += dimWeight;
  }
  const globalConfidence =
    totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const status =
    globalConfidence < 50 ? "PENDING_REVIEW" : "REVIEWED";

  // 8. Invalidate previous analyses for this project
  const prevSnap = await db
    .collection("pestel_analyses")
    .where("projectId", "==", projectId)
    .where("vigente", "==", true)
    .get();

  const batch = db.batch();
  prevSnap.forEach((doc) => batch.update(doc.ref, {vigente: false}));
  await batch.commit();

  // 9. Save PestlAnalysisV2
  const analysisRef = db.collection("pestel_analyses").doc();
  const prevVersion =
    prevSnap.empty ? 0 : (prevSnap.docs[0].data().version as number ?? 0);

  await analysisRef.set({
    projectId,
    userId,
    version: prevVersion + 1,
    analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
    globalConfidence,
    dimensions: dimResults,
    impactChains,
    biasAlerts,
    status,
    vigente: true,
  });

  // 10. Update project stage to 5
  await db
    .collection("pestel_projects")
    .doc(projectId)
    .update({
      currentStage: 5,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(
    `[generateFeed] V2 analysis created: ${analysisRef.id} ` +
      `— confidence: ${globalConfidence}`
  );
  return analysisRef.id;
}

// ============================================================
// V1: LEGACY ORCHESTRATOR (kept for existing feeds)
// ============================================================

interface Factor {
  descripcion: string;
  impacto: "alto" | "medio" | "bajo";
  sentiment: number;
  fuente: string;
  isManual: boolean;
}

interface DimensionPESTL {
  contexto: string;
  factores: Factor[];
  tendencia: "creciente" | "estable" | "decreciente";
  fuentes: string[];
}

interface PESTLAnalysis {
  politico: DimensionPESTL;
  economico: DimensionPESTL;
  social: DimensionPESTL;
  tecnologico: DimensionPESTL;
  legal: DimensionPESTL;
}

const CATEGORY_TO_KEY: Record<PESTLCategory, keyof PESTLAnalysis> = {
  "Político": "politico",
  "Económico": "economico",
  "Social": "social",
  "Tecnológico": "tecnologico",
  "Legal": "legal",
};

/**
 * Calculates trend from classified articles.
 * @param {ClassifiedArticle[]} articles Articles in the dimension
 * @return {"creciente"|"estable"|"decreciente"} Calculated trend
 */
function calcTendencia(
  articles: ClassifiedArticle[]
): "creciente" | "estable" | "decreciente" {
  if (articles.length === 0) return "estable";
  const avg =
    articles.reduce((sum, a) => sum + a.sentiment, 0) / articles.length;
  if (avg < -0.3) return "creciente";
  if (avg > 0.3) return "decreciente";
  return "estable";
}

/**
 * Builds a DimensionPESTL from classified articles.
 * @param {ClassifiedArticle[]} articles Articles in the category
 * @return {DimensionPESTL} Dimension object with factors and sources
 */
function buildDimension(articles: ClassifiedArticle[]): DimensionPESTL {
  const factores: Factor[] = articles.map((a) => ({
    descripcion: a.factor,
    impacto: a.impact,
    sentiment: a.sentiment,
    fuente: `"${a.title}" — ${a.link}`,
    isManual: false,
  }));

  const contexto =
    factores.length > 0 ?
      factores.map((f) => f.descripcion).join(". ") :
      "Sin factores identificados en este período.";

  const fuentes = [...new Set(articles.map((a) => a.link).filter(Boolean))];

  return {contexto, factores, tendencia: calcTendencia(articles), fuentes};
}

/**
 * Returns an empty DimensionPESTL for dimensions with no data.
 * @return {DimensionPESTL} Empty dimension object
 */
function emptyDimension(): DimensionPESTL {
  return {
    contexto: "Sin información disponible para este período.",
    factores: [],
    tendencia: "estable",
    fuentes: [],
  };
}

/**
 * Legacy orchestrator: reads raw articles, classifies with Claude,
 * calculates risk indices and saves to pestel_feeds.
 * @param {object} params Feed generation parameters
 * @param {string} params.jobId Job / raw_articles doc ID
 * @param {string} params.configId Config document ID
 * @param {string} params.userId User UID
 * @param {"ciudadano"|"gubernamental"} params.modo Analysis mode
 * @param {string} params.anthropicKey Anthropic API key
 * @param {Firestore} params.db Firestore instance
 * @return {Promise<string>} feedId of the created document
 */
export async function generateFeedFromRawData(params: {
  jobId: string;
  configId: string;
  userId: string;
  modo: "ciudadano" | "gubernamental";
  anthropicKey: string;
  db: Firestore;
}): Promise<string> {
  const {jobId, configId, userId, modo, anthropicKey, db} = params;

  const rawSnap = await db
    .collection("pestel_raw_articles")
    .doc(jobId)
    .get();

  if (!rawSnap.exists) {
    throw new Error(`pestel_raw_articles/${jobId} not found`);
  }

  const raw = rawSnap.data() as RawArticlesDoc;

  console.log(
    `[generateFeed] Classifying ${raw.articles.length} articles...`
  );
  const classified = await classifyArticlesWithClaude(
    raw.articles,
    anthropicKey
  );
  console.log(`[generateFeed] ${classified.length} articles classified`);

  const byDimension: Record<keyof PESTLAnalysis, ClassifiedArticle[]> = {
    politico: [],
    economico: [],
    social: [],
    tecnologico: [],
    legal: [],
  };

  for (const article of classified) {
    for (const category of article.categories) {
      const key = CATEGORY_TO_KEY[category];
      if (key) byDimension[key].push(article);
    }
  }

  const pestl: PESTLAnalysis = {
    politico: byDimension.politico.length > 0 ?
      buildDimension(byDimension.politico) :
      emptyDimension(),
    economico: byDimension.economico.length > 0 ?
      buildDimension(byDimension.economico) :
      emptyDimension(),
    social: byDimension.social.length > 0 ?
      buildDimension(byDimension.social) :
      emptyDimension(),
    tecnologico: byDimension.tecnologico.length > 0 ?
      buildDimension(byDimension.tecnologico) :
      emptyDimension(),
    legal: byDimension.legal.length > 0 ?
      buildDimension(byDimension.legal) :
      emptyDimension(),
  };

  const {vectorRiesgo, indicePresionSocial, indiceClimaInversion} =
    calculateRiskVector({
      classifiedArticles: classified,
      economicData: raw.economicData,
      modo,
    });

  const prevFeeds = await db
    .collection("pestel_feeds")
    .where("configId", "==", configId)
    .where("vigente", "==", true)
    .get();

  const batch = db.batch();
  prevFeeds.forEach((doc) => batch.update(doc.ref, {vigente: false}));
  await batch.commit();

  const feedRef = db.collection("pestel_feeds").doc();
  await feedRef.set({
    id: feedRef.id,
    configId,
    userId,
    generadoEn: admin.firestore.FieldValue.serverTimestamp(),
    territorio: raw.territorio,
    vigente: true,
    pestl,
    vectorRiesgo,
    indicePresionSocial,
    indiceClimaInversion,
    syncedToModdulo: false,
  });

  console.log(
    `[generateFeed] Legacy feed created: ${feedRef.id} ` +
      `— riesgo: ${vectorRiesgo}`
  );
  return feedRef.id;
}
