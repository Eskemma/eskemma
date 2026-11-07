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
      expect(a.texto).toContain("abre Centinela y usa «Regresar a Moddulo F2 con resultados»");
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

describe("decidirAvisoOrigen — cambio_nota y el botón nombrado (T7 C3)", () => {
  const nota: ResultadoOrigen = { estado: "cambio_nota", importada: { version: 1, fecha: "2026-10-01T00:00:00.000Z" } };
  it("dice que la nota de aprobación cambió o se retiró y nombra el botón de Centinela", () => {
    const a = decidirAvisoOrigen({ origen: nota, f2Cerrada: false });
    expect(a.tipo).toBe("cambio_nota");
    if (a.tipo === "ninguno") throw new Error("debía avisar");
    expect(a.texto).toBe(
      "La nota de aprobación del análisis PESTEL de origen (v1) cambió o se retiró después de importarlo, por ejemplo al volver a aprobarlo con otra justificación. Lo que ves aquí es la nota importada. Para actualizar, abre Centinela y usa «Regresar a Moddulo F2 con resultados»."
    );
  });
  it("nada con la Fase 2 cerrada (como los demás); el texto del cambio de contenido también nombra el botón", () => {
    expect(decidirAvisoOrigen({ origen: nota, f2Cerrada: true })).toEqual({ tipo: "ninguno" });
    const c = decidirAvisoOrigen({ origen: { estado: "cambio_contenido", importada: { version: 1 } }, f2Cerrada: false });
    if (c.tipo === "ninguno") throw new Error("debía avisar");
    expect(c.texto).toContain("abre Centinela y usa «Regresar a Moddulo F2 con resultados»");
  });
});
