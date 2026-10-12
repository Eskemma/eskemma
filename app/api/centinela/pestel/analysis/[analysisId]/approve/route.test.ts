// H25 (7b-3) — caracterización de POST approve (PESTEL). Escrita ANTES del refactor a transacción y verde
// contra el código anterior. Debe seguir verde sin editarse, salvo las 2 pruebas marcadas [EDITADA EN 7b-3]: (1) análisis cuyo proyecto no existe, de «escribe APPROVED y
// lanza» a «404 sin escribir»; (2) el caso «ajeno» se siembra ahora con el DUEÑO DEL PROYECTO distinto (antes con la
// copia `userId` del análisis distinta): la propiedad pasó de la copia del análisis al proyecto (Q3 aprobada).

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
const ack = (type: string) => ({ type, acknowledgedAt: "2026-10-01T00:00:00Z", acknowledgedBy: "u1" });
const siembra = (alertas: unknown[] = [ack("urbano")], extra: Record<string, unknown> = {}) => ({
  "pestel_analyses/a1": { projectId: "p1", userId: "u1", status: "REVIEWED", biasAlerts: alertas, ...extra },
  "pestel_projects/p1": { userId: "u1", currentStage: 6 },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset(siembra());
});

describe("POST approve — respuestas", () => {
  it("401 sin sesión", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await POST(req(), ctx)).status).toBe(401);
  });

  it("[EDITADA EN 7b-3] 404 si el análisis no existe o es ajeno (mismo mensaje), sin escrituras", async () => {
    mockDb.reset({});
    const a = await POST(req(), ctx);
    expect(a.status).toBe(404);
    expect(await a.json()).toEqual({ error: "Análisis no encontrado" });
    // «Ajeno» = el proyecto es de otro usuario (antes se sembraba cambiando la copia `userId` del análisis).
    mockDb.reset({ ...siembra(), "pestel_projects/p1": { userId: "otro", currentStage: 6 } });
    const b = await POST(req(), ctx);
    expect(b.status).toBe(404);
    expect(await b.json()).toEqual({ error: "Análisis no encontrado" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("422 con alertas sin revisar: cuenta cuántas y no escribe", async () => {
    mockDb.reset(siembra([ack("urbano"), { type: "etario" }, { type: "digital" }]));
    const r = await POST(req(), ctx);
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({
      error: "Hay 2 alerta(s) de sesgo sin revisar. Márcalas como revisadas antes de aprobar.",
    });
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("POST approve — éxito", () => {
  it("200 {ok:true}: análisis APPROVED con autor y fecha, y el proyecto a la etapa 7", async () => {
    const r = await POST(req(), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const u = mockDb.updates();
    expect(u.map((x) => x.path).sort()).toEqual(["pestel_analyses/a1", "pestel_projects/p1"]);
    expect(u.find((x) => x.path === "pestel_analyses/a1")!.data).toEqual({ status: "APPROVED", approvedAt: "TS", approvedBy: "u1" });
    expect(u.find((x) => x.path === "pestel_projects/p1")!.data).toEqual({ currentStage: 7, updatedAt: "TS" });
  });

  it("sin biasAlerts aprueba igual", async () => {
    mockDb.reset({
      "pestel_analyses/a1": { projectId: "p1", userId: "u1", status: "REVIEWED" },
      "pestel_projects/p1": { userId: "u1" },
    });
    expect((await POST(req(), ctx)).status).toBe(200);
  });

  it("re-aprobación (ya APPROVED): vuelve a escribir y SOBRESCRIBE approvedAt/approvedBy (se deja como hoy)", async () => {
    mockDb.reset(siembra([ack("urbano")], { status: "APPROVED", approvedAt: "VIEJA", approvedBy: "u-anterior" }));
    const r = await POST(req(), ctx);
    expect(r.status).toBe(200);
    const a = mockDb.updates().find((x) => x.path === "pestel_analyses/a1")!.data;
    expect(a).toEqual({ status: "APPROVED", approvedAt: "TS", approvedBy: "u1" });
  });

  it("[EDITADA EN 7b-3] análisis cuyo proyecto no existe: ya no escribe APPROVED y lanza; responde 404 sin escribir nada", async () => {
    mockDb.reset({ "pestel_analyses/a1": { projectId: "p1", userId: "u1", status: "REVIEWED", biasAlerts: [ack("urbano")] } });
    mockDb.estricto(true);
    const r = await POST(req(), ctx);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Análisis no encontrado" });
    expect((mockDb.snapshot()["pestel_analyses/a1"] as { status: string }).status).toBe("REVIEWED");
    expect(mockDb.updates()).toHaveLength(0);
  });
});
