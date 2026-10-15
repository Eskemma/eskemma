// CARACTERIZACIÓN (M1, commit 1): criterios 1 (cobertura), 8 (pesos por tipo) y 9 (trazabilidad) de
// evaluarCriteriosDVS. Hoy se evalúan sobre el mapa que se les pasa (linkedSource.payload); el commit
// de trazabilidad hará que quien llama pase la copia aprobada. Estas pruebas fijan que la FUNCIÓN no cambia.

import { describe, expect, it } from "vitest";
import type { DVSF2, MapaPESTEL } from "@/types/moddulo.types";
import { evaluarCriteriosDVS } from "./dvs-criteria";

const dvs = { hei: { tensionCentral: "", premisaEstrategica: "", condicionesFavorables: [], condicionesAdversas: [] }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] } as unknown as DVSF2;
const sen = (over: Record<string, unknown> = {}) => ({ descripcion: "d", fuente: "INEGI", fechaCorte: "2020", nivelConfianza: "medio", origenInternacional: false, ...over });
const dim = (code: string, over: Record<string, unknown> = {}) => ({
  code, label: code, clasificacion: "AMENAZA", senalesFavorables: [sen()], senalesAdversas: [], senalesInciertas: [], ...over,
});
const mapaCompleto = (): MapaPESTEL => ({ P: dim("P"), E: dim("E"), S: dim("S"), T: dim("T"), Ec: dim("Ec"), L: dim("L") }) as MapaPESTEL;
const crit = (mapa: MapaPESTEL | undefined, id: string, tipo?: "electoral") =>
  evaluarCriteriosDVS(dvs, mapa, tipo).find((c) => c.id === id)!;

describe("criterios 1, 8 y 9 — comportamiento actual", () => {
  it("1. cobertura: satisfecho con las 6 dimensiones y ≥1 señal cada una; falla si falta una dimensión o una está sin señales", () => {
    expect(crit(mapaCompleto(), "cobertura-pestl")).toMatchObject({ satisfecho: true, severidad: "bloqueante" });
    const sinL = mapaCompleto(); delete sinL.L;
    expect(crit(sinL, "cobertura-pestl").satisfecho).toBe(false);
    const vacia = mapaCompleto(); vacia.S = dim("S", { senalesFavorables: [] }) as never;
    expect(crit(vacia, "cobertura-pestl").satisfecho).toBe(false);
  });

  it("2. cobertura cuenta SEÑALES, no narrativa: editar o vaciar la narrativa no cambia el criterio", () => {
    const m = mapaCompleto(); m.P = dim("P", { narrativa: "" }) as never;
    expect(crit(m, "cobertura-pestl").satisfecho).toBe(true);
  });

  it("3. pesos por tipo (electoral: P, S, L prioritarias): exige OPORTUNIDAD o AMENAZA en ellas; NEUTRAL las incumple; una de seguimiento escalada se suma a las prioritarias", () => {
    expect(crit(mapaCompleto(), "pesos-tipo-proyecto", "electoral")).toMatchObject({ satisfecho: true, severidad: "advertencia" });
    const neutral = mapaCompleto(); neutral.S = dim("S", { clasificacion: "NEUTRAL" }) as never;
    expect(crit(neutral, "pesos-tipo-proyecto", "electoral").satisfecho).toBe(false);
    const escalada = mapaCompleto(); escalada.E = dim("E", { clasificacion: "NEUTRAL", escaladaPorRelevanciaLocal: true }) as never;
    expect(crit(escalada, "pesos-tipo-proyecto", "electoral").satisfecho).toBe(false);
  });

  it("4. trazabilidad: cada señal debe tener fuente y fecha de corte no vacías; la aprobación del usuario (10) es siempre false al evaluar", () => {
    expect(crit(mapaCompleto(), "trazabilidad-hallazgos")).toMatchObject({ satisfecho: true, severidad: "advertencia" });
    const sinFecha = mapaCompleto(); sinFecha.T = dim("T", { senalesFavorables: [sen({ fechaCorte: "  " })] }) as never;
    expect(crit(sinFecha, "trazabilidad-hallazgos").satisfecho).toBe(false);
    expect(crit(mapaCompleto(), "aprobacion-usuario")).toMatchObject({ satisfecho: false, severidad: "bloqueante" });
  });
});
