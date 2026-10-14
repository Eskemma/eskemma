// H25 (commit 7b-6b) — CARACTERIZACIÓN de find-linked-pestel, escrita ANTES del refactor y verde contra
// el código anterior: forma exacta de lo que el repair escribe (3 campos de linkedSource + updatedAt),
// respuestas de ambos modos y errores. Debe seguir verde SIN editar tras el refactor.

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

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidDueno";
const req = (qs: string) => new Request(`http://local/api/moddulo/f2/find-linked-pestel?${qs}`) as never;
const moddulo = { userId: UID, collaborators: [{ uid: UID, role: "owner" }], phases: { exploracion: {} } };

beforeEach(() => {
  mockDb.reset();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: UID } as never);
});

describe("find-linked-pestel — caracterización (código anterior)", () => {
  it("el repair escribe EXACTAMENTE los 3 campos de linkedSource y updatedAt", async () => {
    mockDb.reset({
      "pestel_projects/pest1": { userId: UID, modduloProjectId: "m1", currentStage: 5 },
      "moddulo_projects/m1": moddulo,
    });
    await GET(req("moddulo_project_id=m1"));
    const repair = mockDb.updates().filter((u) => u.path === "moddulo_projects/m1" && "phases.exploracion.linkedSource.sourceId" in u.data);
    expect(repair).toHaveLength(1);
    expect(repair[0].data).toEqual({
      "phases.exploracion.linkedSource.sourceId": "pest1",
      "phases.exploracion.linkedSource.kind": "T22",
      "phases.exploracion.linkedSource.componente": "centinela",
      updatedAt: "SERVER_TIMESTAMP",
    });
  });

  it("modo moddulo_project_id: responde {found, sourceId, currentStage} (currentStage por defecto 3)", async () => {
    mockDb.reset({ "pestel_projects/pest1": { userId: UID, modduloProjectId: "m1" }, "moddulo_projects/m1": moddulo });
    expect(await (await GET(req("moddulo_project_id=m1"))).json()).toEqual({ found: true, sourceId: "pest1", currentStage: 3 });
  });

  it("modo moddulo_project_id sin PESTEL que apunte: {found:false} y sin escrituras de repair", async () => {
    mockDb.reset({ "moddulo_projects/m1": moddulo });
    expect(await (await GET(req("moddulo_project_id=m1"))).json()).toEqual({ found: false });
    expect(mockDb.updates().some((u) => "phases.exploracion.linkedSource.sourceId" in u.data)).toBe(false);
  });

  it("solo ve PESTEL del propio usuario (el de otro uid no cuenta)", async () => {
    mockDb.reset({ "pestel_projects/pest1": { userId: "otro", modduloProjectId: "m1" }, "moddulo_projects/m1": moddulo });
    expect(await (await GET(req("moddulo_project_id=m1"))).json()).toEqual({ found: false });
  });

  it("modo pestel_project_id: devuelve la etapa fresca; ajeno o inexistente → found:false; sin escrituras", async () => {
    mockDb.reset({ "pestel_projects/pest1": { userId: UID, currentStage: 6 }, "pestel_projects/pest2": { userId: "otro" } });
    expect(await (await GET(req("pestel_project_id=pest1"))).json()).toEqual({ found: true, sourceId: "pest1", currentStage: 6 });
    expect(await (await GET(req("pestel_project_id=pest2"))).json()).toEqual({ found: false });
    expect(await (await GET(req("pestel_project_id=nada"))).json()).toEqual({ found: false });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("sin sesión: 401; sin parámetros: 400", async () => {
    expect((await GET(req("pestel_project_id=x"))).status).toBe(200);
    expect((await GET(req(""))).status).toBe(400);
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await GET(req("moddulo_project_id=m1"))).status).toBe(401);
  });
});
