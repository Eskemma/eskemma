// H25 (7b-1) — caracterización de POST vincular-moddulo. Escrita ANTES del refactor a transacción
// y verde contra el código anterior; debe seguir verde sin editarse.

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
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ sesionId: "s1" }) };
const req = (cuerpo: unknown) => new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never;
const TERR = { nivel: "estatal", nombre: "Jalisco" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockResolvedValue({ currentPhase: "investigacion" } as never);
  mockDb.reset({ "fontana_sesiones/s1": { uid: "u1", territorio: TERR }, "moddulo_projects/p1": { phases: {} } });
});

describe("POST vincular-moddulo — respuestas", () => {
  it("401 sin sesión", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await POST(req({ modduloProjectId: "p1" }), ctx)).status).toBe(401);
  });

  it("400 JSON inválido y 400 sin modduloProjectId", async () => {
    const a = await POST(new Request("http://local/x", { method: "POST", body: "{no" }) as never, ctx);
    expect(a.status).toBe(400);
    expect(await a.json()).toEqual({ error: "JSON inválido" });
    const b = await POST(req({}), ctx);
    expect(b.status).toBe(400);
    expect(await b.json()).toEqual({ error: "modduloProjectId es requerido" });
  });

  it("404 si la sesión no existe o es ajena, sin escrituras", async () => {
    mockDb.reset({ "fontana_sesiones/s1": { uid: "otro" } });
    const r = await POST(req({ modduloProjectId: "p1" }), ctx);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Sesión de Fontana no encontrada" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("404 si el proyecto Moddulo no es accesible, sin escrituras", async () => {
    vi.mocked(getProject).mockResolvedValue(null as never);
    const r = await POST(req({ modduloProjectId: "p1" }), ctx);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Proyecto Moddulo no encontrado" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("idempotente: misma sesión y mismo proyecto → 200 con currentPhase, sin escrituras", async () => {
    mockDb.reset({ "fontana_sesiones/s1": { uid: "u1", modduloProjectId: "p1" } });
    const r = await POST(req({ modduloProjectId: "p1" }), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ modduloProjectId: "p1", currentPhase: "investigacion" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("409 sesion_already_linked si está vinculada a OTRO proyecto, sin escrituras", async () => {
    mockDb.reset({ "fontana_sesiones/s1": { uid: "u1", modduloProjectId: "otro" } });
    const r = await POST(req({ modduloProjectId: "p1" }), ctx);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({
      error: "sesion_already_linked",
      message: "Esta sesión de Fontana ya está vinculada a otro proyecto de Moddulo.",
    });
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("POST vincular-moddulo — éxito", () => {
  it("escribe el marcador en el proyecto y modduloProjectId en la sesión", async () => {
    const r = await POST(req({ modduloProjectId: "p1" }), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ modduloProjectId: "p1", currentPhase: "investigacion" });
    const u = mockDb.updates();
    expect(u.map((x) => x.path).sort()).toEqual(["fontana_sesiones/s1", "moddulo_projects/p1"]);
    const marcador = u.find((x) => x.path === "moddulo_projects/p1")!.data["phases.investigacion.fontanaPendiente"] as Record<string, unknown>;
    expect(marcador).toMatchObject({ sesionId: "s1", territorio: TERR });
    expect(typeof marcador.fechaCreacion).toBe("string");
    expect(u.find((x) => x.path === "moddulo_projects/p1")!.data.updatedAt).toBe("TS");
    const s = u.find((x) => x.path === "fontana_sesiones/s1")!.data;
    expect(s.modduloProjectId).toBe("p1");
    expect(typeof s.fechaUltimoGuardado).toBe("string");
  });

  it("currentPhase cae a «proposito» si el proyecto no lo trae", async () => {
    vi.mocked(getProject).mockResolvedValue({} as never);
    const r = await POST(req({ modduloProjectId: "p1" }), ctx);
    expect((await r.json()).currentPhase).toBe("proposito");
  });
});
