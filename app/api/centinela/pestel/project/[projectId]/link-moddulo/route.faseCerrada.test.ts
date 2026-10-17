// F2 cerrada = solo lectura: link-moddulo responde 409 fase_cerrada y no escribe (ni en el Moddulo ni en PESTEL).

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
const cerrada = { phases: { exploracion: { status: "completed", dvs: { x: 1 } } } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("POST link-moddulo — F2 cerrada", () => {
  it("409 fase_cerrada, sin escrituras", async () => {
    sembrar({ "pestel_projects/pest1": pestel(), "moddulo_projects/m1": moddulo(cerrada), "pestel_analyses/a1": ANALISIS });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "fase_cerrada" });
    expect(mockDb.updates()).toHaveLength(0);
  });
  it("va antes de los guards de vínculo (moddulo_already_linked)", async () => {
    sembrar({
      "pestel_projects/pest1": pestel(),
      "moddulo_projects/m1": moddulo({ phases: { exploracion: { status: "completed", linkedSource: { sourceId: "otro" } } } }),
    });
    expect((await (await POST(req({ modduloProjectId: "m1" }), ctx)).json())).toEqual({ error: "fase_cerrada" });
  });
  it("401, 404 PESTEL y 404 Moddulo van antes", async () => {
    sembrar({ "pestel_projects/pest1": pestel() });
    expect((await POST(req({ modduloProjectId: "no-existe" }), ctx)).status).toBe(404);
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await POST(req({ modduloProjectId: "m1" }), ctx)).status).toBe(401);
  });
  it("la fase se cierra ENTRE la lectura previa y la transacción: la transacción rechaza sin escribir", async () => {
    sembrar({ "pestel_projects/pest1": pestel(), "moddulo_projects/m1": moddulo(), "pestel_analyses/a1": ANALISIS });
    vi.mocked(getProject).mockImplementation(async () => {
      const abierto = structuredClone(mockDb.snapshot()["moddulo_projects/m1"]) as never;
      mockDb.reset({ ...structuredClone(mockDb.snapshot()), "moddulo_projects/m1": moddulo(cerrada) });
      return abierto;
    });
    const r = await POST(req({ modduloProjectId: "m1" }), ctx);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "fase_cerrada" });
    expect(mockDb.updates()).toHaveLength(0);
  });
  it("con la fase abierta vincula (201)", async () => {
    sembrar({ "pestel_projects/pest1": pestel(), "moddulo_projects/m1": moddulo(), "pestel_analyses/a1": ANALISIS });
    expect((await POST(req({ modduloProjectId: "m1" }), ctx)).status).toBe(201);
  });
});
