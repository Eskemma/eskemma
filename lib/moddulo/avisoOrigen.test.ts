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

describe("decidirAvisoOrigen — cambio_nota: tres textos y el botón nombrado (T7 C3 / C3b)", () => {
  const caso = (cambioNota?: "agregada" | "cambiada" | "retirada", version: number | null = 1): ResultadoOrigen => ({
    estado: "cambio_nota", ...(cambioNota ? { cambioNota } : {}), importada: { ...(version != null ? { version } : {}), fecha: "2026-10-01T00:00:00.000Z" },
  });
  const texto = (o: ResultadoOrigen) => {
    const a = decidirAvisoOrigen({ origen: o, f2Cerrada: false });
    expect(a.tipo).toBe("cambio_nota");
    if (a.tipo === "ninguno") throw new Error("debía avisar");
    return a.texto;
  };
  it("agregada: no afirma secuencia ni habla de «nota importada» (no la hay)", () => {
    const t = texto(caso("agregada"));
    expect(t).toBe(
      "El análisis PESTEL de origen (versión 1) tiene ahora una nota de aprobación del analista (aprobado con confianza baja) que este proyecto no incluye. Para actualizar, abre Centinela y usa «Regresar a Moddulo F2 con resultados»."
    );
    expect(t).not.toMatch(/después de importarlo|nota importada|se retiró/);
  });
  it("cambiada: dice que cambió y que lo que se ve es la nota importada", () => {
    expect(texto(caso("cambiada"))).toBe(
      "La nota de aprobación del análisis PESTEL de origen (versión 1) cambió después de importarlo, por ejemplo al volver a aprobarlo con otra justificación. Lo que ves aquí es la nota importada. Para actualizar, abre Centinela y usa «Regresar a Moddulo F2 con resultados»."
    );
  });
  it("retirada (NO se alcanza desde la UI: retirar la aprobación es ajustar y eso cambia el contenido; solo prueba unitaria)", () => {
    expect(texto(caso("retirada"))).toBe(
      "La nota de aprobación del análisis PESTEL de origen (versión 1) se retiró después de importarlo. Lo que ves aquí es la nota importada, que ya no está vigente. Para actualizar, abre Centinela y usa «Regresar a Moddulo F2 con resultados»."
    );
  });
  it("sin versión legible se dice sin ella; sin variante (dato antiguo) cae al texto de «cambiada»", () => {
    expect(texto(caso("agregada", null))).toContain("El análisis PESTEL de origen tiene ahora una nota");
    expect(texto(caso(undefined))).toContain("cambió después de importarlo");
  });
  it("nada con la Fase 2 cerrada (como los demás); el texto del cambio de contenido también nombra el botón", () => {
    expect(decidirAvisoOrigen({ origen: caso("agregada"), f2Cerrada: true })).toEqual({ tipo: "ninguno" });
    const c = decidirAvisoOrigen({ origen: { estado: "cambio_contenido", importada: { version: 1 } }, f2Cerrada: false });
    if (c.tipo === "ninguno") throw new Error("debía avisar");
    expect(c.texto).toContain("abre Centinela y usa «Regresar a Moddulo F2 con resultados»");
  });
});
