// C1a — huellas y diff por ítem. Módulo nuevo: no hay comportamiento anterior que caracterizar.
import { describe, expect, it } from "vitest";
import { diffItems, huellaContenido, huellaTupla, huellasPorItem } from "./huella";

describe("huellaContenido", () => {
  it("no depende del orden de las claves", () => {
    expect(huellaContenido({ a: 1, b: { c: 2, d: 3 } })).toBe(huellaContenido({ b: { d: 3, c: 2 }, a: 1 }));
  });
  it("distingue contenido distinto (incluido el orden de un arreglo)", () => {
    expect(huellaContenido({ a: 1 })).not.toBe(huellaContenido({ a: 2 }));
    expect(huellaContenido([1, 2])).not.toBe(huellaContenido([2, 1]));
  });
  it("ignora las claves undefined, como la serialización estable", () => {
    expect(huellaContenido({ a: 1, b: undefined })).toBe(huellaContenido({ a: 1 }));
  });
  it("es un sha-256 hexadecimal de 64 caracteres, también para null y para undefined", () => {
    expect(huellaContenido({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
    expect(huellaContenido(null)).toMatch(/^[0-9a-f]{64}$/);
    expect(huellaContenido(undefined)).toBe(huellaContenido(null));
  });
});

describe("huellaTupla — contenido + aprobación + insumos + estado", () => {
  const base = { contenido: { x: 1 } };
  it("el mismo contenido con la aprobación retirada es OTRA tupla", () => {
    const aprobada = { ...base, aprobacion: { aprobado: true, por: "u1", en: "2026-01-01", huella: "h" } };
    expect(huellaTupla(aprobada)).not.toBe(huellaTupla(base));
  });
  it("cambiar insumos/dependeDe o el estado cambia la tupla; un estado omitido equivale a «vigente»", () => {
    const conInsumos = { ...base, insumos: { dependeDe: [{ artefacto: "o", versionId: "v1", huella: "h" }] } };
    expect(huellaTupla(conInsumos)).not.toBe(huellaTupla(base));
    expect(huellaTupla({ ...base, estado: "propuesta" })).not.toBe(huellaTupla(base));
    expect(huellaTupla({ ...base, estado: "vigente" })).toBe(huellaTupla(base));
  });
  it("es estable ante el orden de claves del contenido y de la aprobación", () => {
    const a = { contenido: { p: 1, q: 2 }, aprobacion: { aprobado: true, por: "u", en: "e" } };
    const b = { aprobacion: { en: "e", por: "u", aprobado: true }, contenido: { q: 2, p: 1 } };
    expect(huellaTupla(a)).toBe(huellaTupla(b));
  });
});

describe("huellasPorItem y diffItems", () => {
  const items = [
    { id: "p1", valor: { t: "uno" } },
    { id: "p2", valor: { t: "dos" } },
  ];
  it("huellas por id", () => {
    const h = huellasPorItem(items);
    expect(Object.keys(h)).toEqual(["p1", "p2"]);
    expect(h.p1).toBe(huellaContenido({ t: "uno" }));
  });
  it("sin cambios: todos iguales", () => {
    const h = huellasPorItem(items);
    expect(diffItems(h, h)).toEqual({ agregados: [], eliminados: [], cambiados: [], iguales: ["p1", "p2"] });
  });
  it("agregados, eliminados y cambiados, en orden determinista", () => {
    const antes = huellasPorItem(items);
    const despues = huellasPorItem([
      { id: "p2", valor: { t: "dos EDITADO" } },
      { id: "p0", valor: { t: "nuevo" } },
    ]);
    expect(diffItems(antes, despues)).toEqual({ agregados: ["p0"], eliminados: ["p1"], cambiados: ["p2"], iguales: [] });
  });
  it("un id repetido conserva el último valor (el módulo no inventa ids)", () => {
    const h = huellasPorItem([{ id: "a", valor: 1 }, { id: "a", valor: 2 }]);
    expect(h.a).toBe(huellaContenido(2));
  });
  it("sin ítems: mapas vacíos", () => {
    expect(huellasPorItem([])).toEqual({});
    expect(diffItems({}, {})).toEqual({ agregados: [], eliminados: [], cambiados: [], iguales: [] });
  });
});
