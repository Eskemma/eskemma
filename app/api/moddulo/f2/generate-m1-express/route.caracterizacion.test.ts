// generate-m1-express: caracterización del flujo posterior a las fuentes (llamada al modelo, parseo,
// escritura). Escritas en el paso 1 contra la llamada única; en el paso 2 solo se adapta el mock del modelo
// (ahora una respuesta por mitad) — el comportamiento observable (200 con el mapa, valla ```json, 404,
// sin escribir ante JSON roto) se conserva.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/ai/claude", () => ({ anthropic: { messages: { create: vi.fn() } }, CLAUDE_MODEL: "m" }));
vi.mock("@/lib/centinela/pestel/scraper/googleNewsRSS", () => ({
  fetchGoogleNewsRSS: vi.fn(async () => []),
  getNewsTopicsForProject: vi.fn(() => []),
}));
vi.mock("@/lib/centinela/pestel/scraper/dof", () => ({ fetchDOFRSS: vi.fn(async () => []) }));
vi.mock("@/lib/centinela/pestel/scraper/inegi", () => ({
  fetchInegiIndicators: vi.fn(async () => []),
  INEGI_DEFAULT_SERIES: [],
  BISE_POBLACION_SERIES: [],
}));
vi.mock("@/lib/centinela/pestel/scraper/banxico", () => ({ fetchBanxicoSeries: vi.fn(async () => []), BANXICO_DEFAULT_SERIES: [] }));
vi.mock("@/lib/sefix/sefixContext", () => ({ buildSefixContext: vi.fn(async () => null), resolveDistrictCabecera: vi.fn(async () => null) }));
vi.mock("@/lib/geo/estadoCve", () => ({ getCveEntidad: vi.fn(() => null) }));
vi.mock("@/lib/centinela/pestel/cache/indicatorCache", () => ({
  fetchWithCache: vi.fn(async () => []),
  CACHE_TTL: { TTL_24H: 1, TTL_7D: 7 },
}));
vi.mock("@/lib/search/webContextFetcher", () => ({
  fetchWebEconomicContext: vi.fn(async () => undefined),
  fetchWebLegalContext: vi.fn(async () => undefined),
}));
vi.mock("@/lib/fontana/tabla/insumosPestel", () => ({ resolverInsumosFontanaPestel: vi.fn(async () => []) }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { anthropic } from "@/lib/ai/claude";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { respuestaValida, respuestaModelo, responderPorMitad, mapaMitad, type Mitad } from "@/lib/moddulo/__tests__/fixtures/modeloPorMitad";

type Db = { reset(): void; updates(): Array<{ path: string; data: Record<string, unknown> }>; failUpdateOn(p: string): void; seed?: unknown };
const db = adminDb as unknown as Db;


const llamar = async () => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "ciudadano", xpcto: { hito: "h" }, territorio: { nivel: "estatal", nombre: "Yucatán", estado: "Yucatán" }, phases: {} } as never);
});

describe("generate-m1-express — caracterización", () => {
  it("respuesta válida → 200 con el mapa y escribe el linkedSource express", async () => {
    responderPorMitad(vi.mocked(anthropic.messages.create), (m) => respuestaValida(m));
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(Object.keys(r.cuerpo.mapaPESTEL)).toEqual(["P", "E", "S", "T", "Ec", "L"]);
    const w = db.updates().find((u) => u.path === "moddulo_projects/p1");
    expect((w?.data["phases.exploracion.linkedSource"] as { kind: string }).kind).toBe("express");
  });

  // EDITADA a propósito (paso 3 de 3b): antes escribía SOLO el vínculo, las fuentes y los dos snapshots
  // (no descartaba nada); ahora deja un M1 nuevo en borrador y descarta lo hecho contra el anterior.
  it("escribe el vínculo, las fuentes, los dos snapshots y un M1 nuevo en borrador; descarta el borrador de motores y las aprobaciones; no toca dvs", async () => {
    responderPorMitad(vi.mocked(anthropic.messages.create), (m) => respuestaValida(m));
    await llamar();
    const d = db.updates().find((u) => u.path === "moddulo_projects/p1")!.data;
    expect(Object.keys(d).sort()).toEqual([
      "phases.exploracion.draftDVS",
      "phases.exploracion.fuentesConsultadas",
      "phases.exploracion.linkedSource",
      "phases.exploracion.m1",
      "phases.exploracion.motorAprobaciones",
      "phases.exploracion.territorioSnapshotAtGeneration",
      "phases.exploracion.xpctoSnapshotAtGeneration",
      "updatedAt",
    ]);
    expect(d["phases.exploracion.m1"]).toEqual({ creadoEn: "TS" });
    expect(d["phases.exploracion.draftDVS"]).toBe("__DELETE__");
    expect(d["phases.exploracion.motorAprobaciones"]).toEqual({});
    expect(d).not.toHaveProperty("phases.exploracion.dvs");
  });

  it("acepta el JSON dentro de una valla ```json", async () => {
    responderPorMitad(vi.mocked(anthropic.messages.create), (m) => respuestaModelo("```json\n" + JSON.stringify(mapaMitad(m as Mitad)) + "\n```"));
    expect((await llamar()).status).toBe(200);
  });

  it("JSON roto → 500 con `raw` de hasta 500 caracteres, sin escribir", async () => {
    responderPorMitad(vi.mocked(anthropic.messages.create), () => respuestaModelo('{"P": {"code": "P", "narra' + "x".repeat(700)));
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("respuesta_invalida");
    expect(r.cuerpo.raw.length).toBe(500);
    expect(db.updates()).toEqual([]);
  });

  it("falta una categoría → ya no se guarda un M1 incompleto: 500 respuesta_invalida de esa mitad (cambio del paso 2)", async () => {
    responderPorMitad(vi.mocked(anthropic.messages.create), (m) => {
      const { Ec: _ec, ...sinEc } = mapaMitad(m) as Record<string, unknown>;
      void _ec;
      return respuestaModelo(JSON.stringify(m === "TEcL" ? sinEc : mapaMitad(m)));
    });
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("respuesta_invalida");
    expect(r.cuerpo.dimensiones).toBe("T, Ec y L");
    expect(db.updates()).toEqual([]);
  });

  it("proyecto inexistente → 404 sin llamar al modelo", async () => {
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await llamar()).status).toBe(404);
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });
});
