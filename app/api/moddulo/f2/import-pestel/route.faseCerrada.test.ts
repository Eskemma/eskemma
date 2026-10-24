// F2 cerrada = solo lectura: import-pestel responde 409 fase_cerrada sin leer el análisis ni escribir.

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

type Db = { reset(d?: Record<string, unknown>): void; updates(): Array<{ path: string; data: Record<string, unknown> }> };
const db = adminDb as unknown as Db;
const llamar = async () => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", pestAnalysisId: "a1" }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const proyecto = (exploracion: Record<string, unknown>) => ({ id: "p1", xpcto: {}, phases: { exploracion } });

// Paso 4: the write is a transaction that re-reads the project document, so the stored document and
// getProject describe the same state.
const sembrar = (exploracion: Record<string, unknown> = {}) => {
  vi.mocked(getProject).mockResolvedValue(proyecto(exploracion) as never);
  db.reset({
    "pestel_analyses/a1": { projectId: "pest1", dimensions: [] },
    "pestel_projects/pest1": { userId: "u1" },
    "moddulo_projects/p1": { phases: { exploracion } },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  db.reset({ "pestel_analyses/a1": { projectId: "pest1", dimensions: [] }, "pestel_projects/pest1": { userId: "u1" } });
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("import-pestel — F2 cerrada", () => {
  it("409 fase_cerrada y no escribe nada", async () => {
    sembrar({ status: "completed", dvs: { x: 1 } });
    const r = await llamar();
    expect(r).toEqual({ status: 409, cuerpo: { error: "fase_cerrada" } });
    expect(db.updates()).toHaveLength(0);
  });
  it("va antes de leer el análisis: con un análisis inexistente sigue siendo fase_cerrada", async () => {
    db.reset({});
    sembrar({ status: "completed" });
    expect((await llamar()).cuerpo).toEqual({ error: "fase_cerrada" });
  });
  it("401 y 404 van antes", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await llamar()).status).toBe(401);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await llamar()).status).toBe(404);
  });
  it("con la fase abierta importa (200)", async () => {
    sembrar({ status: "in-progress" });
    expect((await llamar()).status).toBe(200);
    // EDITADA (T2, 1b): además del Moddulo se escribe el back-link del PESTEL, en la misma transacción.
    expect(db.updates().map((u) => u.path).sort()).toEqual(["moddulo_projects/p1", "pestel_projects/pest1"]);
  });
});
