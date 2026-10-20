// Paso 4 — sesión: las cinco rutas atienden SOLO con la cookie de sesión verificada. Sin cookie o con una cookie
// que no verifica responden 401 {error:"No autorizado"} ANTES de leer el cuerpo o cualquier dato. Se usa el
// getSessionFromRequest REAL (solo se simula la verificación de la cookie), para probar que no hay otra puerta.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => ({ session: null })) }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/moddulo/rda", () => ({ planRDAUpdate: vi.fn(() => ({ nuevos: [], resueltos: [] })) }));
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

import { getSession } from "@/lib/session";
import { getProject } from "@/lib/moddulo/project";
import { POST as generarM1 } from "@/app/api/moddulo/f2/generate-m1-express/route";
import { POST as importar } from "@/app/api/moddulo/f2/import-pestel/route";
import { POST as desvincular } from "@/app/api/moddulo/f2/unlink-pestel/route";
import { POST as vincular } from "@/app/api/centinela/pestel/project/[projectId]/link-moddulo/route";
import { POST as cerrar } from "@/app/api/moddulo/projects/[projectId]/complete-phase/route";
import { decidirSondeo } from "@/lib/moddulo/sondeoCandado";

const cuerpo = JSON.stringify({ projectId: "p1", verificar: true, phaseId: "exploracion", moddulo_project_id: "p1" });
const llamadas: Array<[string, (r: NextRequest) => Promise<Response>]> = [
  ["generate-m1-express (verificar:true)", (r) => generarM1(r)],
  ["import-pestel", (r) => importar(r)],
  ["unlink-pestel", (r) => desvincular(r)],
  ["link-moddulo", (r) => vincular(r, { params: Promise.resolve({ projectId: "pp1" }) })],
  ["complete-phase", (r) => cerrar(r, { params: Promise.resolve({ projectId: "p1" }) })],
];
const req = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost:3000/api/x", { method: "POST", body: cuerpo, headers });

beforeEach(() => vi.clearAllMocks());

describe.each(llamadas)("%s", (_n, llamar) => {
  it("sin cookie → 401 y ni siquiera se intenta verificar nada", async () => {
    const r = await llamar(req());
    expect(r.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
  });
  it("cabeceras que NO son la cookie (Authorization, x-user-id, x-uid) no autentican", async () => {
    const r = await llamar(req({ Authorization: "Bearer abc", "x-user-id": "u1", "x-uid": "u1" }));
    expect(r.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
  });
  it("cookie que no verifica (vencida, revocada o malformada) → 401", async () => {
    const r = await llamar(req({ cookie: "eskemma-session=vencida" }));
    expect(r.status).toBe(401);
    expect(getSession).toHaveBeenCalledWith("vencida");
    expect(getProject).not.toHaveBeenCalled();
  });
  it("otra cookie con otro nombre no cuenta", async () => {
    expect((await llamar(req({ cookie: "session=x; token=y" }))).status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe("lo que ve el usuario ante ese 401 en «Nuevo análisis» y «Desvincular»", () => {
  it("el texto de la franja es el de sesión, sin ofrecer Reintentar", () => {
    for (const accion of ["nuevo_analisis", "desvincular"] as const) {
      const d = decidirSondeo(accion, { tipo: "respuesta", ok: false, status: 401, codigo: "No autorizado" } as never, { error: "No autorizado" });
      expect(d).toEqual({ tipo: "error", mensaje: "Tu sesión no es válida o expiró. Vuelve a iniciar sesión. No se hizo ningún cambio.", reintentable: false });
    }
  });
});
