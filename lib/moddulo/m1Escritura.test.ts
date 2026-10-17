import { describe, expect, it } from "vitest";
import { camposNuevoM1 } from "./m1Escritura";
import { estadoM1 } from "./m1Aprobacion";

const fv = { serverTimestamp: () => "TS", delete: () => "DEL" };

describe("camposNuevoM1", () => {
  it("escribe un m1 nuevo con el sello, vacía las aprobaciones y borra el borrador de motores; nunca toca el dvs", () => {
    expect(camposNuevoM1(fv)).toEqual({
      "phases.exploracion.m1": { creadoEn: "TS" },
      "phases.exploracion.motorAprobaciones": {},
      "phases.exploracion.draftDVS": "DEL",
    });
    expect(Object.keys(camposNuevoM1(fv)).some((k) => k.endsWith(".dvs"))).toBe(false);
  });

  it("un proyecto «anterior» (payload + Reporte F2 y sin m1) pasa a «borrador» con ese m1: deja de estar bloqueado", () => {
    const antes = estadoM1({ m1: undefined, tienePayload: true, huellaPayload: "h", tieneDvs: true, tieneDraft: false, hayMotoresAprobados: false });
    expect(antes.estado).toBe("anterior");
    const despues = estadoM1({ m1: { creadoEn: "x" }, tienePayload: true, huellaPayload: "h2", tieneDvs: true, tieneDraft: false, hayMotoresAprobados: false });
    expect(despues.estado).toBe("borrador");
  });
});
