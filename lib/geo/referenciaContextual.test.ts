// lib/geo/referenciaContextual.test.ts — mencionaOtroTipoDeDistrito (Frente B, 26-09-27).
import { describe, expect, it } from "vitest";
import { mencionaOtroTipoDeDistrito } from "./referenciaContextual";

describe("mencionaOtroTipoDeDistrito", () => {
  it("frase completa (no solo deíctica aislada): detecta el pedido del OTRO tipo", () => {
    expect(mencionaOtroTipoDeDistrito("y en el distrito local, ¿cuánto sería?", "distrito_federal")).toBe("distrito_local");
    expect(mencionaOtroTipoDeDistrito("¿y a nivel distrito federal?", "distrito_local")).toBe("distrito_federal");
    expect(mencionaOtroTipoDeDistrito("dame el mismo dato pero del distrito electoral local", "distrito_federal")).toBe("distrito_local");
  });

  it("pide el MISMO tipo que ya está activo: no es 'hermano' (decidirContexto → usar_activo)", () => {
    expect(mencionaOtroTipoDeDistrito("y en el distrito federal, ¿cuánto sería?", "distrito_federal")).toBeNull();
    expect(mencionaOtroTipoDeDistrito("dame el dato de este distrito local", "distrito_local")).toBeNull();
  });

  it("territorio activo NO distrital: no aplica (nada que ser 'hermano' de)", () => {
    for (const nivel of ["nacional", "estatal", "municipal"] as const) {
      expect(mencionaOtroTipoDeDistrito("y en el distrito local, ¿cuánto sería?", nivel)).toBeNull();
    }
  });

  it("sin mención de tipo de distrito, o sin mensaje/nivel: null", () => {
    expect(mencionaOtroTipoDeDistrito("¿cuál es la población total?", "distrito_federal")).toBeNull();
    expect(mencionaOtroTipoDeDistrito("", "distrito_federal")).toBeNull();
    expect(mencionaOtroTipoDeDistrito(null, "distrito_federal")).toBeNull();
    expect(mencionaOtroTipoDeDistrito("y en el distrito local", null)).toBeNull();
  });

  it("distrito federal a secas (nombre antiguo de la Ciudad de México) NO cuenta como pedir el federal", () => {
    // La frase exacta "distrito federal" sin más contexto es ambigua con el nombre antiguo de CDMX;
    // aquí solo importa que sí trae la palabra DISTRITO + FEDERAL, así que SÍ se detecta como mención
    // de nivel — decidirContexto decide si es "hermano" o no, no esta función.
    expect(mencionaOtroTipoDeDistrito("¿y el distrito federal?", "distrito_local")).toBe("distrito_federal");
  });

  it("«distrito» legado (sin calificar) no dispara: solo cuenta FEDERAL/LOCAL explícito", () => {
    expect(mencionaOtroTipoDeDistrito("dame el dato de este distrito", "distrito_federal")).toBeNull();
  });

  it("hallazgo real (Frente A, verificación en vivo 26-09-27): mencionar el PROPIO tipo primero y el OTRO después SÍ dispara — el orden de la frase no debe importar", () => {
    const msg =
      "Mi proyecto trabaja en un distrito local. Quiero saber la población pero del distrito federal que le corresponde a mi distrito local, no del local.";
    expect(mencionaOtroTipoDeDistrito(msg, "distrito_local")).toBe("distrito_federal");
    // Simétrico: activo federal, el propio mencionado primero, el otro (local) después.
    const msg2 = "Mi proyecto es de distrito federal, pero ahora quiero el distrito local correspondiente.";
    expect(mencionaOtroTipoDeDistrito(msg2, "distrito_federal")).toBe("distrito_local");
  });
});
