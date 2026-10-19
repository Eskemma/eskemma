// generate-m1-express: códigos de error propios (`codigo`) y registro de diagnóstico, ahora por mitad.

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


const espiar = () => ({
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  err: vi.spyOn(console, "error").mockImplementation(() => {}),
});
const todo = (s: ReturnType<typeof espiar>) =>
  [...s.log.mock.calls, ...s.warn.mock.calls, ...s.err.mock.calls].map((c) => c.map(String).join(" ")).join("\n");
const create = () => vi.mocked(anthropic.messages.create);

describe("generate-m1-express — códigos de error propios", () => {
  it("una mitad con stop_reason max_tokens → 500 respuesta_truncada, nombra T, Ec y L, sin reintento y sin escribir", async () => {
    espiar();
    const intentos = responderPorMitad(create(), (m) =>
      m === "TEcL" ? respuestaModelo('{"T":{"code":"T","narra', "max_tokens") : respuestaValida(m)
    );
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("respuesta_truncada");
    expect(r.cuerpo.dimensiones).toBe("T, Ec y L");
    expect(intentos).toEqual({ PES: 1, TEcL: 1 });
    expect(db.updates()).toEqual([]);
  });

  it("JSON inválido con otro stop_reason → respuesta_invalida (se reintenta una vez la mitad) y nombra P, E y S", async () => {
    espiar();
    const intentos = responderPorMitad(create(), (m) => (m === "PES" ? respuestaModelo("Aquí está tu análisis: no es JSON") : respuestaValida(m)));
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("respuesta_invalida");
    expect(r.cuerpo.dimensiones).toBe("P, E y S");
    expect(intentos).toEqual({ PES: 2, TEcL: 1 });
    expect(db.updates()).toEqual([]);
  });

  it("excepción del SDK en ambas mitades → 500 fallo_modelo, sin reintento, console.error con nombre y status, sin el mensaje", async () => {
    const s = espiar();
    const e = Object.assign(new Error("secreto: clave sk-XYZ"), { name: "APIError", status: 529 });
    const intentos = responderPorMitad(create(), () => {
      throw e;
    });
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("fallo_modelo");
    expect(r.cuerpo.dimensiones).toBe("P, E, S, T, Ec y L");
    expect(intentos).toEqual({ PES: 1, TEcL: 1 });
    const texto = todo(s);
    expect(texto).toContain("APIError");
    expect(texto).toContain("529");
    expect(texto).not.toContain("sk-XYZ");
    expect(db.updates()).toEqual([]);
  });

  it("falla el update de Firestore → 500 fallo_guardado y console.error", async () => {
    const s = espiar();
    responderPorMitad(create(), (m) => respuestaValida(m));
    db.atomico(true); // the write is a transaction now: the failure is raised when the buffered writes are applied
    db.failUpdateOn("moddulo_projects/p1");
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo.codigo).toBe("fallo_guardado");
    expect(s.err).toHaveBeenCalled();
  });

  it("el éxito no trae `codigo`", async () => {
    espiar();
    responderPorMitad(create(), (m) => respuestaValida(m));
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.codigo).toBeUndefined();
  });
});

describe("generate-m1-express — registro de diagnóstico por mitad", () => {
  it("registra por mitad el prompt, stop_reason, tokens, duración y tiempo desde el inicio; y un total", async () => {
    const s = espiar();
    responderPorMitad(create(), (m) => respuestaValida(m));
    await llamar();
    const t = todo(s);
    for (const mitad of ["PES", "TEcL"]) {
      expect(t).toMatch(new RegExp(`\\[generate-m1-express\\] mitad=${mitad} prompt: system=\\d+ user=\\d+ caracteres`));
      expect(t).toMatch(new RegExp(`mitad=${mitad} intento=1 stop_reason=end_turn input_tokens=1200 output_tokens=3400 duracion_ms=\\d+ desde_inicio_ms=\\d+`));
    }
    expect(t).toMatch(/\[generate-m1-express\] total duracion_ms=\d+ mitades=2 input_tokens=2400 output_tokens=6800/);
  });

  it("en la rama de parseo registra la mitad, stop_reason, longitud y forma — nunca el texto (paso 4)", async () => {
    const s = espiar();
    const texto = "A".repeat(250) + "M".repeat(300) + "Z".repeat(100);
    responderPorMitad(create(), (m) => (m === "TEcL" ? respuestaModelo(texto, "max_tokens") : respuestaValida(m)));
    await llamar();
    const t = todo(s);
    expect(t).toContain("mitad=TEcL intento=1 parseo fallido stop_reason=max_tokens longitud=650 forma=texto");
    expect(t).not.toContain("AAAAAAAAAA");
    expect(t).not.toContain("ZZZZZZZZZZ");
  });

  it("G (paso 4): los contextos web/Fontana que fallan se registran con clase y status, nunca con el mensaje", async () => {
    const web = await import("@/lib/search/webContextFetcher");
    const fon = await import("@/lib/fontana/tabla/insumosPestel");
    vi.mocked(web.fetchWebEconomicContext).mockRejectedValueOnce(Object.assign(new Error("https://x?q=DATO-DEL-PROYECTO"), { name: "FetchError", status: 502 }));
    vi.mocked(fon.resolverInsumosFontanaPestel).mockRejectedValueOnce(new Error("DATO-DEL-PROYECTO"));
    // The web context is only fetched for projects outside Mexico.
    vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "ciudadano", xpcto: { hito: "h" }, territorio: { nivel: "nacional", nombre: "Colombia", pais: "Colombia" }, phases: {} } as never);
    const s = espiar();
    responderPorMitad(create(), (m) => respuestaValida(m));
    await llamar();
    const t = todo(s);
    expect(t).toContain("webEconomicContext error clase=FetchError status=502");
    expect(t).not.toContain("DATO-DEL-PROYECTO");
  });
});
