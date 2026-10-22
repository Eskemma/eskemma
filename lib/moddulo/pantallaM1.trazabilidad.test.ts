// Paso 7, commit 1: la línea de trazabilidad del Reporte F2 (vigencia) y su lugar en las descargas.
import { describe, expect, it } from "vitest";
import type { DVSF2, MapaPESTEL } from "@/types/moddulo.types";
import { huellaMapaPESTEL } from "./m1Huella";
import { resumenM1ParaCliente } from "./m1Servidor";
import { lineaTrazabilidadReporte, TEXTO_ANTERIOR } from "./pantallaM1";
import { formatF2Report, formatPestelAnalysis } from "./reportFormatters";

const MAPA = {
  P: { code: "P", label: "Político", clasificacion: "AMENAZA", narrativa: "Texto P", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] },
  L: { code: "L", label: "Legal", clasificacion: "NEUTRAL", narrativa: "Texto L", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] },
} as unknown as MapaPESTEL;
const H = huellaMapaPESTEL(MAPA);
const EN = "2026-10-21T20:00:00.000Z";
const aprob = (categoriasEditadas = 0) => ({ huella: H, por: "u", en: EN, categoriasEditadas, total: 2, mapa: MAPA });

const exp = (o: { m1?: object; dvs?: boolean; draft?: boolean; status?: string; kind?: string }) => ({
  status: o.status ?? "in-progress",
  linkedSource: { kind: o.kind ?? "express", payload: MAPA },
  ...(o.m1 ? { m1: o.m1 } : {}),
  ...(o.dvs === false ? {} : { dvs: { x: 1 } }),
  ...(o.draft ? { draftDVS: { x: 1 } } : {}),
}) as never;
const linea = (e: never) => resumenM1ParaCliente(e).trazabilidad;
const lineaPestel = (e: never) => resumenM1ParaCliente(e).trazabilidadPestel;

describe("vigencia de la línea de trazabilidad (resumen del GET)", () => {
  it.each([
    ["aprobado, informe de esta aprobación, SIN ajustes", exp({ m1: { aprobacion: aprob(0), finalizacion: { huella: H } } }), "Análisis aprobado sin ajustes el 21 de octubre de 2026."],
    ["aprobado, informe de esta aprobación, CON ajustes", exp({ m1: { aprobacion: aprob(1), finalizacion: { huella: H } } }), "Análisis revisado y ajustado por el usuario el 21 de octubre de 2026, en 1 de 2 categorías."],
    ["Centinela (T22) aprobado: sin ajustes posibles", exp({ kind: "T22", m1: { aprobacion: aprob(0), finalizacion: { huella: H } } }), "Análisis aprobado sin ajustes el 21 de octubre de 2026."],
    ["fase cerrada con informe vigente: igual", exp({ status: "completed", m1: { aprobacion: aprob(0), finalizacion: { huella: H } } }), "Análisis aprobado sin ajustes el 21 de octubre de 2026."],
    ["proyecto anterior (análisis PESTEL, sin registro m1)", exp({}), TEXTO_ANTERIOR],
    ["proyecto anterior con fase cerrada", exp({ status: "completed" }), TEXTO_ANTERIOR],
    ["aprobado pero SIN informe finalizado", exp({ dvs: false, m1: { aprobacion: aprob(0) } }), null],
    ["informe de OTRO análisis (sello distinto)", exp({ m1: { aprobacion: aprob(0), finalizacion: { huella: "otra" } } }), null],
    ["informe de otro análisis por la regla de compatibilidad (borrador pendiente, sin sello)", exp({ draft: true, m1: { aprobacion: aprob(0) } }), null],
    ["borrador del M1 (sin aprobar)", exp({ m1: { creadoEn: EN } }), null],
    ["M1 reabierto", exp({ m1: { creadoEn: EN, reabiertoEn: EN } }), null],
    ["aprobación que ya no coincide con el payload", exp({ m1: { aprobacion: { ...aprob(0), huella: "vieja" }, finalizacion: { huella: "vieja" } } }), null],
  ] as const)("%s", (_d, e, esperado) => {
    expect(linea(e)).toBe(esperado);
  });

  it("sin análisis PESTEL (sin payload) no hay línea, aunque haya informe", () => {
    expect(linea({ dvs: { x: 1 } } as never)).toBeNull();
  });

  it("la función pura reutiliza la constante del panel y no añade origen", () => {
    expect(lineaTrazabilidadReporte({ estado: "anterior", aprobacionValida: false, aprobacion: undefined, hayDvs: true, dvsDeOtroAnalisis: false })).toBe("Aprobación no registrada (proyecto anterior)");
    expect(lineaTrazabilidadReporte({ estado: "anterior", aprobacionValida: false, aprobacion: undefined, hayDvs: false, dvsDeOtroAnalisis: false })).toBeNull();
    expect(lineaTrazabilidadReporte({ estado: "sin_m1", aprobacionValida: false, aprobacion: undefined, hayDvs: true, dvsDeOtroAnalisis: false })).toBeNull();
    expect(lineaTrazabilidadReporte({ estado: "aprobado", aprobacionValida: true, aprobacion: aprob(0), hayDvs: true, dvsDeOtroAnalisis: false })).not.toMatch(/Centinela|Express/i);
  });
});

describe("línea de la descarga del PESTEL (no depende del Reporte F2)", () => {
  const A0 = "Análisis aprobado sin ajustes el 21 de octubre de 2026.";
  it.each([
    ["aprobado SIN Reporte F2", exp({ dvs: false, m1: { aprobacion: aprob(0) } }), A0],
    ["aprobado con ajustes y sin Reporte F2", exp({ dvs: false, m1: { aprobacion: aprob(2) } }), "Análisis revisado y ajustado por el usuario el 21 de octubre de 2026, en 2 de 2 categorías."],
    ["aprobado con Reporte F2 de OTRO análisis", exp({ m1: { aprobacion: aprob(0), finalizacion: { huella: "otra" } } }), A0],
    ["aprobado con Reporte F2 vigente", exp({ m1: { aprobacion: aprob(0), finalizacion: { huella: H } } }), A0],
    ["Centinela aprobado", exp({ kind: "T22", dvs: false, m1: { aprobacion: aprob(0) } }), A0],
    ["fase cerrada aprobada", exp({ status: "completed", m1: { aprobacion: aprob(0), finalizacion: { huella: H } } }), A0],
    ["anterior SIN Reporte F2 (solo borrador de motores)", exp({ dvs: false, draft: true }), TEXTO_ANTERIOR],
    ["solo payload, sin m1 ni motores (lo lee como borrador)", exp({ dvs: false }), null],
    ["anterior con Reporte F2", exp({}), TEXTO_ANTERIOR],
    ["borrador", exp({ m1: { creadoEn: EN } }), null],
    ["reabierto", exp({ m1: { creadoEn: EN, reabiertoEn: EN } }), null],
    ["aprobación vencida", exp({ m1: { aprobacion: { ...aprob(0), huella: "vieja" } } }), null],
  ] as const)("%s", (_d, e, esperado) => {
    expect(lineaPestel(e)).toBe(esperado);
  });
  it("sin análisis (sin payload) no hay línea; el Reporte F2 sigue exigiendo Reporte vigente", () => {
    expect(lineaPestel({ dvs: { x: 1 } } as never)).toBeNull();
    expect(linea(exp({ dvs: false, m1: { aprobacion: aprob(0) } }))).toBeNull();
    expect(linea(exp({ m1: { aprobacion: aprob(0), finalizacion: { huella: "otra" } } }))).toBeNull();
  });
});

describe("formateadores de descarga", () => {
  const dvs = { hei: { tensionCentral: "t", premisaEstrategica: "p", condicionesFavorables: [], condicionesAdversas: [] }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] } as unknown as DVSF2;
  const LINEA = "Análisis aprobado sin ajustes el 21 de octubre de 2026.";

  it("sin línea (ausente, null o vacía) la salida es idéntica byte a byte", () => {
    const f2 = formatF2Report(dvs);
    expect(formatF2Report(dvs, null)).toBe(f2);
    expect(formatF2Report(dvs, "")).toBe(f2);
    const pe = formatPestelAnalysis(MAPA);
    expect(formatPestelAnalysis(MAPA, null)).toBe(pe);
    expect(formatPestelAnalysis(MAPA, undefined)).toBe(pe);
  });

  it("con línea: una línea en cursiva bajo el título y nada más cambia", () => {
    const f2 = formatF2Report(dvs, LINEA);
    expect(f2.split("\n").slice(0, 3)).toEqual(["# Reporte F2 — Exploración", "", `_${LINEA}_`]);
    expect(f2.replace(`_${LINEA}_\n\n`, "")).toBe(formatF2Report(dvs));
    const pe = formatPestelAnalysis(MAPA, LINEA);
    expect(pe.split("\n").slice(0, 3)).toEqual(["# Análisis PESTEL", "", `_${LINEA}_`]);
    expect(pe.replace(`_${LINEA}_\n\n`, "")).toBe(formatPestelAnalysis(MAPA));
  });
});
