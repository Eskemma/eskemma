// T7 C4 — CARACTERIZACIÓN (verde contra HEAD): descarga del PESTEL (formatPestelAnalysis) con señales incompletas.
import { describe, expect, it } from "vitest";
import type { MapaPESTEL } from "@/types/moddulo.types";
import { formatPestelAnalysis } from "./reportFormatters";

const mapa = (s: Record<string, unknown>) => ({ P: { code: "P", label: "Político", clasificacion: "AMENAZA", narrativa: "n", senalesFavorables: [s], senalesAdversas: [], senalesInciertas: [] } }) as unknown as MapaPESTEL;

describe("descarga del PESTEL — señales", () => {
  it("fuente y fecha → «_(Fuente: SESNSP, 2020)_»", () => {
    expect(formatPestelAnalysis(mapa({ descripcion: "Algo", fuente: "SESNSP", fechaCorte: "2020" }))).toContain("- Algo _(Fuente: SESNSP, 2020)_");
  });
  it("sin fuente ni fecha: sin paréntesis de fuente", () => {
    const t = formatPestelAnalysis(mapa({ descripcion: "Algo" }));
    expect(t).toContain("- Algo");
    expect(t).not.toContain("_(Fuente");
  });
  it("C4 (defecto invertido a propósito): el literal «sin fecha» ya no se imprime como fecha", () => {
    const t = formatPestelAnalysis(mapa({ descripcion: "Algo", fuente: "SESNSP", fechaCorte: "sin fecha" }));
    expect(t).toContain("_(Fuente: SESNSP)_");
    expect(t).not.toContain("sin fecha");
  });
});
