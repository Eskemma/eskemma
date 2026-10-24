// Caracterización (verde contra el código actual, ruta sin cambios): lo que hace PUT /variables sobre un
// PESTEL que YA tiene variables y análisis aprobado. Es el efecto que el asistente «Nuevo proyecto»
// provocaba con el 200 del dedup (commit 1a): reemplaza el documento de variables completo, y no toca
// el análisis ni baja la etapa.
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
import { PUT } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidA";
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const dims = (v: string) =>
  ["P", "E", "S", "T", "Ec", "L"].map((code) => ({ code, variables: [{ id: v, label: v }] }));
const req = (v: string) =>
  new Request("http://x", { method: "PUT", body: JSON.stringify({ dimensions: dims(v) }) }) as unknown as Parameters<typeof PUT>[0];

describe("PUT /variables sobre un PESTEL con variables y análisis aprobado", () => {
  beforeEach(() => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    db.reset({
      "pestel_projects/pest1": { userId: UID, currentStage: 7 },
      "pestel_variable_configs/pest1": { projectId: "pest1", dimensions: dims("original") },
      "pestel_analyses/a1": { projectId: "pest1", status: "APPROVED", vigente: true },
    });
  });

  it("reemplaza las variables guardadas por completo", async () => {
    const res = await PUT(req("nueva"), ctx);
    expect(res.status).toBe(200);
    const cfg = (await db.collection("pestel_variable_configs").doc("pest1").get()).data() as { dimensions: { variables: { id: string }[] }[] };
    expect(cfg.dimensions[0].variables[0].id).toBe("nueva");
  });

  it("no toca el análisis (status/vigente) ni baja la etapa", async () => {
    await PUT(req("nueva"), ctx);
    const a = (await db.collection("pestel_analyses").doc("a1").get()).data();
    expect(a).toEqual({ projectId: "pest1", status: "APPROVED", vigente: true });
    const p = (await db.collection("pestel_projects").doc("pest1").get()).data() as { currentStage: number };
    expect(p.currentStage).toBe(7);
  });
});
