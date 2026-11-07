// T4: la huella del CONTENIDO de un análisis de Centinela. Qué entra y qué no (ver contenidoOrigen.ts), estabilidad
// y completitud respecto de lo que `transformToMapaPESTEL` entrega a F2.
import { describe, expect, it } from "vitest";
import { huellaDeOrigen, huellaComparable } from "./huellaOrigen";
import { VERSION_HUELLA_ORIGEN, CAMPOS_MAPA, ajusteEquivalente, type AjusteCrudo, type DimensionCruda } from "./contenidoOrigen";
import { transformToMapaPESTEL, type RawAdjustment, type RawDimension } from "./transformToMapaPESTEL";
import { AJUSTES_EJEMPLO, DIMENSIONES_EJEMPLO } from "./__fixtures__/analisisEjemplo";
import type { F2DimensionPESTEL, F2Senal, AjusteAnalistaF2 } from "@/types/moddulo.types";

const clon = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const h = (d: unknown, a: unknown) => huellaDeOrigen(d as DimensionCruda[], a as AjusteCrudo[]).h;
const BASE = h(DIMENSIONES_EJEMPLO, AJUSTES_EJEMPLO);
const HASH_V2_SIN_NOTA = "c11748ac1ef77c7142f806796858121391eee8cb8e3871cb5ca45fdf60d38b4c";
const HASH_V2_CON_NOTA = "93dd61cb47ae75cc3f3d5397038427f32d583c3db578287f8f162f338f0a534a";

describe("huellaDeOrigen — estabilidad y versión", () => {
  it("HASH LITERAL v1 (T7 C3: la regla v1 NO cambió; las importaciones v1 se siguen comparando con ella)", () => {
    // El mismo literal que fijó T4. Se verificó verde ANTES de tocar `contenidoOrigen.ts` (con el código de 6e39852).
    expect(huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never, { version: 1 })).toEqual({
      v: 1,
      h: "e231635ea703d9ff82e7f6ef44233b41cfb0720852fd3b81d76685977c86cfb0",
    });
    // v1 ignora la nota por completo: pasarla no cambia nada.
    expect(huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never, { version: 1, nota: { confianza: 39, justificacion: "x" } }).h).toBe(
      "e231635ea703d9ff82e7f6ef44233b41cfb0720852fd3b81d76685977c86cfb0"
    );
  });

  it("HASH LITERAL v2 (vigente): si cambia, cambió la regla y hay que subir VERSION_HUELLA_ORIGEN", () => {
    expect(VERSION_HUELLA_ORIGEN).toBe(2);
    expect(huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never)).toEqual({ v: 2, h: HASH_V2_SIN_NOTA });
    expect(huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never, { nota: { confianza: 39, justificacion: "Se aprueba con reservas." } })).toEqual({
      v: 2,
      h: HASH_V2_CON_NOTA,
    });
  });

  it("v2: la nota entra (confianza y justificación recortada); la fecha de aprobación no; sin nota = hash sin nota", () => {
    const n = (x: object) => huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never, { nota: x as never }).h;
    const base = n({ confianza: 39, justificacion: "Se aprueba con reservas." });
    expect(n({ confianza: 39, justificacion: "  Se aprueba con reservas.\n", aprobadoEn: "2026-11-06T00:00:00.000Z" })).toBe(base);
    expect(n({ confianza: 38, justificacion: "Se aprueba con reservas." })).not.toBe(base);
    expect(n({ confianza: 39, justificacion: "Otra." })).not.toBe(base);
    expect(n({ confianza: 39 })).not.toBe(base);
    expect(n({ confianza: 39 })).not.toBe(h(DIMENSIONES_EJEMPLO, AJUSTES_EJEMPLO));
    expect(huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never, { nota: null }).h).toBe(h(DIMENSIONES_EJEMPLO, AJUSTES_EJEMPLO));
  });

  it("no depende del orden de las dimensiones ni de las claves; sí del orden de las señales", () => {
    expect(h([...DIMENSIONES_EJEMPLO].reverse(), AJUSTES_EJEMPLO)).toBe(BASE);
    const d = clon(DIMENSIONES_EJEMPLO);
    d[0].senalesAdversas = [{ descripcion: "a" }, { descripcion: "b" }] as never;
    const e = clon(d);
    e[0].senalesAdversas = [{ descripcion: "b" }, { descripcion: "a" }] as never;
    expect(h(d, AJUSTES_EJEMPLO)).not.toBe(h(e, AJUSTES_EJEMPLO));
  });

  it("null y ausente son lo mismo en una señal; un ajuste de una dimensión inexistente se ignora (como la transformación)", () => {
    const d = clon(DIMENSIONES_EJEMPLO);
    d[0].senalesFavorables = [{ descripcion: "Un aliado anunció su apoyo", fuente: null }] as never;
    expect(h(d, AJUSTES_EJEMPLO)).toBe(BASE);
    expect(h(DIMENSIONES_EJEMPLO, [...AJUSTES_EJEMPLO, { dimensionCode: "ZZ", newClassification: "NEUTRAL", justification: "x" }])).toBe(BASE);
  });

  it("huellaComparable: v1 y v2 (las que sabemos calcular) con un hash no vacío; otra versión, no", () => {
    expect(huellaComparable({ v: 1, h: "abc" })).toBe(true);
    expect(huellaComparable({ v: 2, h: "abc" })).toBe(true);
    expect(huellaComparable({ v: 3, h: "abc" })).toBe(false);
    expect(huellaComparable({ v: 1, h: "" })).toBe(false);
    expect(huellaComparable(undefined)).toBe(false);
    expect(huellaComparable(null)).toBe(false);
  });
});

describe("huellaDeOrigen — lo que NO es contenido no mueve la huella", () => {
  it.each([
    ["trend", (d: any) => { d[0].trend = "DESCENDENTE"; }],
    ["intensity", (d: any) => { d[0].intensity = "BAJA"; }],
    ["mainSignal", (d: any) => { d[0].mainSignal = "otra"; }],
  ])("el campo del análisis %s no entra", (_n, mutar) => {
    const d = clon(DIMENSIONES_EJEMPLO);
    mutar(d);
    expect(h(d, AJUSTES_EJEMPLO)).toBe(BASE);
  });

  it("adjustedBy y las posiciones del ajuste no entran", () => {
    const a = clon(AJUSTES_EJEMPLO) as any[];
    a[0].adjustedBy = "otro";
    a[0].originalPosition = { x: 1, y: 1 };
    a[0].newPosition = { x: 2, y: 2 };
    expect(h(DIMENSIONES_EJEMPLO, a)).toBe(BASE);
  });

  it("espacios en los extremos de la justificación no cuentan", () => {
    const a = clon(AJUSTES_EJEMPLO) as any[];
    a[0].justification = `  ${a[0].justification}\n`;
    expect(h(DIMENSIONES_EJEMPLO, a)).toBe(BASE);
  });
});

describe("huellaDeOrigen — lo que SÍ es contenido mueve la huella", () => {
  it.each([
    ["classification", (d: any) => { d[0].classification = "NEUTRAL"; }],
    ["narrative", (d: any) => { d[0].narrative = "otra"; }],
    ["confidence", (d: any) => { d[0].confidence = 10; }],
    ["una señal adversa", (d: any) => { d[0].senalesAdversas[0].descripcion = "otra"; }],
    ["la fuente de una señal", (d: any) => { d[0].senalesAdversas[0].fuente = "otra"; }],
    ["la fecha de corte de una señal", (d: any) => { d[0].senalesAdversas[0].fechaCorte = "2025-01"; }],
    ["el nivel de confianza de una señal", (d: any) => { d[0].senalesAdversas[0].nivelConfianza = "bajo"; }],
    ["origenInternacional de una señal", (d: any) => { d[0].senalesAdversas[0].origenInternacional = true; }],
    ["una señal incierta", (d: any) => { d[1].senalesInciertas.push({ descripcion: "nueva" }); }],
  ])("%s", (_n, mutar) => {
    const d = clon(DIMENSIONES_EJEMPLO);
    mutar(d);
    expect(h(d, AJUSTES_EJEMPLO)).not.toBe(BASE);
  });

  it.each([
    ["la clasificación ajustada", (a: any) => { a[0].newClassification = "NEUTRAL"; }],
    ["la justificación", (a: any) => { a[0].justification = "otra"; }],
    ["la clasificación original", (a: any) => { a[0].originalClassification = "NEUTRAL"; }],
    ["la fecha del ajuste (F2 la muestra)", (a: any) => { a[0].adjustedAt = "2026-11-02T12:00:00.000Z"; }],
    ["un ajuste nuevo en otra dimensión", (a: any) => { a.push({ dimensionCode: "E", newClassification: "AMENAZA", justification: "x" }); }],
  ])("%s", (_n, mutar) => {
    const a = clon(AJUSTES_EJEMPLO);
    mutar(a);
    expect(h(DIMENSIONES_EJEMPLO, a)).not.toBe(BASE);
  });

  it("quitar el ajuste cambia la huella; con varios ajustes de la misma dimensión vale el último", () => {
    expect(h(DIMENSIONES_EJEMPLO, [])).not.toBe(BASE);
    const a = clon(AJUSTES_EJEMPLO) as any[];
    a.unshift({ ...a[0], newClassification: "AMENAZA", justification: "viejo" });
    expect(h(DIMENSIONES_EJEMPLO, a)).toBe(BASE);
  });
});

describe("completitud: todo campo que F2 recibe está en la huella o excluido con su razón", () => {
  // Compilación: si F2DimensionPESTEL, F2Senal o AjusteAnalistaF2 ganan un campo, esto deja de compilar.
  const _d: Record<keyof F2DimensionPESTEL, string> = CAMPOS_MAPA.dimension;
  const _s: Record<keyof F2Senal, string> = CAMPOS_MAPA.senal;
  const _a: Record<keyof AjusteAnalistaF2, string> = CAMPOS_MAPA.ajuste;

  const mapa = transformToMapaPESTEL(
    clon(DIMENSIONES_EJEMPLO) as unknown as RawDimension[],
    clon(AJUSTES_EJEMPLO) as unknown as RawAdjustment[]
  );
  const dim = mapa.P!;

  it("cada clave que la transformación produce está clasificada (si se agrega un campo al mapa sin clasificarlo, falla)", () => {
    expect(_d && _s && _a).toBeTruthy();
    const claves = (o: object) => Object.keys(o);
    for (const k of claves(dim)) expect(CAMPOS_MAPA.dimension, `dimensión: ${k}`).toHaveProperty(k);
    for (const k of claves(dim.senalesAdversas[0])) expect(CAMPOS_MAPA.senal, `señal: ${k}`).toHaveProperty(k);
    for (const k of claves(dim.ajuste!)) expect(CAMPOS_MAPA.ajuste, `ajuste: ${k}`).toHaveProperty(k);
  });

  it("todo campo clasificado como «huella» mueve la huella al cambiar su origen en el análisis", () => {
    const origen: Record<string, (d: any, a: any) => void> = {
      "dimension.code": (d) => { d[0].code = "T"; },
      "dimension.clasificacion": (d) => { d[0].classification = "NEUTRAL"; },
      "dimension.senalesFavorables": (d) => { d[0].senalesFavorables.push({ descripcion: "n" }); },
      "dimension.senalesAdversas": (d) => { d[0].senalesAdversas.push({ descripcion: "n" }); },
      "dimension.senalesInciertas": (d) => { d[1].senalesInciertas.push({ descripcion: "n" }); },
      "dimension.narrativa": (d) => { d[0].narrative = "n"; },
      "dimension.confidence": (d) => { d[0].confidence = 1; },
      "dimension.ajuste": (_d, a) => { a.length = 0; },
      "senal.descripcion": (d) => { d[0].senalesAdversas[0].descripcion = "n"; },
      "senal.fuente": (d) => { d[0].senalesAdversas[0].fuente = "n"; },
      "senal.fechaCorte": (d) => { d[0].senalesAdversas[0].fechaCorte = "n"; },
      "senal.nivelConfianza": (d) => { d[0].senalesAdversas[0].nivelConfianza = "bajo"; },
      "senal.origenInternacional": (d) => { d[0].senalesAdversas[0].origenInternacional = true; },
      "ajuste.clasificacionOriginal": (_d, a) => { a[0].originalClassification = "NEUTRAL"; },
      "ajuste.clasificacionAjustada": (_d, a) => { a[0].newClassification = "NEUTRAL"; },
      "ajuste.justificacion": (_d, a) => { a[0].justification = "n"; },
      "ajuste.ajustadoEn": (_d, a) => { a[0].adjustedAt = "2030-01-01T00:00:00.000Z"; },
    };
    for (const [grupo, campos] of Object.entries(CAMPOS_MAPA)) {
      for (const [campo, valor] of Object.entries(campos)) {
        if (valor !== "huella") {
          expect(valor, `${grupo}.${campo} excluido sin razón`).toMatch(/^excluido: .{10,}/);
          continue;
        }
        const mutar = origen[`${grupo}.${campo}`];
        expect(mutar, `falta la mutación de prueba de ${grupo}.${campo}`).toBeTypeOf("function");
        const d = clon(DIMENSIONES_EJEMPLO);
        const a = clon(AJUSTES_EJEMPLO);
        mutar(d, a);
        expect(h(d, a), `${grupo}.${campo} no mueve la huella`).not.toBe(BASE);
      }
    }
  });

  it("los campos excluidos no mueven la huella: label (derivado) y posiciones", () => {
    expect(CAMPOS_MAPA.ajuste.posiciones).toMatch(/^excluido:/);
    expect(CAMPOS_MAPA.dimension.label).toMatch(/^excluido:/);
    expect(CAMPOS_MAPA.dimension.escaladaPorRelevanciaLocal).toMatch(/^excluido:/);
  });
});

describe("ajusteEquivalente — el criterio compartido con la nota de T3", () => {
  it("compara clasificación ajustada y justificación recortada", () => {
    expect(ajusteEquivalente({ clasificacionAjustada: "A", justificacion: " x " }, { newClassification: "A", justification: "x" })).toBe(true);
    expect(ajusteEquivalente({ clasificacionAjustada: "A", justificacion: "x" }, { newClassification: "B", justification: "x" })).toBe(false);
    expect(ajusteEquivalente({ clasificacionAjustada: "A", justificacion: "x" }, { newClassification: "A", justification: "y" })).toBe(false);
    expect(ajusteEquivalente(undefined, { newClassification: "A", justification: "x" })).toBe(false);
  });
});
