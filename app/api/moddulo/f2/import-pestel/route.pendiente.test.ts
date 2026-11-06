// import-pestel (T5): importar el análisis del PESTEL pendiente de ESTE Moddulo funciona; importar el de OTRO PESTEL
// cuando ya hay uno pendiente se rechaza con `moddulo_con_pendiente`.
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
const llamar = async (pestAnalysisId: string) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "m1", pestAnalysisId }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const sembrar = () => {
  db.reset({
    "pestel_analyses/anA": { status: "APPROVED", projectId: "pestA", dimensions: [], adjustments: [] },
    "pestel_analyses/anB": { status: "APPROVED", projectId: "pestB", dimensions: [], adjustments: [] },
    "pestel_projects/pestA": { userId: "u1", modduloProjectId: "m1" }, // el PENDIENTE de este Moddulo
    "pestel_projects/pestB": { userId: "u1" },
    "moddulo_projects/m1": { phases: { exploracion: {} } },
  });
  db.atomico(true);
  vi.mocked(getProject).mockResolvedValue({ id: "m1", xpcto: {}, phases: { exploracion: {} } } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("import-pestel — pendiente (T5)", () => {
  it("el análisis del PESTEL pendiente de este Moddulo se importa (el back-link ya apunta aquí)", async () => {
    sembrar();
    const r = await llamar("anA");
    expect(r.status).toBe(200);
    expect(r.cuerpo.linkedSource).toMatchObject({ kind: "T22", sourceId: "pestA", sourceAnalysisId: "anA" });
  });

  it("[real] el análisis de OTRO PESTEL mientras hay un pendiente: 409 moddulo_con_pendiente, sin escribir", async () => {
    sembrar();
    const r = await llamar("anB");
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("moddulo_con_pendiente");
    expect(r.cuerpo.message).toContain("«Cancelar vínculo pendiente»");
    expect(db.updates()).toEqual([]);
  });
});
