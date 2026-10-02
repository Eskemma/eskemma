// lib/pestel/reportPrompts.test.ts
// Regresión del 5º formato de E7 ("insights_por_tipo", spec 07) y de las
// señales verificadas (fuente/fecha) como insumo en los 5 formatos —
// decisión de Raúl (26-10-02): Técnico/Escenarios con instrucción directa
// de usarlas, Ejecutivo/FODA como contexto de fondo sin exigir cita.
import { describe, expect, it } from "vitest";
import { buildReportPrompt } from "./reportPrompts";
import type {
  DimensionAnalysis,
  PestlAnalysisV2,
  Senal,
} from "@/types/pestel.types";

function senal(descripcion: string, fuente = "SESNSP"): Senal {
  return {
    descripcion,
    fuente,
    fechaCorte: "2026-08",
    nivelConfianza: "alto",
    origenInternacional: false,
  };
}

function dim(
  code: DimensionAnalysis["code"],
  overrides: Partial<DimensionAnalysis> = {}
): DimensionAnalysis {
  return {
    code,
    trend: "ESTABLE",
    intensity: "MEDIA",
    mainSignal: `Señal principal de ${code}`,
    narrative: `Narrativa de ${code}.`,
    classification: "NEUTRAL",
    confidence: 70,
    ...overrides,
  };
}

const baseAnalysis: PestlAnalysisV2 = {
  id: "a1",
  projectId: "p1",
  version: 1,
  analyzedAt: "2026-09-01T00:00:00.000Z",
  globalConfidence: 75,
  dimensions: [
    dim("P", {
      senalesFavorables: [senal("Acuerdo político favorable", "DOF")],
    }),
    dim("E"),
    dim("S", {
      senalesAdversas: [senal("Percepción de inseguridad en aumento")],
    }),
    dim("T"),
    dim("Ec"),
    dim("L", {
      classification: "AMENAZA",
      intensity: "ALTA",
      senalesAdversas: [senal("Riesgo regulatorio alto", "INEGI")],
    }),
  ],
  impactChains: [],
  biasAlerts: [],
  status: "APPROVED",
  vigente: true,
};

const baseCtx = {
  analysis: baseAnalysis,
  variableConfigs: [],
  projectName: "Proyecto de prueba",
  projectType: "electoral" as const,
  territorioNombre: "Jalisco",
};

describe("buildReportPrompt — señales verificadas como insumo", () => {
  it("technical: incluye señales de las 6 dimensiones con instrucción de usarlas", () => {
    const { userPrompt } = buildReportPrompt("technical", baseCtx);
    expect(userPrompt).toContain("SEÑALES VERIFICADAS");
    expect(userPrompt).toContain("Usa estas señales verificadas");
    expect(userPrompt).toContain("Acuerdo político favorable");
    expect(userPrompt).toContain("Riesgo regulatorio alto");
    expect(userPrompt).toContain("Fuente: DOF, 2026-08");
  });

  it("executive: incluye las señales como contexto de fondo, sin exigir enumerarlas", () => {
    const { userPrompt } = buildReportPrompt("executive", baseCtx);
    expect(userPrompt).toContain("SEÑALES VERIFICADAS");
    expect(userPrompt).toContain("contexto de fondo");
    expect(userPrompt).not.toContain("Usa estas señales verificadas");
  });

  it("foda: mismo criterio que executive (contexto de fondo)", () => {
    const { userPrompt } = buildReportPrompt("foda", baseCtx);
    expect(userPrompt).toContain("contexto de fondo");
  });

  it("scenarios: solo incluye señales de las dimensiones de alto impacto, no las 6", () => {
    const { userPrompt } = buildReportPrompt("scenarios", baseCtx);
    // L es AMENAZA + ALTA → entra por el fallback de alta intensidad
    expect(userPrompt).toContain("Riesgo regulatorio alto");
    // P (sin alto impacto, intensidad MEDIA) no debería colarse
    expect(userPrompt).not.toContain("Acuerdo político favorable");
  });

  it("un análisis sin ninguna señal no agrega el bloque en absoluto", () => {
    const sinSenales: PestlAnalysisV2 = {
      ...baseAnalysis,
      dimensions: baseAnalysis.dimensions.map((d) => ({
        ...d,
        senalesFavorables: undefined,
        senalesAdversas: undefined,
        senalesInciertas: undefined,
      })),
    };
    const { userPrompt } = buildReportPrompt("technical", {
      ...baseCtx,
      analysis: sinSenales,
    });
    expect(userPrompt).not.toContain("SEÑALES VERIFICADAS");
  });
});

describe("buildReportPrompt — 5º formato insights_por_tipo (spec 07)", () => {
  it("electoral agrupa por etapa de campaña", () => {
    const { userPrompt } = buildReportPrompt("insights_por_tipo", {
      ...baseCtx,
      projectType: "electoral",
    });
    expect(userPrompt).toContain("Precampaña, Campaña, Cierre");
    expect(userPrompt).not.toContain("momento legislativo");
  });

  it("gubernamental agrupa por eje de agenda (sin lista fija, la spec no la define)", () => {
    const { userPrompt } = buildReportPrompt("insights_por_tipo", {
      ...baseCtx,
      projectType: "gubernamental",
    });
    expect(userPrompt).toContain("eje de agenda de gobierno");
    expect(userPrompt).not.toContain("Precampaña");
  });

  it("legislativo agrupa por momento legislativo", () => {
    const { userPrompt } = buildReportPrompt("insights_por_tipo", {
      ...baseCtx,
      projectType: "legislativo",
    });
    expect(userPrompt).toContain("Apertura, Debate, Votación");
  });

  it("ciudadano agrupa por fase del movimiento", () => {
    const { userPrompt } = buildReportPrompt("insights_por_tipo", {
      ...baseCtx,
      projectType: "ciudadano",
    });
    expect(userPrompt).toContain("Emergencia, Consolidación, Impacto");
  });

  it("incluye las señales completas (mandatory) y la prioridad de dimensiones por tipo", () => {
    const { userPrompt } = buildReportPrompt("insights_por_tipo", {
      ...baseCtx,
      projectType: "electoral",
    });
    // electoral → prioritarias: P, S, L (dimensionPriority.ts)
    expect(userPrompt).toContain("Político, Social, Legal");
    expect(userPrompt).toContain("Usa estas señales verificadas");
    expect(userPrompt).toContain("Acuerdo político favorable");
  });

  it("instruye a declarar grupos vacíos en vez de inventar un insight", () => {
    const { userPrompt } = buildReportPrompt("insights_por_tipo", baseCtx);
    expect(userPrompt).toContain("Sin hallazgos relevantes para esta etapa");
    expect(userPrompt).toMatch(/nunca inventes/i);
  });

  it("usa maxTokens consistente con los otros formatos sin límite estricto", () => {
    const { maxTokens } = buildReportPrompt("insights_por_tipo", baseCtx);
    expect(maxTokens).toBe(6000);
  });
});
