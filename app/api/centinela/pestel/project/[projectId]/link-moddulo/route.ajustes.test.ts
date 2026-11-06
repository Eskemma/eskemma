// link-moddulo (T3, D3): al vincular, el M1 nace CON los ajustes del analista del análisis vigente.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const NAC = { nivel: "nacional", nombre: "México" };
const vincular = async (analisis: Record<string, unknown>) => {
  db.reset({
    "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: NAC },
    "moddulo_projects/m1": { name: "M", type: "electoral", territorio: NAC, xpcto: { hito: "h" }, phases: { exploracion: {} } },
    "pestel_analyses/a1": { status: "APPROVED", projectId: "pest1", analyzedAt: "2026-10-01T00:00:00Z", ...analisis },
  });
  db.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: "m1" }) }) as never, { params: Promise.resolve({ projectId: "pest1" }) });
  const linked = db.updates().find((u) => u.path === "moddulo_projects/m1")?.data["phases.exploracion.linkedSource"] as { payload?: Record<string, any> } | undefined;
  return { status: r.status, payload: linked?.payload };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("link-moddulo — ajustes del analista (T3)", () => {
  it("el payload trae la clasificación ajustada y el `ajuste`", async () => {
    const r = await vincular({
      dimensions: [{ code: "P", classification: "AMENAZA", narrative: "n", confidence: 70 }],
      adjustments: [{ dimensionCode: "P", originalClassification: "AMENAZA", newClassification: "NEUTRAL", justification: "Matiz importante del analista", adjustedAt: "2026-10-20T15:00:00.000Z" }],
    });
    expect(r.status).toBe(201);
    expect(r.payload?.P.clasificacion).toBe("NEUTRAL");
    expect(r.payload?.P.ajuste).toMatchObject({ clasificacionOriginal: "AMENAZA", clasificacionAjustada: "NEUTRAL" });
  });
  it("sin ajustes, igual que antes (sin la clave `ajuste`)", async () => {
    const r = await vincular({ dimensions: [{ code: "P", classification: "AMENAZA", narrative: "n" }] });
    expect(r.payload?.P.clasificacion).toBe("AMENAZA");
    expect(Object.prototype.hasOwnProperty.call(r.payload?.P, "ajuste")).toBe(false);
  });
});
