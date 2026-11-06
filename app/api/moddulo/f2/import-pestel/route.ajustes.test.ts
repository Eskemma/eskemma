// import-pestel (T3, D3): el análisis se importa CON los ajustes del analista (clasificación ajustada + `ajuste`).
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
const dimensiones = [
  { code: "P", classification: "AMENAZA", narrative: "Narrativa IA", confidence: 70 },
  { code: "E", classification: "NEUTRAL", narrative: "n", confidence: 60 },
];
const ajustes = [
  { dimensionCode: "P", originalClassification: "AMENAZA", newClassification: "OPORTUNIDAD", justification: "Cambió el contexto local", adjustedAt: "2026-10-20T15:00:00.000Z", adjustedBy: "u1", originalPosition: { x: 75, y: 85 }, newPosition: { x: 40, y: 20 } },
];
const importar = async (analisis: Record<string, unknown>) => {
  db.reset({
    "pestel_analyses/a1": { status: "APPROVED", projectId: "pest1", ...analisis },
    "pestel_projects/pest1": { userId: "u1" },
    "moddulo_projects/p1": { phases: { exploracion: {} } },
  });
  db.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => ({ id, xpcto: {}, phases: (db.snapshot()[`moddulo_projects/${id}`] as { phases?: unknown })?.phases ?? {} }) as never);
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", pestAnalysisId: "a1" }) }) as never);
  const linked = db.updates().find((u) => u.path === "moddulo_projects/p1")?.data["phases.exploracion.linkedSource"] as { payload: Record<string, any> } | undefined;
  return { status: r.status, payload: linked?.payload };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("import-pestel — ajustes del analista (T3)", () => {
  it("el payload trae la clasificación ajustada y el `ajuste` de la dimensión ajustada; la otra no lo trae", async () => {
    const r = await importar({ dimensions: dimensiones, adjustments: ajustes });
    expect(r.status).toBe(200);
    expect(r.payload?.P.clasificacion).toBe("OPORTUNIDAD");
    expect(r.payload?.P.ajuste).toMatchObject({ clasificacionOriginal: "AMENAZA", clasificacionAjustada: "OPORTUNIDAD", justificacion: "Cambió el contexto local", ajustadoEn: "2026-10-20T15:00:00.000Z" });
    expect(Object.prototype.hasOwnProperty.call(r.payload?.E, "ajuste")).toBe(false);
  });
  it("un análisis sin ajustes se importa exactamente como antes", async () => {
    const r = await importar({ dimensions: dimensiones });
    expect(r.payload?.P.clasificacion).toBe("AMENAZA");
    expect(Object.prototype.hasOwnProperty.call(r.payload?.P, "ajuste")).toBe(false);
  });
});
