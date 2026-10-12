// H25 (commit 6c) — acknowledge-bias hacía DOS `update` seguidos (la lista de alertas y, si todas
// estaban reconocidas, `status: "REVIEWED"`): si el segundo fallaba tras el primero, el sesgo quedaba
// reconocido y el estado no cambiaba. El 500 se trata como ambiguo en la pantalla.
// EDITADO DELIBERADAMENTE EN 7b-3: la prueba «reconoce el único sesgo pendiente» documentaba ese
// defecto (esperaba DOS escrituras); ahora la ruta usa UNA transacción con UN solo `update`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ analysisId: "a1" }) };
const req = (biasType?: string) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ biasType }) }) as never;
const siembra = (alertas: Array<Record<string, unknown>>) => ({
  "pestel_analyses/a1": { projectId: "p1", biasAlerts: alertas },
  "pestel_projects/p1": { userId: "u1" },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("POST acknowledge-bias", () => {
  it("reconoce el único sesgo pendiente: UNA sola escritura (alertas, updatedAt y status REVIEWED)", async () => {
    mockDb.reset({ ...siembra([{ type: "urbano" }]), "pestel_analyses/a1": { projectId: "p1", status: "PENDING_REVIEW", biasAlerts: [{ type: "urbano" }] } });
    const res = await POST(req("urbano"), ctx);
    expect(res.status).toBe(200);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0].data.biasAlerts).toBeDefined();
    expect(u[0].data.status).toBe("REVIEWED");
    expect(u[0].data.updatedAt).toBe("SERVER_TIMESTAMP");
  });

  it("quedan sesgos pendientes: UNA sola escritura (sin REVIEWED)", async () => {
    mockDb.reset(siembra([{ type: "urbano" }, { type: "etario" }]));
    expect((await POST(req("urbano"), ctx)).status).toBe(200);
    expect(mockDb.updates()).toHaveLength(1);
  });

  it("sesgo inexistente: 404 sin escrituras; ajeno: 403; sin sesión: 401; sin biasType: 400", async () => {
    mockDb.reset(siembra([{ type: "urbano" }]));
    expect((await POST(req("otro"), ctx)).status).toBe(404);
    expect(mockDb.updates()).toHaveLength(0);
    mockDb.reset({ ...siembra([{ type: "urbano" }]), "pestel_projects/p1": { userId: "otro" } });
    expect((await POST(req("urbano"), ctx)).status).toBe(403);
    mockDb.reset(siembra([{ type: "urbano" }]));
    expect((await POST(req(undefined), ctx)).status).toBe(400);
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await POST(req("urbano"), ctx)).status).toBe(401);
  });
});
