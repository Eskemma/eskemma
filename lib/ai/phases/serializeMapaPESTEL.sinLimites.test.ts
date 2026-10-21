// Paso 5: serializeMapaPESTEL sin límites de señales ni de descripción, con tope de seguridad y sin campos no certificables.
import { describe, expect, it } from "vitest";
import { estadisticasMapa, MapaDemasiadoGrandeError, MAX_CHARS_MAPA_SERIALIZADO, serializeMapaPESTEL } from "./prompts";
import { lineaMapa } from "@/lib/moddulo/registroModelo";

const sen = (descripcion: string, over: Record<string, unknown> = {}) => ({
  descripcion, fuente: "INEGI, 2020", fechaCorte: "2031-12", nivelConfianza: "alto", origenInternacional: true, ...over,
});
const dim = (over: Record<string, unknown> = {}) => ({
  label: "Político", clasificacion: "AMENAZA", confidence: 80, narrativa: "N.",
  senalesFavorables: [], senalesAdversas: [], senalesInciertas: [], ...over,
});

describe("serializeMapaPESTEL — sin límites (paso 5)", () => {
  it("más de 3 señales por categoría: se incluyen todas, sin «omitidas»", () => {
    const veinte = Array.from({ length: 20 }, (_, i) => sen(`favorable ${i + 1}`));
    const out = serializeMapaPESTEL({ P: dim({ senalesFavorables: veinte }) });
    for (let i = 1; i <= 20; i++) expect(out).toContain(`+ favorable ${i} (Fuente`);
    expect(out).not.toMatch(/omitid/);
  });

  it("descripciones largas intactas (2 000 caracteres), sin «…»", () => {
    const larga = "x".repeat(2000);
    const out = serializeMapaPESTEL({ P: dim({ senalesAdversas: [sen(larga)] }) });
    expect(out).toContain(`- ${larga} (Fuente: INEGI, 2020)`);
    expect(out).not.toContain("…");
  });

  it("no imprime nivelConfianza, fechaCorte ni origenInternacional", () => {
    const out = serializeMapaPESTEL({ P: dim({ senalesFavorables: [sen("algo")] }) });
    expect(out).not.toMatch(/alto|2031|corte|internacional|true|escalad/i);
  });

  it("la fuente solo aparece cuando existe (vacía, ausente → sin paréntesis)", () => {
    const out = serializeMapaPESTEL({
      P: dim({ senalesFavorables: [sen("con fuente"), sen("sin fuente", { fuente: "" }), sen("fuente ausente", { fuente: undefined })] }),
    });
    expect(out).toContain("+ con fuente (Fuente: INEGI, 2020)");
    expect(out).toContain("+ sin fuente\n");
    expect(out).toMatch(/\+ fuente ausente(\n|$)/);
    expect(out).not.toContain("(Fuente: )");
  });

  it("campos opcionales ausentes no inventan líneas (sin narrativa, sin confidence)", () => {
    const out = serializeMapaPESTEL({ P: { label: "Político", clasificacion: "NEUTRAL" } });
    expect(out).toBe("[P] Político — NEUTRAL");
  });

  it("orden estable: dimensiones P,E,S,T,Ec,L y señales en el orden de entrada (no por confianza)", () => {
    const mapa = {
      L: dim({ label: "Legal" }), P: dim(), Ec: dim({ label: "Ecológico" }),
      E: dim({ label: "Económico", senalesInciertas: [sen("z-baja", { nivelConfianza: "bajo" }), sen("a-alta", { nivelConfianza: "alto" })] }),
    };
    const a = serializeMapaPESTEL(mapa);
    expect(a).toBe(serializeMapaPESTEL(mapa));
    expect(a.indexOf("[P]")).toBeLessThan(a.indexOf("[E]"));
    expect(a.indexOf("[E]")).toBeLessThan(a.indexOf("[Ec]"));
    expect(a.indexOf("[Ec]")).toBeLessThan(a.indexOf("[L]"));
    expect(a.indexOf("z-baja")).toBeLessThan(a.indexOf("a-alta"));
  });

  it("vacío, una dimensión sin señales y señales sin descripción", () => {
    expect(serializeMapaPESTEL({})).toBe("");
    const solo = serializeMapaPESTEL({ S: dim({ label: "Social" }) });
    expect(solo).toBe("[S] Social — AMENAZA (confianza: 80%)\n  Narrativa: N.");
    expect(serializeMapaPESTEL({ P: dim({ senalesFavorables: [sen("")] }) })).not.toContain("Señales favorables");
  });

  it("no muta su entrada", () => {
    const mapa = { P: dim({ senalesFavorables: [sen("a"), sen("b")] }) };
    const copia = JSON.stringify(mapa);
    serializeMapaPESTEL(mapa);
    expect(JSON.stringify(mapa)).toBe(copia);
  });
});

describe("tope de seguridad", () => {
  // Builds a mapa whose serialization is exactly `n` characters (one dimension, narrative only).
  const conLongitud = (n: number) => {
    const base = "[P] Político — AMENAZA\n  Narrativa: ".length;
    return { P: { label: "Político", clasificacion: "AMENAZA", narrativa: "n".repeat(n - base) } };
  };

  it("justo en el tope pasa; un carácter más lanza", () => {
    expect(serializeMapaPESTEL(conLongitud(MAX_CHARS_MAPA_SERIALIZADO)).length).toBe(150_000);
    expect(() => serializeMapaPESTEL(conLongitud(MAX_CHARS_MAPA_SERIALIZADO + 1))).toThrow(MapaDemasiadoGrandeError);
  });

  it("el error y sus indicadores son solo números: ninguna cadena del contenido", () => {
    const MARCA = "MARCADOR-SECRETO-777";
    const mapa = { P: { ...conLongitud(150_001).P, senalesFavorables: [{ descripcion: MARCA, fuente: MARCA }] } };
    let err: unknown;
    try { serializeMapaPESTEL(mapa); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(MapaDemasiadoGrandeError);
    const e = err as MapaDemasiadoGrandeError;
    expect(e.longitud).toBeGreaterThan(150_000);
    expect(e.estadisticas.senales).toBe(1);
    expect(JSON.stringify({ m: e.message, l: e.longitud, s: e.estadisticas })).not.toContain(MARCA);
  });
});

describe("línea de medición (solo números)", () => {
  it("lleva longitud, señales, dims, max_desc y narrativa_total, sin contenido", () => {
    const MARCA = "CONTENIDO-NO-DEBE-SALIR";
    const e = estadisticasMapa({ P: dim({ narrativa: MARCA, senalesFavorables: [sen(MARCA + "x")] }), E: dim({ label: "Económico" }) });
    const l = lineaMapa("generate-dvs", e);
    expect(l).toMatch(/^\[generate-dvs\] mapa longitud=\d+ senales=1 dims=P:\d+,E:\d+ max_desc=\d+ narrativa_total=\d+$/);
    expect(l).not.toContain(MARCA);
  });
});
