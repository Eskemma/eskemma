// app/api/moddulo/f2/find-linked-pestel/route.test.ts
// Fase (a) de la papelera (26-09-28): la rama "repair" (modo 1, por modduloProjectId)
// escribía sobre moddulo_projects/{modduloProjectId} sin verificar que exista, sea del
// usuario, o no esté en papelera. Ahora pasa por getProject (mismo guard que ~35 puntos
// del código), que además excluye deletedAt.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  Timestamp: {},
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { GET } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidDueno";

function req(qs: string) {
  return new Request(`http://local/api/moddulo/f2/find-linked-pestel?${qs}`) as never;
}

beforeEach(() => {
  mockAdminDb.reset();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: UID } as never);
});

describe("find-linked-pestel — modo 1 (repair): guard de propiedad/papelera", () => {
  it("con un proyecto Moddulo propio y activo, sí repara el linkedSource", async () => {
    mockAdminDb.reset({
      "pestel_projects/pest1": { userId: UID, modduloProjectId: "m1", currentStage: 5 },
      "moddulo_projects/m1": {
        userId: UID,
        collaborators: [{ uid: UID, role: "owner" }],
        phases: { exploracion: {} },
      },
    });
    const res = await GET(req("moddulo_project_id=m1"));
    const json = await res.json();
    expect(json).toMatchObject({ found: true, sourceId: "pest1" });
    // Nota: el mock de adminDb no expande paths con puntos como campos anidados
    // (a diferencia de Firestore real) — guarda la clave literal con puntos.
    expect(
      (mockAdminDb.snapshot()["moddulo_projects/m1"] as Record<string, unknown>)[
        "phases.exploracion.linkedSource.sourceId"
      ]
    ).toBe("pest1");
  });

  it("con el proyecto Moddulo en papelera, encuentra el lado PESTEL pero NO escribe el repair", async () => {
    mockAdminDb.reset({
      "pestel_projects/pest1": { userId: UID, modduloProjectId: "m1", currentStage: 5 },
      "moddulo_projects/m1": {
        userId: UID,
        collaborators: [{ uid: UID, role: "owner" }],
        deletedAt: "TS",
        phases: { exploracion: {} },
      },
    });
    const res = await GET(req("moddulo_project_id=m1"));
    const json = await res.json();
    expect(json).toMatchObject({ found: true, sourceId: "pest1" });
    expect(
      (mockAdminDb.snapshot()["moddulo_projects/m1"] as { phases: { exploracion: Record<string, unknown> } })
        .phases.exploracion.linkedSource
    ).toBeUndefined();
  });

  it("con un proyecto Moddulo inexistente, encuentra el lado PESTEL pero NO intenta escribir", async () => {
    mockAdminDb.reset({
      "pestel_projects/pest1": { userId: UID, modduloProjectId: "noExiste", currentStage: 5 },
    });
    const res = await GET(req("moddulo_project_id=noExiste"));
    const json = await res.json();
    expect(json).toMatchObject({ found: true, sourceId: "pest1" });
    expect(mockAdminDb.snapshot()["moddulo_projects/noExiste"]).toBeUndefined();
  });

  it("con un proyecto Moddulo ajeno (otro uid), encuentra el lado PESTEL pero NO escribe el repair", async () => {
    mockAdminDb.reset({
      "pestel_projects/pest1": { userId: UID, modduloProjectId: "mAjeno", currentStage: 5 },
      "moddulo_projects/mAjeno": {
        userId: "uidVictima",
        collaborators: [{ uid: "uidVictima", role: "owner" }],
        phases: { exploracion: {} },
      },
    });
    const res = await GET(req("moddulo_project_id=mAjeno"));
    const json = await res.json();
    expect(json).toMatchObject({ found: true, sourceId: "pest1" });
    expect(
      (mockAdminDb.snapshot()["moddulo_projects/mAjeno"] as { phases: { exploracion: Record<string, unknown> } })
        .phases.exploracion.linkedSource
    ).toBeUndefined();
  });
});
