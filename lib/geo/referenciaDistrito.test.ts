// lib/geo/referenciaDistrito.test.ts
// Paso 3: distritos nombrados por número / clave / tipo, con el catálogo real de cabeceras.

import { describe, expect, it } from "vitest";
import { esDistritoFederalAntiguo, mencionaDistrito, parsearReferenciaDistrito } from "./referenciaDistrito";

describe("parsearReferenciaDistrito", () => {
  it("«distrito federal 5 de Jalisco» → federal, 05, Jalisco (CVE 14)", () => {
    expect(parsearReferenciaDistrito("distrito federal 5 de Jalisco")).toMatchObject({ tipo: "distrito_federal", numero: "05", estadoCve: "14" });
  });

  it("«D.L. 27 CDMX» → local, 27, Ciudad de México (CVE 09)", () => {
    expect(parsearReferenciaDistrito("D.L. 27 CDMX")).toMatchObject({ tipo: "distrito_local", numero: "27", estadoCve: "09" });
  });

  it("«D.F. 1405 PUERTO VALLARTA» y «1405»: código completo", () => {
    expect(parsearReferenciaDistrito("D.F. 1405 PUERTO VALLARTA")).toMatchObject({ tipo: "distrito_federal", codigo: "1405" });
    expect(parsearReferenciaDistrito("1405")).toMatchObject({ tipo: null, codigo: "1405" });
  });

  it("número romano y ceros a la izquierda", () => {
    expect(parsearReferenciaDistrito("distrito electoral federal V de Jalisco")).toMatchObject({ numero: "05", estadoCve: "14" });
    expect(parsearReferenciaDistrito("distrito local 005 en Yucatán")).toMatchObject({ tipo: "distrito_local", numero: "05", estadoCve: "31" });
  });

  it("tipo + estado sin número: se piden todos los de ese tipo", () => {
    expect(parsearReferenciaDistrito("distrito federal de Yucatán")).toMatchObject({ tipo: "distrito_federal", numero: null, estadoCve: "31" });
  });

  it("estado que no se reconoce: se marca, no se adivina", () => {
    expect(parsearReferenciaDistrito("distrito federal 5 de Narnia")).toMatchObject({ numero: "05", estadoCve: null, estadoNoReconocido: true });
  });

  it("nombre de cabecera detrás del prefijo", () => {
    expect(parsearReferenciaDistrito("distrito federal Puerto Vallarta")).toMatchObject({ tipo: "distrito_federal", cabecera: "PUERTO VALLARTA" });
  });

  it("solo el prefijo («distrito local») es un nivel, no un lugar", () => {
    expect(parsearReferenciaDistrito("distrito local")).toEqual(expect.objectContaining({ tipo: "distrito_local", numero: null, codigo: null, cabecera: null }));
  });

  it("nombres que no son distritos → null (siguen a la búsqueda por nombre)", () => {
    for (const t of ["Pachuca", "Guadalajara", "Jalisco", "Distrito Federal", "México", "Ciudad Juárez"]) {
      expect(parsearReferenciaDistrito(t)?.numero ?? null, t).toBeNull();
      expect(parsearReferenciaDistrito(t)?.codigo ?? null, t).toBeNull();
    }
  });
});

describe("esDistritoFederalAntiguo / mencionaDistrito", () => {
  it("«Distrito Federal» a secas, «el Distrito Federal» y «DF» son la Ciudad de México", () => {
    for (const t of ["Distrito Federal", "el Distrito Federal", "DF", "D.F."]) expect(esDistritoFederalAntiguo(t), t).toBe(true);
  });

  it("con número, estado o cabecera ya no lo es", () => {
    for (const t of ["distrito federal 5 de Jalisco", "D.F. 1405", "distrito federal Puerto Vallarta"]) expect(esDistritoFederalAntiguo(t), t).toBe(false);
  });

  it("mencionaDistrito detecta la intención de hablar de un distrito", () => {
    for (const t of ["distrito local 27", "D.F. 5 Jalisco", "1405", "este distrito"]) expect(mencionaDistrito(t), t).toBe(true);
    for (const t of ["Pachuca", "Colima", "Guadalajara", "México"]) expect(mencionaDistrito(t), t).toBe(false);
  });
});
