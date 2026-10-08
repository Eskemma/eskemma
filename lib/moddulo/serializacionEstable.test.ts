import { describe, expect, it } from "vitest";
import { serializacionEstable, sonIgualesEstable } from "./serializacionEstable";

describe("serializacionEstable", () => {
  it("no depende del orden de las claves (en cualquier nivel)", () => {
    const a = { hei: { contexto: "x", tensionCentral: "y" }, pip: [{ pipItemId: "1", pregunta: "p" }] };
    const b = { pip: [{ pregunta: "p", pipItemId: "1" }], hei: { tensionCentral: "y", contexto: "x" } };
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(serializacionEstable(a)).toBe(serializacionEstable(b));
    expect(sonIgualesEstable(a, b)).toBe(true);
  });

  it("el orden de los arreglos SÍ importa (es contenido)", () => {
    expect(sonIgualesEstable({ pip: [1, 2] }, { pip: [2, 1] })).toBe(false);
  });

  it("detecta un cambio de contenido", () => {
    expect(sonIgualesEstable({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it("ignora claves undefined (Firestore no las guarda)", () => {
    expect(sonIgualesEstable({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });
});
