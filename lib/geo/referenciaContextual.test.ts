// lib/geo/referenciaContextual.test.ts
// Paso 3: «este distrito», «mi municipio», «nivel estatal»… se resuelven contra el territorio
// activo, NO contra el catálogo nacional.

import { describe, expect, it } from "vitest";
import type { NivelTerritorial } from "@/types/shared.types";
import { clasificarReferencia, decidirContexto } from "./referenciaContextual";

const ctx = (nivelActivo: NivelTerritorial) => ({ nivelActivo });

describe("clasificarReferencia", () => {
  it("«este distrito», «mi distrito», «este distrito federal» son contextuales, con su nivel", () => {
    expect(clasificarReferencia("este distrito")).toEqual({ tipo: "contexto", via: "deictica", nivel: "distrito" });
    expect(clasificarReferencia("mi distrito")).toEqual({ tipo: "contexto", via: "deictica", nivel: "distrito" });
    expect(clasificarReferencia("Este Distrito Federal")).toEqual({ tipo: "contexto", via: "deictica", nivel: "distrito_federal" });
    expect(clasificarReferencia("este distrito local")).toEqual({ tipo: "contexto", via: "deictica", nivel: "distrito_local" });
  });

  it("otras formas de apuntar al proyecto", () => {
    for (const t of ["aquí", "el del proyecto", "el actual", "este territorio", "mi municipio", "el estado"]) {
      expect(clasificarReferencia(t).tipo, t).toBe("contexto");
    }
    expect(clasificarReferencia("mi municipio")).toMatchObject({ nivel: "municipal" });
    expect(clasificarReferencia("este territorio")).toMatchObject({ nivel: null });
  });

  it("calificadores de nivel sin lugar: «nivel estatal», «el local», «distrito federal» en un proyecto distrital", () => {
    expect(clasificarReferencia("nivel estatal")).toEqual({ tipo: "contexto", via: "calificador", nivel: "estatal" });
    expect(clasificarReferencia("el local")).toEqual({ tipo: "contexto", via: "calificador", nivel: "distrito_local" });
    expect(clasificarReferencia("Distrito Federal", ctx("distrito_federal"))).toEqual({ tipo: "contexto", via: "calificador", nivel: "distrito_federal" });
  });

  it("«Distrito Federal» a secas en un proyecto que NO es distrital es un nombre (la Ciudad de México)", () => {
    expect(clasificarReferencia("Distrito Federal", ctx("municipal"))).toEqual({ tipo: "nombre" });
    expect(clasificarReferencia("el Distrito Federal")).toEqual({ tipo: "nombre" });
  });

  it("los nombres propios, números y claves NO son contextuales", () => {
    for (const t of ["Guadalajara", "Jalisco", "distrito federal 5 de Jalisco", "D.L. 27 CDMX", "1405", "México", "El Salto", "La Paz"]) {
      expect(clasificarReferencia(t, ctx("distrito_federal")).tipo, t).toBe("nombre");
    }
  });
});

describe("decidirContexto", () => {
  it("mismo nivel o solo «este»: se usa el territorio activo", () => {
    expect(decidirContexto(null, "municipal")).toEqual({ accion: "usar_activo" });
    expect(decidirContexto("distrito", "distrito_local")).toEqual({ accion: "usar_activo" });
    expect(decidirContexto("distrito_federal", "distrito_federal")).toEqual({ accion: "usar_activo" });
    expect(decidirContexto("distrito_federal", "distrito")).toEqual({ accion: "usar_activo" }); // «distrito» legado = federal
  });

  it("estatal/nacional desde un distrito: se deriva sin preguntar", () => {
    expect(decidirContexto("estatal", "distrito_local")).toEqual({ accion: "nivel_contenedor", nivel: "estatal" });
    expect(decidirContexto("estatal", "municipal")).toEqual({ accion: "nivel_contenedor", nivel: "estatal" });
    expect(decidirContexto("nacional", "distrito_federal")).toEqual({ accion: "nivel_contenedor", nivel: "nacional" });
  });

  it("el otro tipo de distrito: rechazo honesto (la equivalencia no existe)", () => {
    expect(decidirContexto("distrito_federal", "distrito_local")).toEqual({ accion: "hermano", pedido: "distrito_federal", activo: "distrito_local" });
    expect(decidirContexto("distrito_local", "distrito_federal")).toEqual({ accion: "hermano", pedido: "distrito_local", activo: "distrito_federal" });
  });

  it("sin referente: «este distrito» en un proyecto municipal, o un nivel más fino que el del proyecto", () => {
    expect(decidirContexto("distrito", "municipal")).toMatchObject({ accion: "sin_referente", motivo: "activo_no_distrital" });
    expect(decidirContexto("municipal", "estatal")).toMatchObject({ accion: "sin_referente", motivo: "nivel_mas_fino" });
    expect(decidirContexto("municipal", "distrito_local")).toMatchObject({ accion: "sin_referente", motivo: "desglose_de_distrito" });
    expect(decidirContexto("estatal", "nacional")).toMatchObject({ accion: "sin_referente", motivo: "activo_nacional" });
  });
});
