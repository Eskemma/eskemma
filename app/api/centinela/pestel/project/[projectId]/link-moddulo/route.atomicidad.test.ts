// H25 (7b-2) — atomicidad y carreras de link-moddulo. Mock «todo o nada» (modela la garantía; no la
// demuestra: no hay emulador). Las pruebas [real] FALLAN contra la ruta anterior; [local] no discriminan.

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

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const req = (id = "m1") => new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: id }) }) as never;
const NAC = { nivel: "nacional", nombre: "México" };
const moddulo = (phases: unknown = { exploracion: {} }) => ({ name: "M", type: "electoral", territorio: NAC, xpcto: {}, phases });
const inicial = {
  "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: NAC },
  "moddulo_projects/m1": moddulo(),
  "moddulo_projects/m2": moddulo(),
  "pestel_analyses/a1": { projectId: "pest1", analyzedAt: "2026-10-01T00:00:00Z", dimensions: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset(structuredClone(inicial));
  mockDb.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
});

describe("link-moddulo — todo o nada", () => {
  it("[real] si falla la escritura de PESTEL, el Moddulo NO queda vinculado", async () => {
    mockDb.failUpdateOn("pestel_projects/pest1");
    await expect(POST(req(), ctx)).rejects.toThrow();
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("[local] si falla la escritura del Moddulo (la primera), PESTEL no queda vinculado", async () => {
    mockDb.failUpdateOn("moddulo_projects/m1");
    await expect(POST(req(), ctx)).rejects.toThrow();
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("[real] camino feliz: UNA transacción con las dos escrituras", async () => {
    const r = await POST(req(), ctx);
    expect(r.status).toBe(201);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockDb.updates().map((u) => u.path).sort()).toEqual(["moddulo_projects/m1", "pestel_projects/pest1"]);
  });

  it("[real] rama C7b (mismo análisis ya importado): también pasa por la transacción", async () => {
    const importado = moddulo({ exploracion: { linkedSource: { kind: "T22", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } } } });
    mockDb.reset({ ...structuredClone(inicial), "moddulo_projects/m1": importado });
    mockDb.atomico(true);
    const r = await POST(req(), ctx);
    expect(r.status).toBe(200);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("link-moddulo — guard de doble vínculo dentro de la transacción", () => {
  it("[real] el MISMO PESTEL a DOS Moddulo a la vez: si otra petición lo vinculó a m2 entre la lectura previa y la escritura, esta recibe 409 y NO escribe", async () => {
    // La petición «concurrente» se simula en el hueco entre las lecturas previas y la transacción:
    // getProject(m1) se llama después de leer pestel (sin vínculo) y antes de escribir.
    vi.mocked(getProject).mockImplementation(async (id: string) => {
      await mockDb.collection("pestel_projects").doc("pest1").update({ modduloProjectId: "m2" });
      return (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never;
    });
    const antes = mockDb.snapshot();
    const r = await POST(req("m1"), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("pestel_already_linked");
    expect((mockDb.snapshot()["moddulo_projects/m1"])).toEqual(antes["moddulo_projects/m1"]);
    expect((mockDb.snapshot()["pestel_projects/pest1"] as { modduloProjectId: string }).modduloProjectId).toBe("m2");
  });

  it("[real] el MISMO Moddulo a DOS PESTEL a la vez: si otra petición ya lo vinculó a otro análisis, esta recibe 409 y NO escribe", async () => {
    // La foto que devuelve getProject es la vieja (sin vínculo); la transacción lee el documento real.
    vi.mocked(getProject).mockImplementationOnce(async () => {
      await mockDb.collection("moddulo_projects").doc("m1").update({
        phases: { exploracion: { linkedSource: { kind: "T22", sourceId: "pestOtro" } } },
      });
      return moddulo() as never;
    });
    const r = await POST(req("m1"), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("moddulo_already_linked");
    expect((mockDb.snapshot()["pestel_projects/pest1"] as { modduloProjectId?: string }).modduloProjectId).toBeUndefined();
  });
});
