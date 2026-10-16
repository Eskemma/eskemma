// generate-m1-express: caracterización del flujo posterior a las fuentes (llamada al modelo, parseo,
// escritura). Estas pruebas describen el comportamiento de ANTES del registro de diagnóstico y los
// códigos de error propios: deben pasar contra el código anterior sin editarse.

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

type Db = { reset(): void; updates(): Array<{ path: string; data: Record<string, unknown> }>; failUpdateOn(p: string): void; seed?: unknown };
const db = adminDb as unknown as Db;

export const MAPA_VALIDO = Object.fromEntries(
  ["P", "E", "S", "T", "Ec", "L"].map((k) => [k, { code: k, label: k, clasificacion: "NEUTRAL", narrativa: "x", confidence: 65, senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] }])
);
const respuestaModelo = (text: string, stop_reason = "end_turn") => ({
  content: [{ type: "text", text }],
  stop_reason,
  usage: { input_tokens: 1200, output_tokens: 3400 },
});

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
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo(JSON.stringify(MAPA_VALIDO)) as never);
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(Object.keys(r.cuerpo.mapaPESTEL)).toEqual(["P", "E", "S", "T", "Ec", "L"]);
    const w = db.updates().find((u) => u.path === "moddulo_projects/p1");
    expect((w?.data["phases.exploracion.linkedSource"] as { kind: string }).kind).toBe("express");
  });

  it("acepta el JSON dentro de una valla ```json", async () => {
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo("```json\n" + JSON.stringify(MAPA_VALIDO) + "\n```") as never);
    expect((await llamar()).status).toBe(200);
  });

  it("JSON roto → 500 «Error al parsear respuesta de Claude» con 500 caracteres de raw, sin escribir", async () => {
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo('{"P": {"code": "P", "narra' + "x".repeat(700)) as never);
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.error).toBe("Error al parsear respuesta de Claude");
    expect(r.cuerpo.raw.length).toBe(500);
    expect(db.updates()).toEqual([]);
  });

  it("faltan categorías → no aborta: 200 igualmente", async () => {
    const { Ec: _ec, ...sinEc } = MAPA_VALIDO as Record<string, unknown>;
    void _ec;
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo(JSON.stringify(sinEc)) as never);
    expect((await llamar()).status).toBe(200);
  });

  it("proyecto inexistente → 404 sin llamar al modelo", async () => {
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await llamar()).status).toBe(404);
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });
});
