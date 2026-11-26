import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inertarCubiertos, SELECTOR_CUBIERTOS } from "./inertCubiertos";

const el = (inert = false) => ({ inert });
const raizCon = (...els: { inert: boolean }[]) => ({ querySelectorAll: (s: string) => (s === SELECTOR_CUBIERTOS ? els : []) });

describe("inertarCubiertos (H-V63)", () => {
  it("usa solo el selector [data-cubre-dialogo]", () => {
    expect(SELECTOR_CUBIERTOS).toBe("[data-cubre-dialogo]");
  });
  it("pone inert a cada elemento marcado y la función devuelta lo restaura", () => {
    const a = el();
    const b = el();
    const restaurar = inertarCubiertos(raizCon(a, b));
    expect([a.inert, b.inert]).toEqual([true, true]);
    restaurar();
    expect([a.inert, b.inert]).toEqual([false, false]);
  });
  it("restaura el estado PREVIO: un elemento que ya era inerte sigue siéndolo", () => {
    const ya = el(true);
    const otro = el(false);
    inertarCubiertos(raizCon(ya, otro))();
    expect(ya.inert).toBe(true);
    expect(otro.inert).toBe(false);
  });
  it("restaurar dos veces es inocuo", () => {
    const a = el();
    const r = inertarCubiertos(raizCon(a));
    r();
    a.inert = true; // alguien lo vuelve a marcar después
    r();
    expect(a.inert).toBe(true);
  });
  it("si un elemento falla al restaurar, los demás se restauran igual", () => {
    const malo = { get inert() { return false; }, set inert(_v: boolean) { if (_v === false) throw new Error("fallo"); } } as { inert: boolean };
    const bueno = el();
    const restaurar = inertarCubiertos(raizCon(malo, bueno));
    expect(() => restaurar()).not.toThrow();
    expect(bueno.inert).toBe(false);
  });
  it("si la consulta falla a medias, lo ya marcado se restaura y no lanza", () => {
    const a = el();
    const raiz = { querySelectorAll: () => ({ length: 2, 0: a, get 1(): never { throw new Error("falló"); } }) };
    const restaurar = inertarCubiertos(raiz as never);
    expect(a.inert).toBe(true);
    expect(() => restaurar()).not.toThrow();
    expect(a.inert).toBe(false);
  });
  it("sin elementos marcados no hace nada", () => {
    expect(() => inertarCubiertos(raizCon())()).not.toThrow();
  });
});

describe("Layout: cabecera y pie marcados (estática)", () => {
  const src = readFileSync(path.join(process.cwd(), "app/components/Layout.tsx"), "utf8");
  it("la cabecera lleva data-cubre-dialogo", () => {
    expect(src).toMatch(/<header data-cubre-dialogo\b/);
  });
  it("el pie va dentro de un contenedor con data-cubre-dialogo y el contenido principal NO", () => {
    expect(src).toMatch(/<div data-cubre-dialogo>\s*<Footer \/>\s*<\/div>/);
    expect(src).not.toMatch(/<main[^>]*data-cubre-dialogo/);
    expect((src.match(/data-cubre-dialogo/g) ?? []).length).toBe(2);
  });
});
