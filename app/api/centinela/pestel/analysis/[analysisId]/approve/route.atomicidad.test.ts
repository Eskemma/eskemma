// H25 (7b-3) — atomicidad de approve. Mock «todo o nada» (modela la garantía; no la demuestra: no hay
// emulador). [real] = FALLA contra la ruta anterior; [local] = pasa en ambas (no discrimina).

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
const req = () => new Request("http://local/x", { method: "POST" }) as never;
const ack = { type: "urbano", acknowledgedAt: "x", acknowledgedBy: "u1" };
const inicial = {
  "pestel_analyses/a1": { projectId: "p1", userId: "u1", status: "REVIEWED", biasAlerts: [ack] },
  "pestel_projects/p1": { userId: "u1", currentStage: 6 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset(structuredClone(inicial));
  mockDb.atomico(true);
});

describe("approve — todo o nada", () => {
  it("[real] si falla la escritura del proyecto, el análisis NO queda APPROVED", async () => {
    mockDb.failUpdateOn("pestel_projects/p1");
    await expect(POST(req(), ctx)).rejects.toThrow();
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("[local] si falla la escritura del análisis (la primera), el proyecto conserva su etapa", async () => {
    mockDb.failUpdateOn("pestel_analyses/a1");
    await expect(POST(req(), ctx)).rejects.toThrow();
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("[real] camino feliz: UNA transacción con las dos escrituras", async () => {
    const r = await POST(req(), ctx);
    expect(r.status).toBe(200);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockDb.updates().map((u) => u.path).sort()).toEqual(["pestel_analyses/a1", "pestel_projects/p1"]);
  });

  it("[real] análisis cuyo proyecto no existe: 404 «Análisis no encontrado» y NO se escribe nada (antes: APPROVED y luego 500)", async () => {
    mockDb.reset({ "pestel_analyses/a1": structuredClone(inicial["pestel_analyses/a1"]) });
    mockDb.atomico(true);
    mockDb.estricto(true);
    const r = await POST(req(), ctx);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Análisis no encontrado" });
    expect((mockDb.snapshot()["pestel_analyses/a1"] as { status: string }).status).toBe("REVIEWED");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[local] el 422 se decide con la lectura TRANSACCIONAL: una lectura previa vieja (todo reconocido) no aprueba un análisis con un sesgo pendiente", async () => {
    // El almacén tiene un sesgo sin reconocer; la ruta anterior también lo ve (lee directo), así que esta
    // prueba no discrimina contra ella: documenta que la decisión no usa la lectura previa de propiedad.
    mockDb.reset({
      "pestel_analyses/a1": { projectId: "p1", userId: "u1", status: "REVIEWED", biasAlerts: [ack, { type: "etario" }] },
      "pestel_projects/p1": { userId: "u1", currentStage: 6 },
    });
    mockDb.atomico(true);
    const r = await POST(req(), ctx);
    expect(r.status).toBe(422);
    expect(mockDb.updates()).toHaveLength(0);
  });
});
