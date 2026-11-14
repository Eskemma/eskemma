// Caracterización de `construirInforme` y de `extraerEstadoGuardado` ANTES de H75 (marca de corte por longitud).
// Estas pruebas fijan lo que NO debe cambiar: la forma exacta del informe guardado cuando no se conoce
// el motivo de parada, y el parser de la marca de «no guardado». Verdes contra el código anterior.

import { describe, expect, it } from "vitest";
import { MARCA_INFORME_NO_GUARDADO, construirInforme, extraerEstadoGuardado } from "./informesSync";

const ANALISIS = { dimensions: [] };

describe("construirInforme — forma guardada sin motivo de parada (caracterización)", () => {
  it("claves exactas: id, formato, contenidoTexto, datosEstructurados y generadoEn", () => {
    const inf = construirInforme({
      id: "i1",
      format: "technical",
      texto: "Texto",
      analysis: ANALISIS,
      variableConfigs: [],
      generadoEn: "2026-11-13T10:00:00.000Z",
    });
    expect(Object.keys(inf).sort()).toEqual(["contenidoTexto", "datosEstructurados", "formato", "generadoEn", "id"]);
    expect(inf.formato).toBe("tecnico");
  });

  it("con origen: agrega solo `origen` (el informe migrado de localStorage)", () => {
    const inf = construirInforme({
      id: "i2",
      format: "executive",
      texto: "T",
      analysis: ANALISIS,
      variableConfigs: [],
      origen: "migrado_localstorage",
      generadoEn: "2026-11-13T10:00:00.000Z",
    });
    expect(Object.keys(inf).sort()).toEqual([
      "contenidoTexto",
      "datosEstructurados",
      "formato",
      "generadoEn",
      "id",
      "origen",
    ]);
  });
});

describe("extraerEstadoGuardado — se conserva tal cual (caracterización)", () => {
  it("sin marca: guardado", () => {
    expect(extraerEstadoGuardado("abc")).toEqual({ texto: "abc", guardado: true });
  });
  it("con la marca: no guardado y texto sin la marca", () => {
    expect(extraerEstadoGuardado("abc" + MARCA_INFORME_NO_GUARDADO)).toEqual({ texto: "abc", guardado: false });
  });
});
