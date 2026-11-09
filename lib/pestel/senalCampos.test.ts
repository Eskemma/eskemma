import { describe, expect, it } from "vitest";
import { contarCarencias, fechaLegible, fuenteLegible, nivelLegible, FECHA_NO_REGISTRADA, FUENTE_NO_REGISTRADA } from "./senalCampos";

describe("senalCampos — ausente es ausente", () => {
  it.each([[undefined], [null], [""], ["   "], [42], [{}]])("fuente %j → null", (v) => expect(fuenteLegible({ fuente: v })).toBeNull());
  it("fuente con texto → recortada", () => expect(fuenteLegible({ fuente: "  INEGI " })).toBe("INEGI"));
  it.each([[undefined], [null], [""], ["  "], ["sin fecha"], ["Sin Fecha"], ["  SIN FECHA  "]])("fecha %j → null", (v) => expect(fechaLegible({ fechaCorte: v })).toBeNull());
  it.each([["2026"], ["2026-08"], ["2026-08-31"], ["agosto 2026"]])("fecha %j se conserva", (v) => expect(fechaLegible({ fechaCorte: v })).toBe(v));
  it("no hay otras variantes tratadas como ausentes todavía (s/f, n/d se miden, no se ocultan)", () => {
    expect(fechaLegible({ fechaCorte: "s/f" })).toBe("s/f");
    expect(fechaLegible({ fechaCorte: "n/d" })).toBe("n/d");
  });
  it("nivel: alto/medio/bajo sin distinguir mayúsculas; lo demás y lo ausente → null (nunca «bajo»)", () => {
    expect(nivelLegible({ nivelConfianza: "Alto" })).toBe("alto");
    expect(nivelLegible({ nivelConfianza: " medio " })).toBe("medio");
    expect(nivelLegible({ nivelConfianza: "bajo" })).toBe("bajo");
    for (const v of [undefined, null, "", "alta", "baja", "raro", 3]) expect(nivelLegible({ nivelConfianza: v })).toBeNull();
  });
  it("tolera señal nula", () => {
    expect(fuenteLegible(null)).toBeNull();
    expect(fechaLegible(undefined)).toBeNull();
    expect(nivelLegible(null)).toBeNull();
  });
  it("textos fijos", () => {
    expect(FUENTE_NO_REGISTRADA).toBe("fuente no registrada");
    expect(FECHA_NO_REGISTRADA).toBe("fecha no registrada");
  });
  it("contarCarencias: total, sin fuente, sin fecha (vacía o «sin fecha») e incompletas sin doble conteo", () => {
    const r = contarCarencias([
      { fuente: "A", fechaCorte: "2020" },
      { fuente: "", fechaCorte: "2020" },
      { fuente: "A", fechaCorte: "sin fecha" },
      { fuente: "", fechaCorte: "" },
      {},
    ]);
    expect(r).toEqual({ total: 5, sinFuente: 3, sinFecha: 3, incompletas: 4 });
    expect(contarCarencias([])).toEqual({ total: 0, sinFuente: 0, sinFecha: 0, incompletas: 0 });
  });
});
