// T3 (D3): los ajustes del analista viajan en el mapa. `ajuste` solo existe cuando HAY ajuste (la huella de los mapas
// sin ajustes no cambia), sin `ajustadoPor`, con la clasificación ajustada en `clasificacion`, y sin claves
// `undefined`/`null` (Firestore rechaza `undefined`). Un dato ilegible NUNCA descarta el ajuste completo.
import { afterEach, describe, expect, it, vi } from "vitest";
import { transformToMapaPESTEL, type RawAdjustment, type RawDimension } from "./transformToMapaPESTEL";
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";

const dims: RawDimension[] = [
  { code: "P", classification: "AMENAZA", narrative: "Narrativa de la IA", confidence: 80 },
  { code: "E", classification: "NEUTRAL", narrative: "n", confidence: 60 },
];
const ajusteP: RawAdjustment = {
  dimensionCode: "P", originalClassification: "AMENAZA", newClassification: "OPORTUNIDAD",
  justification: "El contexto cambió por completo", adjustedAt: "2026-10-20T15:30:00.000Z", adjustedBy: "uid-secreto",
  originalPosition: { x: 75, y: 85 }, newPosition: { x: 40, y: 20 },
} as RawAdjustment;

const sinNiNull = (v: unknown, ruta = "$"): string[] => {
  if (v === undefined || v === null) return [ruta];
  if (Array.isArray(v)) return v.flatMap((x, i) => sinNiNull(x, `${ruta}[${i}]`));
  if (typeof v === "object") return Object.entries(v as object).flatMap(([k, x]) => (k === "narrativa" || k === "confidence" ? [] : sinNiNull(x, `${ruta}.${k}`)));
  return [];
};

afterEach(() => vi.restoreAllMocks());

describe("transformToMapaPESTEL — con ajustes (T3)", () => {
  it("la clasificación es la ajustada y el ajuste lleva original, ajustada, justificación, fecha ISO y posiciones; sin ajustadoPor", () => {
    const m = transformToMapaPESTEL(dims, [ajusteP]);
    expect(m.P?.clasificacion).toBe("OPORTUNIDAD");
    expect(m.P?.narrativa).toBe("Narrativa de la IA");
    expect(m.P?.confidence).toBe(80);
    expect(m.P?.ajuste).toEqual({
      clasificacionOriginal: "AMENAZA", clasificacionAjustada: "OPORTUNIDAD", justificacion: "El contexto cambió por completo",
      ajustadoEn: "2026-10-20T15:30:00.000Z", posiciones: { original: { x: 75, y: 85 }, nueva: { x: 40, y: 20 } },
    });
    expect(JSON.stringify(m)).not.toContain("uid-secreto");
    expect(Object.prototype.hasOwnProperty.call(m.P?.ajuste, "ajustadoPor")).toBe(false);
  });

  it("la dimensión sin ajuste NO trae la clave `ajuste`", () => {
    const m = transformToMapaPESTEL(dims, [ajusteP]);
    expect(Object.prototype.hasOwnProperty.call(m.E, "ajuste")).toBe(false);
    expect(m.E?.clasificacion).toBe("NEUTRAL");
  });

  it("acepta la fecha como Timestamp de Admin, {_seconds} o ISO", () => {
    const ms = Date.parse("2026-10-20T15:30:00.000Z");
    for (const adjustedAt of [{ toMillis: () => ms }, { _seconds: ms / 1000 }, "2026-10-20T15:30:00.000Z"]) {
      expect(transformToMapaPESTEL(dims, [{ ...ajusteP, adjustedAt }]).P?.ajuste?.ajustadoEn).toBe("2026-10-20T15:30:00.000Z");
    }
  });

  it("fecha ilegible: el ajuste se CONSERVA sin ajustadoEn y queda un aviso sin contenido", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = transformToMapaPESTEL(dims, [{ ...ajusteP, adjustedAt: "no es fecha" }]);
    expect(m.P?.clasificacion).toBe("OPORTUNIDAD");
    expect(m.P?.ajuste).toMatchObject({ clasificacionOriginal: "AMENAZA", clasificacionAjustada: "OPORTUNIDAD", justificacion: "El contexto cambió por completo" });
    expect(Object.prototype.hasOwnProperty.call(m.P?.ajuste, "ajustadoEn")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain("El contexto cambió");
    // ausente también
    const sinFecha = transformToMapaPESTEL(dims, [{ ...ajusteP, adjustedAt: undefined }]);
    expect(sinFecha.P?.ajuste?.justificacion).toBe("El contexto cambió por completo");
  });

  it("posiciones incompletas: se omite solo `posiciones`, no el ajuste", () => {
    const m = transformToMapaPESTEL(dims, [{ ...ajusteP, newPosition: { x: 10 } }]);
    expect(Object.prototype.hasOwnProperty.call(m.P?.ajuste, "posiciones")).toBe(false);
    expect(m.P?.ajuste?.clasificacionAjustada).toBe("OPORTUNIDAD");
  });

  it("ajuste solo de posición (misma clasificación): se conserva con original = ajustada", () => {
    const m = transformToMapaPESTEL(dims, [{ ...ajusteP, newClassification: "AMENAZA" }]);
    expect(m.P?.clasificacion).toBe("AMENAZA");
    expect(m.P?.ajuste).toMatchObject({ clasificacionOriginal: "AMENAZA", clasificacionAjustada: "AMENAZA" });
  });

  it("ninguna clave undefined ni null en el mapa (con y sin datos opcionales)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = transformToMapaPESTEL(dims, [{ ...ajusteP, adjustedAt: undefined, newPosition: undefined }]);
    expect(sinNiNull(m.P?.ajuste)).toEqual([]);
  });

  it("la huella: estable ante el orden de claves del ajuste, y distinta de la del mapa sin ajuste", () => {
    const a = transformToMapaPESTEL(dims, [ajusteP]);
    const reordenado = JSON.parse(JSON.stringify(a)) as typeof a;
    const aj = reordenado.P!.ajuste!;
    reordenado.P!.ajuste = { posiciones: aj.posiciones, ajustadoEn: aj.ajustadoEn, justificacion: aj.justificacion, clasificacionAjustada: aj.clasificacionAjustada, clasificacionOriginal: aj.clasificacionOriginal } as never;
    expect(huellaMapaPESTEL(reordenado)).toBe(huellaMapaPESTEL(a));
    expect(huellaMapaPESTEL(a)).not.toBe(huellaMapaPESTEL(transformToMapaPESTEL(dims)));
  });

  it("sin ajustes (o lista vacía) el mapa es idéntico al de siempre", () => {
    expect(transformToMapaPESTEL(dims, [])).toEqual(transformToMapaPESTEL(dims));
    expect(transformToMapaPESTEL(dims, null)).toEqual(transformToMapaPESTEL(dims));
  });
});
