// H25 (7b-2) — caracterización de POST unlink-pestel. Escrita ANTES del refactor a transacción y verde
// contra el código anterior: fija códigos, cuerpos y el conjunto de escrituras. Paso 4: los casos de éxito pasan por
// la confirmación obligatoria (sonda + confirmar) y el conjunto de escrituras ganó draftDVS y m1 (borrados).

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
const req = (cuerpo: unknown) => new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never;
// Paso 4: unlinking ALWAYS asks first. This helper makes the probe (409, nothing written) and then repeats
// the request confirming with the fingerprint the server returned.
async function POSTconfirmando(cuerpo: Record<string, unknown>) {
  const sondeo = await POST(req(cuerpo));
  expect(sondeo.status).toBe(409);
  const { huella } = await sondeo.json();
  expect(mockDb.updates()).toHaveLength(0);
  return POST(req({ ...cuerpo, confirmar: true, huella }));
}
const T22 = { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } };
const moddulo = (linkedSource?: unknown) => ({ name: "M", phases: { exploracion: linkedSource ? { linkedSource } : {} } });

// getProject lee el mismo documento que verá la ruta: así la caracterización vale antes y después del refactor.
const sembrar = (docs: Record<string, unknown>) => {
  mockDb.reset(structuredClone(docs));
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  sembrar({ "moddulo_projects/m1": moddulo(T22), "pestel_projects/pest1": { userId: "u1", modduloProjectId: "m1" } });
});

describe("POST unlink-pestel — respuestas", () => {
  it("401 sin sesión", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await POST(req({ projectId: "m1" }))).status).toBe(401);
  });

  it("400 JSON inválido y 400 sin projectId", async () => {
    const a = await POST(new Request("http://local/x", { method: "POST", body: "{no" }) as never);
    expect(a.status).toBe(400);
    expect(await a.json()).toEqual({ error: "JSON inválido" });
    const b = await POST(req({}));
    expect(b.status).toBe(400);
    expect(await b.json()).toEqual({ error: "projectId es requerido" });
  });

  it("404 si el proyecto no es accesible, sin escrituras", async () => {
    const r = await POST(req({ projectId: "otro" }));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Proyecto no encontrado" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("400 not_linked sin vínculo y con vínculo express (kind distinto de T22), sin escrituras", async () => {
    for (const ls of [undefined, { kind: "express", sourceId: "m1" }]) {
      sembrar({ "moddulo_projects/m1": moddulo(ls), "pestel_projects/pest1": { userId: "u1", modduloProjectId: "m1" } });
      const r = await POST(req({ projectId: "m1" }));
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({
        error: "not_linked",
        message: "Este proyecto no está vinculado a ningún análisis de Centinela PESTEL.",
      });
      expect(mockDb.updates()).toHaveLength(0);
    }
  });
});

describe("POST unlink-pestel — éxito", () => {
  it("limpia el vínculo del Moddulo (guarda el anterior y vacía las aprobaciones) y el back-link de PESTEL", async () => {
    const r = await POSTconfirmando({ projectId: "m1" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const u = mockDb.updates();
    expect(u.map((x) => x.path).sort()).toEqual(["moddulo_projects/m1", "pestel_projects/pest1"]);
    expect(u.find((x) => x.path === "moddulo_projects/m1")!.data).toEqual({
      "phases.exploracion.linkedSource": "__DELETE__",
      "phases.exploracion.fuentesConsultadas": "__DELETE__",
      "phases.exploracion.xpctoSnapshotAtGeneration": "__DELETE__",
      "phases.exploracion.lastUnlinkedLinkedSource": T22,
      "phases.exploracion.motorAprobaciones": {},
      "phases.exploracion.draftDVS": "__DELETE__", // paso 4: ya no se conserva el borrador de motores
      "phases.exploracion.m1": "__DELETE__", // paso 4: el registro del M1 se va con el vínculo
      updatedAt: "TS",
    });
    expect(u.find((x) => x.path === "pestel_projects/pest1")!.data).toEqual({ modduloProjectId: "__DELETE__", updatedAt: "TS" });
  });

  it("si PESTEL apunta a OTRO Moddulo, no se toca; el Moddulo sí se desvincula", async () => {
    sembrar({ "moddulo_projects/m1": moddulo(T22), "pestel_projects/pest1": { userId: "u1", modduloProjectId: "otro" } });
    const r = await POSTconfirmando({ projectId: "m1" });
    expect(r.status).toBe(200);
    expect(mockDb.updates().map((x) => x.path)).toEqual(["moddulo_projects/m1"]);
  });

  it("si el proyecto PESTEL ya no existe, el Moddulo se desvincula igual", async () => {
    sembrar({ "moddulo_projects/m1": moddulo(T22) });
    const r = await POSTconfirmando({ projectId: "m1" });
    expect(r.status).toBe(200);
    expect(mockDb.updates().map((x) => x.path)).toEqual(["moddulo_projects/m1"]);
  });

  it("sin sourceId en el vínculo solo se escribe el Moddulo", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({ kind: "T22", componente: "centinela" }) });
    const r = await POSTconfirmando({ projectId: "m1" });
    expect(r.status).toBe(200);
    expect(mockDb.updates().map((x) => x.path)).toEqual(["moddulo_projects/m1"]);
  });
});
