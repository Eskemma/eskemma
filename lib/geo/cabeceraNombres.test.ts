// lib/geo/cabeceraNombres.test.ts
// Ejemplos REALES de cambio de nombre de cabecera entre años (CSV de Sefix,
// 2026-09-19) y del mismo código reasignado a otro territorio (redistritación).

import { describe, expect, it } from "vitest";
import { cabeceraSinPrefijo, claveCabecera, codigoDeOpcion, nombresCabeceraCompatibles } from "./cabeceraNombres";

describe("claveCabecera", () => {
  it("quita acentos, puntuación y espacios repetidos; repara mojibake y '?'", () => {
    expect(claveCabecera("Gustavo A. Madero")).toBe(claveCabecera("GUSTAVO A MADERO"));
    expect(claveCabecera("Tlajomulco de Zúñiga")).toBe(claveCabecera("TLAJOMULCO DE ZUNIGA"));
    expect(claveCabecera("TLAJOMULCO DE ZUÃIGA")).toBe(claveCabecera("Tlajomulco de Zuñiga"));
    expect(claveCabecera("QUERÃTARO")).toBe("QUERETARO");
    expect(claveCabecera("CA?ITAS  DE   FELIPE PESCADOR")).toBe("CAITAS DE FELIPE PESCADOR");
  });
});

describe("nombresCabeceraCompatibles", () => {
  it.each([
    ["QUERETARO", "SANTIAGO DE QUERETARO"],
    ["DURANGO", "VICTORIA DE DURANGO"],
    ["TOLUCA", "TOLUCA DE LERDO"],
    ["CARMEN", "CIUDAD DEL CARMEN"],
    ["CD. NEZAHUALCOYOTL", "NEZAHUALCOYOTL"],
    ["GUSTAVO A. MADERO", "GUSTAVO A MADERO"],
    ["Tlaquepaque", "SAN PEDRO TLAQUEPAQUE"],
  ])("'%s' ~ '%s' (renombre de la misma cabecera)", (a, b) => {
    expect(nombresCabeceraCompatibles(a, b)).toBe(true);
    expect(nombresCabeceraCompatibles(b, a)).toBe(true);
  });

  it.each([
    ["NAUCALPAN DE JUAREZ", "AMECAMECA DE JUAREZ"], // México 1521: mismo código, otro territorio
    ["MEXICALI", "TECATE"], // Baja California 0206
    ["IZTAPALAPA", "TLALPAN"],
    ["MERIDA", "MERI"], // nunca por subcadena de letras
  ])("'%s' !~ '%s' (otro territorio)", (a, b) => {
    expect(nombresCabeceraCompatibles(a, b)).toBe(false);
  });

  it("vacío nunca es compatible", () => {
    expect(nombresCabeceraCompatibles("", "MERIDA")).toBe(false);
  });
});

describe("helpers de opción de Sefix", () => {
  it("código de 4 dígitos y cabecera sin prefijo", () => {
    expect(codigoDeOpcion("0927 IZTAPALAPA")).toBe("0927");
    expect(codigoDeOpcion("VOTO EN EL EXTRANJERO")).toBeNull();
    expect(cabeceraSinPrefijo("1405 PUERTO VALLARTA")).toBe("PUERTO VALLARTA");
  });
});
