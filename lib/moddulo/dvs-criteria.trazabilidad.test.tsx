// T7 C4 — criterio 9 (trazabilidad): «sin fecha» y vacío son ausentes, el nivel NO entra, informa con conteos, y el ítem del RDA
// no cambia de id ni se reescribe.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DVSF2, MapaPESTEL } from "@/types/moddulo.types";
import { criterioDVSToRDAItem, evaluarCriteriosDVS, getRecomendacionDVS } from "./dvs-criteria";
import { getDisplayTextForRDAItem, planRDAUpdate } from "./rda";
import PhaseTransitionReview from "@/app/moddulo/components/PhaseTransitionReview";

const dvs = { hei: { tensionCentral: "t", contexto: "c", premisaEstrategica: "p", condicionesFavorables: ["a"], condicionesAdversas: ["b"] }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] } as unknown as DVSF2;
const sen = (o: Record<string, unknown> = {}) => ({ descripcion: "d", fuente: "INEGI", fechaCorte: "2020", nivelConfianza: "medio", origenInternacional: false, ...o });
const dim = (code: string, senales: unknown[]) => ({ code, label: code, clasificacion: "AMENAZA", senalesFavorables: senales, senalesAdversas: [], senalesInciertas: [] });
const mapa = (porDim: Partial<Record<string, unknown[]>> = {}) =>
  Object.fromEntries(["P", "E", "S", "T", "Ec", "L"].map((c) => [c, dim(c, porDim[c] ?? [sen()])])) as unknown as MapaPESTEL;
const c9 = (m?: MapaPESTEL) => evaluarCriteriosDVS(dvs, m, undefined).find((c) => c.id === "trazabilidad-hallazgos")!;

describe("criterio 9 — qué cuenta como trazabilidad", () => {
  it("completo → satisfecho y sin detalle", () => {
    const c = c9(mapa());
    expect(c.satisfecho).toBe(true);
    expect(c.detalle).toBeUndefined();
    expect(c.severidad).toBe("advertencia");
  });
  it("«sin fecha» (y su variante en mayúsculas) YA NO cuenta como fecha", () => {
    expect(c9(mapa({ P: [sen({ fechaCorte: "sin fecha" })] })).satisfecho).toBe(false);
    expect(c9(mapa({ P: [sen({ fechaCorte: "SIN FECHA" })] })).satisfecho).toBe(false);
  });
  it("fuente vacía o fecha vacía siguen sin cumplir", () => {
    expect(c9(mapa({ P: [sen({ fuente: " " })] })).satisfecho).toBe(false);
    expect(c9(mapa({ P: [sen({ fechaCorte: "" })] })).satisfecho).toBe(false);
  });
  it("el NIVEL no entra al criterio: sin nivel o con un nivel raro, si hay fuente y fecha, cumple", () => {
    expect(c9(mapa({ P: [sen({ nivelConfianza: undefined })] })).satisfecho).toBe(true);
    expect(c9(mapa({ P: [sen({ nivelConfianza: "raro" })] })).satisfecho).toBe(true);
  });
  it("una descripción que ya no promete el nivel", () => {
    expect(c9(mapa()).descripcion).toBe("Trazabilidad de hallazgos — ¿Cada señal indica su fuente y su fecha de corte?");
  });
});

describe("criterio 9 — el detalle dice el motivo real con conteos", () => {
  it("N de M señales, sin fuente y sin fecha por separado; una señal sin ambas cuenta una vez en «incompletas»", () => {
    const m = mapa({
      P: [sen(), sen({ fuente: "" }), sen({ fechaCorte: "sin fecha" }), sen({ fuente: "", fechaCorte: "" })],
      E: [sen(), sen()],
    });
    // total = 4 (P) + 2 (E) + 4 (S, T, Ec, L con 1 cada una) = 10; incompletas 3; sin fuente 2; sin fecha 2
    const c = c9(m);
    expect(c.satisfecho).toBe(false);
    expect(c.detalle).toBe("3 de 10 señales sin fuente o sin fecha de corte (2 sin fuente, 2 sin fecha de corte).");
  });
  it("sin mapa (proxy por el contraste) no hay detalle", () => {
    expect(c9(undefined).detalle).toBeUndefined();
  });
});

describe("criterio 9 — el ítem del RDA", () => {
  const incompleto = mapa({ P: [sen({ fuente: "" })] });
  it("conserva el id `exploracion:trazabilidad-hallazgos` y NO guarda el detalle", () => {
    const item = criterioDVSToRDAItem(c9(incompleto), "centinela");
    expect(item.id).toBe("exploracion:trazabilidad-hallazgos");
    expect(JSON.stringify(item)).not.toContain("señales sin fuente");
    expect(item).not.toHaveProperty("detalle");
  });
  it("planRDAUpdate NO reescribe un ítem existente (solo crea los ausentes y resuelve los que ya cumplen)", () => {
    const viejo = { id: "exploracion:trazabilidad-hallazgos", faseOrigen: "exploracion", origenMecanismo: "criterio_suficiencia", criterioId: "trazabilidad-hallazgos",
      nombre: "trazabilidad-hallazgos", descripcion: "TEXTO VIEJO", recomendacion: "RECOMENDACIÓN VIEJA", nivelImpacto: "advertencia", estado: "activo" };
    const proyecto = { type: "electoral", xpcto: {}, phases: { exploracion: { dvs, linkedSource: { kind: "T22", payload: incompleto } } }, rda: { [viejo.id]: viejo } } as never;
    const plan = planRDAUpdate(proyecto);
    expect(plan.nuevos.find((i) => i.id === viejo.id)).toBeUndefined();
    expect(plan.resueltos).not.toContain(viejo.id);
  });
  it("lo que SÍ cambia es el texto MOSTRADO (se resuelve contra el diccionario vigente): descripción nueva y nota de Centinela", () => {
    const viejo = { id: "exploracion:trazabilidad-hallazgos", faseOrigen: "exploracion", origenMecanismo: "criterio_suficiencia", criterioId: "trazabilidad-hallazgos",
      nombre: "x", descripcion: "TEXTO VIEJO", recomendacion: "RECOMENDACIÓN VIEJA", nivelImpacto: "advertencia", estado: "activo", origenAnalisis: "centinela" } as never;
    const t = getDisplayTextForRDAItem(viejo);
    expect(t.descripcion).toBe("Trazabilidad de hallazgos — ¿Cada señal indica su fuente y su fecha de corte?");
    expect(t.recomendacion).toContain("«sin fecha»");
  });
});

describe("criterio 9 — recomendación", () => {
  it("Express no menciona «sin fecha» (ahí lo escribe el prompt de Express); Centinela y origen desconocido sí", () => {
    expect(getRecomendacionDVS("trazabilidad-hallazgos", "express")).not.toContain("sin fecha");
    expect(getRecomendacionDVS("trazabilidad-hallazgos", "centinela")).toContain("un análisis nuevo no siempre lo corrige");
    expect(getRecomendacionDVS("trazabilidad-hallazgos", undefined)).toContain("«sin fecha»");
  });
});

describe("checklist de cierre de F2 — muestra el detalle", () => {
  const render = (lista: ReturnType<typeof evaluarCriteriosDVS>) =>
    renderToStaticMarkup(<PhaseTransitionReview phaseId="exploracion" nextPhaseId="investigacion" xpcto={{}} risks={[]} onConfirm={() => {}} onCancel={() => {}} dvsChecklist={lista} />);
  it("un criterio no satisfecho con detalle lo pinta; uno satisfecho no", () => {
    const h = render([{ ...c9(mapa({ P: [sen({ fuente: "" })] })) }]);
    expect(h).toContain("1 de 6 señales sin fuente o sin fecha de corte (1 sin fuente, 0 sin fecha de corte).");
    expect(h).toContain("data-detalle-criterio");
    expect(render([c9(mapa())])).not.toContain("data-detalle-criterio");
  });
});
