// H25 (7b-1) — caracterización de PATCH { desvincular: true } de Fontana. Escrita ANTES del
// refactor a transacción y pasa contra el código anterior: fija códigos, cuerpos y el conjunto de
// escrituras que la pantalla ve. Debe seguir verde sin editarse tras el cambio.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn(async () => null) }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { PATCH } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ sesionId: "s1" }) };
const req = (cuerpo: unknown) => new Request("http://local/x", { method: "PATCH", body: JSON.stringify(cuerpo) }) as never;

const sesion = (extra: Record<string, unknown> = {}) => ({
  uid: "u1",
  modduloProjectId: "p1",
  tareaPipIds: [],
  territorio: { nivel: "nacional", nombre: "México" },
  ...extra,
});
const proyecto = (marcador?: unknown) => ({
  phases: { investigacion: marcador ? { fontanaPendiente: marcador } : {} },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset({ "fontana_sesiones/s1": sesion(), "moddulo_projects/p1": proyecto({ sesionId: "s1" }) });
});

describe("PATCH desvincular — respuestas", () => {
  it("401 sin sesión", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await PATCH(req({ desvincular: true }), ctx)).status).toBe(401);
  });

  it("400 con JSON inválido", async () => {
    const r = await PATCH(new Request("http://local/x", { method: "PATCH", body: "{no" }) as never, ctx);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "JSON inválido" });
  });

  it("404 si la sesión no existe o es de otro usuario, sin escrituras", async () => {
    mockDb.reset({ "fontana_sesiones/s1": sesion({ uid: "otro" }) });
    const r = await PATCH(req({ desvincular: true }), ctx);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Sesión no encontrada" });
    mockDb.reset({});
    expect((await PATCH(req({ desvincular: true }), ctx)).status).toBe(404);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("400 sesion_no_vinculada, sin escrituras", async () => {
    mockDb.reset({ "fontana_sesiones/s1": sesion({ modduloProjectId: undefined }) });
    const r = await PATCH(req({ desvincular: true }), ctx);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "sesion_no_vinculada", message: "Esta sesión no está vinculada a ningún proyecto." });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("409 escenario_a_no_desvinculable, sin escrituras", async () => {
    mockDb.reset({ "fontana_sesiones/s1": sesion({ tareaPipIds: ["3"] }), "moddulo_projects/p1": proyecto({ sesionId: "s1" }) });
    const r = await PATCH(req({ desvincular: true }), ctx);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({
      error: "escenario_a_no_desvinculable",
      message: "Una sesión de Escenario (a) no puede desvincularse desde aquí.",
    });
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("PATCH desvincular — éxito y conjunto de escrituras", () => {
  it("el marcador es de esta sesión: se borra del proyecto y la sesión pierde modduloProjectId", async () => {
    const r = await PATCH(req({ desvincular: true }), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const u = mockDb.updates();
    expect(u.map((x) => x.path).sort()).toEqual(["fontana_sesiones/s1", "moddulo_projects/p1"]);
    expect(u.find((x) => x.path === "moddulo_projects/p1")!.data).toEqual({ "phases.investigacion.fontanaPendiente": "__DELETE__" });
    const s = u.find((x) => x.path === "fontana_sesiones/s1")!.data;
    expect(s.modduloProjectId).toBe("__DELETE__");
    expect(typeof s.fechaUltimoGuardado).toBe("string");
  });

  it("el marcador apunta a OTRA sesión: el proyecto no se toca, la sesión sí se desvincula", async () => {
    mockDb.reset({ "fontana_sesiones/s1": sesion(), "moddulo_projects/p1": proyecto({ sesionId: "otra" }) });
    const r = await PATCH(req({ desvincular: true }), ctx);
    expect(r.status).toBe(200);
    expect(mockDb.updates().map((x) => x.path)).toEqual(["fontana_sesiones/s1"]);
  });

  it("el proyecto ya no existe: la sesión se desvincula igual", async () => {
    mockDb.reset({ "fontana_sesiones/s1": sesion() });
    const r = await PATCH(req({ desvincular: true }), ctx);
    expect(r.status).toBe(200);
    expect(mockDb.updates().map((x) => x.path)).toEqual(["fontana_sesiones/s1"]);
  });
});
