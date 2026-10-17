import { describe, expect, it } from "vitest";
import { aplicarUpdateFirestore, BORRAR } from "./__tests__/fixtures/semanticaUpdate";

describe("aplicarUpdateFirestore (semántica de rutas con puntos)", () => {
  it("una ruta con puntos fusiona dentro del mapa sin reemplazarlo; un valor objeto reemplaza la hoja; el centinela borra", () => {
    const doc = { a: { m1: { x: 1, y: 2 }, otro: 3 } };
    expect(aplicarUpdateFirestore(doc, { "a.m1.z": 9 })).toEqual({ a: { m1: { x: 1, y: 2, z: 9 }, otro: 3 } });
    expect(aplicarUpdateFirestore(doc, { "a.m1": { z: 9 } })).toEqual({ a: { m1: { z: 9 }, otro: 3 } });
    expect(aplicarUpdateFirestore(doc, { "a.otro": BORRAR })).toEqual({ a: { m1: { x: 1, y: 2 } } });
    expect(aplicarUpdateFirestore({}, { "a.b.c": 1 })).toEqual({ a: { b: { c: 1 } } });
    expect(doc).toEqual({ a: { m1: { x: 1, y: 2 }, otro: 3 } }); // no muta
  });
});
