// app/api/moddulo/projects/route.test.ts
// POST /api/moddulo/projects: un pestelProjectId ajeno → 404 (no 500, y sin
// revelar si existe); uno propio → 201. Ver lib/moddulo/project.createProject.test.ts
// para el guard en sí.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const mockGetSession = vi.mocked(getSessionFromRequest);

const UID = "uidA";

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/moddulo/projects", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/moddulo/projects — pestelProjectId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminDb.reset();
    mockGetSession.mockResolvedValue(mockSessionPayload({ uid: UID }));
  });

  it("404 si el pestelProjectId es de otro usuario, sin crear ni escribir nada", async () => {
    mockAdminDb.reset({ "pestel_projects/pVictima": { userId: "otro" } });
    const antes = mockAdminDb.snapshot();

    const res = await POST(
      buildRequest({ type: "electoral", name: "X", pestelProjectId: "pVictima" })
    );

    expect(res.status).toBe(404);
    expect(mockAdminDb.snapshot()).toEqual(antes);
  });

  it("201 con un pestelProjectId propio", async () => {
    mockAdminDb.reset({ "pestel_projects/pPropio": { userId: UID } });

    const res = await POST(
      buildRequest({ type: "electoral", name: "X", pestelProjectId: "pPropio" })
    );

    expect(res.status).toBe(201);
  });
});
