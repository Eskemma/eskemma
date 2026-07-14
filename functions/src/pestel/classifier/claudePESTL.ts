// functions/src/pestel/classifier/claudePESTL.ts
// Two modes of operation:
// V1 (legacy): classifyArticlesWithClaude — batch classification
// V2 (new): analyzeDimension — per-dimension deep analysis
//            buildImpactChains — cross-dimensional chains

import Anthropic from "@anthropic-ai/sdk";
import type {RawArticle} from "../scrapers/googleNewsRSS";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const BATCH_SIZE = 10;
const MIN_TITLE_LENGTH = 20;

// ============================================================
// V1 TYPES (legacy — kept for backward compat)
// ============================================================

export type PESTLCategory =
  | "Político"
  | "Económico"
  | "Social"
  | "Tecnológico"
  | "Legal";

export interface ClassifiedArticle {
  title: string;
  link: string;
  pubDate: string;
  source: "google_news" | "dof";
  categories: PESTLCategory[];
  impact: "alto" | "medio" | "bajo";
  sentiment: number;
  factor: string;
}

interface ClaudeClassificationResult {
  index: number;
  categories: PESTLCategory[];
  impact: "alto" | "medio" | "bajo";
  sentiment: number;
  factor: string;
}

// ============================================================
// V2 TYPES
// ============================================================

// C2: "Ec" is the new 6th dimension (Ecológico). "L" is now Legal only.
export type DimensionCode = "P" | "E" | "S" | "T" | "L" | "Ec";

export interface DimensionVariable {
  name: string;
  weight: number;
}

// C3: individual tripartite signal
export interface Senal {
  descripcion: string;
  fuente: string;
  fechaCorte: string;
  nivelConfianza: "alto" | "medio" | "bajo";
  origenInternacional: boolean;
}

export interface DimensionAnalysisResult {
  code: DimensionCode;
  trend: "ASCENDENTE" | "DESCENDENTE" | "ESTABLE";
  intensity: "ALTA" | "MEDIA" | "BAJA";
  mainSignal: string;
  narrative: string;
  classification: "OPORTUNIDAD" | "AMENAZA" | "NEUTRAL";
  confidence: number;
  // C3: tripartite signals (may be absent in legacy responses)
  senalesFavorables?: Senal[];
  senalesAdversas?: Senal[];
  senalesInciertas?: Senal[];
  // Set when all parse attempts failed with rawData present (not "no data")
  processingError?: true;
}

export interface ImpactChainResult {
  dimensions: DimensionCode[];
  description: string;
  riskLevel: "CRÍTICO" | "MODERADO" | "BAJO";
  recommendation: string;
}

interface DimensionRawOutput {
  tendencia: "ASCENDENTE" | "DESCENDENTE" | "ESTABLE";
  intensidad: "ALTA" | "MEDIA" | "BAJA";
  señal_principal: string;
  narrativa: string;
  clasificación: "OPORTUNIDAD" | "AMENAZA" | "NEUTRAL";
  confianza: number;
  // C3: tripartite signals from Claude
  señalesFavorables?: Senal[];
  señalesAdversas?: Senal[];
  señalesInciertas?: Senal[];
}

// ============================================================
// HELPERS
// ============================================================

export interface EconomicDataPoint {
  series?: string;
  name?: string;
  value?: number | string;
  date?: string;
  period?: string;
  source?: "INEGI" | "Banxico" | "BISE";
}

const DIMENSION_NAMES: Record<DimensionCode, string> = {
  P: "Político",
  E: "Económico",
  S: "Social",
  T: "Tecnológico",
  L: "Legal",
  Ec: "Ecológico",
};

const TIPO_DESCRIPTIONS: Record<string, string> = {
  electoral: "campaña política o proceso electoral",
  gubernamental: "gestión de un gobierno en ejercicio",
  legislativo: "proceso legislativo o actuación de una bancada",
  ciudadano: "movimiento social u organización civil",
};

// Marco legal-electoral vigente en México (actualizado 2024).
// Inyectar en prompts de tipo "electoral" y "gubernamental".
const MEXICAN_LEGAL_CONTEXT = `
MARCO LEGAL VIGENTE EN MÉXICO (usar solo esta terminología):
- INE: Instituto Nacional Electoral (reemplazó al IFE en 2014)
- LGIPE: Ley General de Instituciones y Procedimientos Electorales (2014)
- LGPP: Ley General de Partidos Políticos (2014)
- TEPJF: Tribunal Electoral del Poder Judicial de la Federación
- OPLES: Organismos Públicos Locales Electorales (antes IEE)
- SCJN: Suprema Corte de Justicia de la Nación
NO mencionar: COFIPE, IFE, TRIFE (derogados/extintos).
`.trim();

/**
 * Extracts a JSON value from a Claude response string.
 * @param {string} text Raw response text from Claude
 * @return {unknown} Parsed JSON value or null
 */
function extractJson(text: string): unknown {
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // fall through
    }
  }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // fall through
    }
  }
  return null;
}

// ============================================================
// V2: PER-DIMENSION ANALYSIS
// ============================================================

/**
 * Formats economic data points for inclusion in a prompt.
 * @param {EconomicDataPoint[]} points Data points to format
 * @return {string} Formatted text block
 */
function formatEconomicData(points: EconomicDataPoint[]): string {
  if (!points || points.length === 0) return "";
  return points
    .slice(0, 20)
    .map((p) => {
      const label = p.name ?? p.series ?? "Indicador";
      const val = p.value ?? "N/D";
      const period = p.period ?? p.date ?? "";
      const src = p.source ?? "INEGI";
      return `- ${label}: ${val} | período: ${period} | fuente: ${src}`;
    })
    .join("\n");
}

/**
 * Builds the per-dimension PEST-L analysis prompt.
 * @param {object} params Prompt parameters
 * @param {DimensionCode} params.code Dimension code
 * @param {string} params.tipo Project type
 * @param {string} params.territorio Territory name
 * @param {number} params.horizonte Horizon in months
 * @param {DimensionVariable[]} params.variables Variables with weights
 * @param {string} params.rawData Articles and manual data as text
 * @param {EconomicDataPoint[]} params.inegiData INEGI indicators (dim E)
 * @param {EconomicDataPoint[]} params.banxicoData Banxico series (dim E)
 * @param {EconomicDataPoint[]} params.biseData BISE population data (dim S)
 * @return {string} Formatted prompt
 */
function buildDimensionPrompt(params: {
  code: DimensionCode;
  tipo: string;
  territorio: string;
  horizonte: number;
  variables: DimensionVariable[];
  rawData: string;
  inegiData?: EconomicDataPoint[];
  banxicoData?: EconomicDataPoint[];
  biseData?: EconomicDataPoint[];
}): string {
  const {
    code, tipo, territorio, horizonte, variables, rawData,
    banxicoData, biseData,
  } = params;
  const dimName = DIMENSION_NAMES[code];
  const tipoDesc = TIPO_DESCRIPTIONS[tipo] ?? tipo;
  const varsText = variables
    .map((v) => `- ${v.name} (peso ${v.weight}/5)`)
    .join("\n");

  const useLegalCtx =
    tipo === "electoral" || tipo === "gubernamental";

  const banxicoText = formatEconomicData(banxicoData ?? []);

  // Always include the economic block for dim E so Claude knows INEGI BIE
  // is unavailable and never cites it.
  const economicBlock = code === "E" ?
    "\nBANXICO (Banco de México — series verificadas SP1/SF43718/SF61745):\n" +
    (banxicoText ?
      banxicoText + "\n" :
      "(sin datos disponibles en esta consulta)\n") +
    "INEGI indicadores económicos: NO DISPONIBLE " +
    "(IDs de series BIE inválidos — datos no obtenidos). " +
    "No cites INEGI como fuente de datos económicos.\n" :
    "";

  const biseText = formatEconomicData(biseData ?? []);
  const biseBlock = code === "S" && biseText ?
    "\nDATOS DEMOGRÁFICOS (INEGI/BISE — Censo de Población" +
    " y Vivienda, datos quinquenales/decenales):\n" +
    biseText :
    "";

  const ecologicoCtx = code === "Ec" ? `
DIMENSIÓN ECOLÓGICA — enfocar el análisis en:
- Cambio climático y eventos climáticos extremos con impacto político
- Recursos hídricos y disputas por agua
- Política ambiental: normas, sanciones, litigios, movilización
- Desastres naturales y respuesta gubernamental
- Presión de grupos ambientalistas o movimientos "por la naturaleza"
No abordar factores legales ni económicos generales aquí (están en \
L y E respectivamente).
`.trim() : "";

  const legalBlock = useLegalCtx ? `\n${MEXICAN_LEGAL_CONTEXT}\n` : "";
  const ecoBlock = ecologicoCtx ? `\n${ecologicoCtx}\n` : "";

  return `Eres un consultor experto en comunicación política en \
Latinoamérica. Analiza la dimensión ${dimName} del análisis PEST-L.

CONTEXTO DEL PROYECTO:
- Tipo de proyecto: ${tipoDesc}
- Territorio: ${territorio}
- Horizonte temporal: ${horizonte} meses
${legalBlock}${ecoBlock}
VARIABLES MONITOREADAS:
${varsText}

DATOS RECOLECTADOS:
${rawData || "Sin datos disponibles para este período."}
${economicBlock}${biseBlock}
INSTRUCCIONES:
- Usa solo terminología vigente para el contexto mexicano.
- CITAS EN NARRATIVA — REGLAS OBLIGATORIAS:
  * Cita solo fuentes presentes en los bloques de datos anteriores.
  * La fecha en la cita debe ser EXACTAMENTE el campo 'período' del \
dato citado (ej. el período de la serie Banxico). Nunca la fecha \
actual ni una fecha inferida. Si el dato no tiene período propio, \
omite la fecha de la cita.
  * Formatos válidos ÚNICAMENTE: 'Banxico, YYYY-MM-DD' | \
'Google News, YYYY-MM' | 'DOF, YYYY-MM-DD' | \
'INEGI/BISE, año' (solo datos de población).
  * NO cites 'INEGI' ni 'INEGI/Banxico' para datos económicos: \
esa fuente no tiene datos en esta consulta.
  * Si no puedes atribuir un dato a alguna de esas fuentes, \
no cites — no inventes fuentes ni fechas.
  * Máx. 3 citas por narrativa.
- En señalesFavorables/Adversas/Inciertas:
  * fuente: usa SOLO 'Banxico', 'Google News', 'DOF', o 'INEGI/BISE' \
(esta última solo para datos de población). Si el dato no proviene \
de ninguno de esos bloques, deja fuente = ''.
  * fechaCorte: usa el campo 'período' del dato si es de Banxico o \
INEGI/BISE, o la fecha de la noticia si es de Google News/DOF. \
Nunca la fecha actual. Si no hay fecha disponible, escribe 'sin fecha'.
  * origenInternacional: true solo si la fuente es extranjera.

Responde ÚNICAMENTE con un objeto JSON con esta estructura exacta:
{
  "tendencia": "ASCENDENTE" | "DESCENDENTE" | "ESTABLE",
  "intensidad": "ALTA" | "MEDIA" | "BAJA",
  "señal_principal": "máx. 150 chars describiendo el hallazgo clave",
  "narrativa": "2-3 párrafos con el análisis detallado",
  "clasificación": "OPORTUNIDAD" | "AMENAZA" | "NEUTRAL",
  "confianza": número entre 0 y 100,
  "señalesFavorables": [
    {
      "descripcion": "...",
      "fuente": "...",
      "fechaCorte": "YYYY-MM-DD",
      "nivelConfianza": "alto" | "medio" | "bajo",
      "origenInternacional": false
    }
  ],
  "señalesAdversas": [...],
  "señalesInciertas": [...]
}

Incluye entre 1 y 3 señales por categoría según los datos \
disponibles. Si no hay señales de una categoría, usa array vacío [].
La confianza debe reflejar la calidad y cantidad de datos disponibles.
Sin datos suficientes asigna confianza menor a 50.`;
}

/**
 * Calls Claude to analyze one PEST-L dimension in depth.
 * @param {object} params Analysis parameters
 * @param {DimensionCode} params.code Dimension to analyze
 * @param {string} params.tipo Project type
 * @param {string} params.territorio Territory name
 * @param {number} params.horizonte Horizon in months
 * @param {DimensionVariable[]} params.variables Variables with weights
 * @param {string} params.rawData Scraped + manual data as text
 * @param {EconomicDataPoint[]} params.inegiData INEGI indicators (E dim)
 * @param {EconomicDataPoint[]} params.banxicoData Banxico series (E dim)
 * @param {EconomicDataPoint[]} params.biseData BISE population data (S dim)
 * @param {string} params.anthropicKey Anthropic API key
 * @return {Promise<DimensionAnalysisResult>} Dimension analysis
 */
export async function analyzeDimension(params: {
  code: DimensionCode;
  tipo: string;
  territorio: string;
  horizonte: number;
  variables: DimensionVariable[];
  rawData: string;
  inegiData?: EconomicDataPoint[];
  banxicoData?: EconomicDataPoint[];
  biseData?: EconomicDataPoint[];
  anthropicKey: string;
}): Promise<DimensionAnalysisResult> {
  const {code, anthropicKey} = params;
  const client = new Anthropic({apiKey: anthropicKey});
  const prompt = buildDimensionPrompt(params);

  let raw: DimensionRawOutput = {
    tendencia: "ESTABLE",
    intensidad: "BAJA",
    señal_principal: "Sin datos suficientes.",
    narrativa: "No hay información disponible para esta dimensión.",
    clasificación: "NEUTRAL",
    confianza: 0,
  };

  let currentMaxTokens = 2048;
  let parsedSuccessfully = false;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    // 90 s gives Claude room to complete output tokens under API load.
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await client.messages.create(
        {
          model: CLAUDE_MODEL,
          max_tokens: currentMaxTokens,
          messages: [{role: "user", content: prompt}],
        },
        {signal: controller.signal}
      );

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

      const parsed = extractJson(text) as DimensionRawOutput | null;
      clearTimeout(timeoutId);

      if (parsed && typeof parsed === "object") {
        raw = {...raw, ...parsed};
        parsedSuccessfully = true;
        break; // valid JSON received — done
      }

      // JSON parse failed: log and retry (malformed or truncated response)
      console.warn(
        `[claudePESTL] analyzeDimension ${code} attempt ${attempt}: ` +
        `JSON parse failed. stop_reason=${response.stop_reason}, ` +
        `output_tokens=${response.usage?.output_tokens ?? "?"}, ` +
        `response_snippet=${text.slice(0, 120)}`
      );
      if (attempt >= MAX_ATTEMPTS) break;

      if (response.stop_reason === "max_tokens") {
        // Deterministic truncation: scale tokens so next attempt completes.
        currentMaxTokens = Math.min(currentMaxTokens * 2, 4096);
        console.warn(
          `[claudePESTL] dim ${code} truncated, retrying with ` +
          `max_tokens=${currentMaxTokens}`
        );
      } else {
        // Non-deterministic parse failure: brief delay before retry.
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("rate") ||
          error.message.includes("overloaded") ||
          error.name === "AbortError");

      if (attempt < MAX_ATTEMPTS && isRetryable) {
        const backoff = 2000 * attempt; // 2 s, 4 s
        console.warn(
          `[claudePESTL] analyzeDimension ${code} attempt ${attempt} failed ` +
          `(${error instanceof Error ? error.message : "unknown"}), ` +
          `retrying in ${backoff / 1000}s...`
        );
        await new Promise((r) => setTimeout(r, backoff));
      } else {
        console.error(
          `[claudePESTL] analyzeDimension ${code} failed ` +
          `after ${attempt} attempt(s):`,
          error
        );
        break;
      }
    }
  }

  return {
    code,
    trend: raw.tendencia ?? "ESTABLE",
    intensity: raw.intensidad ?? "BAJA",
    mainSignal: (raw.señal_principal ?? "").substring(0, 150),
    narrative: raw.narrativa ?? "",
    classification: raw.clasificación ?? "NEUTRAL",
    confidence: Math.max(0, Math.min(100, raw.confianza ?? 0)),
    senalesFavorables: raw.señalesFavorables ?? [],
    senalesAdversas: raw.señalesAdversas ?? [],
    senalesInciertas: raw.señalesInciertas ?? [],
    ...(!parsedSuccessfully && !!params.rawData?.trim() ?
      {processingError: true as const} : {}),
  };
}

// ============================================================
// V2: IMPACT CHAINS
// ============================================================

/**
 * Generates cross-dimensional impact chains from dimension narratives.
 * @param {object} params Parameters
 * @param {Array} params.dimensions Analyzed dimensions
 * @param {string} params.tipo Project type
 * @param {string} params.territorio Territory name
 * @param {string} params.anthropicKey Anthropic API key
 * @return {Promise<ImpactChainResult[]>} 2-5 impact chains
 */
export async function buildImpactChains(params: {
  dimensions: DimensionAnalysisResult[];
  tipo: string;
  territorio: string;
  anthropicKey: string;
}): Promise<ImpactChainResult[]> {
  const {dimensions, tipo, territorio, anthropicKey} = params;
  const client = new Anthropic({apiKey: anthropicKey});

  const narratives = dimensions
    .map(
      (d) =>
        `${DIMENSION_NAMES[d.code]} (${d.classification}):\n` +
        `Señal: ${d.mainSignal}\n` +
        `Narrativa: ${d.narrative.substring(0, 300)}`
    )
    .join("\n\n");

  const tipoDesc = TIPO_DESCRIPTIONS[tipo] ?? tipo;

  const prompt = `Eres un analista experto en comunicación política. \
Basado en el siguiente análisis PEST-L para un proyecto de ${tipoDesc} \
en ${territorio}, identifica 2-5 cadenas de impacto transversales.

${narratives}

Una cadena de impacto describe cómo un factor en una dimensión \
desencadena efectos en otras dimensiones.

Responde ÚNICAMENTE con un JSON array:
[{
  "dimensions": ["P","E"] (2+ códigos de dimensión involucrados),
  "description": "máx. 200 caracteres describiendo la cadena",
  "riskLevel": "CRÍTICO" | "MODERADO" | "BAJO",
  "recommendation": "máx. 100 caracteres con acción recomendada"
}]`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await client.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{role: "user", content: prompt}],
      },
      {signal: controller.signal}
    );

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = extractJson(text) as ImpactChainResult[] | null;
    if (Array.isArray(parsed)) {
      return parsed
        .slice(0, 5)
        .map((c) => ({
          dimensions: (c.dimensions ?? []).slice(0, 5) as DimensionCode[],
          description: (c.description ?? "").substring(0, 200),
          riskLevel: c.riskLevel ?? "BAJO",
          recommendation: (c.recommendation ?? "").substring(0, 100),
        }));
    }
  } catch (error) {
    console.error("[claudePESTL] buildImpactChains failed:", error);
  } finally {
    clearTimeout(timeoutId);
  }

  return [];
}

// ============================================================
// V1: LEGACY BATCH CLASSIFICATION (kept for legacy feeds)
// ============================================================

/**
 * Extracts a JSON array from a Claude response string.
 * @param {string} text Raw response text from Claude
 * @return {ClaudeClassificationResult[]} Parsed results or empty array
 */
function extractJsonFromResponse(
  text: string
): ClaudeClassificationResult[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    return JSON.parse(jsonMatch[0]) as ClaudeClassificationResult[];
  } catch {
    return [];
  }
}

/**
 * Builds the batch classification prompt.
 * @param {RawArticle[]} articles Articles to classify
 * @return {string} Formatted prompt
 */
function buildClassificationPrompt(articles: RawArticle[]): string {
  const articlesList = articles
    .map((a, i) => `[${i + 1}] Título: ${a.title}\nContenido: ${a.content}`)
    .join("\n\n");

  return `Eres un analista político especializado en México. Analiza \
las siguientes ${articles.length} noticias y clasifícalas según PEST-L.

Para cada noticia proporciona:
- categories: array con una o más de \
["Político","Económico","Social","Tecnológico","Legal"]
- impact: "alto" | "medio" | "bajo"
- sentiment: número de -1.0 a 1.0
- factor: resumen del factor identificado (máx. 100 caracteres)

NOTICIAS:
${articlesList}

Responde ÚNICAMENTE con un JSON array:
[{"index":1,"categories":[...],"impact":"...","sentiment":0.0,\
"factor":"..."}]`;
}

/**
 * Classifies one batch of articles with Claude.
 * @param {RawArticle[]} batch Articles in the batch
 * @param {Anthropic} client Anthropic client instance
 * @return {Promise<ClassifiedArticle[]>} Classified articles
 */
async function classifyBatch(
  batch: RawArticle[],
  client: Anthropic
): Promise<ClassifiedArticle[]> {
  const prompt = buildClassificationPrompt(batch);
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{role: "user", content: prompt}],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const results = extractJsonFromResponse(text);
  return results
    .filter((r) => r.index >= 1 && r.index <= batch.length)
    .map((r) => {
      const article = batch[r.index - 1];
      return {
        title: article.title,
        link: article.link,
        pubDate: article.pubDate,
        source: article.source,
        categories: r.categories || [],
        impact: r.impact || "bajo",
        sentiment: Math.max(-1, Math.min(1, r.sentiment ?? 0)),
        factor: r.factor || article.title,
      };
    });
}

/**
 * Legacy: classifies raw articles into PEST-L dimensions using Claude.
 * Processes in batches of up to 10 articles.
 * @param {RawArticle[]} articles Raw articles to classify
 * @param {string} anthropicKey Anthropic API key
 * @return {Promise<ClassifiedArticle[]>} Classified articles with PEST-L
 */
export async function classifyArticlesWithClaude(
  articles: RawArticle[],
  anthropicKey: string
): Promise<ClassifiedArticle[]> {
  if (!anthropicKey) {
    console.warn("[claudePESTL] ANTHROPIC_API_KEY not set — skipping");
    return [];
  }

  const filtered = articles.filter(
    (a) => a.title && a.title.length >= MIN_TITLE_LENGTH
  );

  if (filtered.length === 0) {
    console.warn("[claudePESTL] No valid articles to classify");
    return [];
  }

  const client = new Anthropic({apiKey: anthropicKey});
  const classified: ClassifiedArticle[] = [];

  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);
    try {
      const batchResults = await classifyBatch(batch, client);
      classified.push(...batchResults);
      console.log(
        `[claudePESTL] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ` +
          `${batchResults.length}/${batch.length} classified`
      );
    } catch (error) {
      console.error(
        `[claudePESTL] Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`,
        error
      );
    }

    if (i + BATCH_SIZE < filtered.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(
    `[claudePESTL] Total: ${classified.length}/${filtered.length}`
  );
  return classified;
}
