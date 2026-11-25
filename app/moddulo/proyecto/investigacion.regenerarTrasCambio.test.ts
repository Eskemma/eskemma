// H-V48 (C4b-0): prueba ESTÁTICA (no hay DOM en la suite). Con el 409 `f3_estado_cambio` (tipo «desactualizado»)
// la página recarga proyecto y resultados, y el botón de generar sigue disponible (no se escribió nada).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const base = "app/moddulo/proyecto/[projectId]/investigacion";
const page = readFileSync(`${base}/page.tsx`, "utf8");

describe("investigación — tras un aviso «desactualizado» al generar", () => {
  for (const k of ["sintesis", "veredicto"]) {
    it(`generar_${k}: recarga proyecto y resultados`, () => {
      const i = page.indexOf(`decidirGeneracionF3UI("generar_${k}", resp)`);
      const bloque = page.slice(i, i + 900);
      expect(bloque).toContain('if (d.tipo === "desactualizado") { loadProject(); loadResultados(); }');
    });
  }
  it("el botón de generar solo se apaga mientras genera (no por el aviso) y reaparece si no se guardó nada", () => {
    for (const [f, flag] of [["F3Sintesis", "sintesis"], ["F3Veredicto", "veredicto"]] as const) {
      const src = readFileSync(`${base}/components/${f}.tsx`, "utf8");
      expect(src).toContain(`if (!${flag}) {`);
      expect(src).toContain("disabled={generando || !puedeGenerar}");
    }
  });
});
