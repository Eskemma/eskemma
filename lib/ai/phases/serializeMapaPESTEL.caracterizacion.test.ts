// CARACTERIZACIÓN (M1, commit 1): fija el comportamiento ACTUAL de serializeMapaPESTEL antes de
// cambiarlo. Los límites (3 señales por grupo, 140 caracteres) se retiran en el commit de
// serialización completa: esas pruebas se editan allí a propósito y se declara.

import { describe, expect, it } from "vitest";
import { serializeMapaPESTEL } from "./prompts";

const sen = (descripcion: string, over: Record<string, unknown> = {}) => ({
  descripcion, fuente: "INEGI, 2020", fechaCorte: "2020-01", nivelConfianza: "medio", origenInternacional: false, ...over,
});
const dim = (over: Record<string, unknown> = {}) => ({
  label: "Político", clasificacion: "AMENAZA", confidence: 80, narrativa: "Narrativa completa.",
  senalesFavorables: [], senalesAdversas: [], senalesInciertas: [], ...over,
});

describe("serializeMapaPESTEL — comportamiento actual", () => {
  it("1. orden P,E,S,T,Ec,L; omite dimensiones ausentes; encabezado con clasificación y confianza", () => {
    const out = serializeMapaPESTEL({ L: dim({ label: "Legal" }), P: dim(), S: dim({ label: "Social", confidence: undefined }) });
    expect(out.indexOf("[P]")).toBeLessThan(out.indexOf("[S]"));
    expect(out.indexOf("[S]")).toBeLessThan(out.indexOf("[L]"));
    expect(out).not.toContain("[E]");
    expect(out).toContain("[P] Político — AMENAZA (confianza: 80%)");
    expect(out).toContain("[S] Social — AMENAZA\n"); // sin confianza no imprime el paréntesis
  });

  it("2. la narrativa va COMPLETA, sin truncar", () => {
    const larga = "x".repeat(3000);
    expect(serializeMapaPESTEL({ P: dim({ narrativa: larga }) })).toContain(`Narrativa: ${larga}`);
  });

  it("3. la descripción de cada señal se trunca a 140 caracteres (139 + «…»)", () => {
    const out = serializeMapaPESTEL({ P: dim({ senalesAdversas: [sen("a".repeat(300))] }) });
    expect(out).toContain(`- ${"a".repeat(139)}… (Fuente: INEGI, 2020)`);
    expect(out).not.toContain("a".repeat(140));
  });

  it("4. máximo 3 señales por grupo, con la línea «(+ N señales adicionales omitidas)»", () => {
    const seis = Array.from({ length: 6 }, (_, i) => sen(`señal ${i + 1}`));
    const out = serializeMapaPESTEL({ P: dim({ senalesFavorables: seis }) });
    expect(out.match(/\+ señal \d/g)).toHaveLength(3);
    expect(out).toContain("(+ 3 señales adicionales omitidas)");
  });

  it("5. dentro de un grupo ordena por confianza (alto > medio > bajo), no por el orden guardado", () => {
    const out = serializeMapaPESTEL({
      P: dim({ senalesInciertas: [sen("baja", { nivelConfianza: "bajo" }), sen("alta", { nivelConfianza: "alto" }), sen("media", { nivelConfianza: "medio" })] }),
    });
    expect(out.indexOf("? alta")).toBeLessThan(out.indexOf("? media"));
    expect(out.indexOf("? media")).toBeLessThan(out.indexOf("? baja"));
  });

  it("6. cita solo la fuente: no imprime fecha de corte ni confianza de la señal; filtra señales sin descripción y omite grupos vacíos", () => {
    const out = serializeMapaPESTEL({
      P: dim({ senalesFavorables: [sen("con texto", { fechaCorte: "2031-12-31", nivelConfianza: "alto" }), sen("")] }),
    });
    expect(out).toContain("+ con texto (Fuente: INEGI, 2020)");
    expect(out).not.toContain("2031-12-31");
    expect(out).not.toMatch(/alto/);
    expect(out).not.toContain("Señales adversas");
    expect(out).not.toContain("omitidas"); // la señal vacía no cuenta como omitida
  });
});
