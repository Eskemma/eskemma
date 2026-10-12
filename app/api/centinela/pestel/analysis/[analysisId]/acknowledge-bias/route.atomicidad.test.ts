// H25 (7b-3) — acknowledge-bias en UNA transacción con UN solo update. Mock «todo o nada» (modela la
// garantía; no la demuestra: no hay emulador). [real] = FALLA contra la ruta anterior; [local] = pasa en ambas.

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
const req = (biasType = "urbano") => new Request("http://local/x", { method: "POST", body: JSON.stringify({ biasType }) }) as never;
const siembra = (alertas: Array<Record<string, unknown>>, status = "PENDING_REVIEW") => ({
  "pestel_analyses/a1": { projectId: "p1", status, biasAlerts: alertas },
  "pestel_projects/p1": { userId: "u1" },
});
const analisis = () => mockDb.snapshot()["pestel_analyses/a1"] as { status: string; biasAlerts: Array<Record<string, unknown>> };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("acknowledge-bias — una sola escritura atómica", () => {
  it("[real] reconocer el último: UNA transacción y UN update con alertas, updatedAt y status REVIEWED", async () => {
    mockDb.reset(siembra([{ type: "urbano" }]));
    mockDb.atomico(true);
    expect((await POST(req(), ctx)).status).toBe(200);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0].data).toMatchObject({ updatedAt: "TS", status: "REVIEWED" });
    expect(u[0].data.biasAlerts).toBeDefined();
  });

  it("[local] con pendientes: un update SIN el campo status (la ruta anterior también)", async () => {
    mockDb.reset(siembra([{ type: "urbano" }, { type: "etario" }]));
    mockDb.atomico(true);
    await POST(req(), ctx);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect("status" in u[0].data).toBe(false);
  });

  it("[real] NUNCA baja un APPROVED: reconocer de nuevo en un análisis aprobado conserva APPROVED", async () => {
    mockDb.reset(siembra([{ type: "urbano", acknowledgedAt: "x", acknowledgedBy: "o" }], "APPROVED"));
    mockDb.atomico(true);
    expect((await POST(req(), ctx)).status).toBe(200);
    expect(analisis().status).toBe("APPROVED");
    expect("status" in mockDb.updates()[0].data).toBe(false);
  });

  it("[real] un análisis ya REVIEWED tampoco se reescribe a REVIEWED (solo PENDING_REVIEW pasa a REVIEWED)", async () => {
    mockDb.reset(siembra([{ type: "urbano" }], "REVIEWED"));
    mockDb.atomico(true);
    await POST(req(), ctx);
    expect(mockDb.updates()).toHaveLength(1);
    expect(mockDb.updates().some((u) => "status" in u.data)).toBe(false);
    expect(analisis().status).toBe("REVIEWED");
  });

  it("[real] cuerpo inválido: 400 «JSON inválido» (antes un 500 sin código), sin escrituras", async () => {
    mockDb.reset(siembra([{ type: "urbano" }]));
    const r = await POST(new Request("http://local/x", { method: "POST", body: "{no" }) as never, ctx);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "JSON inválido" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[real] dos reconocimientos simultáneos: el 2.º no pisa al 1.º (relee el análisis dentro de la transacción)", async () => {
    mockDb.reset(siembra([{ type: "urbano" }, { type: "etario" }]));
    mockDb.atomico(true);
    // «Otra petición» reconoce `etario` en el hueco entre las lecturas previas y la escritura.
    const conCarrera = {
      json: async () => {
        await mockDb.collection("pestel_analyses").doc("a1").update({
          biasAlerts: [{ type: "urbano" }, { type: "etario", acknowledgedAt: "y", acknowledgedBy: "otro" }],
        });
        return { biasType: "urbano" };
      },
    } as never;
    expect((await POST(conCarrera, ctx)).status).toBe(200);
    const al = analisis().biasAlerts;
    expect(al[0]).toMatchObject({ type: "urbano", acknowledgedBy: "u1" });
    expect(al[1]).toMatchObject({ type: "etario", acknowledgedBy: "otro" });
    expect(analisis().status).toBe("REVIEWED");
  });

  it("[local] si falla la escritura del análisis, no queda nada escrito", async () => {
    mockDb.reset(siembra([{ type: "urbano" }]));
    mockDb.atomico(true);
    mockDb.failUpdateOn("pestel_analyses/a1");
    await expect(POST(req(), ctx)).rejects.toThrow();
    expect(mockDb.updates()).toHaveLength(0);
    expect(analisis().status).toBe("PENDING_REVIEW");
  });
});
