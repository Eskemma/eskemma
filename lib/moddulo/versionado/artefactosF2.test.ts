// C1b-1 — registro de artefactos de F2 (módulo puro). La marca `en` llega en formas inesperadas: nunca lanza.

import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  detalleDesvinculacion, detalleMotoresDescartados, enAIso, hayAlgoQueVersionarAlDesvincular, estadoF2M1, vivoF2M1, ESQUEMA_F2, PUNTERO_F2, FASE_F2, AMBITO_F2, NOMBRE_F2_M1,
} from "./artefactosF2";
import { aprobacionDe, docProyectoM1, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";

const exp = (o: Parameters<typeof docProyectoM1>[0] = {}) => docProyectoM1(o).phases.exploracion as never;

describe("constantes", () => {
  it("ámbito, fase, puntero y nombre", () => {
    expect([AMBITO_F2, FASE_F2, PUNTERO_F2, NOMBRE_F2_M1, ESQUEMA_F2]).toEqual(["moddulo", "exploracion", "phases.exploracion.revision", "f2M1", 1]);
  });
});

describe("enAIso — nunca lanza", () => {
  it("Timestamp real → su ISO exacto", () => {
    const d = new Date("2026-11-17T10:20:30.123Z");
    expect(enAIso(Timestamp.fromDate(d))).toBe("2026-11-17T10:20:30.123Z");
  });
  it("Date, forma serializada (_seconds / seconds) y texto con fecha válida (dato legado)", () => {
    expect(enAIso(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01T00:00:00.000Z");
    expect(enAIso({ _seconds: 1_700_000_000, _nanoseconds: 5_000_000 })).toBe("2023-11-14T22:13:20.005Z");
    expect(enAIso({ seconds: 1_700_000_000 })).toBe("2023-11-14T22:13:20.000Z");
    expect(enAIso("2026-10-15T12:00:00Z")).toBe("2026-10-15T12:00:00.000Z");
  });
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["texto que no es fecha (el stub 'TS')", "TS"],
    ["un número", 12345],
    ["un objeto sin forma de fecha (sentinela de FieldValue pendiente)", { _methodName: "FieldValue.serverTimestamp" }],
    ["un Date inválido", new Date("x")],
    ["un toDate() que devuelve basura", { toDate: () => "no" }],
    ["un toDate() que lanza", { toDate: () => { throw new Error("boom"); } }],
    ["_seconds no finito", { _seconds: Number.NaN }],
  ])("%s → null, sin excepción", (_n, v) => {
    expect(() => enAIso(v)).not.toThrow();
    expect(enAIso(v)).toBeNull();
  });
});

describe("estadoF2M1", () => {
  const M = mapaM1();

  it("sin revisión (ni aprobado ni reabierto): contenido sin `aprobacion`", () => {
    const e = estadoF2M1(exp());
    expect(e.aprobacion).toBeUndefined();
    expect(e.contenido).toEqual({ kind: "express", mapa: M, ediciones: {} });
  });

  it("aprobado en el vivo: aprobación con autor, fecha ISO, huella y conteos, SIN `mapa` (decisión 1)", () => {
    const e = estadoF2M1(exp({ m1: { aprobacion: aprobacionDe(M, { en: Timestamp.fromDate(new Date("2026-11-17T01:02:03.004Z")) }) } }));
    expect(e.aprobacion).toEqual({ aprobado: true, por: "u1", en: "2026-11-17T01:02:03.004Z", huella: aprobacionDe(M).huella, categoriasEditadas: 0, total: 6 });
    expect(e.aprobacion).not.toHaveProperty("mapa");
  });

  it("reabierto en el vivo: `aprobacion {aprobado:false, por, en}` con quien reabrió y cuándo", () => {
    const e = estadoF2M1(exp({ m1: { reabiertoEn: Timestamp.fromDate(new Date("2026-11-17T09:00:00.000Z")), reabiertoPor: "u7" } }));
    expect(e.aprobacion).toEqual({ aprobado: false, por: "u7", en: "2026-11-17T09:00:00.000Z" });
  });

  it("con sello: el estado DESPUÉS de la operación (aprobar o reabrir) con el ISO que se le da", () => {
    const a = estadoF2M1(exp(), { aprobado: true, por: "u1", en: "2026-11-17T00:00:00.000Z", huella: "h", categoriasEditadas: 2, total: 6 });
    expect(a.aprobacion).toEqual({ aprobado: true, por: "u1", en: "2026-11-17T00:00:00.000Z", huella: "h", categoriasEditadas: 2, total: 6 });
    const r = estadoF2M1(exp(), { aprobado: false, por: "u1", en: "2026-11-17T00:00:00.000Z" });
    expect(r.aprobacion).toEqual({ aprobado: false, por: "u1", en: "2026-11-17T00:00:00.000Z" });
  });

  it("[en inesperado] null, texto basura o sentinela: NO lanza y queda `en: null` («sin fecha registrada»)", () => {
    for (const en of [null, undefined, "TS", { _methodName: "x" }]) {
      const e = estadoF2M1(exp({ m1: { aprobacion: aprobacionDe(M, { en }) } }));
      expect(e.aprobacion).toMatchObject({ aprobado: true, en: null });
    }
    expect(() => estadoF2M1(exp({ m1: { reabiertoEn: "TS" } }))).not.toThrow();
  });

  it("[aprobación OBSOLETA] queda con SU huella (distinta del contenido actual) y sin mapa: la copia congelada NO se conserva en la versión", () => {
    const e = estadoF2M1(exp({ m1: { aprobacion: aprobacionDe(M, { huella: "huella-vieja" }) } }));
    expect(e.aprobacion).toMatchObject({ aprobado: true, huella: "huella-vieja" });
    expect(e.aprobacion).not.toHaveProperty("mapa");
  });

  it("nunca trae valores `undefined` (el Admin SDK los rechaza)", () => {
    const e = estadoF2M1(exp({ m1: { aprobacion: { por: 5, en: undefined, huella: undefined } as never } }));
    expect(JSON.stringify(e)).not.toContain("undefined");
    expect(Object.values(e.aprobacion as object).every((v) => v !== undefined)).toBe(true);
  });

  it("proyecto sin payload: `mapa` es null y `kind` null (no lanza)", () => {
    const e = estadoF2M1(exp({ payload: null }));
    expect(e.contenido).toEqual({ kind: null, mapa: null, ediciones: {} });
  });
});

describe("vivoF2M1 — la parte viva, SIN autor ni fecha", () => {
  const M = mapaM1();
  it("lleva el contenido, la huella aprobada y si está reabierto; nunca por/en", () => {
    const v = vivoF2M1(exp({ m1: { aprobacion: aprobacionDe(M) } })) as Record<string, unknown>;
    expect(v).toMatchObject({ esquema: 1, kind: "express", aprobacionHuella: aprobacionDe(M).huella, reabierto: false });
    expect(JSON.stringify(v)).not.toContain("u1");
    expect(JSON.stringify(v)).not.toContain("2026-10-15");
  });
  it("aprobar otra vez con distinto autor/fecha NO cambia la proyección viva (sin falsa deriva)", () => {
    const a = vivoF2M1(exp({ m1: { aprobacion: aprobacionDe(M, { por: "u1", en: "a" }) } }));
    const b = vivoF2M1(exp({ m1: { aprobacion: aprobacionDe(M, { por: "u2", en: "b" }) } }));
    expect(a).toEqual(b);
  });
  it("editar el contenido SÍ la cambia (es deriva real)", () => {
    const m2 = mapaM1(); m2.P!.narrativa = "otra";
    expect(vivoF2M1(exp({ payload: m2 }))).not.toEqual(vivoF2M1(exp()));
  });
  it("reabierto se distingue de aprobado y de sin revisar", () => {
    expect((vivoF2M1(exp({ m1: { reabiertoEn: "t" } })) as { reabierto: boolean }).reabierto).toBe(true);
    expect((vivoF2M1(exp()) as { reabierto: boolean }).reabierto).toBe(false);
  });
});

describe("detalleMotoresDescartados", () => {
  it("solo nombres y una bandera; el tipo es el estrecho del evento", () => {
    const d = detalleMotoresDescartados({ motoresAprobados: ["M2", "M4"], hayBorrador: true });
    expect(d).toEqual({ motoresAprobadosDescartados: ["M2", "M4"], borradorDescartado: true });
    expect(detalleMotoresDescartados({ motoresAprobados: [], hayBorrador: false })).toEqual({ motoresAprobadosDescartados: [], borradorDescartado: false });
  });
  it("es una copia de la lista", () => {
    const src = ["M2"]; const d = detalleMotoresDescartados({ motoresAprobados: src, hayBorrador: false });
    src.push("M3");
    expect(d.motoresAprobadosDescartados).toEqual(["M2"]);
  });
});

describe("C1b-2 — hayAlgoQueVersionarAlDesvincular", () => {
  const T = { payload: { P: {} } };
  it("sí: payload, m1, borrador o aprobaciones con contenido (cualquiera de los cuatro)", () => {
    expect(hayAlgoQueVersionarAlDesvincular({ linkedSource: T })).toBe(true);
    expect(hayAlgoQueVersionarAlDesvincular({ linkedSource: {}, m1: { creadoEn: "t" } })).toBe(true);
    expect(hayAlgoQueVersionarAlDesvincular({ linkedSource: {}, draftDVS: { x: 1 } })).toBe(true);
    expect(hayAlgoQueVersionarAlDesvincular({ linkedSource: {}, motorAprobaciones: { M2: true } })).toBe(true);
  });
  it("no: un T22 realmente vacío en esos cuatro puntos ({} / undefined / null no cuentan)", () => {
    expect(hayAlgoQueVersionarAlDesvincular(undefined)).toBe(false);
    expect(hayAlgoQueVersionarAlDesvincular({ linkedSource: {} })).toBe(false);
    expect(hayAlgoQueVersionarAlDesvincular({ linkedSource: { payload: {} }, m1: {}, draftDVS: null, motorAprobaciones: {} })).toBe(false);
  });
});

describe("C1b-2 — detalleDesvinculacion (solo booleanos, números y nombres de motor)", () => {
  it("con aprobación: cuenta categorías; motores en orden M2..M5; `dvs` conservado", () => {
    expect(detalleDesvinculacion({ aprobacion: { categoriasEditadas: 2, total: 6 }, motoresAprobados: ["M4", "M2"], hayBorrador: true, hayReporteF2: true })).toEqual({
      teniaAprobacion: true, categoriasEditadas: 2, totalCategorias: 6, motoresAprobadosDescartados: ["M2", "M4"], borradorDescartado: true, reporteF2Conservado: true,
    });
  });
  it("SIN aprobación: false, 0 y 0", () => {
    expect(detalleDesvinculacion({ aprobacion: null, motoresAprobados: [], hayBorrador: false, hayReporteF2: false })).toEqual({
      teniaAprobacion: false, categoriasEditadas: 0, totalCategorias: 0, motoresAprobadosDescartados: [], borradorDescartado: false, reporteF2Conservado: false,
    });
  });
  it("campos raros de la aprobación (texto, NaN, ausentes) → 0; un nombre que no es M2..M5 se descarta (nunca texto libre)", () => {
    const d = detalleDesvinculacion({ aprobacion: { categoriasEditadas: "x", total: Number.NaN }, motoresAprobados: ["M2", "texto-del-usuario", "M9"], hayBorrador: false, hayReporteF2: false });
    expect(d).toMatchObject({ teniaAprobacion: true, categoriasEditadas: 0, totalCategorias: 0, motoresAprobadosDescartados: ["M2"] });
  });
});
