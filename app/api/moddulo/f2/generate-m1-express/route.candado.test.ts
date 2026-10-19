// Paso 4 — generate-m1-express: candado H15 de «Nuevo análisis». Con algo que se perdería (el M1, sus ediciones o
// aprobación, el borrador de motores o sus aprobaciones) el servidor exige confirmación ligada a la huella de lo que el
// usuario vio; 409 antes de leer fuentes o llamar al modelo; revalidado en la transacción de escritura.

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

import { exploracionGate, otroMapaGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const create = () => vi.mocked(anthropic.messages.create);
const llamar = async (cuerpo: Record<string, unknown> = {}) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...cuerpo }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
/** getProject and the stored document describe the same exploration state. */
const sembrar = (exploracion: Record<string, unknown> = {}) => {
  vi.mocked(getProject).mockResolvedValue({
    id: "p1", type: "ciudadano", xpcto: { hito: "h" },
    territorio: { nivel: "estatal", nombre: "Yucatán", estado: "Yucatán" }, phases: { exploracion },
  } as never);
  db.reset({ [P]: { phases: { exploracion } } });
};
const escribioM1 = () => db.updates().some((u) => u.path === P && "phases.exploracion.linkedSource" in u.data);
const estadoCargado = () => exploracionGate("aprobado", { draftDVS: { x: 1 }, motorAprobaciones: { M2: true } });

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of ["log", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  create().mockReset();
  responderPorMitad(create(), (m) => respuestaValida(m));
});

describe("generate-m1-express — candado de «Nuevo análisis»", () => {
  it("proyecto limpio (nada que perder): genera sin pedir confirmación, como siempre", async () => {
    sembrar({});
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(escribioM1()).toBe(true);
  });

  it("solo un Reporte F2 finalizado, sin M1 ni borrador: nada se pierde → no pide confirmación (el Reporte no cambia)", async () => {
    sembrar({ dvs: { x: 1 } });
    expect((await llamar()).status).toBe(200);
  });

  it("M1 aprobado con motores: 409 reemplazo_requiere_confirmacion con las líneas reales y la huella, SIN llamar al modelo ni escribir", async () => {
    sembrar(estadoCargado());
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(typeof r.cuerpo.huella).toBe("string");
    expect(r.cuerpo.lineas.join(" ")).toContain("Se perderá la aprobación del análisis");
    expect(r.cuerpo.lineas.join(" ")).toContain("borrador de motores");
    expect(create()).not.toHaveBeenCalled();
    expect(db.updates()).toEqual([]);
  });

  it.each(["borrador", "reabierto"] as const)("M1 en %s (payload existente): también pide confirmación", async (estado) => {
    sembrar(exploracionGate(estado));
    expect((await llamar()).cuerpo.error).toBe("reemplazo_requiere_confirmacion");
  });

  it("confirmar sin huella, o confirmar:false con huella: sigue pidiendo", async () => {
    sembrar(estadoCargado());
    const { cuerpo } = await llamar();
    expect((await llamar({ confirmar: true })).cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect((await llamar({ confirmar: false, huella: cuerpo.huella })).cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(create()).not.toHaveBeenCalled();
  });

  it("huella de otro estado: 409 reemplazo_huella_vencida con las líneas y la huella vigentes", async () => {
    sembrar(estadoCargado());
    const r = await llamar({ confirmar: true, huella: "huella-vieja" });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_huella_vencida");
    expect(r.cuerpo.huella).not.toBe("huella-vieja");
    expect(create()).not.toHaveBeenCalled();
  });

  it("confirmado con la huella que devolvió el servidor: genera y escribe el M1 nuevo en borrador", async () => {
    sembrar(estadoCargado());
    const { cuerpo } = await llamar();
    const r = await llamar({ confirmar: true, huella: cuerpo.huella });
    expect(r.status).toBe(200);
    const d = db.updates().find((u) => u.path === P)!.data;
    expect(d["phases.exploracion.m1"]).toEqual({ creadoEn: "TS" });
    expect(d["phases.exploracion.draftDVS"]).toBe("__DELETE__");
    expect(d["phases.exploracion.motorAprobaciones"]).toEqual({});
  });

  it("verificar:true — proyecto limpio: 200 {verificado} sin llamar al modelo ni escribir; con algo que perder: el mismo 409", async () => {
    sembrar({});
    expect(await llamar({ verificar: true })).toEqual({ status: 200, cuerpo: { verificado: true } });
    expect(create()).not.toHaveBeenCalled();
    expect(db.updates()).toEqual([]);
    sembrar(estadoCargado());
    const r = await llamar({ verificar: true });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
  });

  it("[carrera] limpio al inicio pero aparece una aprobación mientras el modelo genera: 409 y CERO escrituras", async () => {
    sembrar({});
    create().mockReset();
    responderPorMitad(create(), (m) => {
      db.reset({ [P]: { phases: { exploracion: estadoCargado() } } });
      return respuestaValida(m);
    });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(db.updates()).toEqual([]);
  });

  it("[carrera] confirmado, pero el contenido cambió mientras generaba (otra pestaña editó y volvió a aprobar): huella_vencida y cero escrituras", async () => {
    sembrar(estadoCargado());
    const { cuerpo } = await llamar();
    create().mockReset();
    responderPorMitad(create(), (m) => {
      db.reset({ [P]: { phases: { exploracion: exploracionGate("aprobado", { draftDVS: { x: 1 }, motorAprobaciones: { M2: true } }, otroMapaGate) } } });
      return respuestaValida(m);
    });
    const r = await llamar({ confirmar: true, huella: cuerpo.huella });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_huella_vencida");
    expect(db.updates()).toEqual([]);
  });

  it("[carrera] la Fase 2 se cierra mientras genera: 409 fase_cerrada y cero escrituras", async () => {
    sembrar({});
    create().mockReset();
    responderPorMitad(create(), (m) => {
      db.reset({ [P]: { phases: { exploracion: { status: "completed" } } } });
      return respuestaValida(m);
    });
    const r = await llamar();
    expect(r).toEqual({ status: 409, cuerpo: { error: "fase_cerrada" } });
    expect(db.updates()).toEqual([]);
  });

  it("el candado va después de fase_cerrada y de pestel_linked: no pide confirmar algo que se rechazaría igual", async () => {
    sembrar({ status: "completed", ...estadoCargado() });
    expect((await llamar()).cuerpo.error).toBe("fase_cerrada");
    sembrar({ linkedSource: { kind: "T22", sourceId: "x", sourceAnalysisId: "a", payload: { P: {} } }, m1: { creadoEn: "t" } });
    expect((await llamar()).cuerpo.error).toBe("pestel_linked");
  });
});
