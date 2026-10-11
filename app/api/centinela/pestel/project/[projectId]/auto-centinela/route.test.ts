// H25 (commit 6b) — auto-centinela PATCH: una sola escritura idempotente (fija un valor).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { PATCH } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ projectId: "p1" }) };
const req = (enabled?: unknown) =>
  new Request("http://local/x", { method: "PATCH", body: JSON.stringify({ enabled }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset({ "pestel_projects/p1": { userId: "u1", autoMonitorEnabled: false } });
});

describe("PATCH auto-centinela", () => {
  it("activa: 200 con el valor y UNA escritura; repetirlo deja el mismo resultado (idempotente)", async () => {
    const r1 = await PATCH(req(true), ctx);
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ autoMonitorEnabled: true });
    const r2 = await PATCH(req(true), ctx);
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ autoMonitorEnabled: true });
    const u = mockDb.updates();
    expect(u).toHaveLength(2);
    expect(u.every((x) => x.data.autoMonitorEnabled === true)).toBe(true);
  });

  it("proyecto inexistente: 404; de otro usuario: 403; sin sesión: 401; valor no booleano: 400 — sin escrituras", async () => {
    mockDb.reset({});
    expect((await PATCH(req(true), ctx)).status).toBe(404);
    mockDb.reset({ "pestel_projects/p1": { userId: "otro" } });
    expect((await PATCH(req(true), ctx)).status).toBe(403);
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await PATCH(req(true), ctx)).status).toBe(401);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
    expect((await PATCH(req("sí"), ctx)).status).toBe(400);
    expect(mockDb.updates()).toHaveLength(0);
  });
});
