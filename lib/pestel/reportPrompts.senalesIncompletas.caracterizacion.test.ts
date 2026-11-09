// T7 C4 — CARACTERIZACIÓN (verde contra HEAD): cómo se serializan hoy las señales de un análisis de Centinela en los
// prompts de E7. Fija el formato de una señal completa y deja DOCUMENTADO el defecto de las incompletas (N7/H73):
// con fuente vacía sale «(Fuente: , …» y el literal «sin fecha» se cita como si fuera una fecha. El defecto se invierte
// a propósito en C4 (ver reportPrompts.senalesIncompletas.test.ts); aquí se fija lo que NO cambia.
import { describe, expect, it } from "vitest";
import { buildReportPrompt } from "./reportPrompts";
import type { Senal } from "@/types/pestel.types";
import { analisisCon, senal } from "./__fixtures__/senalesE7";

const ctx = (s: Senal) => ({ analysis: analisisCon(s), variableConfigs: [], projectName: "P", projectType: "electoral" as const, territorioNombre: "Jalisco" });
const tecnico = (s: Senal) => buildReportPrompt("technical", ctx(s)).userPrompt;

describe("señales en los prompts de E7 — comportamiento actual", () => {
  it("una señal completa: «- descripción → cita: (Fuente: X, fecha) · confianza: N» (C4: la confianza ya no va dentro de la cita)", () => {
    expect(tecnico(senal())).toContain("    - Señal de prueba → cita: (Fuente: DOF, 2026-08) · confianza: alto");
  });
  it("C4 (defecto invertido a propósito): sin fuente ya no sale «(Fuente: , …»", () => {
    expect(tecnico(senal({ fuente: "" }))).not.toContain("(Fuente: ,");
  });
  it("C4 (defecto invertido a propósito): el literal «sin fecha» ya no se cita como fecha", () => {
    expect(tecnico(senal({ fechaCorte: "sin fecha" }))).not.toContain("DOF, sin fecha");
  });
  it("el modo `soft` (Ejecutivo) NO exige citar y el `mandatory` (Técnico) sí", () => {
    const soft = buildReportPrompt("executive", ctx(senal())).userPrompt;
    expect(soft).toContain("contexto de fondo");
    expect(tecnico(senal())).toContain("cópiala tal cual");
  });
  it("sin señales no agrega el bloque", () => {
    const a = analisisCon(senal());
    a.dimensions = a.dimensions.map((d) => ({ ...d, senalesFavorables: [] }));
    expect(buildReportPrompt("technical", { analysis: a, variableConfigs: [], projectName: "P", projectType: "electoral", territorioNombre: "J" }).userPrompt).not.toContain("SEÑALES");
  });
});
