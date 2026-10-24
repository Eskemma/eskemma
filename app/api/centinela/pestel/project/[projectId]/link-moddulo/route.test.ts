// H25 (7b-2) — caracterización de POST link-moddulo (PESTEL → Moddulo). Escrita ANTES del refactor a
// transacción y verde contra el código anterior; debe seguir verde sin editarse.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { MENSAJE_MODDULO_OTRA_VERSION } from "@/lib/moddulo/textosVinculo";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const req = (cuerpo: unknown) => new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never;
const NAC = { nivel: "nacional", nombre: "México" };
const ANALISIS = { projectId: "pest1", analyzedAt: "2026-10-01T00:00:00Z", dimensions: [] };
const pestel = (extra: Record<string, unknown> = {}) => ({ userId: "u1", tipo: "electoral", territorio: NAC, ...extra });
const moddulo = (extra: Record<string, unknown> = {}) => ({
  name: "M",
  type: "electoral",
  territorio: NAC,
  xpcto: { hito: "h" },
  phases: { exploracion: {} },
  ...extra,
});

const sembrar = (docs: Record<string, unknown>) => {
  mockDb.reset(structuredClone(docs));
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  sembrar({ "pestel_projects/pest1": pestel(), "moddulo_projects/m1": moddulo(), "pestel_analyses/a1": ANALISIS });
});

describe("POST link-moddulo — respuestas previas a escribir", () => {
  it("401, 400 JSON inválido y 400 sin modduloProjectId", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await POST(req({ modduloProjectId: "m1" }), ctx)).status).toBe(401);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
    const a = await POST(new Request("http://local/x", { method: "POST", body: "{no" }) as never, ctx);
    expect(a.status).toBe(400);
    expect(await a.json()).toEqual({ error: "JSON inválido" });
    const b = await POST(req({}), ctx);
    expect(b.status).toBe(400);
    expect(await b.json()).toEqual({ error: "modduloProjectId es requerido" });
  });

  it("404 si el proyecto PESTEL no existe o es ajeno", async () => {
    sembrar({ "pestel_projects/pest1": pestel({ userId: "otro" }), "moddulo_projects/m1": moddulo() });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Proyecto PESTEL no encontrado" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("idempotente: ya vinculado a ESTE Moddulo → 200 sin escrituras", async () => {
    sembrar({ "pestel_projects/pest1": pestel({ modduloProjectId: "m1" }), "moddulo_projects/m1": moddulo() });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ modduloProjectId: "m1" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("409 pestel_already_linked si PESTEL ya apunta a OTRO Moddulo", async () => {
    sembrar({ "pestel_projects/pest1": pestel({ modduloProjectId: "otro" }), "moddulo_projects/m1": moddulo() });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({
      error: "pestel_already_linked",
      message: "Este proyecto PESTEL ya está vinculado a otro proyecto de Moddulo.",
    });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("404 si el proyecto Moddulo no es accesible", async () => {
    const r = await POST(req({ modduloProjectId: "no-existe" }), ctx);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Proyecto Moddulo no encontrado" });
  });

  it("409 moddulo_already_linked si el Moddulo ya apunta a OTRO análisis PESTEL", async () => {
    sembrar({
      "pestel_projects/pest1": pestel(),
      "moddulo_projects/m1": moddulo({ phases: { exploracion: { linkedSource: { kind: "T22", sourceId: "otro" } } } }),
    });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("moddulo_already_linked");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("422 tipo_mismatch", async () => {
    sembrar({ "pestel_projects/pest1": pestel(), "moddulo_projects/m1": moddulo({ type: "gubernamental" }) });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(422);
    const c = await r.json();
    expect(c).toMatchObject({ error: "tipo_mismatch", pestelTipo: "electoral", modduloType: "gubernamental" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("422 territorio_mismatch sin forceLink; con forceLink vincula", async () => {
    sembrar({
      "pestel_projects/pest1": pestel(),
      "moddulo_projects/m1": moddulo({ territorio: { nivel: "estatal", nombre: "Jalisco", estado: "Jalisco" } }),
    });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(422);
    expect((await r.json()).error).toBe("territorio_mismatch");
    expect(mockDb.updates()).toHaveLength(0);
    const f = await POST(req({ modduloProjectId: "m1", forceLink: true }), ctx);
    expect(f.status).toBe(201);
  });
});

describe("POST link-moddulo — escritura", () => {
  it("con análisis: 201, escribe el vínculo con el mapa en el Moddulo y el back-link en PESTEL", async () => {
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ modduloProjectId: "m1", sourceAnalysisId: "a1" });
    const u = mockDb.updates();
    expect(u.map((x) => x.path).sort()).toEqual(["moddulo_projects/m1", "pestel_projects/pest1"]);
    const m = u.find((x) => x.path === "moddulo_projects/m1")!.data;
    expect(m["phases.exploracion.linkedSource"]).toMatchObject({ kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1" });
    expect(m["phases.exploracion.motorAprobaciones"]).toEqual({});
    expect(m["phases.exploracion.xpctoSnapshotAtGeneration"]).toBe(JSON.stringify({ hito: "h" }));
    expect(m.updatedAt).toBe("TS");
    expect(u.find((x) => x.path === "pestel_projects/pest1")!.data).toEqual({ modduloProjectId: "m1", updatedAt: "TS" });
  });

  it("con análisis: deja un M1 nuevo en borrador (m1 con creadoEn) y descarta el borrador de motores, sin tocar el Reporte F2", async () => {
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(201);
    const m = mockDb.updates().find((x) => x.path === "moddulo_projects/m1")!.data;
    expect(m["phases.exploracion.m1"]).toEqual({ creadoEn: "TS" });
    expect(m["phases.exploracion.draftDVS"]).toBe("__DELETE__");
    expect(m).not.toHaveProperty("phases.exploracion.dvs");
  });

  it("sin análisis: 201 con sourceAnalysisId null y solo el vínculo (sin mapa ni aprobaciones)", async () => {
    sembrar({ "pestel_projects/pest1": pestel(), "moddulo_projects/m1": moddulo() });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ modduloProjectId: "m1", sourceAnalysisId: null });
    const m = mockDb.updates().find((x) => x.path === "moddulo_projects/m1")!.data;
    expect(m["phases.exploracion.linkedSource"]).toEqual({ kind: "T22", componente: "centinela", sourceId: "pest1" });
    expect(m["phases.exploracion.motorAprobaciones"]).toBeUndefined();
    expect(m).not.toHaveProperty("phases.exploracion.m1");
    expect(m).not.toHaveProperty("phases.exploracion.draftDVS");
  });

  it("rama C7b: mismo análisis ya importado → 200 y SOLO se reafirma el back-link de PESTEL", async () => {
    sembrar({
      "pestel_projects/pest1": pestel(),
      "moddulo_projects/m1": moddulo({
        phases: { exploracion: { linkedSource: { kind: "T22", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } } } },
      }),
      "pestel_analyses/a1": ANALISIS,
    });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ modduloProjectId: "m1", sourceAnalysisId: "a1" });
    expect(mockDb.updates()).toEqual([{ path: "pestel_projects/pest1", data: { modduloProjectId: "m1", updatedAt: "TS" } }]);
  });

  it("rama C7b: OTRO análisis ya importado → 409 moddulo_already_linked sin escrituras", async () => {
    sembrar({
      "pestel_projects/pest1": pestel(),
      "moddulo_projects/m1": moddulo({
        phases: { exploracion: { linkedSource: { kind: "T22", sourceId: "pest1", sourceAnalysisId: "viejo", payload: { P: {} } } } },
      }),
      "pestel_analyses/a1": ANALISIS,
    });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(409);
    // EDITADA (T2, 1c): el texto ya no remite a «contacta soporte»; dice cómo actualizar la versión.
    expect((await r.json()).message).toBe(MENSAJE_MODDULO_OTRA_VERSION);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("upgrade express→Centinela: un mapa SIN sourceAnalysisId no es conflicto (vincula y reemplaza)", async () => {
    sembrar({
      "pestel_projects/pest1": pestel(),
      "moddulo_projects/m1": moddulo({ phases: { exploracion: { linkedSource: { kind: "express", sourceId: "pest1", payload: { P: {} } } } } }),
      "pestel_analyses/a1": ANALISIS,
    });
    // Paso 4: replacing an existing M1 asks once (409 with the lines and the fingerprint); confirmed, it links.
    const pide = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(pide.status).toBe(409);
    const { huella } = await pide.json();
    expect(mockDb.updates()).toHaveLength(0);
    const r = await POST(req({ modduloProjectId: "m1", confirmar: true, huella }), ctx);
    expect(r.status).toBe(201);
  });
});
