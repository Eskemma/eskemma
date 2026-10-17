// F2 cerrada = solo lectura: generate-m1-express responde 409 fase_cerrada ANTES de leer fuentes, llamar al
// modelo o escribir (se cuentan las llamadas con mocks).

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
import { fetchGoogleNewsRSS } from "@/lib/centinela/pestel/scraper/googleNewsRSS";
import { fetchWithCache } from "@/lib/centinela/pestel/cache/indicatorCache";
import { resolverInsumosFontanaPestel } from "@/lib/fontana/tabla/insumosPestel";
import { buildSefixContext } from "@/lib/sefix/sefixContext";

type Db = { reset(): void; updates(): Array<{ path: string; data: Record<string, unknown> }> };
const db = adminDb as unknown as Db;
const llamar = async () => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const proyecto = (exploracion: Record<string, unknown>) => ({
  id: "p1", type: "ciudadano", xpcto: { hito: "h" }, territorio: { nivel: "estatal", nombre: "Yucatán", estado: "Yucatán" }, phases: { exploracion },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("generate-m1-express — F2 cerrada", () => {
  it("409 fase_cerrada sin llamar al modelo ni a ninguna fuente y sin escribir", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ status: "completed", dvs: { x: 1 } }) as never);
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo).toEqual({ error: "fase_cerrada" });
    expect(anthropic.messages.create).not.toHaveBeenCalled();
    expect(fetchGoogleNewsRSS).not.toHaveBeenCalled();
    expect(fetchWithCache).not.toHaveBeenCalled();
    expect(resolverInsumosFontanaPestel).not.toHaveBeenCalled();
    expect(buildSefixContext).not.toHaveBeenCalled();
    expect(db.updates()).toHaveLength(0);
  });
  it("gana sobre pestel_linked (el estado de la fase se decide primero)", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ status: "completed", linkedSource: { sourceAnalysisId: "a1" } }) as never);
    expect((await llamar()).cuerpo).toEqual({ error: "fase_cerrada" });
  });
  it("orden coherente con las rutas m1-*: 401 y 404 van antes", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await llamar()).status).toBe(401);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await llamar()).status).toBe(404);
  });
  it("con la fase abierta (in-progress) NO responde fase_cerrada: llega al modelo", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ status: "in-progress" }) as never);
    vi.mocked(anthropic.messages.create).mockRejectedValue(new Error("x"));
    const r = await llamar();
    expect(r.cuerpo.error).not.toBe("fase_cerrada");
    expect(anthropic.messages.create).toHaveBeenCalled();
  });
});
