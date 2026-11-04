import { describe, expect, it } from "vitest";
import { resolverVinculoPestel as r } from "./resolverVinculoPestel";

describe("resolverVinculoPestel", () => {
  it("vinculado: T22 con sourceId y sourceAnalysisId (Olmos 2, Anaya)", () => {
    expect(r({ linkedSource: { kind: "T22", sourceId: "FTlPqj", sourceAnalysisId: "an" }, backlinkId: "FTlPqj" })).toEqual({ estado: "vinculado", pestProjectId: "FTlPqj", pestPendienteId: null, formaAntigua: false });
  });
  it("pendiente, forma antigua: T22 sin sourceAnalysisId (Prueba 24)", () => {
    expect(r({ linkedSource: { kind: "T22", sourceId: "ZAkiRK" }, backlinkId: null })).toEqual({ estado: "pendiente", pestProjectId: null, pestPendienteId: "ZAkiRK", formaAntigua: true });
  });
  it("pendiente, forma nueva: back-link sin vínculo T22 (sin linkedSource o con un express)", () => {
    for (const ls of [undefined, null, { kind: "express", sourceId: "m1" }, { kind: "T22" }]) {
      expect(r({ linkedSource: ls, backlinkId: "p1" })).toEqual({ estado: "pendiente", pestProjectId: null, pestPendienteId: "p1", formaAntigua: false });
    }
  });
  it("el vínculo T22 manda sobre el back-link (no se mezclan)", () => {
    expect(r({ linkedSource: { kind: "T22", sourceId: "pA" }, backlinkId: "pB" }).pestPendienteId).toBe("pA");
    expect(r({ linkedSource: { kind: "T22", sourceId: "pA", sourceAnalysisId: "x" }, backlinkId: "pB" }).estado).toBe("vinculado");
  });
  it("sin PESTEL: ninguno, express sin back-link, sin datos", () => {
    for (const ls of [undefined, null, { kind: "express", sourceId: "m1" }]) {
      expect(r({ linkedSource: ls, backlinkId: null })).toEqual({ estado: "sin_pestel", pestProjectId: null, pestPendienteId: null, formaAntigua: false });
      expect(r({ linkedSource: ls, backlinkId: undefined }).estado).toBe("sin_pestel");
    }
  });
});
