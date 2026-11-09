// T7 C5 — textos COMPLETOS de `version_nueva` y `cambio_contenido` y sus bordes (sin versión, sin fecha). Se escribió como
// CARACTERIZACIÓN (verde contra HEAD con «vN») y la etiqueta se invirtió a propósito a «versión N» en C5; los bordes no cambian.
import { describe, expect, it } from "vitest";
import { decidirAvisoOrigen, etiquetaVersionTexto } from "./avisoOrigen";
import { decidirEstadoOrigen } from "@/lib/centinela/pestel/estadoOrigen";
import type { ResultadoOrigen } from "@/lib/centinela/pestel/estadoOrigen";

const texto = (o: ResultadoOrigen) => {
  const a = decidirAvisoOrigen({ origen: o, f2Cerrada: false });
  if (a.tipo === "ninguno") throw new Error("debía avisar");
  return a.texto;
};
const ACCION = "Para actualizar, abre Centinela y usa «Regresar a Moddulo F2 con resultados».";
const F1 = "2026-10-01T00:00:00.000Z", F2 = "2026-10-09T00:00:00.000Z";

describe("version_nueva — texto completo", () => {
  it("con versión y fecha del vigente y versión importada", () => {
    expect(texto({ estado: "version_nueva", importada: { version: 1, fecha: F1 }, vigente: { version: 2, fecha: F2 } })).toBe(
      `Hay una versión más nueva del análisis PESTEL (versión 2, 9 de octubre de 2026). Este proyecto usa la versión 1. ${ACCION}`
    );
  });
  it("sin versión del vigente: solo la fecha entre paréntesis", () => {
    expect(texto({ estado: "version_nueva", importada: { version: 1 }, vigente: { fecha: F2 } })).toContain("Hay una versión más nueva del análisis PESTEL (9 de octubre de 2026).");
  });
  it("sin versión ni fecha del vigente: sin paréntesis; sin versión importada: «una versión anterior»", () => {
    const t = texto({ estado: "version_nueva", importada: {}, vigente: {} });
    expect(t).toBe(`Hay una versión más nueva del análisis PESTEL. Este proyecto usa una versión anterior. ${ACCION}`);
  });
});

describe("etiquetaVersionTexto y la fecha en el aviso REAL (de decidirEstadoOrigen a decidirAvisoOrigen)", () => {
  it("«versión N»", () => {
    expect(etiquetaVersionTexto(1)).toBe("versión 1");
    expect(etiquetaVersionTexto(12)).toBe("versión 12");
  });
  it("un `version_nueva` producido por `decidirEstadoOrigen` SIEMPRE lleva la fecha del vigente en el texto (la comparación la exige)", () => {
    const origen = decidirEstadoOrigen({
      huellaGuardada: { v: 2, h: "x" }, huellaActual: { v: 2, h: "x" },
      importado: { id: "a1", version: 5, analizadoEn: "2026-11-05T00:00:00.000Z" },
      vigente: { id: "a2", version: 4, analizadoEn: "2026-11-08T00:00:00.000Z" },
    });
    expect(origen.estado).toBe("version_nueva");
    expect(texto(origen)).toBe(`Hay una versión más nueva del análisis PESTEL (versión 4, 8 de noviembre de 2026). Este proyecto usa la versión 5. ${ACCION}`);
  });
  it("artefacto del seed (números de versión que no siguen las fechas): «más nueva (versión 4)» frente a «usa la versión 5» es correcto, se compara por FECHA", () => {
    const origen = decidirEstadoOrigen({
      huellaGuardada: { v: 2, h: "x" }, huellaActual: { v: 2, h: "x" },
      importado: { id: "an-apr39s", version: 5, analizadoEn: "2026-11-05T00:00:00.000Z" },
      vigente: { id: "an-sinfuente", version: 4, analizadoEn: "2026-11-08T00:00:00.000Z" },
    });
    expect(origen.estado).toBe("version_nueva");
  });
});

describe("cambio_contenido — texto completo", () => {
  it("con versión importada", () => {
    expect(texto({ estado: "cambio_contenido", importada: { version: 1 } })).toBe(
      `El análisis PESTEL de origen (versión 1) cambió después de importarlo (por ejemplo, por un ajuste del analista). Lo que ves aquí es la versión importada. ${ACCION}`
    );
  });
  it("sin versión legible se dice sin ella", () => {
    expect(texto({ estado: "cambio_contenido", importada: {} })).toBe(
      `El análisis PESTEL de origen cambió después de importarlo (por ejemplo, por un ajuste del analista). Lo que ves aquí es la versión importada. ${ACCION}`
    );
  });
});
