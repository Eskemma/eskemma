// Fixtures de T7 C4: un análisis de 6 dimensiones con UNA señal configurable en P.
import type { DimensionAnalysis, PestlAnalysisV2, Senal } from "@/types/pestel.types";

export function senal(over: Partial<Senal> = {}): Senal {
  return { descripcion: "Señal de prueba", fuente: "DOF", fechaCorte: "2026-08", nivelConfianza: "alto", origenInternacional: false, ...over };
}
export function analisisCon(s: Senal): PestlAnalysisV2 {
  const dim = (code: DimensionAnalysis["code"], over: Partial<DimensionAnalysis> = {}): DimensionAnalysis => ({
    code, trend: "ESTABLE", intensity: "MEDIA", mainSignal: `Señal de ${code}`, narrative: `Narrativa de ${code}.`, classification: "NEUTRAL", confidence: 70, ...over,
  });
  return {
    id: "a1", projectId: "p1", version: 1, analyzedAt: "2026-09-01T00:00:00.000Z", globalConfidence: 75,
    dimensions: [dim("P", { senalesFavorables: [s] }), dim("E"), dim("S"), dim("T"), dim("Ec"), dim("L")],
    impactChains: [], biasAlerts: [], status: "APPROVED", vigente: true,
  };
}
