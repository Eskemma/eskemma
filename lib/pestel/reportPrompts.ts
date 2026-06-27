// lib/pestel/reportPrompts.ts
// Constructs the Claude prompts for the 4 E7 report formats.
// No external dependencies — pure string builders.

import type {
  PestlAnalysisV2,
  DimensionAnalysis,
  PestlDimensionConfig,
  HumanAdjustment,
  TipoProyecto,
} from "@/types/pestel.types";
import {
  buildScorecard,
  getHighStakeDimensions,
} from "@/lib/pestel/matrizUtils";

export type ReportFormat = "executive" | "technical" | "foda" | "scenarios";

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

interface ReportContext {
  analysis: PestlAnalysisV2;
  variableConfigs: PestlDimensionConfig[];
  projectName: string;
  projectType: TipoProyecto;
  territorioNombre: string;
}

/**
 * Returns the full prompt string for the given report format.
 * This is passed directly as the user message to Claude.
 */
export function buildReportPrompt(
  format: ReportFormat,
  ctx: ReportContext
): { systemPrompt: string; userPrompt: string; maxTokens: number } {
  const base = buildBaseContext(ctx);

  switch (format) {
    case "executive":
      return {
        systemPrompt: SYSTEM_CONSULTANT,
        userPrompt: `${base}\n\n${EXECUTIVE_INSTRUCTIONS(ctx.projectType)}`,
        maxTokens: 4000,
      };
    case "technical":
      return {
        systemPrompt: SYSTEM_CONSULTANT,
        userPrompt: `${base}\n\n${TECHNICAL_INSTRUCTIONS}`,
        maxTokens: 6000,
      };
    case "foda":
      return {
        systemPrompt: SYSTEM_CONSULTANT,
        userPrompt: `${base}\n\n${FODA_INSTRUCTIONS}`,
        maxTokens: 2000,
      };
    case "scenarios":
      return {
        systemPrompt: SYSTEM_CONSULTANT,
        userPrompt: buildScenariosPrompt(base, ctx),
        maxTokens: 6000,
      };
  }
}

// ─────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────

const SYSTEM_CONSULTANT = `Eres un consultor senior de comunicación y estrategia política en México con 20 años de experiencia.
Redactas en español formal pero accesible. Tus análisis son precisos, concretos y orientados a la acción.
Cuando citas datos, usas el formato (Fuente: nombre, fecha). Nunca inventas datos que no están en el contexto.`;

// ─────────────────────────────────────────────────────────────
// Base context (shared by all formats)
// ─────────────────────────────────────────────────────────────

function buildBaseContext(ctx: ReportContext): string {
  const { analysis, variableConfigs, projectName, projectType, territorioNombre } = ctx;
  const scorecard = buildScorecard(analysis.dimensions, variableConfigs);
  const date = formatDate(analysis.analyzedAt);

  const dimensionsText = analysis.dimensions
    .map((d) => formatDimension(d, analysis.adjustments))
    .join("\n\n");

  const impactChainsText =
    analysis.impactChains.length > 0
      ? analysis.impactChains
          .map(
            (c) =>
              `  [${c.dimensions.join("→")}] ${c.description} — Riesgo: ${c.riskLevel}\n  Recomendación: ${c.recommendation}`
          )
          .join("\n")
      : "  Sin cadenas de impacto identificadas.";

  const scorecardText = scorecard.dimensions
    .map(
      (d) =>
        `  ${d.code} | ${analysis.dimensions.find((x) => x.code === d.code)?.classification ?? "-"} | Confianza: ${d.confidence}% | Peso: ${d.dimWeight} | Score: ${d.score}`
    )
    .join("\n");

  return `== CONTEXTO DEL ANÁLISIS ==
Proyecto: ${projectName}
Tipo: ${TYPE_LABELS[projectType]}
Territorio: ${territorioNombre}
Confianza global: ${analysis.globalConfidence}%
Fecha: ${date}
Versión: ${analysis.version}

== DIMENSIONES PEST-L ==
${dimensionsText}

== CADENAS DE IMPACTO ==
${impactChainsText}

== SCORECARD PONDERADO ==
${scorecardText}
  Score global: ${scorecard.globalScore}/100`;
}

function formatDimension(
  d: DimensionAnalysis,
  adjustments: HumanAdjustment[] | undefined
): string {
  const adj = adjustments?.find((a) => a.dimensionCode === d.code);
  const adjNote = adj
    ? `\n  Ajuste analista: "${adj.justification}" (clasificación → ${adj.newClassification})`
    : "";
  return `[${d.code}] ${DIMENSION_LABELS[d.code]}
  Clasificación: ${d.classification} | Tendencia: ${d.trend} | Intensidad: ${d.intensity}
  Señal principal: ${d.mainSignal}
  Narrativa: ${d.narrative}
  Confianza: ${d.confidence}%${adjNote}`;
}

// ─────────────────────────────────────────────────────────────
// Format-specific instructions
// ─────────────────────────────────────────────────────────────

function EXECUTIVE_INSTRUCTIONS(tipo: TipoProyecto): string {
  return `== INSTRUCCIONES: REPORTE EJECUTIVO ==
Audiencia: dirección del proyecto político (no equipo técnico).
Extensión: máximo 3 páginas (aproximadamente 600-900 palabras).
Formato: Markdown con encabezados ##.

Estructura obligatoria:
1. ## Resumen ejecutivo (2 párrafos: qué es el análisis y cuál es la lectura general)
2. ## Hallazgos críticos por dimensión (tabla o lista de los factores más relevantes)
3. ## Las 3 principales implicaciones estratégicas para el proyecto ${TYPE_LABELS[tipo]}
4. ## Scorecard (reproduce la tabla del scorecard ponderado)

Estilo: claro, directo, sin tecnicismos. Cada implicación estratégica debe ser accionable.`;
}

const TECHNICAL_INSTRUCTIONS = `== INSTRUCCIONES: REPORTE TÉCNICO COMPLETO ==
Audiencia: equipo interno de análisis político.
Extensión: sin límite (cubre todo el contenido).
Formato: Markdown con encabezados ##.

Estructura obligatoria:
1. ## Ficha metodológica (tipo de proyecto, territorio, fecha, versión, metodología PEST-L)
2. ## Análisis por dimensión (para cada dimensión: señal principal, narrativa completa, tendencia, intensidad, fuentes)
3. ## Cadenas de impacto transversal
4. ## Scorecard ponderado (tabla completa con pesos y scores)
5. ## Alertas de sesgo y limitaciones del análisis
6. ## Ajustes del analista (si los hay, documenta cada uno con su justificación)

Incluye notas metodológicas sobre el nivel de confianza y las fuentes cuando sea relevante.`;

const FODA_INSTRUCTIONS = `== INSTRUCCIONES: SÍNTESIS FODA-LISTA ==
Extrae del análisis PEST-L las oportunidades y amenazas para alimentar un análisis FODA posterior.

Formato de respuesta (Markdown, sin texto adicional):

## Oportunidades
- [Oportunidad 1 — dimensión PEST-L de origen]
- [Oportunidad 2 — dimensión PEST-L de origen]
...

## Amenazas
- [Amenaza 1 — dimensión PEST-L de origen]
- [Amenaza 2 — dimensión PEST-L de origen]
...

Reglas:
- Incluye SOLO factores clasificados como OPORTUNIDAD o AMENAZA en el análisis.
- Cada ítem debe ser concreto y accionable (no abstracto).
- Si hay ajuste del analista que cambia la clasificación, usa la clasificación ajustada.
- Máximo 6 oportunidades y 6 amenazas.`;

function buildScenariosPrompt(base: string, ctx: ReportContext): string {
  const { analysis, projectType } = ctx;
  const highStake = getHighStakeDimensions(
    analysis.dimensions,
    analysis.adjustments,
    60
  );

  const highStakeText =
    highStake.length > 0
      ? highStake
          .map(
            (d) =>
              `  [${d.code}] ${DIMENSION_LABELS[d.code]}: ${d.mainSignal} (${d.classification}, ${d.intensity})`
          )
          .join("\n")
      : "  (Todos los factores están por debajo del umbral crítico — usa los de mayor intensidad)";

  const fallback =
    highStake.length === 0
      ? analysis.dimensions
          .filter((d) => d.intensity === "ALTA")
          .map(
            (d) =>
              `  [${d.code}] ${DIMENSION_LABELS[d.code]}: ${d.mainSignal}`
          )
          .join("\n")
      : "";

  return `${base}

== FACTORES DE ALTO IMPACTO Y ALTA PROBABILIDAD (insumo para escenarios) ==
${highStakeText}${fallback ? "\n" + fallback : ""}

== INSTRUCCIONES: ESCENARIOS PROSPECTIVOS ==
Genera 3 escenarios basados en los factores de alto impacto y alta probabilidad listados arriba.
Para cada escenario incluye:
1. Título descriptivo del escenario
2. Narrativa (2-3 párrafos): descripción de cómo se desarrollaría este escenario
3. Implicación comunicacional específica para un proyecto ${TYPE_LABELS[projectType]}

Formato Markdown con encabezados ##.

## Escenario optimista
[...]

## Escenario base
[...]

## Escenario pesimista
[...]`;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  P: "Político",
  E: "Económico",
  S: "Social",
  T: "Tecnológico",
  L: "Legal / Ambiental",
};

const TYPE_LABELS: Record<TipoProyecto, string> = {
  electoral: "electoral",
  gubernamental: "gubernamental",
  legislativo: "legislativo",
  ciudadano: "ciudadano",
};

function formatDate(value: unknown): string {
  try {
    const d =
      typeof value === "string"
        ? new Date(value)
        : new Date((value as { _seconds: number })._seconds * 1000);
    return d.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "Fecha desconocida";
  }
}
