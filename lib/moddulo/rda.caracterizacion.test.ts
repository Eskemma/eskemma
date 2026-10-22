// CARACTERIZACIÓN (paso 7, commit 2): comportamiento de planRDAUpdate (y por tanto de computeRDAItemsParaFase) para
// CADA fase con evaluador, antes de que la fase de exploración lea la copia aprobada del M1 en vez del payload.
import { describe, expect, it } from "vitest";
import { planRDAUpdate } from "./rda";

const sen = (o: Record<string, unknown> = {}) => ({ descripcion: "d", fuente: "INEGI", fechaCorte: "2020", nivelConfianza: "medio", origenInternacional: false, ...o });
const dim = (code: string, o: Record<string, unknown> = {}) => ({ code, label: code, clasificacion: "AMENAZA", senalesFavorables: [sen()], senalesAdversas: [], senalesInciertas: [], ...o });
const mapa = (over: Record<string, unknown> = {}) => ({ P: dim("P"), E: dim("E"), S: dim("S"), T: dim("T"), Ec: dim("Ec"), L: dim("L"), ...over });
const dvsMin = (over: Record<string, unknown> = {}) => ({
  hei: { tensionCentral: "t", contexto: "c", premisaEstrategica: "p", condicionesFavorables: ["a"], condicionesAdversas: ["b"] },
  contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [], ...over,
});
const proyecto = (o: Record<string, unknown>) => ({ type: "electoral", xpcto: {}, phases: {}, rda: {}, ...o }) as never;
const ids = (xs: { id: string }[]) => xs.map((i) => i.id).sort();

describe("planRDAUpdate — proposito", () => {
  it("con un XPCTO vacío y sin dictamen crea ítems de F1 para los criterios pendientes (el 10 incluido, la fase no está cerrada para el plan)", () => {
    const plan = planRDAUpdate(proyecto({}));
    expect(plan.nuevos.length).toBeGreaterThan(0);
    expect(plan.nuevos.every((i) => i.faseOrigen === "proposito" && i.id.startsWith("proposito:"))).toBe(true);
    expect(plan.resueltos).toEqual([]);
  });
  it("no vuelve a crear lo que ya existe y resuelve (sistema) un ítem activo que dejó de estar pendiente", () => {
    const primero = planRDAUpdate(proyecto({}));
    const rda = Object.fromEntries(primero.nuevos.map((i) => [i.id, { ...i, fechaCreacion: null }]));
    expect(planRDAUpdate(proyecto({ rda })).nuevos).toEqual([]);
    rda["proposito:inexistente"] = { id: "proposito:inexistente", faseOrigen: "proposito", estado: "activo" } as never;
    expect(planRDAUpdate(proyecto({ rda })).resueltos).toEqual(["proposito:inexistente"]);
  });
});

describe("planRDAUpdate — exploracion", () => {
  it("sin Reporte F2 (dvs) la fase no se evalúa: no crea ni resuelve nada de F2", () => {
    const rda = { "exploracion:cobertura-pestl": { id: "exploracion:cobertura-pestl", faseOrigen: "exploracion", estado: "activo" } } as never;
    const plan = planRDAUpdate(proyecto({ rda, phases: { exploracion: { linkedSource: { payload: mapa() } } } }));
    expect(plan.nuevos.filter((i) => i.faseOrigen === "exploracion")).toEqual([]);
    expect(plan.resueltos).not.toContain("exploracion:cobertura-pestl");
  });
  it("con Reporte F2 y un análisis completo: los criterios no satisfechos pasan a ítems (la aprobación del usuario siempre)", () => {
    const plan = planRDAUpdate(proyecto({ phases: { exploracion: { dvs: dvsMin(), linkedSource: { payload: mapa() } } } }));
    const f2 = ids(plan.nuevos.filter((i) => i.faseOrigen === "exploracion"));
    expect(f2).toContain("exploracion:aprobacion-usuario");
    expect(f2).not.toContain("exploracion:cobertura-pestl");
    expect(f2).not.toContain("exploracion:trazabilidad-hallazgos");
  });
  it("criterios 1, 8 y 9 se evalúan sobre el mapa del payload", () => {
    const sinL = mapa(); delete (sinL as Record<string, unknown>).L;
    const sinFecha = mapa({ P: dim("P", { senalesFavorables: [sen({ fechaCorte: "" })] }) });
    const neutral = mapa({ S: dim("S", { clasificacion: "NEUTRAL" }) });
    const f2 = (m: unknown) => ids(planRDAUpdate(proyecto({ phases: { exploracion: { dvs: dvsMin(), linkedSource: { payload: m } } } })).nuevos.filter((i) => i.faseOrigen === "exploracion"));
    expect(f2(sinL)).toContain("exploracion:cobertura-pestl");
    expect(f2(sinFecha)).toContain("exploracion:trazabilidad-hallazgos");
    expect(f2(neutral)).toContain("exploracion:pesos-tipo-proyecto");
  });
  it("sin payload usa el proxy del Reporte F2 (sin mapa)", () => {
    const plan = planRDAUpdate(proyecto({ phases: { exploracion: { dvs: dvsMin() } } }));
    expect(ids(plan.nuevos.filter((i) => i.faseOrigen === "exploracion"))).toContain("exploracion:cobertura-pestl");
  });
  it("un ítem activo de F2 que ya no está vigente se resuelve", () => {
    const rda = { "exploracion:cobertura-pestl": { id: "exploracion:cobertura-pestl", faseOrigen: "exploracion", estado: "activo" } } as never;
    const plan = planRDAUpdate(proyecto({ rda, phases: { exploracion: { dvs: dvsMin(), linkedSource: { payload: mapa() } } } }));
    expect(plan.resueltos).toContain("exploracion:cobertura-pestl");
  });
});

describe("planRDAUpdate — investigacion", () => {
  it("sin síntesis ni tablero no se evalúa", () => {
    const plan = planRDAUpdate(proyecto({ phases: { investigacion: {} } }));
    expect(plan.nuevos.filter((i) => i.faseOrigen === "investigacion")).toEqual([]);
  });
  it("vacíos residuales con destino RDA y asignaciones desactivadas generan ítems; el resto no", () => {
    const sintesis = { vaciosResiduales: [
      { pipItemId: "p1", numero: 1, pregunta: "¿q?", urgencia: "alta", destino: "RDA" },
      { pipItemId: "p2", numero: 2, pregunta: "¿r?", urgencia: "baja", destino: "SIP" },
    ] };
    const tareas = [{ numero: 1, asignaciones: [{ asignacionId: "a1", activada: false, canal: 1, label: "x" }, { asignacionId: "a2", activada: true }] }];
    const plan = planRDAUpdate(proyecto({ phases: { investigacion: { f3Sintesis: sintesis, f3TareasPIP: tareas } } }));
    const f3 = plan.nuevos.filter((i) => i.faseOrigen === "investigacion");
    expect(ids(f3).filter((i) => i.startsWith("investigacion:vacio-"))).toEqual(["investigacion:vacio-p1"]);
    expect(f3.length).toBe(2);
    expect(f3.find((i) => i.id === "investigacion:vacio-p1")?.nivelImpacto).toBe("prioritario");
  });
});
