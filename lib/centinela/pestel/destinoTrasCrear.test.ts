import { describe, expect, it } from "vitest";
import {
  AVISOS_ASISTENTE,
  mensajeDeAvisoAsistente,
  planTrasCrearProyecto,
  rutaProyectoExistente,
} from "./destinoTrasCrear";
import { urlSinAviso } from "@/lib/moddulo/guardadoHonesto";

// Comportamiento ANTERIOR del asistente (sin DOM no se puede ejercitar la página): siempre PUT /variables.
const planAnterior = (_status: number) => ({ guardarVariables: true });

describe("planTrasCrearProyecto", () => {
  it("201 (proyecto creado) guarda las variables del asistente", () => {
    expect(planTrasCrearProyecto(201).guardarVariables).toBe(true);
  });
  it("200 (dedup: PESTEL ya vinculado) NO guarda variables", () => {
    expect(planTrasCrearProyecto(200).guardarVariables).toBe(false);
  });
  it("cualquier otro código no guarda variables (fail-closed)", () => {
    for (const s of [202, 204, 0, 500]) expect(planTrasCrearProyecto(s).guardarVariables).toBe(false);
  });
  it("[negativo local] el comportamiento anterior sobrescribía con 200", () => {
    expect(planAnterior(200).guardarVariables).toBe(true);
    expect(planTrasCrearProyecto(200).guardarVariables).not.toBe(planAnterior(200).guardarVariables);
  });
});

describe("rutaProyectoExistente", () => {
  it("etapa ≥ 5 → análisis; < 5 → datos", () => {
    expect(rutaProyectoExistente("p1", 5)).toBe("/centinela/pestel/p1/analisis");
    expect(rutaProyectoExistente("p1", 7)).toBe("/centinela/pestel/p1/analisis");
    expect(rutaProyectoExistente("p1", 4)).toBe("/centinela/pestel/p1/datos");
    expect(rutaProyectoExistente("p1", 0)).toBe("/centinela/pestel/p1/datos");
  });
  it("etapa ausente o no numérica → datos", () => {
    expect(rutaProyectoExistente("p1", undefined)).toBe("/centinela/pestel/p1/datos");
    expect(rutaProyectoExistente("p1", "7")).toBe("/centinela/pestel/p1/datos");
  });
});

describe("aviso del asistente (lista cerrada)", () => {
  it("201 no avisa; 200 y cualquier otro código avisan pestel_existente", () => {
    expect(planTrasCrearProyecto(201).aviso).toBeNull();
    for (const st of [200, 202, 500]) expect(planTrasCrearProyecto(st).aviso).toBe("pestel_existente");
  });
  it("el texto es fijo y dice lo que pasó", () => {
    expect(mensajeDeAvisoAsistente("pestel_existente")).toBe(
      "Este proyecto ya tenía un análisis PESTEL; se abrió ese. Las variables que elegiste no se guardaron."
    );
    expect(Object.keys(AVISOS_ASISTENTE)).toEqual(["pestel_existente"]);
  });
  it("cualquier valor fuera de la lista (incluidos hostiles) no produce texto", () => {
    for (const c of ["__proto__", "constructor", "toString", "<script>alert(1)</script>", "", "PESTEL_EXISTENTE", null, undefined])
      expect(mensajeDeAvisoAsistente(c as string | null | undefined)).toBeNull();
  });
  it("la ruta lleva el código y sin aviso queda igual que antes", () => {
    expect(rutaProyectoExistente("p1", 4, "pestel_existente")).toBe("/centinela/pestel/p1/datos?aviso=pestel_existente");
    expect(rutaProyectoExistente("p1", 6, "pestel_existente")).toBe("/centinela/pestel/p1/analisis?aviso=pestel_existente");
    expect(rutaProyectoExistente("p1", 6)).toBe("/centinela/pestel/p1/analisis");
  });
  it("tras leerlo se quita de la URL conservando otros parámetros", () => {
    expect(urlSinAviso("/centinela/pestel/p1/datos", "aviso=pestel_existente")).toBe("/centinela/pestel/p1/datos");
    expect(urlSinAviso("/centinela/pestel/p1/datos", "aviso=pestel_existente&x=1")).toBe("/centinela/pestel/p1/datos?x=1");
  });
  it("[negativo local] el comportamiento anterior abría el proyecto sin avisar", () => {
    const anterior = (_s: number) => ({ guardarVariables: true, aviso: null });
    expect(anterior(200).aviso).toBeNull();
    expect(planTrasCrearProyecto(200).aviso).not.toBeNull();
  });
});
