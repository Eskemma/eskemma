// 4f: generate-m1-express — causa del fallo del modelo por mitad, orden de gravedad y sin mensaje del proveedor.

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
import { respuestaValida, respuestaModelo, responderPorMitad } from "@/lib/moddulo/__tests__/fixtures/modeloPorMitad";

type Db = { reset(d?: Record<string, unknown>): void; updates(): Array<{ path: string; data: Record<string, unknown> }>; failUpdateOn(p: string): void; atomico(a?: boolean): void; seed?: unknown };
const db = adminDb as unknown as Db;


const llamar = async () => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  db.reset({ "moddulo_projects/p1": { phases: { exploracion: {} } } }); // paso 4: the write is a transaction that re-reads the document
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "ciudadano", xpcto: { hito: "h" }, territorio: { nivel: "estatal", nombre: "Yucatán", estado: "Yucatán" }, phases: {} } as never);
});


const e = (status: number) => Object.assign(new Error("SECRETO-xyz request_id=req_FAKE123"), { name: "APIError", status });
const create = () => vi.mocked(anthropic.messages.create);
const espiar = () => ({
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  err: vi.spyOn(console, "error").mockImplementation(() => {}),
});
const todo = (s: ReturnType<typeof espiar>) =>
  [...s.log.mock.calls, ...s.warn.mock.calls, ...s.err.mock.calls].map((c) => c.map(String).join(" ")).join("\n");

describe("generate-m1-express — 4f: causa del fallo del modelo", () => {
  it.each([[429, "limite"], [529, "sobrecarga"], [503, "sobrecarga"], [402, "saldo"], [500, "otro"]] as const)(
    "ambas mitades fallan con status %s → causa %s, sin el mensaje del proveedor ni escrituras",
    async (status, causa) => {
      const s = espiar();
      responderPorMitad(create(), () => {
        throw e(status);
      });
      const r = await llamar();
      expect(r.status).toBe(500);
      expect(r.cuerpo.codigo).toBe("fallo_modelo");
      expect(r.cuerpo.causa).toBe(causa);
      expect(JSON.stringify(r.cuerpo)).not.toMatch(/SECRETO|req_FAKE123/);
      expect(todo(s)).not.toMatch(/SECRETO|req_FAKE123/);
      expect(todo(s)).toContain("causa=" + causa);
      expect(db.updates()).toEqual([]);
    }
  );

  it("orden de gravedad entre mitades: saldo > limite > sobrecarga > otro", async () => {
    espiar();
    const casos: Array<[number, number, string]> = [
      [429, 402, "saldo"], [402, 429, "saldo"],
      [529, 429, "limite"], [500, 529, "sobrecarga"], [500, 500, "otro"],
    ];
    for (const [a, b, esperado] of casos) {
      vi.clearAllMocks();
      db.reset({ "moddulo_projects/p1": { phases: { exploracion: {} } } });
      responderPorMitad(create(), (m) => {
        throw e(m === "PES" ? a : b);
      });
      const r = await llamar();
      expect(r.cuerpo.causa, `${a} + ${b}`).toBe(esperado);
    }
  });

  it("una mitad fallida con la otra exitosa: no se guarda nada y la causa es la de la fallida", async () => {
    espiar();
    responderPorMitad(create(), (m) => {
      if (m === "TEcL") throw e(429);
      return respuestaValida(m);
    });
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.causa).toBe("limite");
    expect(r.cuerpo.dimensiones).toBe("T, Ec y L");
    expect(db.updates()).toEqual([]);
  });

  it("sin fallo del modelo (respuesta inválida) el cuerpo no trae causa", async () => {
    espiar();
    responderPorMitad(create(), (m) => (m === "PES" ? respuestaModelo("no es JSON") : respuestaValida(m)));
    const r = await llamar();
    expect(r.cuerpo.codigo).toBe("respuesta_invalida");
    expect(r.cuerpo).not.toHaveProperty("causa");
  });
});
