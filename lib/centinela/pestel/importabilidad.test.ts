// T7 C1 — decidirImportabilidad: razones derivadas de datos, fechas reales y nunca inventadas.
import { describe, expect, it } from "vitest";
import { decidirImportabilidad } from "./importabilidad";

const sesgo = (reconocido: boolean) => ({ type: "urbano", description: "d", ...(reconocido ? { acknowledgedAt: "2026-10-01T00:00:00Z" } : {}) });
const base = { id: "a1", status: "APPROVED", vigente: true, analyzedAt: "2026-10-01T10:00:00Z", globalConfidence: 80, biasAlerts: [] as unknown[] };
const tipos = (x: ReturnType<typeof decidirImportabilidad>) => x.razones.map((r) => r.tipo);

describe("decidirImportabilidad — tabla de estados", () => {
  it("aprobado, vigente, confianza ≥ 50, sin sesgos → ok sin razones", () => {
    expect(decidirImportabilidad(base)).toEqual({ nivel: "ok", razones: [] });
  });

  it("REVIEWED y PENDING_REVIEW piden confirmación: REVIEWED NO equivale a revisión humana", () => {
    for (const status of ["REVIEWED", "PENDING_REVIEW"]) {
      const r = decidirImportabilidad({ ...base, status });
      expect(r.nivel).toBe("aviso");
      expect(r.razones).toEqual([{ tipo: "no_aprobado", status }]);
    }
  });

  it("estado ausente o desconocido también cuenta como no aprobado (sin inventar el estado)", () => {
    expect(decidirImportabilidad({ ...base, status: undefined }).razones).toEqual([{ tipo: "no_aprobado" }]);
    expect(decidirImportabilidad({ ...base, status: 7 }).razones).toEqual([{ tipo: "no_aprobado" }]);
    expect(decidirImportabilidad({ ...base, status: "OTRO" }).razones).toEqual([{ tipo: "no_aprobado", status: "OTRO" }]);
  });

  it("sesgos: cuenta solo las SIN reconocer; todas reconocidas → sin razón", () => {
    expect(decidirImportabilidad({ ...base, biasAlerts: [sesgo(true), sesgo(false), sesgo(false)] }).razones).toEqual([{ tipo: "sesgos_sin_revisar", cantidad: 2 }]);
    expect(decidirImportabilidad({ ...base, biasAlerts: [sesgo(true)] })).toEqual({ nivel: "ok", razones: [] });
  });

  it("biasAlerts ausente, no arreglo o con elementos nulos no truena", () => {
    expect(decidirImportabilidad({ ...base, biasAlerts: undefined }).nivel).toBe("ok");
    expect(decidirImportabilidad({ ...base, biasAlerts: "x" }).nivel).toBe("ok");
    expect(decidirImportabilidad({ ...base, biasAlerts: [null, undefined] }).razones).toEqual([{ tipo: "sesgos_sin_revisar", cantidad: 2 }]);
  });

  it("confianza baja SOLA (aprobado) es informativa: nivel ok pero con la razón para que viaje la nota", () => {
    const r = decidirImportabilidad({ ...base, globalConfidence: 39 });
    expect(r.nivel).toBe("ok");
    expect(r.razones).toEqual([{ tipo: "confianza_baja", confianza: 39 }]);
  });

  it("confianza baja + no aprobado: avisa y lista ambas, en orden fijo", () => {
    const r = decidirImportabilidad({ ...base, status: "PENDING_REVIEW", globalConfidence: 40, biasAlerts: [sesgo(false)] });
    expect(r.nivel).toBe("aviso");
    expect(tipos(r)).toEqual(["no_aprobado", "sesgos_sin_revisar", "confianza_baja"]);
  });

  it("confianza ausente, igual a 50 o no numérica no cuenta como baja", () => {
    for (const globalConfidence of [undefined, 50, "30", null]) expect(decidirImportabilidad({ ...base, globalConfidence }).razones).toEqual([]);
  });

  it("`vigente` ausente cuenta como vigente; solo `false` genera la razón", () => {
    expect(decidirImportabilidad({ ...base, vigente: undefined }).razones).toEqual([]);
    expect(tipos(decidirImportabilidad({ ...base, vigente: false }))).toEqual(["no_vigente"]);
  });
});

describe("decidirImportabilidad — fechas de no_vigente (ajuste: reales o ausentes, nunca inventadas)", () => {
  const noVigente = { ...base, vigente: false };

  it("con el vigente entregado lleva la fecha del análisis y la del vigente", () => {
    const r = decidirImportabilidad(noVigente, { id: "a2", analyzedAt: "2026-11-02T08:30:00Z" });
    expect(r.razones).toEqual([{ tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z", fechaVigente: "2026-11-02T08:30:00.000Z" }]);
  });

  it("si el vigente no existe o no se consultó, la razón va sin fecha del vigente (no se inventa)", () => {
    for (const vigente of [undefined, null]) {
      const r = decidirImportabilidad(noVigente, vigente);
      expect(r.razones).toEqual([{ tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z" }]);
      expect("fechaVigente" in r.razones[0]).toBe(false);
    }
  });

  it("si el vigente entregado no trae fecha legible, tampoco se inventa", () => {
    expect(decidirImportabilidad(noVigente, { id: "a2" }).razones).toEqual([{ tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z" }]);
    expect(decidirImportabilidad(noVigente, { id: "a2", analyzedAt: "no-es-fecha" }).razones).toEqual([{ tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z" }]);
  });

  it("si la fecha del propio análisis es ilegible o falta, se omite también", () => {
    const sin = { ...noVigente, analyzedAt: undefined };
    expect(decidirImportabilidad(sin, { id: "a2", analyzedAt: "2026-11-02T08:30:00Z" }).razones).toEqual([{ tipo: "no_vigente", fechaVigente: "2026-11-02T08:30:00.000Z" }]);
    expect(decidirImportabilidad({ ...noVigente, analyzedAt: "basura" }).razones).toEqual([{ tipo: "no_vigente" }]);
  });

  it("acepta fechas de Firestore ({_seconds}) en ambos", () => {
    const t = (iso: string) => ({ _seconds: Date.parse(iso) / 1000 });
    const r = decidirImportabilidad({ ...noVigente, analyzedAt: t("2026-10-01T10:00:00Z") }, { id: "a2", analyzedAt: t("2026-11-02T08:30:00Z") });
    expect(r.razones).toEqual([{ tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z", fechaVigente: "2026-11-02T08:30:00.000Z" }]);
  });

  it("si el «vigente» entregado es el mismo documento, su fecha no se repite como si fuera otro", () => {
    const r = decidirImportabilidad(noVigente, { id: "a1", analyzedAt: "2026-10-01T10:00:00Z" });
    expect(r.razones).toEqual([{ tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z" }]);
  });
});
