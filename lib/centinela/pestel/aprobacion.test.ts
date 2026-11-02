import { describe, expect, it } from "vitest";
import {
  aMillis,
  informeAnteriorAlAjuste,
  planRetiroAprobacion,
  textoAprobacionRetirada,
  validarJustificacionAjuste,
} from "./aprobacion";

describe("validarJustificacionAjuste", () => {
  it("corta, justa, tope y larga (el conteo es del texto recortado)", () => {
    expect(validarJustificacionAjuste("x".repeat(19))).toMatchObject({ ok: false, motivo: "corta" });
    expect(validarJustificacionAjuste(undefined)).toMatchObject({ ok: false, motivo: "corta" });
    expect(validarJustificacionAjuste("x".repeat(20))).toEqual({ ok: true, valor: "x".repeat(20) });
    expect(validarJustificacionAjuste(` ${"x".repeat(1000)} `)).toEqual({ ok: true, valor: "x".repeat(1000) });
    expect(validarJustificacionAjuste("x".repeat(1001))).toMatchObject({ ok: false, motivo: "larga" });
  });
});

describe("planRetiroAprobacion", () => {
  it("solo retira un APPROVED y archiva lo que hay, sin undefined", () => {
    expect(planRetiroAprobacion({ status: "REVIEWED", approvedAt: 1 })).toBeNull();
    expect(planRetiroAprobacion({})).toBeNull();
    expect(planRetiroAprobacion({ status: "APPROVED" })).toEqual({ anterior: { approvedAt: null, approvedBy: null } });
    expect(
      planRetiroAprobacion({ status: "APPROVED", approvedAt: "t", approvedBy: "u", aprobacionJustificacion: "j", aprobacionConfianza: 39 })
    ).toEqual({ anterior: { approvedAt: "t", approvedBy: "u", justificacion: "j", confianza: 39 } });
  });
});

describe("aMillis", () => {
  it("ISO, {_seconds}, Timestamp con toMillis, número y basura", () => {
    expect(aMillis("2026-10-01T00:00:00Z")).toBe(Date.parse("2026-10-01T00:00:00Z"));
    expect(aMillis({ _seconds: 10 })).toBe(10000);
    expect(aMillis({ toMillis: () => 5 })).toBe(5);
    expect(aMillis(7)).toBe(7);
    for (const v of [null, undefined, "no fecha", {}]) expect(aMillis(v)).toBeNull();
  });
});

describe("textoAprobacionRetirada", () => {
  const dim = (c: string) => (c === "P" ? "Político" : c);
  const f = (ms: number) => `f${ms}`;
  it("dice cuándo se aprobó, por qué dimensión y cuándo se retiró; se deriva de lo guardado", () => {
    expect(
      textoAprobacionRetirada(
        { status: "REVIEWED", aprobacionAnterior: { approvedAt: { _seconds: 1 } }, aprobacionRetirada: { en: { _seconds: 2 }, porDimension: "P" } },
        dim,
        f
      )
    ).toBe("La aprobación del f1000 se retiró por un ajuste en Político el f2000. Vuelve a aprobar cuando termines tus ajustes.");
  });
  it("sin fechas conserva la frase; aprobado de nuevo o sin rastro: null", () => {
    expect(textoAprobacionRetirada({ status: "REVIEWED", aprobacionAnterior: {}, aprobacionRetirada: {} }, dim, f)).toBe(
      "La aprobación se retiró por un ajuste. Vuelve a aprobar cuando termines tus ajustes."
    );
    expect(textoAprobacionRetirada({ status: "APPROVED", aprobacionAnterior: {}, aprobacionRetirada: {} }, dim, f)).toBeNull();
    expect(textoAprobacionRetirada({ status: "REVIEWED" }, dim, f)).toBeNull();
  });
});

describe("informeAnteriorAlAjuste", () => {
  const ajustes = [{ adjustedAt: "2026-10-10T00:00:00Z" }, { adjustedAt: "2026-10-12T00:00:00Z" }];
  it("generado antes del ÚLTIMO ajuste → sí; después → no", () => {
    expect(informeAnteriorAlAjuste({ generadoEn: "2026-10-11T00:00:00Z" }, ajustes)).toBe(true);
    expect(informeAnteriorAlAjuste({ generadoEn: "2026-10-13T00:00:00Z" }, ajustes)).toBe(false);
    expect(informeAnteriorAlAjuste({ generadoEn: "2026-10-12T00:00:00Z" }, ajustes)).toBe(false);
  });
  it("sin ajustes, sin fechas o sin informe: no se rotula", () => {
    expect(informeAnteriorAlAjuste({ generadoEn: "2026-10-11T00:00:00Z" }, [])).toBe(false);
    expect(informeAnteriorAlAjuste({ generadoEn: "2026-10-11T00:00:00Z" }, undefined)).toBe(false);
    expect(informeAnteriorAlAjuste({}, ajustes)).toBe(false);
    expect(informeAnteriorAlAjuste(null, ajustes)).toBe(false);
    expect(informeAnteriorAlAjuste({ generadoEn: "2026-10-11T00:00:00Z" }, [{ adjustedAt: "no fecha" }])).toBe(false);
  });
});
