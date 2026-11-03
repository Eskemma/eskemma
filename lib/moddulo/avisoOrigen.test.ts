import { describe, expect, it } from "vitest";
import { decidirAvisoOrigen } from "./avisoOrigen";
import type { ResultadoOrigen } from "@/lib/centinela/pestel/estadoOrigen";

const nueva: ResultadoOrigen = { estado: "version_nueva", importada: { version: 1, fecha: "2026-10-01T00:00:00.000Z" }, vigente: { version: 2, fecha: "2026-10-09T00:00:00.000Z" } };
const cambio: ResultadoOrigen = { estado: "cambio_contenido", importada: { version: 4 } };

describe("decidirAvisoOrigen", () => {
  it("versión nueva: dice cuál es, cuál usa el proyecto y qué hacer", () => {
    const a = decidirAvisoOrigen({ origen: nueva, f2Cerrada: false });
    expect(a.tipo).toBe("version_nueva");
    if (a.tipo !== "ninguno") {
      expect(a.texto).toContain("Hay una versión más nueva del análisis PESTEL (v2, 9 de octubre de 2026)");
      expect(a.texto).toContain("Este proyecto usa v1.");
      expect(a.texto).toContain("abre Centinela y regresa a Moddulo F2");
    }
  });
  it("cambio de contenido: dice que cambió después de importarlo y que lo que se ve es la versión importada", () => {
    const a = decidirAvisoOrigen({ origen: cambio, f2Cerrada: false });
    expect(a.tipo).toBe("cambio_contenido");
    if (a.tipo !== "ninguno") expect(a.texto).toContain("cambió después de importarlo");
  });
  it.each<[string, ResultadoOrigen | null | undefined, boolean]>([
    ["fase cerrada (aunque haya versión nueva)", nueva, true],
    ["fase cerrada y cambio de contenido", cambio, true],
    ["igual", { estado: "igual" }, false],
    ["no verificable", { estado: "no_verificable", razon: "sin_huella" }, false],
    ["sin dato", null, false],
    ["sin dato (undefined)", undefined, false],
  ])("sin aviso: %s", (_n, origen, f2Cerrada) => {
    expect(decidirAvisoOrigen({ origen, f2Cerrada })).toEqual({ tipo: "ninguno" });
  });
});
