// "Distrito hermano" — Frente A (26-09-27): resolverCorrespondenciaLocalFederal.
// Los datos de Yucatán y Jalisco son EXACTAMENTE los que produjo scripts/eceg-data-pipeline.ts en un
// dry-run real (buildCorrespondenciaLocalFederal), verificados contra la medición de la ronda antes de
// escribir este archivo — no son sintéticos.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sefix/ecegStorage", () => ({
  buildEcegStoragePath: (nivel: string, estadoId: string) => `sefix/eceg_2020/${nivel}/${estadoId}.json`,
  fetchEcegFromStorage: vi.fn(),
}));
// eceg.ts importa lib/geo/municipios.ts transitivamente (resolveMunicipioCve, etc. — sin uso en este
// adaptador), que a su vez inicializa firebase-admin al cargarse: se mockea para no exigir credenciales
// en la suite, mismo patrón que resolverReferenciaTerritorio.test.ts.
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

import { fetchEcegFromStorage } from "@/lib/sefix/ecegStorage";
import {
  resolverCorrespondenciaLocalFederal,
  UMBRAL_CORRESPONDENCIA_LOCAL_FEDERAL,
} from "./eceg";

// Recorte real del dry-run de Yucatán (31) — 21 distritos locales.
const YUCATAN = {
  anioCartografia: 2025,
  porDistritoLocal: {
    "012": { distritoFederalDominante: "005", pctDominante: 100 },
    "011": { distritoFederalDominante: "002", pctDominante: 86.7 },
    "020": { distritoFederalDominante: "005", pctDominante: 65 },
  },
};
// Recorte real del dry-run de Jalisco (14) — calculado con el MISMO método que cualquier otro estado,
// sin caso especial (el 100% es el dato real de la cartografía 2025, no un artefacto de esta prueba).
const JALISCO = {
  anioCartografia: 2025,
  porDistritoLocal: { "001": { distritoFederalDominante: "003", pctDominante: 100 } },
};

describe("resolverCorrespondenciaLocalFederal", () => {
  it("≥80%: sugiere el federal dominante con su % y el año de la cartografía", async () => {
    vi.mocked(fetchEcegFromStorage).mockResolvedValueOnce(YUCATAN as never);
    const r = await resolverCorrespondenciaLocalFederal("31", "012");
    expect(r).toEqual({ ok: true, distritoFederalCve: "005", pctDominante: 100, anioCartografia: 2025 });
  });

  it("<80%: NO sugiere, con el % real en el motivo honesto", async () => {
    vi.mocked(fetchEcegFromStorage).mockResolvedValueOnce(YUCATAN as never);
    const r = await resolverCorrespondenciaLocalFederal("31", "020");
    expect(r.ok).toBe(false);
    expect((r as { motivo: string }).motivo).toContain("65");
  });

  it("Jalisco: calculado igual que cualquier estado (sin caso especial) — 100% real de la cartografía 2025", async () => {
    vi.mocked(fetchEcegFromStorage).mockResolvedValueOnce(JALISCO as never);
    const r = await resolverCorrespondenciaLocalFederal("14", "001");
    expect(r).toEqual({ ok: true, distritoFederalCve: "003", pctDominante: 100, anioCartografia: 2025 });
  });

  it("distrito local sin datos de correspondencia: motivo honesto, no se inventa", async () => {
    vi.mocked(fetchEcegFromStorage).mockResolvedValueOnce(YUCATAN as never);
    const r = await resolverCorrespondenciaLocalFederal("31", "999");
    expect(r).toEqual({ ok: false, motivo: expect.stringContaining("No hay datos") });
  });

  it("error de red: motivo honesto, no revienta", async () => {
    vi.mocked(fetchEcegFromStorage).mockRejectedValueOnce(new Error("boom"));
    const r = await resolverCorrespondenciaLocalFederal("31", "012");
    expect(r).toEqual({ ok: false, motivo: expect.stringContaining("conexión") });
  });

  it("el umbral exportado es 80 (decisión de Raúl, medido)", () => {
    expect(UMBRAL_CORRESPONDENCIA_LOCAL_FEDERAL).toBe(80);
  });
});
