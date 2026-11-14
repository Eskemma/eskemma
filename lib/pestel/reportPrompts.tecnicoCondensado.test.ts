// H75 / B1 — el Técnico es condensado y con presupuesto por sección; la sección 5 recibe las alertas de sesgo reales
// (solo el Técnico); el copy del formato cambia. Literales propios (como en T8b): si alguien toca el prompt, la prueba lo dice.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildReportPrompt, type ReportFormat } from "./reportPrompts";
import { ctxH75b } from "./__fixtures__/ctxH75b";

const tecnico = () => buildReportPrompt("technical", ctxH75b).userPrompt;

describe("Técnico condensado — literales del prompt aprobado (prompt-tecnico-b1-r2)", () => {
  it("el encabezado ya no dice «COMPLETO» y fija la extensión total como tope", () => {
    const p = tecnico();
    expect(p).toContain("== INSTRUCCIONES: REPORTE TÉCNICO ==");
    expect(p).not.toContain("REPORTE TÉCNICO COMPLETO");
    expect(p).toContain("Extensión TOTAL: máximo ~2 500 palabras. Es un tope, no una meta: cada sección tiene su presupuesto.");
  });

  it("ya no pide «sin límite» ni la narrativa completa", () => {
    const p = tecnico();
    expect(p).not.toContain("Extensión: sin límite");
    expect(p).not.toContain("cubre todo el contenido");
    expect(p).not.toContain("narrativa completa");
    expect(p).toContain("NO la copies completa");
  });

  it("las secciones 5 y 6 son obligatorias y se recorta la 2 antes que ellas", () => {
    const p = tecnico();
    expect(p).toContain("Las secciones 5 y 6 son OBLIGATORIAS y van completas");
    expect(p).toContain("recorta la sección 2, nunca la 5 ni la 6");
    expect(p).toContain("SECCIÓN ELÁSTICA");
  });

  it("presupuesto por sección", () => {
    const p = tecnico();
    for (const frase of [
      "## Ficha metodológica — hasta 150 palabras",
      "de hasta 230 palabras cada uno",
      "un párrafo de hasta 90 palabras",
      "hasta 3 señales clave",
      "## Cadenas de impacto transversal — hasta 300 palabras",
      "## Alertas de sesgo y limitaciones del análisis — hasta 250 palabras",
      "## Ajustes del analista — hasta 120 palabras",
    ]) expect(p).toContain(frase);
  });

  it("sección 5 usa las alertas listadas y solo datos del contexto; sección 6 copia la justificación textualmente", () => {
    const p = tecnico();
    expect(p).toContain("cada alerta de sesgo listada más abajo");
    expect(p).toContain("Solo con datos presentes en el contexto.");
    expect(p).toContain("COPIADA TEXTUALMENTE entre comillas, sin ampliarla, parafrasearla ni agregarle interpretación");
    expect(p).toContain("«Sin ajustes del analista registrados.»");
  });

  it("no agrega secciones ni resumen final, y el tope de tokens sigue en 6000", () => {
    expect(tecnico()).toContain("No agregues secciones ni un resumen final.");
    expect(buildReportPrompt("technical", ctxH75b).maxTokens).toBe(6000);
  });
});

describe("Técnico — bloque de alertas de sesgo", () => {
  it("con alertas: una línea por alerta, marcando reconocida / pendiente de revisión", () => {
    const p = tecnico();
    expect(p).toContain("== ALERTAS DE SESGO DEL ANÁLISIS ==");
    expect(p).toContain("- sesgo_digital: Solo fuentes digitales. (reconocida)");
    expect(p).toContain("- cobertura_insuficiente: Cobertura insuficiente en E, S, T, L, Ec. (pendiente de revisión)");
  });

  it("sin alertas (arreglo vacío o ausente): «Sin alertas de sesgo registradas.»", () => {
    for (const biasAlerts of [[], undefined]) {
      const p = buildReportPrompt("technical", { ...ctxH75b, analysis: { ...ctxH75b.analysis, biasAlerts: biasAlerts as never } }).userPrompt;
      expect(p).toContain("== ALERTAS DE SESGO DEL ANÁLISIS ==\nSin alertas de sesgo registradas.");
      expect(p).not.toContain("- sesgo_digital");
    }
  });

  it("el bloque va después de las señales y antes de las instrucciones", () => {
    const p = tecnico();
    const senales = p.indexOf("== SEÑALES DEL ANÁLISIS");
    const alertas = p.indexOf("== ALERTAS DE SESGO DEL ANÁLISIS ==");
    const instrucciones = p.indexOf("== INSTRUCCIONES: REPORTE TÉCNICO ==");
    expect(senales).toBeGreaterThan(-1);
    expect(alertas).toBeGreaterThan(senales);
    expect(instrucciones).toBeGreaterThan(alertas);
  });

  it.each(["executive", "foda", "scenarios", "insights_por_tipo"] as ReportFormat[])("%s NO recibe el bloque de alertas", (f) => {
    expect(buildReportPrompt(f, ctxH75b).userPrompt).not.toContain("ALERTAS DE SESGO DEL ANÁLISIS");
  });
});

describe("Técnico — copy del formato en la pantalla (FORMAT_OPTIONS)", () => {
  it("nombre «Técnico» y descripción «Metodología, fuentes y análisis condensado»; el copy antiguo ya no está", () => {
    const fuente = readFileSync(join(__dirname, "../../app/centinela/pestel/[projectId]/informes/page.tsx"), "utf8");
    expect(fuente).toContain('label: "Técnico",');
    expect(fuente).toContain('description: "Metodología, fuentes y análisis condensado",');
    expect(fuente).not.toContain("Técnico completo");
    expect(fuente).not.toContain("Metodología + fuentes + narrativas");
  });
});
