// Regresión del fix de denominadores (26-10-01, F1-3/F1-13/F1-19): verifica
// que FONTANA_ECEG_CONFIG y el espejo ECEG_DENOMINATORS de Sefix usan la base
// poblacional correcta (confirmada contra el diccionario de datos ITER 2020,
// ver CLAUDE.md "Deuda Técnica") en vez de los proxies previos (POBTOT,
// P_18YMAS). Mide con datos reales de 3 territorios en la ronda misma
// (Yucatán estatal, D.F. 3102, Iztapalapa) antes de aplicar — este archivo
// solo fija la configuración, no vuelve a calcular las bodegas.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sefix/ecegStorage", () => ({
  buildEcegStoragePath: (nivel: string, estadoId: string) => `sefix/eceg_2020/${nivel}/${estadoId}.json`,
  fetchEcegFromStorage: vi.fn(),
}));
vi.mock("@/lib/geo/municipios", () => ({
  getMunicipiosOptions: vi.fn(),
  getMunicipiosOptionsNacional: vi.fn(),
  resolveMunicipioCve: vi.fn(),
}));
vi.mock("@/lib/geo/distritos", () => ({
  getDistritosFederalesOptions: vi.fn(),
  getDistritosLocalesOptions: vi.fn(),
  getDistritosFederalesOptionsNacional: vi.fn(),
  getDistritosLocalesOptionsNacional: vi.fn(),
}));

import { FONTANA_ECEG_CONFIG } from "./eceg";
import { ECEG_DENOMINATORS } from "@/lib/sefix/ecegConstants";

describe("denominadores de F1-3/F1-13/F1-19 (Fontana)", () => {
  it("F1-3 (P3YM_HLI) usa P_3YMAS, no POBTOT", () => {
    expect(FONTANA_ECEG_CONFIG["F1-3"]).toEqual({
      key: "P3YM_HLI",
      tipo: "porcentaje",
      denominadorKey: "P_3YMAS",
    });
  });

  it("F1-19 (P3HLINHE) usa P_3YMAS, no POBTOT", () => {
    expect(FONTANA_ECEG_CONFIG["F1-19"]).toEqual({
      key: "P3HLINHE",
      tipo: "porcentaje",
      denominadorKey: "P_3YMAS",
    });
  });

  it("F1-13 (P15YM_SE) usa P_15YMAS, no P_18YMAS (ya no es un proxy)", () => {
    expect(FONTANA_ECEG_CONFIG["F1-13"]).toEqual({
      key: "P15YM_SE",
      tipo: "porcentaje",
      denominadorKey: "P_15YMAS",
    });
  });

  it("F1-14 (P18YM_PB) no se toca — P_18YMAS ya era la base correcta", () => {
    expect(FONTANA_ECEG_CONFIG["F1-14"]).toEqual({
      key: "P18YM_PB",
      tipo: "porcentaje",
      denominadorKey: "P_18YMAS",
    });
  });
});

describe("espejo ECEG_DENOMINATORS (Sefix) — coordinado con Fontana", () => {
  it("P3YM_HLI y P3HLINHE usan P_3YMAS", () => {
    expect(ECEG_DENOMINATORS.P3YM_HLI).toBe("P_3YMAS");
    expect(ECEG_DENOMINATORS.P3HLINHE).toBe("P_3YMAS");
  });

  it("P15YM_SE usa P_15YMAS", () => {
    expect(ECEG_DENOMINATORS.P15YM_SE).toBe("P_15YMAS");
  });

  it("P15YM_AN y P18YM_PB NO se tocan en este fix (fuera del alcance aprobado)", () => {
    expect(ECEG_DENOMINATORS.P15YM_AN).toBe("P_18YMAS");
    expect(ECEG_DENOMINATORS.P18YM_PB).toBe("P_18YMAS");
  });

  it("Fontana y Sefix coinciden en los 3 denominadores corregidos (sin divergencia entre apps)", () => {
    expect(FONTANA_ECEG_CONFIG["F1-3"].denominadorKey).toBe(ECEG_DENOMINATORS.P3YM_HLI);
    expect(FONTANA_ECEG_CONFIG["F1-19"].denominadorKey).toBe(ECEG_DENOMINATORS.P3HLINHE);
    expect(FONTANA_ECEG_CONFIG["F1-13"].denominadorKey).toBe(ECEG_DENOMINATORS.P15YM_SE);
  });
});
