// M1 review/approval: derived state, edits by path, "Editado" chip, adjusted-category count
// and traceability line. Pure module + the server-only fingerprint.

import { describe, expect, it } from "vitest";
import type { M1Datos, MapaPESTEL } from "@/types/moddulo.types";
import {
  aFecha,
  contarDimensionesEditadas,
  dimensionEditada,
  estadoM1,
  lineaTrazabilidadM1,
  registrarEdicion,
  restaurarDimension,
  rutaEdicion,
  totalDimensiones,
  type EntradaEstadoM1,
} from "./m1Aprobacion";
import { huellaMapaPESTEL } from "./m1Huella";

const dim = (code: string, over: Record<string, unknown> = {}) => ({
  code, label: code, clasificacion: "NEUTRAL" as const, narrativa: `IA ${code}`,
  senalesFavorables: [], senalesAdversas: [], senalesInciertas: [], ...over,
});
const mapa = (): MapaPESTEL => ({ P: dim("P"), E: dim("E"), S: dim("S"), T: dim("T"), Ec: dim("Ec"), L: dim("L") });

const base = (over: Partial<EntradaEstadoM1> = {}): EntradaEstadoM1 => ({
  m1: undefined, tienePayload: true, huellaPayload: "H1",
  tieneDvs: false, tieneDraft: false, hayMotoresAprobados: false, ...over,
});
const aprobacion = (huella = "H1") => ({ por: "u", en: new Date(), huella, categoriasEditadas: 0, total: 6, mapa: mapa() });

describe("huellaMapaPESTEL (servidor)", () => {
  it("es estable ante el orden de las claves y cambia con cualquier contenido", () => {
    const a = mapa();
    const b: MapaPESTEL = { L: a.L, Ec: a.Ec, T: a.T, S: a.S, E: a.E, P: { ...a.P!, label: "P" } };
    expect(huellaMapaPESTEL(a)).toBe(huellaMapaPESTEL(b));
    expect(huellaMapaPESTEL(a)).toMatch(/^[0-9a-f]{64}$/);
    const c = mapa(); c.P!.narrativa = "otra";
    expect(huellaMapaPESTEL(c)).not.toBe(huellaMapaPESTEL(a));
    const d = mapa(); d.S!.clasificacion = "AMENAZA";
    expect(huellaMapaPESTEL(d)).not.toBe(huellaMapaPESTEL(a));
  });
});

describe("estadoM1 — cada combinación", () => {
  it("sin payload y sin restos → sin_m1", () => {
    expect(estadoM1(base({ tienePayload: false, huellaPayload: null })).estado).toBe("sin_m1");
  });
  it("sin payload con borrador (resto de un desvincular, p. ej. uF4UM9) → sin_m1_con_restos", () => {
    expect(estadoM1(base({ tienePayload: false, huellaPayload: null, tieneDraft: true, hayMotoresAprobados: true })).estado).toBe("sin_m1_con_restos");
  });
  it("sin payload con SOLO dvs de la ruta legada → sin_m1 (el dvs no es un resto de motores)", () => {
    expect(estadoM1(base({ tienePayload: false, huellaPayload: null, tieneDvs: true })).estado).toBe("sin_m1");
  });
  it("payload sin registro m1 y con dvs → anterior", () => {
    expect(estadoM1(base({ tieneDvs: true })).estado).toBe("anterior");
  });
  it("payload sin registro m1 y con borrador o aprobaciones de motores → anterior", () => {
    expect(estadoM1(base({ tieneDraft: true })).estado).toBe("anterior");
    expect(estadoM1(base({ hayMotoresAprobados: true })).estado).toBe("anterior");
  });
  it("payload sin registro m1 y nada más → borrador", () => {
    expect(estadoM1(base()).estado).toBe("borrador");
  });
  it("con m1 sin aprobación → borrador (aunque haya dvs: ya pasó por «Nuevo análisis»)", () => {
    expect(estadoM1(base({ m1: { ediciones: {} }, tieneDvs: true })).estado).toBe("borrador");
  });
  it("aprobación cuya huella coincide → aprobado y válida", () => {
    const r = estadoM1(base({ m1: { aprobacion: aprobacion("H1") } }));
    expect(r).toMatchObject({ estado: "aprobado", aprobacionValida: true });
  });
  it("aprobación cuya huella NO coincide (el payload cambió) → borrador, aprobación inválida", () => {
    const r = estadoM1(base({ m1: { aprobacion: aprobacion("VIEJA") }, tieneDvs: true }));
    expect(r).toMatchObject({ estado: "borrador", aprobacionValida: false, motoresSinGenerar: false });
  });
  it("aprobación sin huella de payload calculable → no es válida", () => {
    expect(estadoM1(base({ huellaPayload: null, m1: { aprobacion: aprobacion() } })).aprobacionValida).toBe(false);
  });
  it("aprobado sin generación → motoresSinGenerar", () => {
    expect(estadoM1(base({ m1: { aprobacion: aprobacion() } })).motoresSinGenerar).toBe(true);
  });
  it("aprobado con generación de OTRA huella → motoresSinGenerar", () => {
    const m1: M1Datos = { aprobacion: aprobacion("H1"), generacion: { huella: "H0", en: new Date() } };
    expect(estadoM1(base({ m1, tieneDraft: true })).motoresSinGenerar).toBe(true);
  });
  it("aprobado con generación de la misma huella → motores generados", () => {
    const m1: M1Datos = { aprobacion: aprobacion("H1"), generacion: { huella: "H1", en: new Date() } };
    expect(estadoM1(base({ m1, tieneDraft: true }))).toMatchObject({ estado: "aprobado", motoresSinGenerar: false });
  });
  it("reabierto: marca de reapertura y sin aprobación", () => {
    const m1: M1Datos = { reabiertoEn: new Date(), reabiertoPor: "u", generacion: { huella: "H1", en: new Date() } };
    expect(estadoM1(base({ m1, tieneDraft: true })).estado).toBe("reabierto");
  });
  it("un M1 con aprobación válida no se considera reabierto aunque conserve la marca", () => {
    const m1: M1Datos = { aprobacion: aprobacion(), reabiertoEn: new Date() };
    expect(estadoM1(base({ m1 })).estado).toBe("aprobado");
  });
});

describe("ediciones por ruta", () => {
  const e1 = { dim: "P", campo: "narrativa" as const, valorActual: "IA P", editado: "Mi texto", por: "u", en: "t1" };

  it("la primera edición guarda el original; la segunda lo conserva", () => {
    const a = registrarEdicion(undefined, e1);
    expect(a["P.narrativa"]).toEqual({ original: "IA P", editado: "Mi texto", por: "u", en: "t1" });
    const b = registrarEdicion(a, { ...e1, valorActual: "Mi texto", editado: "Otro", en: "t2" });
    expect(b["P.narrativa"]).toMatchObject({ original: "IA P", editado: "Otro", en: "t2" });
  });
  it("las claves son por ruta: narrativa y clasificación se registran por separado", () => {
    let e = registrarEdicion(undefined, e1);
    e = registrarEdicion(e, { dim: "P", campo: "clasificacion", valorActual: "NEUTRAL", editado: "AMENAZA", por: "u", en: "t" });
    expect(Object.keys(e).sort()).toEqual(["P.clasificacion", "P.narrativa"]);
    expect(rutaEdicion("Ec", "clasificacion")).toBe("Ec.clasificacion");
  });
  it("editar de vuelta al texto original elimina la entrada (no es un ajuste)", () => {
    const a = registrarEdicion(undefined, e1);
    const b = registrarEdicion(a, { ...e1, valorActual: "Mi texto", editado: "IA P" });
    expect(b).toEqual({});
  });
  it("no muta el objeto recibido", () => {
    const a = registrarEdicion(undefined, e1);
    const copia = JSON.parse(JSON.stringify(a));
    registrarEdicion(a, { ...e1, editado: "x" });
    expect(a).toEqual(copia);
  });
  it("restaurar una dimensión devuelve los originales de AMBOS campos y quita la dimensión, sin tocar las demás", () => {
    let e = registrarEdicion(undefined, e1);
    e = registrarEdicion(e, { dim: "P", campo: "clasificacion", valorActual: "NEUTRAL", editado: "AMENAZA", por: "u", en: "t" });
    e = registrarEdicion(e, { dim: "S", campo: "narrativa", valorActual: "IA S", editado: "S editada", por: "u", en: "t" });
    const r = restaurarDimension(e, "P");
    expect(r.valores).toEqual({ narrativa: "IA P", clasificacion: "NEUTRAL" });
    expect(Object.keys(r.ediciones)).toEqual(["S.narrativa"]);
  });
  it("restaurar una dimensión sin ediciones no hace nada", () => {
    expect(restaurarDimension(undefined, "P")).toEqual({ ediciones: {}, valores: {} });
  });
});

describe("chip «Editado» y conteo de categorías ajustadas", () => {
  it("«Editado» solo si lo editado coincide con el payload", () => {
    const m = mapa(); m.P!.narrativa = "Mi texto";
    const e = registrarEdicion(undefined, { dim: "P", campo: "narrativa", valorActual: "IA P", editado: "Mi texto", por: "u", en: "t" });
    expect(dimensionEditada(e, m, "P")).toBe(true);
    expect(dimensionEditada(e, m, "S")).toBe(false);
  });
  it("si el payload ya no tiene el texto editado (re-sync/nuevo análisis) NO hay chip ni conteo", () => {
    const e = registrarEdicion(undefined, { dim: "P", campo: "narrativa", valorActual: "IA P", editado: "Mi texto", por: "u", en: "t" });
    const distinto = mapa(); distinto.P!.narrativa = "Texto nuevo de la IA";
    expect(dimensionEditada(e, distinto, "P")).toBe(false);
    expect(contarDimensionesEditadas(e, distinto)).toBe(0);
  });
  it("una dimensión con narrativa y clasificación editadas cuenta UNA vez", () => {
    const m = mapa(); m.P!.narrativa = "x"; m.P!.clasificacion = "AMENAZA"; m.S!.narrativa = "y";
    let e = registrarEdicion(undefined, { dim: "P", campo: "narrativa", valorActual: "IA P", editado: "x", por: "u", en: "t" });
    e = registrarEdicion(e, { dim: "P", campo: "clasificacion", valorActual: "NEUTRAL", editado: "AMENAZA", por: "u", en: "t" });
    e = registrarEdicion(e, { dim: "S", campo: "narrativa", valorActual: "IA S", editado: "y", por: "u", en: "t" });
    expect(contarDimensionesEditadas(e, m)).toBe(2);
  });
  it("restaurar NO cuenta como ajuste", () => {
    const m = mapa(); m.P!.narrativa = "x";
    let e = registrarEdicion(undefined, { dim: "P", campo: "narrativa", valorActual: "IA P", editado: "x", por: "u", en: "t" });
    expect(contarDimensionesEditadas(e, m)).toBe(1);
    e = restaurarDimension(e, "P").ediciones;
    m.P!.narrativa = "IA P";
    expect(contarDimensionesEditadas(e, m)).toBe(0);
  });
  it("sin ediciones el conteo es 0 y el total cuenta las dimensiones del mapa", () => {
    expect(contarDimensionesEditadas(undefined, mapa())).toBe(0);
    expect(totalDimensiones(mapa())).toBe(6);
    expect(totalDimensiones(undefined)).toBe(0);
  });
});

describe("lineaTrazabilidadM1", () => {
  const en = new Date("2026-10-15T18:00:00Z");
  it("con ajustes", () => {
    expect(lineaTrazabilidadM1({ en, categoriasEditadas: 2, total: 6 }))
      .toBe("Análisis revisado y ajustado por el usuario el 15 de octubre de 2026, en 2 de 6 categorías.");
  });
  it("sin ajustes", () => {
    expect(lineaTrazabilidadM1({ en, categoriasEditadas: 0, total: 6 })).toBe("Análisis aprobado sin ajustes el 15 de octubre de 2026.");
  });
  it("proyecto anterior (sin aprobación) o fecha ilegible → null", () => {
    expect(lineaTrazabilidadM1(undefined)).toBeNull();
    expect(lineaTrazabilidadM1({ en: "no es fecha", categoriasEditadas: 0, total: 6 })).toBeNull();
  });
  it("acepta las formas de fecha de Firestore (client, admin, ISO)", () => {
    expect(aFecha({ toDate: () => en })?.getTime()).toBe(en.getTime());
    expect(aFecha({ _seconds: en.getTime() / 1000 })?.getTime()).toBe(en.getTime());
    expect(aFecha({ seconds: en.getTime() / 1000 })?.getTime()).toBe(en.getTime());
    expect(aFecha(en.toISOString())?.getTime()).toBe(en.getTime());
    expect(aFecha(null)).toBeNull();
  });
});
