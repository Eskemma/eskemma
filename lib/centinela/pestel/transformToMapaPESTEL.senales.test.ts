// T3 (N7): las señales del análisis que no traen fuente, fecha, nivel de confianza u origen internacional ya NO se
// rellenan con «», «» y «medio»: el campo queda AUSENTE (nunca undefined/null). El criterio 9 de suficiencia tolera
// la ausencia (cuenta como «sin trazabilidad», igual que el «» de antes) y no lanza.
import { describe, expect, it } from "vitest";
import { transformToMapaPESTEL } from "./transformToMapaPESTEL";
import { evaluarCriteriosDVS } from "@/lib/moddulo/dvs-criteria";
import { formatPestelAnalysis } from "@/lib/moddulo/reportFormatters";
import type { DVSF2, MapaPESTEL } from "@/types/moddulo.types";

const completa = { descripcion: "d", fuente: "INEGI, 2020", fechaCorte: "2020-01", nivelConfianza: "alto" as const, origenInternacional: true };
const dvs = { hei: { tensionCentral: "", premisaEstrategica: "", condicionesFavorables: [], condicionesAdversas: [] }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] } as unknown as DVSF2;
const mapaCon = (senal: Record<string, unknown>) =>
  ({ P: { code: "P", label: "P", clasificacion: "AMENAZA", senalesFavorables: [senal], senalesAdversas: [], senalesInciertas: [] } }) as unknown as MapaPESTEL;
const crit9 = (m: MapaPESTEL) => evaluarCriteriosDVS(dvs, m, undefined).find((c) => c.id === "trazabilidad-hallazgos")!;

describe("transformToMapaPESTEL — señales incompletas (N7)", () => {
  it("una señal completa pasa tal cual", () => {
    expect(transformToMapaPESTEL([{ code: "P", senalesFavorables: [completa] }]).P?.senalesFavorables).toEqual([completa]);
  });
  it("una señal solo con descripción NO fabrica «», «» ni «medio»: las claves quedan ausentes", () => {
    const s = transformToMapaPESTEL([{ code: "P", senalesAdversas: [{ descripcion: "solo texto" }] }]).P!.senalesAdversas[0];
    expect(s).toEqual({ descripcion: "solo texto" });
    for (const k of ["fuente", "fechaCorte", "nivelConfianza", "origenInternacional"]) expect(Object.prototype.hasOwnProperty.call(s, k)).toBe(false);
  });
  it("un valor presente se conserva aunque sea falsy (origenInternacional:false, fuente vacía)", () => {
    const s = transformToMapaPESTEL([{ code: "P", senalesInciertas: [{ descripcion: "d", fuente: "", origenInternacional: false }] }]).P!.senalesInciertas[0];
    expect(s).toEqual({ descripcion: "d", fuente: "", origenInternacional: false });
  });
  it("sin descripción conserva el comportamiento de siempre (descripcion «»)", () => {
    expect(transformToMapaPESTEL([{ code: "P", senalesFavorables: [{}] }]).P!.senalesFavorables[0]).toEqual({ descripcion: "" });
  });
  it("el mapa serializado no contiene null (Firestore/JSON)", () => {
    const m = transformToMapaPESTEL([{ code: "P", senalesFavorables: [{ descripcion: "x" }], senalesAdversas: [completa] }]);
    expect(JSON.stringify(m)).not.toContain("null");
  });
});

describe("consumidores de señales sin trazabilidad (N7)", () => {
  it("criterio 9: ausentes → no satisfecho y NO lanza; completas → satisfecho", () => {
    expect(crit9(mapaCon({ descripcion: "d" })).satisfecho).toBe(false);
    expect(crit9(mapaCon({ descripcion: "d", fuente: "INEGI" })).satisfecho).toBe(false);
    expect(crit9(mapaCon({ descripcion: "d", fuente: "INEGI", fechaCorte: "2020" })).satisfecho).toBe(true);
  });
  it("la descarga del PESTEL tolera señales sin fuente ni fecha", () => {
    const txt = formatPestelAnalysis(mapaCon({ descripcion: "Texto de la señal" }));
    expect(txt).toContain("Texto de la señal");
  });
});
