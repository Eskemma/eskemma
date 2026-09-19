// lib/geo/municipioCanonico.test.ts
import { describe, expect, it } from "vitest";
import { claveComparacionMunicipio, plegarDiacriticosGeo, repararMojibakeGeo } from "./municipioCanonico";

describe("repararMojibakeGeo", () => {
  it("repara la Ñ doblemente codificada que traen los CSV locales reales del INE", () => {
    expect(repararMojibakeGeo("TLAJOMULCO DE ZUÃIGA")).toBe("TLAJOMULCO DE ZUÑIGA");
  });

  it("repara vocales acentuadas (é = Ã + ©)", () => {
    expect(repararMojibakeGeo("MÃ©rida")).toBe("Mérida");
  });

  it("no toca texto normal, con acentos legítimos ni vacío", () => {
    for (const t of ["ZAPOPAN", "TLAJOMULCO DE ZUÑIGA", "Mérida", "", "GRAL. ESCOBEDO"]) expect(repararMojibakeGeo(t)).toBe(t);
  });

  it("si la secuencia no es UTF-8 válido, devuelve el texto tal cual (nunca lo corrompe)", () => {
    expect(repararMojibakeGeo("AÃ(B")).toBe("AÃ(B");
  });
});

describe("claveComparacionMunicipio", () => {
  it("aplica alias y pliega Ñ/Ü en ambos lados", () => {
    expect(claveComparacionMunicipio("14", "Tlaquepaque")).toBe(claveComparacionMunicipio("14", "SAN PEDRO TLAQUEPAQUE"));
    expect(claveComparacionMunicipio("19", "General Escobedo")).toBe(claveComparacionMunicipio("19", "GRAL. ESCOBEDO"));
    expect(claveComparacionMunicipio("14", "Tlajomulco de Zúñiga")).toBe(claveComparacionMunicipio("14", "TLAJOMULCO DE ZUNIGA"));
    expect(plegarDiacriticosGeo("ZUÑIGA GÜEMEZ")).toBe("ZUNIGA GUEMEZ");
  });
});
