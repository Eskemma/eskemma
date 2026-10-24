// POST /api/moddulo/projects (T2, 1b): el 409 de «PESTEL ya vinculado» trae un código estable
// (`pestel_already_linked`, el mismo de link-moddulo/import-pestel) además del texto de siempre en `error`.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "TS", delete: () => "DEL" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;

describe("POST /api/moddulo/projects — 409 con código", () => {
  beforeEach(() => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: "u1" }));
    db.reset({
      "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" },
      "moddulo_projects/m1": { phases: {} },
    });
  });

  it("PESTEL ya vinculado a un Moddulo existente: 409 con el texto de siempre y codigo pestel_already_linked", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ type: "electoral", name: "N", pestelProjectId: "p1" }) }) as never
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Este proyecto de PESTEL ya está vinculado a otro proyecto de Moddulo.",
      codigo: "pestel_already_linked",
    });
  });
});
