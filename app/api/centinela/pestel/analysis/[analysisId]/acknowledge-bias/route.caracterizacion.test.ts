// H25 (7b-3) — caracterización COMPLEMENTARIA de acknowledge-bias (la de 6c vive en route.test.ts).
// Escrita ANTES del refactor y verde contra el código anterior; debe seguir verde sin editarse.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ analysisId: "a1" }) };
const req = (biasType?: string) => new Request("http://local/x", { method: "POST", body: JSON.stringify({ biasType }) }) as never;
const siembra = (alertas: Array<Record<string, unknown>>, status = "PENDING_REVIEW") => ({
  "pestel_analyses/a1": { projectId: "p1", status, biasAlerts: alertas },
  "pestel_projects/p1": { userId: "u1" },
});
const estado = () => mockDb.snapshot()["pestel_analyses/a1"] as { status: string; biasAlerts: Array<Record<string, unknown>> };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("POST acknowledge-bias — caracterización", () => {
  it("cuerpos de error: 404 análisis, 403 sin permisos, 400 sin biasType, 404 alerta", async () => {
    mockDb.reset({});
    const a = await POST(req("x"), ctx);
    expect(a.status).toBe(404);
    expect(await a.json()).toEqual({ error: "Análisis no encontrado" });
    mockDb.reset({ ...siembra([{ type: "urbano" }]), "pestel_projects/p1": { userId: "otro" } });
    const b = await POST(req("urbano"), ctx);
    expect(b.status).toBe(403);
    expect(await b.json()).toEqual({ error: "Sin permisos" });
    mockDb.reset(siembra([{ type: "urbano" }]));
    const c = await POST(req(undefined), ctx);
    expect(c.status).toBe(400);
    expect(await c.json()).toEqual({ error: "biasType es requerido" });
    const d = await POST(req("otro"), ctx);
    expect(d.status).toBe(404);
    expect(await d.json()).toEqual({ error: "Alerta de sesgo no encontrada" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("reconoce con fecha y autor y responde {ok:true}; con pendientes el status NO cambia", async () => {
    mockDb.reset(siembra([{ type: "urbano" }, { type: "etario" }]));
    const r = await POST(req("urbano"), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const al = estado().biasAlerts;
    expect(al[0]).toMatchObject({ type: "urbano", acknowledgedBy: "u1" });
    expect(typeof al[0].acknowledgedAt).toBe("string");
    expect(al[1]).toEqual({ type: "etario" });
    expect(estado().status).toBe("PENDING_REVIEW");
  });

  it("al reconocer el último, el análisis pasa a REVIEWED", async () => {
    mockDb.reset(siembra([{ type: "urbano" }, { type: "etario", acknowledgedAt: "x", acknowledgedBy: "o" }]));
    expect((await POST(req("urbano"), ctx)).status).toBe(200);
    expect(estado().status).toBe("REVIEWED");
  });

  it("re-reconocer una alerta ya reconocida SOBRESCRIBE fecha y autor (se deja como hoy)", async () => {
    mockDb.reset(siembra([{ type: "urbano", acknowledgedAt: "vieja", acknowledgedBy: "otro" }, { type: "etario" }]));
    expect((await POST(req("urbano"), ctx)).status).toBe(200);
    expect(estado().biasAlerts[0]).toMatchObject({ acknowledgedBy: "u1" });
    expect(estado().biasAlerts[0].acknowledgedAt).not.toBe("vieja");
  });
});
