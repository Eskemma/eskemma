import { describe, expect, it } from "vitest";
import { clasificarAsimetrias } from "./asimetriasVinculo";

const c = (linkedSource: Parameters<typeof clasificarAsimetrias>[0]["linkedSource"], backlinks: string[]) => clasificarAsimetrias({ modduloId: "m1", linkedSource, backlinks });

describe("clasificarAsimetrias", () => {
  it("lo normal NO es asimetría: pendiente por back-link (sin linkedSource o express), vinculado coincidente, forma antigua coincidente, nada", () => {
    expect(c(undefined, ["p1"])).toEqual([]);
    expect(c({ kind: "express", sourceId: "m1" }, ["p1"])).toEqual([]);
    expect(c({ kind: "T22", sourceId: "p1", sourceAnalysisId: "a1" }, ["p1"])).toEqual([]);
    expect(c({ kind: "T22", sourceId: "p1" }, ["p1"])).toEqual([]);
    expect(c(undefined, [])).toEqual([]);
  });
  it("varios pendientes", () => {
    expect(c(undefined, ["p1", "p2"])).toEqual([{ tipo: "varios_pendientes", modduloId: "m1", pestelIds: ["p1", "p2"] }]);
  });
  it("T22 con análisis y sin back-link", () => {
    expect(c({ kind: "T22", sourceId: "p1", sourceAnalysisId: "a1" }, [])).toEqual([{ tipo: "t22_sin_backlink", modduloId: "m1", pestelIds: ["p1"] }]);
  });
  it("T22 con análisis y un back-link de OTRO PESTEL", () => {
    expect(c({ kind: "T22", sourceId: "p1", sourceAnalysisId: "a1" }, ["p2"])[0].tipo).toBe("backlink_con_t22_de_otro");
  });
  it("forma antigua (T22 sin análisis) con un back-link distinto", () => {
    expect(c({ kind: "T22", sourceId: "p1" }, ["p2"])[0].tipo).toBe("pendiente_antiguo_distinto");
  });
  it("solo ids y tipo: ninguna asimetría lleva contenido", () => {
    for (const a of c({ kind: "T22", sourceId: "p1", sourceAnalysisId: "a1", payload: { secreto: 1 } } as never, ["p2", "p3"])) {
      expect(Object.keys(a).sort()).toEqual(["modduloId", "pestelIds", "tipo"]);
    }
  });
});
