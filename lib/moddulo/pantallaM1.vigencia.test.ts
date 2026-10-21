// Commit 2 (estados de trabajo): vigencia del Reporte F2 (sello y compatibilidad), cierre, etiqueta, bloqueo de
// «Editar análisis», aviso de motores actualizados y borde de la edición fantasma.
import { describe, expect, it } from "vitest";
import { estadoM1, contarDimensionesEditadas, dimensionEditada, mismoValorDeEdicion, registrarEdicion } from "./m1Aprobacion";
import { analizarM1, resumenM1ParaCliente } from "./m1Servidor";
import { huellaMapaPESTEL } from "./m1Huella";
import {
  avisoMotoresActualizadosVisible, motivoBloqueoEditarAnalisis, motivoNoCerrarF2, reporteDelAnalisisAnterior,
  textoBloqueoAccionesF2, textoMotoresActualizados,
} from "./pantallaM1";

const MAPA = {
  P: { code: "P", label: "Político", clasificacion: "AMENAZA", narrativa: "Texto original", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] },
  L: { code: "L", label: "Legal", clasificacion: "AMENAZA", narrativa: "Texto legal", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] },
} as never;
const H = huellaMapaPESTEL(MAPA);
const aprobacion = { huella: H, por: "u", en: "t", categoriasEditadas: 0, total: 2, mapa: MAPA };
const estado = (m1: object, tieneDvs: boolean, tieneDraft: boolean) =>
  estadoM1({ m1: m1 as never, tienePayload: true, huellaPayload: H, tieneDvs, tieneDraft, hayMotoresAprobados: false });

describe("estadoM1.dvsDeOtroAnalisis — sello y regla de compatibilidad", () => {
  it.each([
    ["sello igual, sin borrador", { finalizacion: { huella: H } }, true, false, false],
    ["sello igual, con borrador guardado", { finalizacion: { huella: H } }, true, true, false],
    ["sello distinto, sin borrador (el sello manda)", { finalizacion: { huella: "otra" } }, true, false, true],
    ["sello distinto, con borrador", { finalizacion: { huella: "otra" } }, true, true, true],
    ["SIN sello, sin borrador pendiente → se asume vigente", {}, true, false, false],
    ["SIN sello, con borrador pendiente → de otro análisis (el hueco)", {}, true, true, true],
    ["sin dvs finalizado: nada que comparar (primera generación)", {}, false, true, false],
  ] as const)("%s", (_d, extra, dvs, draft, esperado) => {
    expect(estado({ aprobacion, generacion: { huella: H }, ...extra }, dvs, draft).dvsDeOtroAnalisis).toBe(esperado);
  });
  it("estados sin aprobación válida nunca la marcan", () => {
    expect(estado({ creadoEn: "t" }, true, true).dvsDeOtroAnalisis).toBe(false); // borrador
    expect(estado({ reabiertoEn: "t" }, true, true).dvsDeOtroAnalisis).toBe(false); // reabierto
    expect(estadoM1({ m1: undefined, tienePayload: true, huellaPayload: H, tieneDvs: true, tieneDraft: true, hayMotoresAprobados: false }).dvsDeOtroAnalisis).toBe(false); // anterior
  });
});

describe("la fase cerrada no cambia nunca", () => {
  const exp = (extra: object, status?: string) => ({ status, linkedSource: { kind: "express", payload: MAPA }, dvs: {}, draftDVS: {}, m1: { aprobacion, generacion: { huella: H }, ...extra } });
  it("con la fase cerrada el resumen para la pantalla NO marca dvsDeOtroAnalisis (ni etiqueta ni aviso nuevos)", () => {
    expect(resumenM1ParaCliente(exp({}, "completed") as never).dvsDeOtroAnalisis).toBe(false);
    expect(resumenM1ParaCliente(exp({}, "in-progress") as never).dvsDeOtroAnalisis).toBe(true);
  });
  it("el resumen entrega si hay borrador guardado en el servidor", () => {
    expect(resumenM1ParaCliente(exp({}) as never).borradorGuardado).toBe(true);
    expect(resumenM1ParaCliente({ ...exp({}), draftDVS: undefined } as never).borradorGuardado).toBe(false);
  });
  it("«ya_cerrada» sigue ganando sobre cualquier motivo", () => {
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: true, motoresSinGenerar: true, dvsDeOtroAnalisis: true, f2Cerrada: true })).toBe("ya_cerrada");
  });
  it("analizarM1 expone cerrada y la vigencia por separado (el resumen es quien lo apaga)", () => {
    const a = analizarM1(exp({}, "completed") as never);
    expect(a.cerrada).toBe(true);
    expect(a.estado.dvsDeOtroAnalisis).toBe(true);
  });
});

describe("motivoNoCerrarF2 con dvsDeOtroAnalisis", () => {
  it("aprobado + dvs de otra versión → reporte_f2_de_otro_analisis (aunque los motores estén generados)", () => {
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: true, motoresSinGenerar: false, dvsDeOtroAnalisis: true })).toBe("reporte_f2_de_otro_analisis");
  });
  it("aprobado + dvs vigente → puede cerrar; sin el campo (llamadores anteriores) como antes", () => {
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: true, motoresSinGenerar: false, dvsDeOtroAnalisis: false })).toBeNull();
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: true, motoresSinGenerar: false })).toBeNull();
  });
  it("el orden anterior se conserva (reabierto, sin dvs)", () => {
    expect(motivoNoCerrarF2({ estado: "reabierto", hayDvs: true, motoresSinGenerar: false, dvsDeOtroAnalisis: true })).toBe("m1_no_aprobado");
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: false, motoresSinGenerar: false, dvsDeOtroAnalisis: true })).toBe("reporte_f2_no_finalizado");
  });
});

describe("etiqueta del reporte", () => {
  it("se deriva también de la comparación de huellas, no solo de borrador/reabierto", () => {
    expect(reporteDelAnalisisAnterior("aprobado", true, true)).toBe(true);
    expect(reporteDelAnalisisAnterior("aprobado", true, false)).toBe(false);
    expect(reporteDelAnalisisAnterior("aprobado", false, true)).toBe(false);
    expect(reporteDelAnalisisAnterior("reabierto", true)).toBe(true); // como antes
    expect(reporteDelAnalisisAnterior("aprobado", true)).toBe(false); // como antes
  });
});

describe("«Editar análisis» con borrador guardado pendiente", () => {
  const base = { estado: "aprobado" as const, generando: false, hayDvs: true, borradorGuardado: false };
  it("con borrador guardado + dvs finalizado: bloqueado con su motivo", () => {
    expect(motivoBloqueoEditarAnalisis({ ...base, borradorGuardado: true })).toBe("borrador_pendiente");
    expect(textoBloqueoAccionesF2("borrador_pendiente", true)).toMatch(/motores nuevos sin finalizar/);
  });
  it("sin borrador guardado (el borrador LOCAL de «Editar análisis» no cuenta), sin dvs o con la fase cerrada: libre", () => {
    expect(motivoBloqueoEditarAnalisis(base)).toBeNull();
    expect(motivoBloqueoEditarAnalisis({ ...base, hayDvs: false, borradorGuardado: true })).toBeNull();
    expect(motivoBloqueoEditarAnalisis({ ...base, borradorGuardado: true, f2Cerrada: true })).toBeNull();
  });
  it("conserva los bloqueos generales (generando, M1 en edición) por encima", () => {
    expect(motivoBloqueoEditarAnalisis({ ...base, generando: true, borradorGuardado: true })).toBe("generando");
    expect(motivoBloqueoEditarAnalisis({ ...base, estado: "reabierto", borradorGuardado: true })).toBe("m1_en_edicion");
  });
});

describe("aviso de motores actualizados", () => {
  const E = "Revísalos en orden; el efecto se ve en cómo se interpreta cada uno.";
  it("con nombres, en el orden de pantalla y sin importar el orden recibido", () => {
    expect(textoMotoresActualizados(["L"])).toBe(`Los motores M2–M5 se actualizaron con tus ajustes en Legal. ${E}`);
    expect(textoMotoresActualizados(["L", "P"])).toBe(`Los motores M2–M5 se actualizaron con tus ajustes en Político y Legal. ${E}`);
    expect(textoMotoresActualizados(["L", "E", "P"])).toBe(`Los motores M2–M5 se actualizaron con tus ajustes en Político, Económico y Legal. ${E}`);
  });
  it("sin ediciones vigentes: texto sin ajustes", () => {
    expect(textoMotoresActualizados([])).toBe(`Los motores M2–M5 se actualizaron con el análisis PESTEL aprobado. ${E}`);
  });
  it("no promete menciones ni nombra el producto", () => {
    for (const t of [textoMotoresActualizados([]), textoMotoresActualizados(["L"])]) expect(t).not.toMatch(/Claude|mencion|incluy/i);
  });
  const v = { estado: "aprobado" as const, f2Cerrada: false, hayDvs: true, borradorGuardado: true, dvsDeOtroAnalisis: true };
  it("visible: aprobado, abierta, dvs, borrador guardado y dvs de otra versión", () => {
    expect(avisoMotoresActualizadosVisible(v)).toBe(true);
  });
  it.each([
    ["fase cerrada", { f2Cerrada: true }],
    ["sin borrador guardado (se apaga al finalizar)", { borradorGuardado: false }],
    ["dvs ya sellado con la huella vigente", { dvsDeOtroAnalisis: false }],
    ["primera generación (sin dvs)", { hayDvs: false }],
    ["M1 reabierto", { estado: "reabierto" as const }],
    ["proyecto anterior (sin registro m1)", { estado: "anterior" as const }],
  ])("no visible: %s", (_d, cambio) => {
    expect(avisoMotoresActualizadosVisible({ ...v, ...cambio })).toBe(false);
  });
});

describe("borde de la edición fantasma", () => {
  const mapa = (narrativa: string, clasificacion = "AMENAZA") => ({ L: { code: "L", label: "Legal", clasificacion, narrativa } }) as never;
  it("dejar la narrativa igual salvo espacios o saltos finales NO registra edición", () => {
    const e = registrarEdicion(undefined, { dim: "L", campo: "narrativa", valorActual: "Texto original\n\n", editado: "Texto original", por: "u", en: "t" });
    expect(e).toEqual({});
  });
  it("una edición real sí se registra y conserva el original sin recortar", () => {
    const e = registrarEdicion(undefined, { dim: "L", campo: "narrativa", valorActual: "Texto original\n", editado: "Otro texto", por: "u", en: "t" });
    expect(e["L.narrativa"]).toMatchObject({ original: "Texto original\n", editado: "Otro texto" });
  });
  it("la clasificación se compara exacta y el interior de la narrativa no se normaliza", () => {
    expect(mismoValorDeEdicion("clasificacion", "AMENAZA", "NEUTRAL")).toBe(false);
    expect(mismoValorDeEdicion("clasificacion", "AMENAZA", "AMENAZA")).toBe(true);
    expect(mismoValorDeEdicion("narrativa", "a b", "a  b")).toBe(false);
  });
  it("una edición fantasma ya guardada (original con espacios) deja de contar como categoría editada", () => {
    const ediciones = { "L.narrativa": { original: "Texto\n", editado: "Texto", por: "u", en: "t" } };
    expect(dimensionEditada(ediciones, mapa("Texto"), "L")).toBe(false);
    expect(contarDimensionesEditadas(ediciones, mapa("Texto"))).toBe(0);
  });
  it.each([
    ["solo texto", { "L.narrativa": { original: "a", editado: "b" } }, mapa("b"), 1],
    ["solo etiqueta", { "L.clasificacion": { original: "AMENAZA", editado: "NEUTRAL" } }, mapa("a", "NEUTRAL"), 1],
    ["ambos (cuenta UNA categoría)", { "L.narrativa": { original: "a", editado: "b" }, "L.clasificacion": { original: "AMENAZA", editado: "NEUTRAL" } }, mapa("b", "NEUTRAL"), 1],
    ["ninguno (valor devuelto al original)", { "L.narrativa": { original: "a", editado: "a" } }, mapa("a"), 0],
  ] as const)("los cuatro casos: %s", (_d, ed, m, n) => {
    const ediciones = Object.fromEntries(Object.entries(ed).map(([k, v]) => [k, { ...v, por: "u", en: "t" }]));
    expect(contarDimensionesEditadas(ediciones as never, m)).toBe(n);
  });
  it("la huella no depende de las ediciones ni de su comparación (se calcula sobre el objeto guardado)", () => {
    const m = mapa("Texto");
    const h = huellaMapaPESTEL(m);
    registrarEdicion(undefined, { dim: "L", campo: "narrativa", valorActual: "Texto\n", editado: "Texto", por: "u", en: "t" });
    expect(huellaMapaPESTEL(m)).toBe(h);
  });
});
