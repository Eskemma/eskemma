// T7 C3b: el aviso de la nota junto a «Regresar a Moddulo F2 con resultados»: cuándo se pregunta, cómo falla (en silencio) y
// cuándo se muestra.
import { describe, expect, it, vi } from "vitest";
import { cargarNotaImportada, debePedirNotaImportada, mostrarAvisoNotaCentinela } from "./avisoNotaCentinela";

const APROBADO_39 = { id: "a1", status: "APPROVED", globalConfidence: 39, aprobacionJustificacion: "Con reservas documentadas." };
const NOTA = { confianza: 39, justificacion: "Con reservas documentadas." };
const imp = (extra: object = {}) => ({ v: 2, nota: null, sourceAnalysisId: "a1", ...extra }) as never;

describe("debePedirNotaImportada — solo con vínculo y un análisis con nota", () => {
  it("vinculado + aprobado con confianza baja → sí", () => {
    expect(debePedirNotaImportada({ moddulo: "m1", analysis: APROBADO_39 })).toBe(true);
  });
  it.each([
    ["sin vínculo", { moddulo: null, analysis: APROBADO_39 }],
    ["sin vínculo (undefined)", { analysis: APROBADO_39 }],
    ["sin análisis", { moddulo: "m1", analysis: null }],
    ["análisis sin id", { moddulo: "m1", analysis: { ...APROBADO_39, id: undefined } }],
    ["confianza suficiente", { moddulo: "m1", analysis: { ...APROBADO_39, globalConfidence: 80 } }],
    ["sin aprobar", { moddulo: "m1", analysis: { ...APROBADO_39, status: "REVIEWED" } }],
  ])("no pregunta (cero lecturas): %s", (_n, i) => {
    expect(debePedirNotaImportada(i as never)).toBe(false);
  });
});

describe("cargarNotaImportada — nunca lanza: cualquier fallo es null", () => {
  const ok = (cuerpo: unknown) => vi.fn(async () => ({ ok: true, json: async () => cuerpo }));
  it("lee la nota importada de la ruta existente (?ajustesImportados=1)", async () => {
    const f = ok({ notaImportada: { v: 2, nota: NOTA, sourceAnalysisId: "a1" } });
    expect(await cargarNotaImportada("pest1", f)).toEqual({ v: 2, nota: NOTA, sourceAnalysisId: "a1" });
    expect(f).toHaveBeenCalledWith("/api/centinela/pestel/project/pest1?ajustesImportados=1");
  });
  it("respuesta no OK, red caída, JSON ilegible o forma inesperada → null", async () => {
    expect(await cargarNotaImportada("p", vi.fn(async () => ({ ok: false, json: async () => ({}) })))).toBeNull();
    expect(await cargarNotaImportada("p", vi.fn(async () => { throw new Error("red"); }))).toBeNull();
    expect(await cargarNotaImportada("p", vi.fn(async () => ({ ok: true, json: async () => { throw new Error("no json"); } })))).toBeNull();
    for (const cuerpo of [null, {}, { notaImportada: null }, { notaImportada: "x" }]) expect(await cargarNotaImportada("p", ok(cuerpo))).toBeNull();
  });
  it("campos con tipo equivocado se normalizan (v y sourceAnalysisId a null)", async () => {
    expect(await cargarNotaImportada("p", ok({ notaImportada: { v: "2", nota: null, sourceAnalysisId: 5 } }))).toEqual({ v: null, nota: null, sourceAnalysisId: null });
  });
});

describe("mostrarAvisoNotaCentinela", () => {
  it("nota AGREGADA: vínculo v2 sin nota y el análisis ya la tiene → sí", () => {
    expect(mostrarAvisoNotaCentinela(APROBADO_39, imp())).toBe(true);
  });
  it("nota CAMBIADA (otra justificación) → sí; EQUIVALENTE → no", () => {
    expect(mostrarAvisoNotaCentinela(APROBADO_39, imp({ nota: { confianza: 39, justificacion: "Otra." } }))).toBe(true);
    expect(mostrarAvisoNotaCentinela(APROBADO_39, imp({ nota: NOTA }))).toBe(false);
  });
  it("vínculo v1 o sin huella → no (inaccionable)", () => {
    expect(mostrarAvisoNotaCentinela(APROBADO_39, imp({ v: 1 }))).toBe(false);
    expect(mostrarAvisoNotaCentinela(APROBADO_39, imp({ v: null }))).toBe(false);
  });
  it("fallo del GET (null) o sin datos cargados → no", () => {
    expect(mostrarAvisoNotaCentinela(APROBADO_39, null)).toBe(false);
    expect(mostrarAvisoNotaCentinela(APROBADO_39, undefined)).toBe(false);
  });
  it("F2 importó OTRO análisis → no", () => {
    expect(mostrarAvisoNotaCentinela(APROBADO_39, imp({ sourceAnalysisId: "a2" }))).toBe(false);
  });
});
