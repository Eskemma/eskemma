// import-pestel (T2, 1b): unicidad del vínculo Moddulo ↔ PESTEL. El import escribe el back-link del PESTEL
// en la MISMA transacción que el vínculo del Moddulo, no importa un PESTEL que ya reclama otro Moddulo y,
// al reemplazar un PESTEL por otro, limpia el back-link del anterior.

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
const llamar = async (cuerpo: Record<string, unknown>) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
// getProject devuelve lo que hay sembrado en el documento (mismo estado que la transacción).
const conProyectos = () =>
  vi.mocked(getProject).mockImplementation(async (id: string) => {
    const d = (await db.collection("moddulo_projects").doc(id).get()).data() as { phases?: unknown } | undefined;
    return (d ? { id, xpcto: {}, phases: d.phases ?? {} } : null) as never;
  });
const base = (extra: Record<string, unknown> = {}) => ({
  "pestel_analyses/a1": { projectId: "pest1", dimensions: [] },
  "pestel_analyses/a2": { projectId: "pest2", dimensions: [] },
  "pestel_projects/pest1": { userId: "u1" },
  "pestel_projects/pest2": { userId: "u1" },
  "moddulo_projects/p1": { phases: { exploracion: {} } },
  "moddulo_projects/p2": { phases: { exploracion: {} } },
  ...extra,
});
const escrituras = (ruta: string) => db.updates().filter((u) => u.path === ruta);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  conProyectos();
});

describe("import-pestel — back-link y unicidad (T2, 1b)", () => {
  it("el primer import escribe el back-link del PESTEL junto con el vínculo del Moddulo", async () => {
    db.reset(base());
    db.atomico(true);
    const r = await llamar({ projectId: "p1", pestAnalysisId: "a1" });
    expect(r.status).toBe(200);
    expect(escrituras("moddulo_projects/p1")).toHaveLength(1);
    expect(escrituras("pestel_projects/pest1")).toEqual([
      { path: "pestel_projects/pest1", data: { modduloProjectId: "p1", updatedAt: "TS" } },
    ]);
  });

  it("«Vincular de nuevo» tras desvincular (PESTEL sin back-link) lo restablece", async () => {
    db.reset(base({ "moddulo_projects/p1": { phases: { exploracion: { lastUnlinkedLinkedSource: { sourceId: "pest1", sourceAnalysisId: "a1" } } } } }));
    db.atomico(true);
    await llamar({ projectId: "p1", pestAnalysisId: "a1" });
    expect(escrituras("pestel_projects/pest1")[0]?.data.modduloProjectId).toBe("p1");
  });

  it("un PESTEL que ya está vinculado a OTRO Moddulo existente no se importa: 409 pestel_already_linked y cero escrituras", async () => {
    db.reset(base({ "pestel_projects/pest1": { userId: "u1", modduloProjectId: "p2" } }));
    db.atomico(true);
    const r = await llamar({ projectId: "p1", pestAnalysisId: "a1" });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("pestel_already_linked");
    expect(db.updates()).toEqual([]);
  });

  it("la papelera no libera el vínculo: el otro Moddulo con deletedAt también bloquea", async () => {
    db.reset(
      base({
        "pestel_projects/pest1": { userId: "u1", modduloProjectId: "p2" },
        "moddulo_projects/p2": { deletedAt: "2026-10-01", phases: { exploracion: {} } },
      })
    );
    db.atomico(true);
    expect((await llamar({ projectId: "p1", pestAnalysisId: "a1" })).status).toBe(409);
    expect(db.updates()).toEqual([]);
  });

  it("un back-link a un Moddulo que ya no existe (legado) no bloquea y se sobrescribe", async () => {
    db.reset(base({ "pestel_projects/pest1": { userId: "u1", modduloProjectId: "fantasma" } }));
    db.atomico(true);
    expect((await llamar({ projectId: "p1", pestAnalysisId: "a1" })).status).toBe(200);
    expect(escrituras("pestel_projects/pest1")[0]?.data.modduloProjectId).toBe("p1");
  });

  it("[carrera] dos importaciones del mismo PESTEL a dos Moddulo: la segunda recibe 409 y no escribe", async () => {
    db.reset(base());
    db.atomico(true);
    expect((await llamar({ projectId: "p1", pestAnalysisId: "a1" })).status).toBe(200);
    const antes = db.updates().length;
    const r = await llamar({ projectId: "p2", pestAnalysisId: "a1" });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("pestel_already_linked");
    expect(db.updates()).toHaveLength(antes);
  });

  it("al reemplazar un PESTEL por otro se limpia el back-link del anterior (si todavía apuntaba a este Moddulo)", async () => {
    db.reset(
      base({
        "pestel_projects/pest1": { userId: "u1", modduloProjectId: "p1" },
        "moddulo_projects/p1": {
          phases: { exploracion: { linkedSource: { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } } } },
        },
      })
    );
    db.atomico(true);
    const pide = await llamar({ projectId: "p1", pestAnalysisId: "a2" });
    expect(pide.status).toBe(409);
    expect(db.updates()).toEqual([]);
    const ok = await llamar({ projectId: "p1", pestAnalysisId: "a2", confirmar: true, huella: pide.cuerpo.huella });
    expect(ok.status).toBe(200);
    expect(escrituras("pestel_projects/pest2")[0]?.data.modduloProjectId).toBe("p1");
    expect(escrituras("pestel_projects/pest1")[0]?.data.modduloProjectId).toBe("__DELETE__");
  });

  it("no toca el back-link de un PESTEL anterior que ya apuntaba a otro Moddulo", async () => {
    db.reset(
      base({
        "pestel_projects/pest1": { userId: "u1", modduloProjectId: "p2" },
        "moddulo_projects/p1": {
          phases: { exploracion: { linkedSource: { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } } } },
        },
      })
    );
    db.atomico(true);
    const pide = await llamar({ projectId: "p1", pestAnalysisId: "a2" });
    await llamar({ projectId: "p1", pestAnalysisId: "a2", confirmar: true, huella: pide.cuerpo.huella });
    expect(escrituras("pestel_projects/pest1")).toEqual([]);
  });

  it("si falla la escritura del back-link no queda el Moddulo vinculado (todo o nada)", async () => {
    db.reset(base());
    db.atomico(true);
    db.failUpdateOn("pestel_projects/pest1");
    await expect(llamar({ projectId: "p1", pestAnalysisId: "a1" })).rejects.toThrow();
    expect(escrituras("moddulo_projects/p1")).toEqual([]);
  });

  it("el mismo análisis ya importado sigue siendo 200 sin escribir nada", async () => {
    db.reset(
      base({
        "pestel_projects/pest1": { userId: "u1", modduloProjectId: "p1" },
        "moddulo_projects/p1": {
          phases: { exploracion: { linkedSource: { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } } } },
        },
      })
    );
    db.atomico(true);
    expect((await llamar({ projectId: "p1", pestAnalysisId: "a1" })).status).toBe(200);
    expect(db.updates()).toEqual([]);
  });
});
