// app/api/moddulo/projects/[projectId]/restore/route.test.ts
// Papelera de proyectos de Moddulo — fase (b): PATCH .../restore es owner-only,
// con 404 idéntico para ajeno/inexistente/no-en-papelera (anti-enumeración).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { PATCH } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const OWNER = "uidOwner";
const COLLAB = "uidColaborador";
const OTHER = "uidAjeno";

function req() {
  return new Request("http://local/api/moddulo/projects/p1/restore", { method: "PATCH" }) as never;
}

function params(projectId: string) {
  return { params: Promise.resolve({ projectId }) };
}

beforeEach(() => {
  mockAdminDb.reset();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: OWNER } as never);
});

describe("PATCH .../restore", () => {
  it("el dueño restaura un proyecto en papelera → 200", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        collaborators: [{ uid: OWNER, role: "owner" }],
        deletedAt: "TS",
      },
    });
    const res = await PATCH(req(), params("p1"));
    expect(res.status).toBe(200);
    expect(
      (mockAdminDb.snapshot()["moddulo_projects/p1"] as Record<string, unknown>).deletedAt
    ).toBe("FIELD_DELETE");
  });

  it("un colaborador no-owner → 403", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: COLLAB } as never);
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        collaborators: [{ uid: OWNER, role: "owner" }, { uid: COLLAB, role: "analyst" }],
        deletedAt: "TS",
      },
    });
    const res = await PATCH(req(), params("p1"));
    expect(res.status).toBe(403);
  });

  it("proyecto ajeno → 404 (mismo mensaje que inexistente/no-en-papelera)", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: OTHER } as never);
    mockAdminDb.reset({
      "moddulo_projects/p1": { userId: OWNER, collaborators: [{ uid: OWNER, role: "owner" }], deletedAt: "TS" },
    });
    const res = await PATCH(req(), params("p1"));
    expect(res.status).toBe(404);
  });

  it("proyecto inexistente → 404", async () => {
    const res = await PATCH(req(), params("noExiste"));
    expect(res.status).toBe(404);
  });

  it("proyecto activo (no en papelera) → 404, aunque el usuario sea dueño", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": { userId: OWNER, collaborators: [{ uid: OWNER, role: "owner" }] },
    });
    const res = await PATCH(req(), params("p1"));
    expect(res.status).toBe(404);
  });

  it("sin sesión → 401", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    const res = await PATCH(req(), params("p1"));
    expect(res.status).toBe(401);
  });
});
