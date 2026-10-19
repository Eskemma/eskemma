// generate-m1-express (paso 2): dos llamadas en paralelo de tres dimensiones — fusión, reintento de una sola
// mitad con presupuesto de tiempo, y el contexto que recibe cada una.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { respuestaValida, respuestaModelo, responderPorMitad, mapaMitad, dimension } from "@/lib/moddulo/__tests__/fixtures/modeloPorMitad";

type Db = { reset(d?: Record<string, unknown>): void; updates(): Array<{ path: string; data: Record<string, unknown> }>; failUpdateOn(p: string): void; seed?: unknown };
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


const espiar = () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  return { warn: vi.spyOn(console, "warn").mockImplementation(() => {}), err: vi.spyOn(console, "error").mockImplementation(() => {}) };
};
const create = () => vi.mocked(anthropic.messages.create);
const avanzar = (ms: number) => vi.setSystemTime(Date.now() + ms);

afterEach(() => vi.useRealTimers());

describe("generate-m1-express — dos mitades en paralelo", () => {
  it("llama al modelo dos veces, una por mitad, con su tope, su timeout y sin reintentos del SDK", async () => {
    espiar();
    responderPorMitad(create(), (m) => respuestaValida(m));
    await llamar();
    expect(create()).toHaveBeenCalledTimes(2);
    for (const [cuerpo, opciones] of create().mock.calls as unknown as Array<[{ max_tokens: number }, { timeout: number; maxRetries: number }]>) {
      expect(cuerpo.max_tokens).toBe(8000);
      expect(opciones.maxRetries).toBe(0);
      expect(opciones.timeout).toBeLessThanOrEqual(170_000);
      expect(opciones.timeout).toBeGreaterThan(100_000);
    }
  });

  it("las dos llamadas salen antes de que responda ninguna (paralelo real)", async () => {
    espiar();
    let enVuelo = 0, maxEnVuelo = 0;
    create().mockImplementation((async (args: unknown) => {
      const m = (await import("@/lib/moddulo/__tests__/fixtures/modeloPorMitad")).mitadDeLlamada(args);
      enVuelo += 1; maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
      await new Promise((r) => setTimeout(r, 5));
      enVuelo -= 1;
      return respuestaValida(m);
    }) as never);
    await llamar();
    expect(maxEnVuelo).toBe(2);
  });

  it("cada mitad recibe el mismo contexto y nombra lo que cubre la otra", async () => {
    espiar();
    responderPorMitad(create(), (m) => respuestaValida(m));
    await llamar();
    const users = (create().mock.calls as unknown as Array<[{ messages: Array<{ content: string }> }]>).map((c) => c[0].messages[0].content);
    expect(users).toHaveLength(2);
    const [a, b] = users[0].includes("tú escribes solo P, E, S") ? users : [users[1], users[0]];
    expect(a).toContain("Otra parte cubre T, Ec, L");
    expect(b).toContain("Otra parte cubre P, E, S");
    for (const trozo of ["== XPCTO DEL PROYECTO ==", "Hito: h", "REGLA ABSOLUTA SOBRE FUENTES"]) {
      expect(a).toContain(trozo);
      expect(b).toContain(trozo);
    }
  });

  it("fusiona en el orden P, E, S, T, Ec, L con UN solo update de Firestore tras ambas mitades", async () => {
    espiar();
    responderPorMitad(create(), (m) => respuestaValida(m));
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(Object.keys(r.cuerpo.mapaPESTEL)).toEqual(["P", "E", "S", "T", "Ec", "L"]);
    const w = db.updates().filter((u) => u.path === "moddulo_projects/p1");
    expect(w).toHaveLength(1);
    expect(Object.keys((w[0].data["phases.exploracion.linkedSource"] as { payload: object }).payload)).toEqual(["P", "E", "S", "T", "Ec", "L"]);
  });

  it("una mitad con una clave de más o de menos es respuesta_invalida de esa mitad", async () => {
    espiar();
    responderPorMitad(create(), (m) => respuestaModelo(JSON.stringify(m === "PES" ? { ...mapaMitad("PES"), T: dimension("T") } : mapaMitad(m))));
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo).toMatchObject({ codigo: "respuesta_invalida", dimensiones: "P, E y S" });
    expect(db.updates()).toEqual([]);
  });

  it("un valor que no es objeto (nulo, arreglo, texto) también invalida la mitad", async () => {
    espiar();
    responderPorMitad(create(), (m) => respuestaModelo(JSON.stringify(m === "TEcL" ? { T: null, Ec: [], L: "x" } : mapaMitad(m))));
    expect((await llamar()).cuerpo).toMatchObject({ codigo: "respuesta_invalida", dimensiones: "T, Ec y L" });
  });
});

describe("generate-m1-express — reintento de una sola mitad", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));

  it("fallo_modelo en una mitad: se reintenta SOLO esa, una vez, y el análisis sale completo", async () => {
    espiar();
    const intentos = responderPorMitad(create(), (m, n) => {
      if (m === "TEcL" && n === 1) throw Object.assign(new Error("x"), { name: "APIError", status: 529 });
      return respuestaValida(m);
    });
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(intentos).toEqual({ PES: 1, TEcL: 2 });
    expect(Object.keys(r.cuerpo.mapaPESTEL)).toEqual(["P", "E", "S", "T", "Ec", "L"]);
  });

  it("respuesta_invalida en una mitad: un reintento; si vuelve a fallar, falla todo con el nombre de la mitad y no hay un tercero", async () => {
    espiar();
    const intentos = responderPorMitad(create(), (m) => (m === "PES" ? respuestaModelo("no json") : respuestaValida(m)));
    const r = await llamar();
    expect(intentos.PES).toBe(2);
    expect(r.cuerpo).toMatchObject({ codigo: "respuesta_invalida", dimensiones: "P, E y S" });
    expect(db.updates()).toEqual([]);
  });

  it("el reintento usa un timeout que respeta el presupuesto (≤ 285 s desde el inicio)", async () => {
    espiar();
    responderPorMitad(create(), (m, n) => {
      if (m === "PES" && n === 1) { avanzar(100_000); throw new Error("x"); }
      return respuestaValida(m);
    });
    await llamar();
    const llamadas = create().mock.calls as unknown as Array<[unknown, { timeout: number }]>;
    const tiempos = llamadas.map((c) => c[1].timeout);
    expect(tiempos[tiempos.length - 1]).toBeLessThanOrEqual(185_000);
    expect(tiempos[tiempos.length - 1]).toBeGreaterThan(0);
  });

  it("no hay reintento con respuesta_truncada (volvería a truncar)", async () => {
    espiar();
    const intentos = responderPorMitad(create(), (m) => (m === "TEcL" ? respuestaModelo('{"T":', "max_tokens") : respuestaValida(m)));
    await llamar();
    expect(intentos.TEcL).toBe(1);
  });

  it("no hay reintento si fallan las dos mitades", async () => {
    espiar();
    const intentos = responderPorMitad(create(), () => {
      throw new Error("x");
    });
    await llamar();
    expect(intentos).toEqual({ PES: 1, TEcL: 1 });
  });

  it("no hay reintento si ya pasaron 150 s desde el inicio, y lo deja en el log", async () => {
    const s = espiar();
    const intentos = responderPorMitad(create(), (m) => {
      if (m === "PES") { avanzar(155_000); throw new Error("x"); }
      return respuestaValida(m);
    });
    const r = await llamar();
    expect(intentos.PES).toBe(1);
    expect(r.cuerpo).toMatchObject({ codigo: "fallo_modelo", dimensiones: "P, E y S" });
    expect(s.warn.mock.calls.map((c) => c.join(" ")).join("\n")).toContain("mitad=PES sin reintento por tiempo");
  });

  it("no hay reintento si, aun bajo 150 s, el reintento no cabría antes de 240 s (140 s + una mitad de 140 s)", async () => {
    espiar();
    const intentos = responderPorMitad(create(), (m) => {
      if (m === "PES") { avanzar(140_000); throw new Error("x"); }
      return respuestaValida(m);
    });
    await llamar();
    expect(intentos.PES).toBe(1);
  });

  it("con 100 s transcurridos y la mitad de 100 s, el reintento sí cabe (≈ 200 s < 240 s)", async () => {
    espiar();
    const intentos = responderPorMitad(create(), (m, n) => {
      if (m === "PES" && n === 1) { avanzar(100_000); throw new Error("x"); }
      return respuestaValida(m);
    });
    const r = await llamar();
    expect(intentos.PES).toBe(2);
    expect(r.status).toBe(200);
  });

  it("el total del log cuenta los tokens de todos los intentos", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    responderPorMitad(create(), (m, n) => (m === "TEcL" && n === 1 ? respuestaModelo("no json", "end_turn", { input_tokens: 10, output_tokens: 20 }) : respuestaValida(m)));
    await llamar();
    const t = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(t).toContain("mitad=TEcL intento=2");
    expect(t).toMatch(/total duracion_ms=\d+ mitades=2 input_tokens=2410 output_tokens=6820/);
  });
});
