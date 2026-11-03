// T4: la decisión del estado del origen. Pura. Sin huella o con otra versión de la regla NUNCA es «cambió».
import { describe, expect, it } from "vitest";
import { decidirEstadoOrigen, type DatosOrigen } from "./estadoOrigen";

const H = { v: 1, h: "aaa" };
const importado = { id: "a1", version: 1, analizadoEn: "2026-10-01T00:00:00.000Z" };
const d = (extra: Partial<DatosOrigen> = {}): DatosOrigen => ({
  huellaGuardada: H, huellaActual: H, importado, vigente: { id: "a1", version: 1, analizadoEn: importado.analizadoEn }, ...extra,
});

describe("decidirEstadoOrigen", () => {
  it("huella igual y el importado es el vigente → igual", () => {
    expect(decidirEstadoOrigen(d())).toMatchObject({ estado: "igual" });
  });
  it("huella distinta → cambio_contenido", () => {
    expect(decidirEstadoOrigen(d({ huellaActual: { v: 1, h: "bbb" } })).estado).toBe("cambio_contenido");
  });
  it("hay un vigente distinto y más reciente → version_nueva (con versión y fecha, sin ids)", () => {
    const r = decidirEstadoOrigen(d({ vigente: { id: "a2", version: 2, analizadoEn: "2026-10-05T00:00:00.000Z" } }));
    expect(r).toEqual({ estado: "version_nueva", importada: { version: 1, fecha: "2026-10-01T00:00:00.000Z" }, vigente: { version: 2, fecha: "2026-10-05T00:00:00.000Z" } });
    expect(JSON.stringify(r)).not.toContain("a2");
  });
  it("version_nueva gana sobre cambio_contenido y no necesita huella (Anaya)", () => {
    const nueva = { id: "a2", version: 2, analizadoEn: "2026-10-05T00:00:00.000Z" };
    expect(decidirEstadoOrigen(d({ huellaActual: { v: 1, h: "bbb" }, vigente: nueva })).estado).toBe("version_nueva");
    expect(decidirEstadoOrigen(d({ huellaGuardada: undefined, vigente: nueva })).estado).toBe("version_nueva");
  });
  it("el vigente es MÁS VIEJO que el importado (versiones desordenadas): no es versión nueva", () => {
    const r = decidirEstadoOrigen(d({ vigente: { id: "a0", version: 5, analizadoEn: "2026-09-01T00:00:00.000Z" } }));
    expect(r.estado).toBe("igual");
  });
  it("fechas ilegibles: no se afirma versión nueva", () => {
    expect(decidirEstadoOrigen(d({ vigente: { id: "a2", version: 9, analizadoEn: "no es fecha" } })).estado).toBe("igual");
  });
  it("sin huella guardada o con otra versión de la regla → no_verificable, NUNCA cambio_contenido", () => {
    expect(decidirEstadoOrigen(d({ huellaGuardada: undefined, huellaActual: { v: 1, h: "zzz" } }))).toMatchObject({ estado: "no_verificable", razon: "sin_huella" });
    expect(decidirEstadoOrigen(d({ huellaGuardada: { v: 2, h: "aaa" }, huellaActual: { v: 1, h: "zzz" } })).estado).toBe("no_verificable");
    expect(decidirEstadoOrigen(d({ huellaGuardada: null })).estado).toBe("no_verificable");
  });
  it("origen ilegible → no_verificable (Olmos 2 y similares: sin huella y sin versión nueva)", () => {
    expect(decidirEstadoOrigen(d({ importado: null })).razon).toBe("origen_no_disponible");
    expect(decidirEstadoOrigen(d({ huellaActual: null })).razon).toBe("origen_no_disponible");
    expect(decidirEstadoOrigen(d({ huellaGuardada: undefined })).estado).toBe("no_verificable");
  });
});
