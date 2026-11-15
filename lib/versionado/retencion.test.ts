// C1a — poda por artefacto y revisiones parciales (módulo puro).
import { describe, expect, it } from "vitest";
import { artefactosNoRecuperables, decidirPoda, revisionEsParcial } from "./retencion";
import type { RetenidaRef } from "./tipos";

const r = (n: number, extra: Partial<RetenidaRef> = {}): RetenidaRef => ({ id: `v${n}`, n, aprobada: false, protegida: false, ...extra });
const lista = (cuantas: number, extra: (n: number) => Partial<RetenidaRef> = () => ({})) =>
  Array.from({ length: cuantas }, (_, i) => r(i + 1, extra(i + 1)));

describe("decidirPoda", () => {
  it("bajo el tope (o justo en el tope) no poda nada", () => {
    expect(decidirPoda(lista(5), { tope: 20, vigenteId: "v5" })).toEqual([]);
    expect(decidirPoda(lista(20), { tope: 20, vigenteId: "v20" })).toEqual([]);
  });
  it("sobre el tope poda las más antiguas no protegidas", () => {
    expect(decidirPoda(lista(21), { tope: 20, vigenteId: "v21" })).toEqual(["v1"]);
  });
  it("máximo 2 borrados por escritura, de la más antigua a la más nueva", () => {
    expect(decidirPoda(lista(30), { tope: 20, vigenteId: "v30" })).toEqual(["v1", "v2"]);
    expect(decidirPoda(lista(30), { tope: 20, vigenteId: "v30", maxBorrados: 1 })).toEqual(["v1"]);
  });
  it("protege las aprobadas", () => {
    const l = lista(23, (n) => (n === 1 ? { aprobada: true } : {}));
    expect(decidirPoda(l, { tope: 20, vigenteId: "v23" })).toEqual(["v2", "v3"]);
  });
  it("protege las referenciadas por un dependeDe vigente o por un cierre (protegida)", () => {
    const l = lista(23, (n) => (n <= 2 ? { protegida: true } : {}));
    expect(decidirPoda(l, { tope: 20, vigenteId: "v23" })).toEqual(["v3"]);
  });
  it("nunca poda la vigente, aunque sea la más antigua por n (la lista puede quedar por encima del tope)", () => {
    const l = lista(21);
    expect(decidirPoda(l, { tope: 20, vigenteId: "v1" })).toEqual([]);
    expect(decidirPoda(l, { tope: 20, vigenteId: "v21" })).toEqual(["v1"]);
  });
  it("si todo lo que excede está protegido, no poda (las protegidas pueden superar el tope)", () => {
    const l = lista(25, () => ({ aprobada: true }));
    expect(decidirPoda(l, { tope: 20, vigenteId: "v25" })).toEqual([]);
  });
  it("es determinista: no depende del orden de entrada", () => {
    const l = lista(25);
    expect(decidirPoda([...l].reverse(), { tope: 20, vigenteId: "v25" })).toEqual(decidirPoda(l, { tope: 20, vigenteId: "v25" }));
  });
  it("con el tope por defecto (20) y el máximo por defecto (2)", () => {
    expect(decidirPoda(lista(40), { vigenteId: "v40" })).toEqual(["v1", "v2"]);
  });
});

describe("revisiones parciales (se calculan AL LEER; la poda no protege revisiones antiguas)", () => {
  const manifiesto = { dvs: { versionId: "dvs__000002" }, "m1.aprobacion": { versionId: "m1.aprobacion__000001" } };
  it("completa: todas las versiones que cita existen", () => {
    const existen = new Set(["dvs__000002", "m1.aprobacion__000001"]);
    expect(artefactosNoRecuperables(manifiesto, existen)).toEqual([]);
    expect(revisionEsParcial(manifiesto, existen)).toBe(false);
  });
  it("parcial: dice cuáles artefactos ya no se pueden recuperar (requisito de C4)", () => {
    const existen = new Set(["m1.aprobacion__000001"]);
    expect(artefactosNoRecuperables(manifiesto, existen)).toEqual([{ artefacto: "dvs", versionId: "dvs__000002" }]);
    expect(revisionEsParcial(manifiesto, existen)).toBe(true);
  });
});
