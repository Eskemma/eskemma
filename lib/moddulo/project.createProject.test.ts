// lib/moddulo/project.createProject.test.ts
// Regression for the cross-tenant write in createProject (found 26-09-23):
// pestelProjectId came from the request body and was used with the Admin SDK
// to (a) persist a linkedSource and (b) write modduloProjectId into
// pestel_projects/{id}, without checking that the PESTEL project belonged to
// the caller. The guard reads pestel_projects/{id} first and requires
// userId === caller. Same mocking pattern as
// app/api/centinela/pestel/project/route.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { adminDb } from "@/lib/firebase-admin";
import { createProject, PestelProjectNoPropioError } from "./project";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;

const UID = "uidA";
const OTHER_UID = "uidVictima";
const base = { type: "electoral" as const, name: "Proyecto de prueba" };

function moddulosEnStore() {
  return Object.keys(mockAdminDb.snapshot()).filter((p) => p.startsWith("moddulo_projects/"));
}

describe("createProject — guard de pestelProjectId", () => {
  beforeEach(() => {
    mockAdminDb.reset();
  });

  it("rechaza un pestelProjectId de otro usuario y NO escribe nada", async () => {
    mockAdminDb.reset({ "pestel_projects/pVictima": { userId: OTHER_UID, nombre: "Ajeno" } });
    const antes = mockAdminDb.snapshot();

    await expect(
      createProject(UID, { ...base, pestelProjectId: "pVictima" })
    ).rejects.toBeInstanceOf(PestelProjectNoPropioError);

    // Ni proyecto Moddulo nuevo ni write-back sobre el PESTEL ajeno.
    expect(moddulosEnStore()).toEqual([]);
    expect(mockAdminDb.snapshot()).toEqual(antes);
    expect(
      (mockAdminDb.snapshot()["pestel_projects/pVictima"] as Record<string, unknown>).modduloProjectId
    ).toBeUndefined();
  });

  it("rechaza un pestelProjectId inexistente sin escribir nada", async () => {
    await expect(
      createProject(UID, { ...base, pestelProjectId: "noExiste" })
    ).rejects.toBeInstanceOf(PestelProjectNoPropioError);
    expect(mockAdminDb.snapshot()).toEqual({});
  });

  it("con un pestelProjectId propio crea el proyecto, el linkedSource y el write-back", async () => {
    mockAdminDb.reset({ "pestel_projects/pPropio": { userId: UID, nombre: "Mio" } });

    const project = await createProject(UID, {
      ...base,
      pestelProjectId: "pPropio",
      pestAnalysisId: "an1",
    });

    expect(project.userId).toBe(UID);
    const linked = (project.phases.exploracion as unknown as Record<string, unknown>).linkedSource;
    expect(linked).toMatchObject({ kind: "T22", sourceId: "pPropio", sourceAnalysisId: "an1" });
    expect(
      (mockAdminDb.snapshot()["pestel_projects/pPropio"] as Record<string, unknown>).modduloProjectId
    ).toBe(project.id);
  });

  it("sin pestelProjectId no lee pestel_projects y crea el proyecto normal", async () => {
    mockAdminDb.collection.mockClear();

    const project = await createProject(UID, base);

    expect(project.name).toBe("Proyecto de prueba");
    expect(moddulosEnStore()).toHaveLength(1);
    const colecciones = mockAdminDb.collection.mock.calls.map((c) => c[0]);
    expect(colecciones).not.toContain("pestel_projects");
  });
});
