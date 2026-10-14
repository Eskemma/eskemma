// H25 (commit 7b-6a) — CARACTERIZACIÓN de createProject, escrita ANTES del refactor y verde contra el
// código anterior: forma exacta del documento creado (con y sin PESTEL), el write-back y el valor de
// retorno. Debe seguir verde SIN editar tras volver atómico el camino con pestelProjectId.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { adminDb } from "@/lib/firebase-admin";
import { createProject } from "./project";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidA";
const base = { type: "electoral" as const, name: "Proyecto de prueba" };
const territorio = { nivel: "estatal" as const, nombre: "Jalisco", estado: "Jalisco", pais: "México" };

const moddulos = () =>
  Object.entries(mockDb.snapshot()).filter(([p]) => p.startsWith("moddulo_projects/")) as Array<[string, Record<string, any>]>;

beforeEach(() => mockDb.reset());

describe("createProject — caracterización (código anterior)", () => {
  it("con PESTEL: forma exacta del documento (linkedSource T22/centinela, pestelProjectId, owner)", async () => {
    mockDb.reset({ "pestel_projects/pP": { userId: UID } });
    const project = await createProject(UID, { ...base, pestelProjectId: "pP", pestAnalysisId: "an1", territorio });
    const [[ruta, doc]] = moddulos();
    expect(moddulos()).toHaveLength(1);
    expect(project.id).toBe(ruta.split("/")[1]);
    expect(doc).toMatchObject({
      userId: UID, type: "electoral", name: "Proyecto de prueba", description: "", currentPhase: "proposito",
      status: "draft", color: "#026988", pestelProjectId: "pP", territorio,
      settings: { aiLevel: "balanced", language: "es" },
      createdAt: "SERVER_TIMESTAMP", updatedAt: "SERVER_TIMESTAMP", lastAccessedAt: "SERVER_TIMESTAMP",
    });
    expect(doc.phases.exploracion.linkedSource).toEqual({ kind: "T22", componente: "centinela", sourceId: "pP", sourceAnalysisId: "an1" });
    expect(doc.collaborators).toEqual([{ uid: UID, email: "", role: "owner", addedAt: expect.any(String), addedBy: UID }]);
    expect(Object.keys(doc.phases).sort()).toEqual(
      ["diagnostico", "estrategia", "evaluacion", "exploracion", "gerencia", "investigacion", "proposito", "seguimiento", "tactica"]
    );
  });

  it("con PESTEL y sin pestAnalysisId: linkedSource SIN sourceAnalysisId", async () => {
    mockDb.reset({ "pestel_projects/pP": { userId: UID } });
    await createProject(UID, { ...base, pestelProjectId: "pP" });
    expect(moddulos()[0][1].phases.exploracion.linkedSource).toEqual({ kind: "T22", componente: "centinela", sourceId: "pP" });
  });

  it("el write-back al PESTEL escribe modduloProjectId (id del Moddulo creado) y updatedAt", async () => {
    mockDb.reset({ "pestel_projects/pP": { userId: UID, nombre: "N" } });
    const project = await createProject(UID, { ...base, pestelProjectId: "pP" });
    expect(mockDb.updates().filter((u) => u.path === "pestel_projects/pP")).toEqual([
      { path: "pestel_projects/pP", data: { modduloProjectId: project.id, updatedAt: "SERVER_TIMESTAMP" } },
    ]);
    expect(mockDb.snapshot()["pestel_projects/pP"]).toMatchObject({ userId: UID, nombre: "N", modduloProjectId: project.id });
  });

  it("retorna { id, ...datos del documento }", async () => {
    mockDb.reset({ "pestel_projects/pP": { userId: UID } });
    const project = await createProject(UID, { ...base, pestelProjectId: "pP" });
    expect(project).toMatchObject({ id: expect.any(String), userId: UID, name: "Proyecto de prueba", pestelProjectId: "pP" });
  });

  it("sin PESTEL: documento sin pestelProjectId ni linkedSource, y sin tocar pestel_projects", async () => {
    const project = await createProject(UID, { ...base, color: "#112233" });
    const [[, doc]] = moddulos();
    expect(doc).not.toHaveProperty("pestelProjectId");
    expect(doc.phases.exploracion?.linkedSource).toBeUndefined();
    expect(doc.color).toBe("#112233");
    expect(project.id).toEqual(expect.any(String));
    expect(mockDb.updates()).toHaveLength(0);
  });
});
