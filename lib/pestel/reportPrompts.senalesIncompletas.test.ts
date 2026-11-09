// T7 C4 (N7/H73): señales sin fuente / fecha / nivel en los prompts de E7. Lo que falta se dice con un texto fijo y el
// prompt le prohíbe al modelo inventarlo o deducirlo.
import { describe, expect, it } from "vitest";
import { buildReportPrompt, type ReportFormat } from "./reportPrompts";
import { analisisCon, senal } from "./__fixtures__/senalesE7";

const prompt = (formato: ReportFormat, s: ReturnType<typeof senal>) =>
  buildReportPrompt(formato, { analysis: analisisCon(s), variableConfigs: [], projectName: "P", projectType: "electoral", territorioNombre: "Jalisco" }).userPrompt;

describe("señales incompletas en E7", () => {
  it("sin fuente → «fuente no registrada» (nunca «Fuente: ,»)", () => {
    const p = prompt("technical", senal({ fuente: "" }));
    expect(p).toContain("→ cita: (fuente no registrada, 2026-08) · confianza: alto");
    expect(p).not.toContain("(Fuente: ,");
  });
  it("fuente solo con espacios cuenta como ausente", () => {
    expect(prompt("technical", senal({ fuente: "   " }))).toContain("→ cita: (fuente no registrada, 2026-08)");
  });
  it("«sin fecha» o fecha vacía → «fecha no registrada»; el literal no se cita", () => {
    for (const f of ["sin fecha", "Sin fecha", ""]) {
      const p = prompt("technical", senal({ fechaCorte: f }));
      expect(p).toContain("→ cita: (Fuente: DOF, fecha no registrada) · confianza: alto");
      expect(p).not.toContain("DOF, sin fecha");
    }
  });
  it("sin fuente y sin fecha: ambos textos fijos", () => {
    expect(prompt("technical", senal({ fuente: "", fechaCorte: "sin fecha" }))).toContain("→ cita: (fuente no registrada, fecha no registrada) · confianza: alto");
  });
  it("nivel ausente o desconocido: la señal no declara confianza (no se inventa «bajo»)", () => {
    for (const n of [undefined, "", "raro"]) {
      const p = prompt("technical", senal({ nivelConfianza: n as never }));
      expect(p).toContain("→ cita: (Fuente: DOF, 2026-08)");
      expect(p).not.toContain("confianza: raro");
      expect(p).not.toContain("→ cita: (Fuente: DOF, 2026-08) · confianza");
    }
  });
  it("encabezado nuevo, sin «verificadas», en los modos mandatory y soft", () => {
    for (const f of ["technical", "insights_por_tipo", "executive", "foda"] as ReportFormat[]) {
      const p = prompt(f, senal());
      expect(p).toContain("== SEÑALES DEL ANÁLISIS (con la fuente y fecha que registra cada una) ==");
      expect(p).not.toContain("VERIFICADAS");
    }
  });
  it("la instrucción prohíbe inventar o deducir lo «no registrado» (mandatory y soft)", () => {
    for (const f of ["technical", "executive"] as ReportFormat[]) {
      const p = prompt(f, senal());
      expect(p).toContain("«fuente no registrada»");
      expect(p).toContain("«fecha no registrada»");
      expect(p).toMatch(/No inventes ni deduzcas/);
    }
  });
  it("la confianza NUNCA va dentro de los paréntesis de la cita (ajuste tras la medición real)", () => {
    const p = prompt("technical", senal({ fuente: "", fechaCorte: "sin fecha" }));
    expect(p).not.toMatch(/→ cita: \([^)]*confianza/);
    expect(p).toContain("no la repitas dentro de la cita");
  });
  it("reglas del ajuste: un marcador por pieza, fechas tal cual sin «y», sin notas de método (mandatory y soft)", () => {
    for (const f of ["technical", "executive"] as ReportFormat[]) {
      const p = prompt(f, senal());
      expect(p).toContain("un marcador por pieza ausente");
      expect(p).toContain("nunca dos fechas unidas por «y»");
      expect(p).toContain("no agregues notas sobre cómo tratas las señales ni sobre tu método");
    }
  });
  it("una señal completa conserva su formato", () => {
    expect(prompt("technical", senal())).toContain("- Señal de prueba → cita: (Fuente: DOF, 2026-08) · confianza: alto");
  });
});
