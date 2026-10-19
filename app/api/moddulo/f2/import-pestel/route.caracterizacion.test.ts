// import-pestel: qué escribe en un proyecto Moddulo. Escrita como caracterización ANTES de que los escritores
// de M1 dejaran el proyecto como «M1 nuevo en borrador» (verde contra el código anterior: no tocaba m1 ni
// draftDVS); las dos pruebas marcadas «EDITADA» se invirtieron a propósito con ese cambio (paso 3 de 3b).

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

type Db = { reset(d?: Record<string, unknown>): void; updates(): Array<{ path: string; data: Record<string, unknown> }> };
const db = adminDb as unknown as Db;
const llamar = async (cuerpo: Record<string, unknown>) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const proyecto = (exploracion: Record<string, unknown> = {}) => ({ id: "p1", xpcto: { hito: "h" }, phases: { exploracion } });

// Paso 4: the write is a transaction that re-reads the project document, so the stored document and
// getProject describe the same state.
const sembrar = (exploracion: Record<string, unknown> = {}) => {
  vi.mocked(getProject).mockResolvedValue(proyecto(exploracion) as never);
  db.reset({
    "pestel_analyses/a1": { projectId: "pest1", dimensions: [] },
    "pestel_projects/pest1": { userId: "u1" },
    "moddulo_projects/p1": { phases: { exploracion } },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  db.reset({
    "pestel_analyses/a1": { projectId: "pest1", dimensions: [] },
    "pestel_projects/pest1": { userId: "u1" },
  });
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("import-pestel — lo que escribe", () => {
  it("EDITADA — proyecto sin M1: escribe el vínculo T22, el snapshot de XPCTO, un M1 nuevo en borrador (m1 con creadoEn), vacía las aprobaciones y el borrador de motores, y borra el puntero de deshacer", async () => {
    sembrar();
    const r = await llamar({ projectId: "p1", pestAnalysisId: "a1" });
    expect(r.status).toBe(200);
    const w = db.updates().filter((u) => u.path === "moddulo_projects/p1");
    expect(w).toHaveLength(1);
    const d = w[0].data;
    expect(Object.keys(d).sort()).toEqual([
      "phases.exploracion.draftDVS",
      "phases.exploracion.linkedSource",
      "phases.exploracion.m1",
      "phases.exploracion.lastUnlinkedLinkedSource",
      "phases.exploracion.motorAprobaciones",
      "phases.exploracion.xpctoSnapshotAtGeneration",
      "updatedAt",
    ].sort());
    expect(d["phases.exploracion.linkedSource"]).toMatchObject({ kind: "T22", sourceId: "pest1", sourceAnalysisId: "a1" });
    expect(d["phases.exploracion.motorAprobaciones"]).toEqual({});
    expect(d["phases.exploracion.m1"]).toEqual({ creadoEn: "TS" });
    expect(d["phases.exploracion.draftDVS"]).toBe("__DELETE__");
  });

  it("EDITADA (paso 4) — en un proyecto «anterior» (con borrador y Reporte F2) pide UNA confirmación; confirmada, deja un M1 nuevo en borrador y descarta el borrador de motores, pero NO toca el Reporte F2 (dvs)", async () => {
    sembrar({ dvs: { x: 1 }, draftDVS: { y: 1 }, linkedSource: { kind: "express", sourceId: "p1", payload: { P: {} } } });
    const pide = await llamar({ projectId: "p1", pestAnalysisId: "a1" });
    expect(pide.status).toBe(409);
    expect(pide.cuerpo.error).toBe("conflict");
    expect(db.updates()).toEqual([]);
    await llamar({ projectId: "p1", pestAnalysisId: "a1", confirmar: true, huella: pide.cuerpo.huella });
    const d = db.updates().find((u) => u.path === "moddulo_projects/p1")!.data;
    expect(d).not.toHaveProperty("phases.exploracion.dvs");
    expect(d["phases.exploracion.m1"]).toEqual({ creadoEn: "TS" });
    expect(d["phases.exploracion.draftDVS"]).toBe("__DELETE__");
    expect(d["phases.exploracion.motorAprobaciones"]).toEqual({});
  });

  it("el mismo análisis ya importado responde 200 sin escribir", async () => {
    sembrar({ linkedSource: { kind: "T22", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } } });
    const r = await llamar({ projectId: "p1", pestAnalysisId: "a1" });
    expect(r.status).toBe(200);
    expect(db.updates().filter((u) => u.path === "moddulo_projects/p1")).toHaveLength(0);
  });
});
