// Paso 7, commit 2: los criterios 1, 8 y 9 leen la copia aprobada cuando la aprobación es válida; las recomendaciones
// de esos tres criterios nombran la acción que existe según el origen del análisis.
import { describe, expect, it } from "vitest";
import type { MapaPESTEL, RDAItem } from "@/types/moddulo.types";
import { elegirMapaParaCriterios } from "./m1Aprobacion";
import { mapaParaCriterios, proyectoConMapaParaCriterios } from "./m1Servidor";
import { huellaMapaPESTEL } from "./m1Huella";
import { planRDAUpdate, getDisplayTextForRDAItem } from "./rda";
import { criterioDVSToRDAItem, evaluarCriteriosDVS, getRecomendacionDVS, origenDeAnalisis } from "./dvs-criteria";

const sen = { descripcion: "d", fuente: "INEGI", fechaCorte: "2020", nivelConfianza: "medio", origenInternacional: false };
const dim = (code: string, o: Record<string, unknown> = {}) => ({ code, label: code, clasificacion: "AMENAZA", senalesFavorables: [sen], senalesAdversas: [], senalesInciertas: [], ...o });
const completo = () => ({ P: dim("P"), E: dim("E"), S: dim("S"), T: dim("T"), Ec: dim("Ec"), L: dim("L") }) as unknown as MapaPESTEL;
const sinL = () => { const m = completo(); delete (m as Record<string, unknown>).L; return m; };
const dvs = { hei: { tensionCentral: "t", contexto: "c", premisaEstrategica: "p", condicionesFavorables: [], condicionesAdversas: [] }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] };

describe("elegirMapaParaCriterios", () => {
  const payload = completo(), copia = sinL();
  it("aprobación válida → la copia", () => expect(elegirMapaParaCriterios({ aprobacionValida: true, aprobacion: { mapa: copia }, payload })).toBe(copia));
  it("aprobación no válida → el payload", () => expect(elegirMapaParaCriterios({ aprobacionValida: false, aprobacion: { mapa: copia }, payload })).toBe(payload));
  it("sin registro de aprobación → el payload", () => expect(elegirMapaParaCriterios({ aprobacionValida: false, payload })).toBe(payload));
  it("válida pero sin copia guardada → el payload", () => expect(elegirMapaParaCriterios({ aprobacionValida: true, aprobacion: null, payload })).toBe(payload));
  it("sin nada → undefined (los criterios usan su proxy)", () => expect(elegirMapaParaCriterios({ aprobacionValida: false })).toBeUndefined());
});

describe("mapaParaCriterios / proyectoConMapaParaCriterios (servidor)", () => {
  const payload = completo();
  const h = huellaMapaPESTEL(payload);
  const exp = (m1: object | undefined, copia = sinL()) => ({
    dvs: dvs as never, linkedSource: { kind: "express", payload },
    ...(m1 ? { m1: { aprobacion: { huella: h, por: "u", en: "t", categoriasEditadas: 0, total: 6, mapa: copia }, ...m1 } } : {}),
  }) as never;

  it("aprobación válida → la copia (aunque difiera del payload: lo que M2–M5 leyeron)", () => {
    const e = exp({});
    expect(mapaParaCriterios(e)).toBe((e as { m1: { aprobacion: { mapa: unknown } } }).m1.aprobacion.mapa);
  });
  it("huella que no coincide, reabierto o proyecto anterior → el payload", () => {
    const e = exp({}); (e as { m1: { aprobacion: { huella: string } } }).m1.aprobacion.huella = "otra";
    expect(mapaParaCriterios(e)).toBe(payload);
    expect(mapaParaCriterios(exp(undefined))).toBe(payload);
  });
  it("el proyecto se devuelve con la copia en la ranura del payload, sin mutar el original", () => {
    const proyecto = { type: "electoral", phases: { exploracion: exp({}) } };
    const antes = JSON.stringify(proyecto);
    const nuevo = proyectoConMapaParaCriterios(proyecto);
    expect(nuevo).not.toBe(proyecto);
    expect((nuevo.phases.exploracion as { linkedSource: { payload: unknown } }).linkedSource.payload).not.toBe(payload);
    expect(JSON.stringify(proyecto)).toBe(antes);
  });
  it("sin análisis se devuelve el mismo objeto", () => {
    const p = { phases: { exploracion: { dvs: dvs as never } } };
    expect(proyectoConMapaParaCriterios(p)).toBe(p);
  });

  it("el RDA de F2 sale de la copia: una copia sin la dimensión L crea el ítem de cobertura; sin el cambio no", () => {
    const proyecto = { type: "electoral", xpcto: {}, rda: {}, phases: { exploracion: exp({}) } } as never;
    const ids = (p: never) => planRDAUpdate(p).nuevos.filter((i) => i.faseOrigen === "exploracion").map((i) => i.criterioId);
    expect(ids(proyectoConMapaParaCriterios(proyecto))).toContain("cobertura-pestl");
    expect(ids(proyecto)).not.toContain("cobertura-pestl");
  });
});

describe("criterios 8 y 10 sin cambio", () => {
  it("una dimensión prioritaria en NEUTRAL sigue saliendo como advertencia; la aprobación del usuario sigue en false", () => {
    const m = completo(); m.S = dim("S", { clasificacion: "NEUTRAL" }) as never;
    const c = evaluarCriteriosDVS(dvs as never, m, "electoral");
    expect(c.find((x) => x.id === "pesos-tipo-proyecto")).toMatchObject({ satisfecho: false, severidad: "advertencia" });
    expect(c.find((x) => x.id === "aprobacion-usuario")).toMatchObject({ satisfecho: false, severidad: "bloqueante" });
  });
});

describe("recomendaciones de los criterios 1, 8 y 9 por origen", () => {
  const IDS = ["cobertura-pestl", "pesos-tipo-proyecto", "trazabilidad-hallazgos"];
  it("origen: todo kind distinto de T22 es Express", () => {
    expect(origenDeAnalisis("T22")).toBe("centinela");
    expect(origenDeAnalisis("express")).toBe("express");
    expect(origenDeAnalisis(undefined)).toBe("express");
  });
  it.each(IDS)("%s — Express nombra «Nuevo análisis» y no menciona Centinela", (id) => {
    const t = getRecomendacionDVS(id, "express")!;
    expect(t).toContain("«Nuevo análisis»");
    expect(t).not.toMatch(/Centinela/);
  });
  it.each(IDS)("%s — Centinela manda a generar uno nuevo allá y reimportar, sin «Nuevo análisis» ni «Editar narrativas»", (id) => {
    const t = getRecomendacionDVS(id, "centinela")!;
    expect(t).toMatch(/Centinela/);
    expect(t).toMatch(/vuelve a importarlo/);
    expect(t).not.toContain("«Nuevo análisis»");
    expect(t).not.toContain("Editar narrativas");
  });
  it.each(IDS)("%s — sin origen conocido el texto es válido para ambos", (id) => {
    const t = getRecomendacionDVS(id)!;
    expect(t).toMatch(/Express/); expect(t).toMatch(/Centinela/);
  });
  it.each(IDS)("%s — ninguna promete editar señales ni «relanzar»", (id) => {
    for (const o of ["express", "centinela", undefined] as const) {
      const t = getRecomendacionDVS(id, o)!;
      expect(t).not.toMatch(/relanza|elimínala|complétala/i);
    }
  });
  it("la advertencia del criterio 8 sigue diciendo que se puede aceptar si la categoría es Neutral a propósito", () => {
    for (const o of ["express", "centinela", undefined] as const) expect(getRecomendacionDVS("pesos-tipo-proyecto", o)).toMatch(/Neutral a propósito/);
  });
  it("los demás criterios conservan su texto", () => {
    expect(getRecomendacionDVS("aprobacion-usuario")).toMatch(/aprueba explícitamente cada uno de los motores M2 a M5/);
    expect(getRecomendacionDVS("hei-clara")).toMatch(/Revisa el motor M5/);
    expect(getRecomendacionDVS("no-existe")).toBeUndefined();
  });
  it("el ítem del RDA guarda el origen de los criterios 1, 8 y 9 y no el de los demás", () => {
    const crit = (id: string) => ({ id, descripcion: "x", satisfecho: false, severidad: "advertencia" as const });
    expect(criterioDVSToRDAItem(crit("cobertura-pestl"), "centinela")).toMatchObject({ origenAnalisis: "centinela", recomendacion: getRecomendacionDVS("cobertura-pestl", "centinela") });
    expect(criterioDVSToRDAItem(crit("hei-clara"), "centinela")).not.toHaveProperty("origenAnalisis");
    expect(criterioDVSToRDAItem(crit("cobertura-pestl"))).not.toHaveProperty("origenAnalisis");
  });
  it("el texto mostrado en el RDA sigue el origen del ítem; uno anterior sin origen usa el texto para ambos", () => {
    const item = (extra: object) => ({ id: "exploracion:pesos-tipo-proyecto", faseOrigen: "exploracion", origenMecanismo: "criterio_suficiencia", criterioId: "pesos-tipo-proyecto", nombre: "n", descripcion: "d", nivelImpacto: "advertencia", recomendacion: "viejo", estado: "activo", ...extra }) as unknown as RDAItem;
    expect(getDisplayTextForRDAItem(item({ origenAnalisis: "express" })).recomendacion).toBe(getRecomendacionDVS("pesos-tipo-proyecto", "express"));
    expect(getDisplayTextForRDAItem(item({})).recomendacion).toBe(getRecomendacionDVS("pesos-tipo-proyecto"));
  });
  it("planRDAUpdate marca el origen según el kind del análisis", () => {
    const p = (kind: string) => ({ type: "electoral", xpcto: {}, rda: {}, phases: { exploracion: { dvs: dvs as never, linkedSource: { kind, payload: sinL() } } } }) as never;
    const item = (kind: string) => planRDAUpdate(p(kind)).nuevos.find((i) => i.criterioId === "cobertura-pestl")!;
    expect(item("T22").origenAnalisis).toBe("centinela");
    expect(item("express").origenAnalisis).toBe("express");
  });
});
