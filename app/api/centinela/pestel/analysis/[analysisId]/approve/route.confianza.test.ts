// T6 (D2) — approve: con confianza global < 50 exige una justificación (20 a 1 000 caracteres) y la guarda;
// con ≥ 50 (o sin dato) todo queda como siempre. La caracterización de approve (route.test.ts) no se tocó.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS", delete: () => "__DELETE__" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ analysisId: "a1" }) };
const llamar = async (cuerpo?: unknown) => {
  const r = await POST(
    new Request("http://local/x", { method: "POST", ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }) }) as never,
    ctx
  );
  return { status: r.status, cuerpo: await r.json() };
};
const sembrar = (globalConfidence: unknown, extra: Record<string, unknown> = {}) =>
  db.reset({
    "pestel_analyses/a1": { projectId: "p1", userId: "u1", status: "REVIEWED", biasAlerts: [], globalConfidence, ...extra },
    "pestel_projects/p1": { userId: "u1", currentStage: 6 },
  });
const escrituras = () => db.updates().filter((u) => u.path === "pestel_analyses/a1");
const JUST = "Aprobamos con confianza baja porque el territorio tiene poca cobertura mediática.";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("POST approve — justificación con confianza < 50", () => {
  it("confianza 39 sin justificación: 422 con código y texto fijo, sin escrituras", async () => {
    sembrar(39);
    const r = await llamar();
    expect(r.status).toBe(422);
    expect(r.cuerpo.codigo).toBe("justificacion_requerida");
    expect(r.cuerpo.error).toContain("confianza global menor a 50");
    expect(db.updates()).toEqual([]);
  });
  it("justificación corta, vacía o de solo espacios: 422", async () => {
    sembrar(39);
    for (const j of ["corta", "", "   "]) expect((await llamar({ justificacion: j })).status).toBe(422);
    expect(db.updates()).toEqual([]);
  });
  it("justificación de más de 1 000 caracteres: 422 con el conteo", async () => {
    sembrar(39);
    const r = await llamar({ justificacion: "x".repeat(1001) });
    expect(r.status).toBe(422);
    expect(r.cuerpo.error).toBe("La justificación no puede superar 1 000 caracteres (tiene 1001). Acórtala.");
  });
  it("con justificación válida aprueba y guarda justificación (recortada), confianza, quién y cuándo", async () => {
    sembrar(39);
    expect((await llamar({ justificacion: `  ${JUST}  ` })).status).toBe(200);
    const w = escrituras();
    expect(w).toHaveLength(1);
    expect(w[0].data).toEqual({
      status: "APPROVED",
      approvedAt: "TS",
      approvedBy: "u1",
      aprobacionJustificacion: JUST,
      aprobacionConfianza: 39,
    });
  });
  it("el 422 de sesgos sin revisar sigue yendo primero", async () => {
    sembrar(39, { biasAlerts: [{ type: "urbano" }] });
    expect((await llamar({ justificacion: JUST })).cuerpo.error).toContain("sin revisar");
  });
  it("confianza exactamente 50, mayor, ausente o no numérica: no pide justificación y no guarda campos nuevos (payload de siempre)", async () => {
    for (const c of [50, 62, undefined, "alta"]) {
      sembrar(c);
      expect((await llamar()).status).toBe(200);
      expect(Object.keys(escrituras()[0].data).sort()).toEqual(["approvedAt", "approvedBy", "status"]);
    }
  });
  it("un cuerpo con justificación pero confianza ≥ 50 la ignora (no se guarda)", async () => {
    sembrar(80);
    await llamar({ justificacion: JUST });
    expect(escrituras()[0].data).not.toHaveProperty("aprobacionJustificacion");
  });
});
