// getMapaPESTELExpressPrompt: (1) caracterización — con las 6 dimensiones el texto sale idéntico byte a byte
// al de antes de parametrizarlo (fixture generado con el código anterior); (2) subconjuntos de 3 dimensiones.

import { describe, expect, it } from "vitest";
import { getMapaPESTELExpressPrompt } from "./prompts";
import golden from "./__fixtures__/express-prompt-antes-paso2.json";

const xpcto = { hito: "Ganar", sujeto: "Sujeto X", capacidades: { financiero: "f", humano: "h", logistico: "l" }, tiempo: { fechaLimite: "2027-11-04", duracionMeses: 12 }, justificacion: "j" };
const ctx = {
  news: [{ title: "Nota 1", link: "http://a", pubDate: "2026-10-01T00:00:00Z", content: "c1" }, { title: "Nota 2", link: "http://b", pubDate: "2026-10-02T00:00:00Z", content: "c2" }],
  dof: [{ title: "DOF 1", link: "http://d", pubDate: "2026-10-03T00:00:00Z", content: "x" }],
  inegi: [], banxico: [], sefix: null, bise: [],
} as never;
const archivos = [{ nombre: "doc.pdf", textoExtraido: "texto " + "x".repeat(50) }];
const TIPOS = ["ciudadano", "electoral", "gubernamental", "legislativo"];

describe("getMapaPESTELExpressPrompt — caracterización de las 6 dimensiones", () => {
  for (const tipo of TIPOS) {
    it(`${tipo}: sin opciones, el texto es idéntico byte a byte (con y sin contexto)`, () => {
      expect(getMapaPESTELExpressPrompt(tipo, xpcto, archivos, ctx)).toEqual((golden as Record<string, unknown>)[`${tipo}_con_contexto`]);
      expect(getMapaPESTELExpressPrompt(tipo, xpcto)).toEqual((golden as Record<string, unknown>)[`${tipo}_sin_contexto`]);
    });
  }
  it("pasar las 6 dimensiones explícitamente (sin compacto) también es idéntico", () => {
    expect(getMapaPESTELExpressPrompt("ciudadano", xpcto, archivos, ctx, { dimensiones: ["P", "E", "S", "T", "Ec", "L"] })).toEqual(
      (golden as Record<string, unknown>).ciudadano_con_contexto
    );
  });
});

describe("getMapaPESTELExpressPrompt — mitades de 3 dimensiones", () => {
  const A = ["P", "E", "S"] as const;
  const B = ["T", "Ec", "L"] as const;
  const mitad = (dims: readonly ("P" | "E" | "S" | "T" | "Ec" | "L")[], tipo = "ciudadano") =>
    getMapaPESTELExpressPrompt(tipo, xpcto, archivos, ctx, { dimensiones: dims, compacto: true }).user;

  it("cada mitad pide solo sus tres claves y nombra las de la otra", () => {
    const a = mitad(A);
    expect(a).toContain("las 3 claves en el nivel raíz: P, E, S");
    expect(a).toContain("tú escribes solo P, E, S. Otra parte cubre T, Ec, L");
    expect(a).not.toContain("las 6 claves");
    expect(a).not.toContain('"T": { "code"');
    expect(a).toContain('"P": { "code"');
    const b = mitad(B);
    expect(b).toContain("las 3 claves en el nivel raíz: T, Ec, L");
    expect(b).toContain("tú escribes solo T, Ec, L. Otra parte cubre P, E, S");
    expect(b).not.toContain('"P": { "code"');
    expect(b).toContain('"Ec": { "code"');
  });

  it("las instrucciones de profundidad son solo de las dimensiones de la mitad", () => {
    const a = mitad(A);
    expect(a).toMatch(/- P \(Político\)/);
    expect(a).not.toMatch(/- T \(Tecnológico\)/);
    const b = mitad(B);
    expect(b).toMatch(/- T \(Tecnológico\)/);
    expect(b).not.toMatch(/- P \(Político\)/);
  });

  it("cada mitad recibe el contexto completo: XPCTO, documentos, fuentes y reglas", () => {
    const completo = getMapaPESTELExpressPrompt("ciudadano", xpcto, archivos, ctx).user;
    for (const m of [mitad(A), mitad(B)]) {
      for (const trozo of ["Nota 1", "DOF 1", "doc.pdf", "Hito: Ganar", "REGLA ABSOLUTA SOBRE FUENTES", "REGLA DE NARRATIVA", "Omite el campo (o usa false)"]) {
        expect(completo).toContain(trozo);
        expect(m).toContain(trozo);
      }
    }
  });

  it("el JSON de ejemplo de cada mitad es compacto y el sistema lo pide en una sola línea", () => {
    const { system, user } = getMapaPESTELExpressPrompt("electoral", xpcto, archivos, ctx, { dimensiones: A, compacto: true });
    expect(system).toContain("en una sola línea, sin saltos de línea ni sangrías");
    expect(user).not.toContain('\n    "senalesFavorables"');
  });

  it("la clave `escaladaPorRelevanciaLocal` del ejemplo solo aparece en la mitad de Ec", () => {
    expect(mitad(A)).not.toContain('"escaladaPorRelevanciaLocal": false');
    expect(mitad(B)).toContain('"escaladaPorRelevanciaLocal": false');
  });

  it("el orden de las claves del ejemplo respeta el canónico aunque se pidan desordenadas", () => {
    const u = getMapaPESTELExpressPrompt("ciudadano", xpcto, archivos, ctx, { dimensiones: ["S", "P", "E"] }).user;
    expect(u.indexOf('"P": { "code"')).toBeLessThan(u.indexOf('"E": { "code"'));
    expect(u.indexOf('"E": { "code"')).toBeLessThan(u.indexOf('"S": { "code"'));
  });
});
