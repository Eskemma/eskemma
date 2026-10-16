// generate-m1-express: códigos de error propios (`codigo`) y registro de diagnóstico.

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

const MAPA_VALIDO = Object.fromEntries(
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


const espiar = () => ({
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  err: vi.spyOn(console, "error").mockImplementation(() => {}),
});
const todo = (s: ReturnType<typeof espiar>) =>
  [...s.log.mock.calls, ...s.warn.mock.calls, ...s.err.mock.calls].map((c) => c.map(String).join(" ")).join("\n");

describe("generate-m1-express — códigos de error propios", () => {
  it("stop_reason max_tokens + JSON cortado → 500 codigo respuesta_truncada, sin escribir", async () => {
    espiar();
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo('{"P":{"code":"P","narra', "max_tokens") as never);
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("respuesta_truncada");
    expect(db.updates()).toEqual([]);
  });

  it("JSON inválido con otro stop_reason → 500 codigo respuesta_invalida", async () => {
    espiar();
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo("Aquí está tu análisis: no es JSON") as never);
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("respuesta_invalida");
    expect(db.updates()).toEqual([]);
  });

  it("excepción del SDK → 500 codigo fallo_modelo y console.error con nombre y status, sin el mensaje", async () => {
    const s = espiar();
    const e = Object.assign(new Error("secreto: clave sk-XYZ"), { name: "APIError", status: 529 });
    vi.mocked(anthropic.messages.create).mockRejectedValue(e);
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("fallo_modelo");
    expect(s.err).toHaveBeenCalled();
    const texto = todo(s);
    expect(texto).toContain("APIError");
    expect(texto).toContain("529");
    expect(texto).not.toContain("sk-XYZ");
    expect(db.updates()).toEqual([]);
  });

  it("falla el update de Firestore → 500 codigo fallo_guardado y console.error", async () => {
    const s = espiar();
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo(JSON.stringify(MAPA_VALIDO)) as never);
    db.failUpdateOn("moddulo_projects/p1");
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("fallo_guardado");
    expect(s.err).toHaveBeenCalled();
  });

  it("el éxito no trae `codigo`", async () => {
    espiar();
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo(JSON.stringify(MAPA_VALIDO)) as never);
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.codigo).toBeUndefined();
  });
});

describe("generate-m1-express — registro de diagnóstico", () => {
  it("tras la llamada registra stop_reason, tokens de entrada y salida, duración y tamaño del prompt", async () => {
    const s = espiar();
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo(JSON.stringify(MAPA_VALIDO), "end_turn") as never);
    await llamar();
    const t = todo(s);
    expect(t).toMatch(/\[generate-m1-express\] prompt: system=\d+ user=\d+ caracteres/);
    expect(t).toMatch(/stop_reason=end_turn input_tokens=1200 output_tokens=3400 duracion_ms=\d+/);
  });

  it("en la rama de parseo registra stop_reason, longitud, primeros 200 y últimos 100 caracteres", async () => {
    const s = espiar();
    const texto = "A".repeat(250) + "M".repeat(300) + "Z".repeat(100);
    vi.mocked(anthropic.messages.create).mockResolvedValue(respuestaModelo(texto, "max_tokens") as never);
    await llamar();
    const t = todo(s);
    expect(t).toContain("parseo fallido stop_reason=max_tokens longitud=650");
    expect(t).toContain("A".repeat(200));
    expect(t).not.toContain("A".repeat(201));
    expect(t).toContain("Z".repeat(100));
    expect(t).not.toContain("Z".repeat(101));
  });
});
