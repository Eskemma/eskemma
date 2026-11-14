// H75 / B1 — contexto de análisis fijo para las pruebas del prompt del Técnico y del fixture prompts-antes-h75b.json
// (los otros 4 formatos, generados con el código ANTERIOR a B1). Incluye alertas de sesgo (una reconocida y una pendiente)
// y un ajuste del analista: así se prueba que ninguna de las dos cosas cambia los otros formatos.
import type { DimensionAnalysis, PestlAnalysisV2, Senal } from "@/types/pestel.types";

const senal = (descripcion: string, fuente: string, fechaCorte = "2026-08-01"): Senal => ({
  descripcion,
  fuente,
  fechaCorte,
  nivelConfianza: "alto",
  origenInternacional: false,
});

const dim = (code: DimensionAnalysis["code"], extra: Partial<DimensionAnalysis> = {}): DimensionAnalysis => ({
  code,
  trend: "ESTABLE",
  intensity: "MEDIA",
  mainSignal: `Señal principal de ${code}`,
  narrative: `Narrativa de ${code}.`,
  classification: "NEUTRAL",
  confidence: 60,
  ...extra,
});

export const analisisH75b: PestlAnalysisV2 = {
  id: "a-h75b",
  projectId: "p-h75b",
  version: 2,
  analyzedAt: "2026-09-22T12:00:00.000Z",
  globalConfidence: 36,
  dimensions: [
    dim("P", { classification: "AMENAZA", intensity: "ALTA", senalesAdversas: [senal("Fragmentación opositora", "INE")] }),
    dim("E", { senalesFavorables: [senal("Tipo de cambio estable", "Banxico")] }),
    dim("S", { classification: "AMENAZA", intensity: "ALTA", senalesAdversas: [senal("Inseguridad en aumento", "SESNSP", "sin fecha")] }),
    dim("T", { trend: "ASCENDENTE", senalesInciertas: [senal("Regulación de IA", "")] }),
    dim("Ec"),
    dim("L", { classification: "AMENAZA", intensity: "ALTA", senalesAdversas: [senal("Riesgo regulatorio alto", "DOF")] }),
  ],
  impactChains: [
    { dimensions: ["P", "L"], description: "Reforma electoral encarece la competencia.", riskLevel: "CRITICO", recommendation: "Monitorear agenda legislativa." },
  ] as unknown as PestlAnalysisV2["impactChains"],
  biasAlerts: [
    { type: "sesgo_digital", description: "Solo fuentes digitales.", acknowledgedAt: "2026-09-23T01:16:46.353Z", acknowledgedBy: "u1" },
    { type: "cobertura_insuficiente", description: "Cobertura insuficiente en E, S, T, L, Ec." },
  ],
  adjustments: [
    {
      dimensionCode: "S",
      adjustedBy: "u1",
      adjustedAt: "2026-09-23T02:00:00.000Z",
      originalClassification: "AMENAZA",
      newClassification: "NEUTRAL",
      justification: "Una sola fuente digital.",
      originalPosition: { x: 0, y: 0 },
      newPosition: { x: 0, y: 0 },
    },
  ],
  status: "APPROVED",
  vigente: true,
};

export const ctxH75b = {
  analysis: analisisH75b,
  variableConfigs: [],
  projectName: "Proyecto H75",
  projectType: "electoral" as const,
  territorioNombre: "Jalisco",
};
