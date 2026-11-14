// H75 / B1 — caracterización ANTES de cambiar el prompt del Técnico. Fija lo que NO debe cambiar:
//  · los otros 4 formatos, byte a byte contra prompts-antes-h75b.json (generado con el código anterior a B1);
//  · del Técnico: el tope de tokens, los 6 encabezados en su orden, el bloque de señales con las reglas de cita de H74,
//    el contexto base y el system prompt.
// Verde contra el código anterior y sin editar después de B1.

import { describe, expect, it } from "vitest";
import { buildReportPrompt, type ReportFormat } from "./reportPrompts";
import { ctxH75b } from "./__fixtures__/ctxH75b";
import antes from "./__fixtures__/prompts-antes-h75b.json";

describe("B1 — los otros 4 formatos no cambian (byte a byte)", () => {
  it.each(["executive", "foda", "scenarios", "insights_por_tipo"] as ReportFormat[])("%s: systemPrompt, userPrompt y maxTokens idénticos", (f) => {
    const esperado = (antes as Record<string, { systemPrompt: string; userPrompt: string; maxTokens: number }>)[f];
    const actual = buildReportPrompt(f, ctxH75b);
    expect(actual.systemPrompt).toBe(esperado.systemPrompt);
    expect(actual.userPrompt).toBe(esperado.userPrompt);
    expect(actual.maxTokens).toBe(esperado.maxTokens);
  });
});

describe("B1 — lo que del Técnico NO cambia (caracterización)", () => {
  const tecnico = buildReportPrompt("technical", ctxH75b);

  it("el tope de tokens sigue en 6000", () => {
    expect(tecnico.maxTokens).toBe(6000);
  });

  it("las 6 secciones conservan sus encabezados y su orden", () => {
    const titulos = [
      "## Ficha metodológica",
      "## Análisis por dimensión",
      "## Cadenas de impacto transversal",
      "## Scorecard ponderado",
      "## Alertas de sesgo y limitaciones del análisis",
      "## Ajustes del analista",
    ];
    let desde = tecnico.userPrompt.indexOf("== INSTRUCCIONES: REPORTE TÉCNICO");
    expect(desde).toBeGreaterThan(-1);
    for (const t of titulos) {
      const i = tecnico.userPrompt.indexOf(t, desde);
      expect(i, `falta o está desordenado: ${t}`).toBeGreaterThan(-1);
      desde = i;
    }
  });

  it("el bloque de señales conserva las reglas de cita de H74 (fuente no registrada, cita tal cual, sin inventar)", () => {
    const p = tecnico.userPrompt;
    expect(p).toContain("== SEÑALES DEL ANÁLISIS (con la fuente y fecha que registra cada una) ==");
    expect(p).toContain("Usa estas señales en tu análisis.");
    expect(p).toContain("cópiala tal cual, con el formato (Fuente: nombre, fecha)");
    expect(p).toContain("un marcador por pieza ausente");
    expect(p).toContain("No inventes ni deduzcas lo que falta");
    expect(p).toContain("→ cita: (Fuente: Banxico, 2026-08-01)");
    expect(p).toContain("→ cita: (fuente no registrada, 2026-08-01)");
    expect(p).toContain("→ cita: (Fuente: SESNSP, fecha no registrada)");
  });

  it("el contexto base (dimensiones, cadenas y scorecard) sigue antes de las instrucciones", () => {
    const p = tecnico.userPrompt;
    const i = p.indexOf("== INSTRUCCIONES: REPORTE TÉCNICO");
    for (const bloque of ["== CONTEXTO DEL ANÁLISIS ==", "== DIMENSIONES PESTEL ==", "== CADENAS DE IMPACTO ==", "== SCORECARD PONDERADO =="]) {
      const j = p.indexOf(bloque);
      expect(j).toBeGreaterThan(-1);
      expect(j).toBeLessThan(i);
    }
  });

  it("el system prompt no cambia", () => {
    expect(tecnico.systemPrompt).toBe((antes as Record<string, { systemPrompt: string }>).executive.systemPrompt);
  });
});
