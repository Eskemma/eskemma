// lib/pestel/reportPrompts.ts
// Constructs the Claude prompts for the 5 E7 report formats.
// No external dependencies — pure string builders.

import { FECHA_NO_REGISTRADA, FUENTE_NO_REGISTRADA, fechaLegible, fuenteLegible, nivelLegible } from "@/lib/pestel/senalCampos";
import type {
  PestlAnalysisV2,
  DimensionAnalysis,
  PestlDimensionConfig,
  HumanAdjustment,
  TipoProyecto,
  Senal,
  DimensionCode,
} from "@/types/pestel.types";
import { DIMENSION_META } from "@/types/pestel.types";
import {
  buildScorecard,
  getHighStakeDimensions,
} from "@/lib/pestel/matrizUtils";
import { getDimensionPriorityConfig } from "@/lib/moddulo/dimensionPriority";

export type ReportFormat =
  | "executive"
  | "technical"
  | "foda"
  | "scenarios"
  | "insights_por_tipo";

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
  const { analysis } = ctx;

  switch (format) {
    case "executive": {
      // Señales como contexto de fondo, SIN instrucción de enumerarlas —
      // decisión de Raúl (26-10-02): el ejecutivo es deliberadamente breve
      // (600-900 palabras, "sin tecnicismos"), así que las señales se dan
      // como respaldo opcional, nunca como lista obligatoria. El system
      // prompt (línea 74-76) ya decide citar solo si aporta.
      const senalesBlock = buildSenalesBlock(analysis.dimensions, "soft");
      return {
        systemPrompt: SYSTEM_CONSULTANT,
        userPrompt: `${base}${senalesBlock}\n\n${EXECUTIVE_INSTRUCTIONS(ctx.projectType)}`,
        maxTokens: 4000,
      };
    }
    case "technical": {
      // Señales completas de las 6 dimensiones, con instrucción directa de
      // usarlas — cierra la promesa que el prompt técnico ya hacía
      // ("fuentes... cuando sea relevante") sin tener con qué cumplirla.
      const senalesBlock = buildSenalesBlock(analysis.dimensions, "mandatory");
      return {
        systemPrompt: SYSTEM_CONSULTANT,
        userPrompt: `${base}${senalesBlock}\n\n${buildAlertasSesgoBlock(analysis.biasAlerts)}\n\n${TECHNICAL_INSTRUCTIONS}`,
        maxTokens: 6000,
      };
    }
    case "foda": {
      // Mismo criterio que ejecutivo: contexto de fondo, sin exigir cita —
      // el formato es una lista comprimida ("sin texto adicional").
      const senalesBlock = buildSenalesBlock(analysis.dimensions, "soft");
      return {
        systemPrompt: SYSTEM_CONSULTANT,
        userPrompt: `${base}${senalesBlock}\n\n${FODA_INSTRUCTIONS}`,
        maxTokens: 2000,
      };
    }
    case "scenarios":
      return {
        systemPrompt: SYSTEM_CONSULTANT,
        userPrompt: buildScenariosPrompt(base, ctx),
        maxTokens: 6000,
      };
    case "insights_por_tipo":
      return {
        systemPrompt: SYSTEM_CONSULTANT,
        userPrompt: buildInsightsPorTipoPrompt(base, ctx),
        maxTokens: 6000,
      };
  }
}

// ─────────────────────────────────────────────────────────────
// Señales verificadas (fuente/fecha) como insumo — dos modos:
//  - "mandatory": instruye a usarlas/citarlas (Técnico, Escenarios,
//    Mapa de insights).
//  - "soft": las da como contexto de fondo, sin exigir que se enumeren
//    una por una (Ejecutivo, FODA) — el system prompt decide si citar
//    aporta sin alargar el formato.
// Un análisis sin ninguna señal (arrays vacíos es resultado normal, no
// error) no agrega el bloque en absoluto.
// ─────────────────────────────────────────────────────────────

function buildSenalesBlock(
  dimensions: DimensionAnalysis[],
  mode: "mandatory" | "soft",
  onlyCodes?: DimensionCode[]
): string {
  const dims = onlyCodes
    ? dimensions.filter((d) => onlyCodes.includes(d.code))
    : dimensions;

  const lines: string[] = [];
  for (const d of dims) {
    const favorables = d.senalesFavorables ?? [];
    const adversas = d.senalesAdversas ?? [];
    const inciertas = d.senalesInciertas ?? [];
    if (favorables.length === 0 && adversas.length === 0 && inciertas.length === 0) {
      continue;
    }
    lines.push(`[${d.code}] ${DIMENSION_LABELS(d.code)}`);
    if (favorables.length > 0) lines.push(formatSenalesGrupo("Favorables", favorables));
    if (adversas.length > 0) lines.push(formatSenalesGrupo("Adversas", adversas));
    if (inciertas.length > 0) lines.push(formatSenalesGrupo("Inciertas", inciertas));
  }

  if (lines.length === 0) return "";

  // T7 C4 (ajuste del prompt tras la medición real): la cita va aparte de la confianza (antes iban juntas entre paréntesis y
  // el modelo copiaba «; confianza …» dentro de la cita), un marcador por pieza ausente, las fechas tal cual y sin notas de método.
  const reglasCita =
    `Cada señal trae su «cita:» ya armada: cuando la uses, cópiala tal cual, con el formato (Fuente: nombre, fecha). ` +
    `Si falta una pieza, la cita ya dice «${FUENTE_NO_REGISTRADA}» o «${FECHA_NO_REGISTRADA}»: déjala así, un marcador por pieza ausente, ` +
    `con el nombre real de la fuente y las fechas tal como vienen (nunca dos fechas unidas por «y» en una misma cita; si apoyas una idea en dos señales, cita cada una por separado). ` +
    `La confianza es solo contexto para ti: no la repitas dentro de la cita. ` +
    `No inventes ni deduzcas lo que falta, y no agregues notas sobre cómo tratas las señales ni sobre tu método.`;
  const instruccion =
    mode === "mandatory"
      ? `Usa estas señales en tu análisis. ${reglasCita}`
      : `Estas señales son contexto de fondo — úsalas solo si aportan sin alargar el formato ni volverlo más técnico de lo que debe ser. Si citas una: ${reglasCita}`;

  return `\n\n== SEÑALES DEL ANÁLISIS (con la fuente y fecha que registra cada una) ==\n${instruccion}\n${lines.join("\n")}`;
}

function formatSenalesGrupo(etiqueta: string, senales: Senal[]): string {
  return (
    `  ${etiqueta}:\n` +
    senales
      .map((s) => {
        // T7 C4 (N7): lo que falta se dice con un texto fijo, nunca vacío ni con «sin fecha» como si fuera fecha.
        const fuente = fuenteLegible(s);
        const fecha = fechaLegible(s) ?? FECHA_NO_REGISTRADA;
        const nivel = nivelLegible(s);
        const cita = fuente ? `Fuente: ${fuente}, ${fecha}` : `${FUENTE_NO_REGISTRADA}, ${fecha}`;
        return `    - ${s.descripcion} → cita: (${cita})${nivel ? ` · confianza: ${nivel}` : ""}`;
      })
      .join("\n")
  );
}

// ─────────────────────────────────────────────────────────────
// Alertas de sesgo (solo Técnico, H75 / B1): la sección 5 del Técnico necesita los datos reales de las alertas; antes no
// llegaban al prompt y el modelo no podía citarlas. Siempre se emite el bloque (con «Sin alertas…» si no hay) para que la
// sección 5 no tenga que inferirlas.
// ─────────────────────────────────────────────────────────────

function buildAlertasSesgoBlock(alertas: PestlAnalysisV2["biasAlerts"] | undefined): string {
  const titulo = "== ALERTAS DE SESGO DEL ANÁLISIS ==";
  if (!alertas || alertas.length === 0) return `${titulo}\nSin alertas de sesgo registradas.`;
  return `${titulo}\n${alertas
    .map((a) => `- ${a.type}: ${a.description} (${a.acknowledgedAt ? "reconocida" : "pendiente de revisión"})`)
    .join("\n")}`;
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

== DIMENSIONES PESTEL ==
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
  return `[${d.code}] ${DIMENSION_LABELS(d.code)}
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

// H75 / B1 (26-11-13): el Técnico es CONDENSADO y con presupuesto por sección. Antes pedía «extensión: sin límite» y la
// narrativa completa por dimensión: con max_tokens 12000 seguía cortado y no llegaba a las secciones 5 y 6. Texto medido con el
// modelo real (2 rondas; prompt-tecnico-b1-r2): 3 738 tokens, 77 s, las 6 secciones y la justificación del ajuste copiada tal cual.
// Las secciones 5 y 6 son obligatorias y se recorta la 2 antes que ellas. Qué pierde respecto del anterior: la narrativa íntegra y
// el inventario completo de señales por dimensión (siguen en la pantalla de análisis y en los demás formatos).
const TECHNICAL_INSTRUCTIONS = `== INSTRUCCIONES: REPORTE TÉCNICO ==
Audiencia: equipo interno de análisis político.
Formato: Markdown con encabezados ##.
Extensión TOTAL: máximo ~2 500 palabras. Es un tope, no una meta: cada sección tiene su presupuesto.

Escribe las 6 secciones, en este orden y con estos encabezados. Las secciones 5 y 6 son OBLIGATORIAS y van completas:
si vas a pasarte de la extensión, recorta la sección 2, nunca la 5 ni la 6.

1. ## Ficha metodológica — hasta 150 palabras, en viñetas: tipo de proyecto, territorio, fecha, versión, confianza global y metodología PESTEL.
2. ## Análisis por dimensión — SECCIÓN ELÁSTICA. Un subapartado por cada una de las 6 dimensiones, de hasta 230 palabras cada uno:
   - una línea con clasificación · tendencia · intensidad · confianza;
   - la lectura en un párrafo de hasta 90 palabras: condensa la narrativa (hallazgo, causa principal e implicación); NO la copies completa;
   - hasta 3 señales clave (prioriza las adversas y las que tienen fuente registrada), cada una en una línea con su cita tal como viene.
   No listes todas las señales ni repitas por separado la «señal principal» y la narrativa.
3. ## Cadenas de impacto transversal — hasta 300 palabras: una línea por cadena (dimensiones → nivel de riesgo → efecto y recomendación en una frase cada uno), sin repetir lo de la sección 2.
4. ## Scorecard ponderado — la tabla completa (dimensión, clasificación, confianza, peso, score), el score global y una frase.
5. ## Alertas de sesgo y limitaciones del análisis — hasta 250 palabras: cada alerta de sesgo listada más abajo con una frase sobre qué implica para la lectura, y de 3 a 5 limitaciones concretas (confianza global, señales sin fuente o sin fecha registrada, cobertura). Solo con datos presentes en el contexto.
6. ## Ajustes del analista — hasta 120 palabras: por cada ajuste, su dimensión, el cambio de clasificación y la justificación del analista COPIADA TEXTUALMENTE entre comillas, sin ampliarla, parafrasearla ni agregarle interpretación; si no hay ajustes, una sola línea: «Sin ajustes del analista registrados.»

No agregues secciones ni un resumen final.`;

const FODA_INSTRUCTIONS = `== INSTRUCCIONES: SÍNTESIS FODA-LISTA ==
Extrae del análisis PESTEL las oportunidades y amenazas para alimentar un análisis FODA posterior.

Formato de respuesta (Markdown, sin texto adicional):

## Oportunidades
- [Oportunidad 1 — dimensión PESTEL de origen]
- [Oportunidad 2 — dimensión PESTEL de origen]
...

## Amenazas
- [Amenaza 1 — dimensión PESTEL de origen]
- [Amenaza 2 — dimensión PESTEL de origen]
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
              `  [${d.code}] ${DIMENSION_LABELS(d.code)}: ${d.mainSignal} (${d.classification}, ${d.intensity})`
          )
          .join("\n")
      : "  (Todos los factores están por debajo del umbral crítico — usa los de mayor intensidad)";

  const fallback =
    highStake.length === 0
      ? analysis.dimensions
          .filter((d) => d.intensity === "ALTA")
          .map(
            (d) =>
              `  [${d.code}] ${DIMENSION_LABELS(d.code)}: ${d.mainSignal}`
          )
          .join("\n")
      : "";

  // Señales SOLO de las dimensiones ya filtradas por alto impacto — no se
  // inflan las 6 dimensiones completas, se refuerza el respaldo factual
  // justo de los factores que ya alimentan el escenario.
  const codesAltoImpacto = (highStake.length > 0 ? highStake : analysis.dimensions.filter((d) => d.intensity === "ALTA")).map((d) => d.code);
  const senalesBlock = buildSenalesBlock(analysis.dimensions, "mandatory", codesAltoImpacto);

  return `${base}

== FACTORES DE ALTO IMPACTO Y ALTA PROBABILIDAD (insumo para escenarios) ==
${highStakeText}${fallback ? "\n" + fallback : ""}${senalesBlock}

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

// 5º formato de E7 (spec 07, `_docs/specs/pestel/07_informes.md:44-50`):
// agrupa insights por un criterio DISTINTO según el tipo de proyecto —
// no es el mismo eje que `DIMENSION_PRIORITY_BY_TYPE` (ese prioriza QUÉ
// dimensión PEST-L destacar; este agrupa EN QUÉ MOMENTO del ciclo del
// proyecto aplica cada insight). La spec no define más que el criterio de
// agrupamiento — el resto (qué cuenta como insight, cómo repartir entre
// grupos) lo decide el prompt, igual que ya hacen los otros 4 formatos.
const AGRUPAMIENTO_POR_TIPO: Record<TipoProyecto, string> = {
  electoral: "etapa de campaña: Precampaña, Campaña, Cierre",
  gubernamental: "eje de agenda de gobierno (defínelos a partir del contenido real del análisis — no uses un catálogo fijo de ejes)",
  legislativo: "momento legislativo: Apertura, Debate, Votación",
  ciudadano: "fase del movimiento: Emergencia, Consolidación, Impacto",
};

function buildInsightsPorTipoPrompt(base: string, ctx: ReportContext): string {
  const { analysis, projectType } = ctx;
  const { prioritarias } = getDimensionPriorityConfig(projectType);
  // Señales completas (las 6 dimensiones) — el formato organiza TODO el
  // análisis por momento del ciclo, no un subconjunto como Escenarios.
  const senalesBlock = buildSenalesBlock(analysis.dimensions, "mandatory");

  return `${base}${senalesBlock}

== INSTRUCCIONES: MAPA DE INSIGHTS POR TIPO DE PROYECTO ==
Agrupa los insights del análisis según el criterio que corresponde a un
proyecto ${TYPE_LABELS[projectType]}: ${AGRUPAMIENTO_POR_TIPO[projectType]}.

Un "insight" es un hallazgo concreto y accionable derivado de una señal,
una narrativa de dimensión, o un patrón entre varias dimensiones — nunca
una afirmación genérica sin respaldo en el contexto. Cada insight debe
indicar de qué dimensión(es) PESTEL proviene.

Dentro de cada grupo, ordena los insights dando prioridad a hallazgos de
las dimensiones ${prioritarias.map((d) => DIMENSION_LABELS(d)).join(", ")}
(son las dimensiones de mayor peso para este tipo de proyecto) — sin excluir
insights de otras dimensiones si son relevantes para ese grupo.

Si un grupo no tiene insights respaldados por el análisis, dilo explícitamente
("Sin hallazgos relevantes para esta etapa") — nunca inventes un insight para
rellenar un grupo vacío.

Formato Markdown con encabezados ## (uno por grupo, en el orden de la lista
de arriba) y viñetas por insight.`;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const DIMENSION_LABELS = (code: string): string =>
  DIMENSION_META[code as keyof typeof DIMENSION_META]?.label ?? code;

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
