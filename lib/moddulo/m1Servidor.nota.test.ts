// T7 C3: la nota de aprobación del analista en la línea de trazabilidad del Reporte F2 y en la descarga del PESTEL.
import { describe, expect, it } from "vitest";
import { resumenM1ParaCliente } from "./m1Servidor";
import { exploracionGate } from "./__tests__/fixtures/m1Gate";
import { formatPestelAnalysis } from "./reportFormatters";

const aprobado = (linkedSource: Record<string, unknown>) => {
  const e = exploracionGate("aprobado", {}) as Record<string, any>;
  // El fixture trae `en: "t"` (sin fecha legible → la línea base es null); aquí se usa una fecha real.
  const m1 = { ...e.m1, aprobacion: { ...e.m1.aprobacion, en: "2026-10-20T15:30:00.000Z" } };
  return { ...e, m1, linkedSource: { ...e.linkedSource, ...linkedSource } } as never;
};

describe("trazabilidad con la nota", () => {
  it("importación previa (huella v1 o sin huella): ambas líneas dicen «no disponible» (no «sin nota»)", () => {
    for (const ls of [{ kind: "T22", sourceAnalysisId: "a1", huellaFuente: { v: 1, h: "x" } }, { kind: "T22", sourceAnalysisId: "a1" }]) {
      const r = resumenM1ParaCliente(aprobado(ls));
      expect(r.trazabilidadPestel).toContain("Nota de aprobación del analista: no disponible para esta importación");
      expect(r.trazabilidadPestel).not.toMatch(/sin nota/i);
    }
  });
  it("v2 con nota: la nota atribuida al analista en la línea del PESTEL; v2 sin nota: la línea de siempre", () => {
    const con = resumenM1ParaCliente(aprobado({ kind: "T22", sourceAnalysisId: "a1", huellaFuente: { v: 2, h: "x" }, aprobacionOrigen: { confianza: 39, justificacion: "Con reservas." } }));
    expect(con.trazabilidadPestel).toContain("Según el analista, que aprobó el análisis con una confianza global de 39 %: «Con reservas.»");
    const sin = resumenM1ParaCliente(aprobado({ kind: "T22", sourceAnalysisId: "a1", huellaFuente: { v: 2, h: "x" } }));
    expect(sin.trazabilidadPestel).not.toContain("analista");
  });
  it("un M1 express (sin análisis de Centinela) no recibe ninguna frase de nota", () => {
    const r = resumenM1ParaCliente(aprobado({ kind: "express", sourceAnalysisId: undefined }));
    expect(r.trazabilidadPestel ?? "").not.toContain("Nota de aprobación");
  });
  it("la descarga del PESTEL lleva la línea con la nota, cursiva bajo el título", () => {
    const linea = resumenM1ParaCliente(aprobado({ kind: "T22", sourceAnalysisId: "a1", huellaFuente: { v: 2, h: "x" }, aprobacionOrigen: { confianza: 39 } })).trazabilidadPestel;
    expect(linea).toContain("no hay justificación registrada");
    expect(formatPestelAnalysis({} as never, linea)).toContain("no hay justificación registrada");
  });
});
