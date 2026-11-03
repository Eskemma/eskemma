// Análisis de Centinela de ejemplo (dos dimensiones, señales de los tres tipos y un ajuste) para las pruebas de la
// huella de origen (T4). Lleva TODOS los campos que `transformToMapaPESTEL` copia, más campos que la huella ignora.
import type { AjusteCrudo, DimensionCruda } from "../contenidoOrigen";

export const DIMENSIONES_EJEMPLO = [
  {
    code: "P",
    classification: "AMENAZA",
    narrative: "El entorno político es adverso.",
    confidence: 75,
    // Campos del análisis que F2 no consume (la huella los ignora):
    trend: "ASCENDENTE",
    intensity: "ALTA",
    mainSignal: "La oposición controla el congreso.",
    senalesAdversas: [
      { descripcion: "La oposición controla 70 % del congreso", fuente: "INE", fechaCorte: "2024-06", nivelConfianza: "alto", origenInternacional: false },
    ],
    senalesFavorables: [{ descripcion: "Un aliado anunció su apoyo" }],
  },
  {
    code: "E",
    classification: "NEUTRAL",
    narrative: "La economía es estable.",
    confidence: 70,
    senalesInciertas: [{ descripcion: "Inflación incierta", fuente: "INEGI", fechaCorte: "2024-05", nivelConfianza: "medio" }],
  },
] as unknown as (DimensionCruda & Record<string, unknown>)[];

export const AJUSTES_EJEMPLO: (AjusteCrudo & Record<string, unknown>)[] = [
  {
    dimensionCode: "P",
    adjustedBy: "uid-analista",
    adjustedAt: "2026-11-01T12:00:00.000Z",
    originalClassification: "AMENAZA",
    newClassification: "OPORTUNIDAD",
    justification: "La coalición opositora se fracturó.",
    originalPosition: { x: 75, y: 85 },
    newPosition: { x: 40, y: 20 },
  },
];

/** Campos de la raíz del documento que la huella ignora: status, vigente, version, etc. */
export const EXTRAS_DEL_DOCUMENTO = {
  status: "APPROVED",
  vigente: true,
  version: 3,
  globalConfidence: 72,
  biasAlerts: [{ type: "x", description: "y" }],
  impactChains: [{ dimensions: ["P"], description: "c", riskLevel: "ALTO", recommendation: "r" }],
  informes: [{ formato: "ejecutivo", contenidoTexto: "t" }],
  updatedAt: "2026-11-02T00:00:00.000Z",
};
