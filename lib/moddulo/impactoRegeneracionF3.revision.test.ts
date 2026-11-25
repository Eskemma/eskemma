// H-V48 (C4b-0): `revision.n` normalizado y comparación. Módulo puro.
import { describe, expect, it } from "vitest";
import { InvestigacionCambioError, exigirRevisionSinCambio, revisionDeInvestigacion } from "./impactoRegeneracionF3";

describe("revisionDeInvestigacion", () => {
  it("normaliza lo ausente o no numérico a 0", () => {
    for (const x of [undefined, null, {}, { revision: {} }, { revision: { n: "3" } }, { revision: { n: null } }]) {
      expect(revisionDeInvestigacion(x)).toBe(0);
    }
  });
  it("lee n cuando es número", () => {
    expect(revisionDeInvestigacion({ revision: { n: 7 } })).toBe(7);
  });
});

describe("exigirRevisionSinCambio", () => {
  it("pasa con n igual (incluido undefined contra 0)", () => {
    expect(() => exigirRevisionSinCambio({ revision: { n: 2 } }, 2)).not.toThrow();
    expect(() => exigirRevisionSinCambio(undefined, 0)).not.toThrow();
  });
  it("lanza con n distinto, también si `revision` apareció", () => {
    expect(() => exigirRevisionSinCambio({ revision: { n: 3 } }, 2)).toThrow(InvestigacionCambioError);
    expect(() => exigirRevisionSinCambio({ revision: { n: 1 } }, 0)).toThrow(InvestigacionCambioError);
  });
});
