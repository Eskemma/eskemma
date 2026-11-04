// T5 — unlink-pestel en MODO PENDIENTE: cancela un vínculo pendiente (back-link sin importar, o el T22 sin análisis de
// la forma antigua). Sin H15; respeta fase_cerrada; el `pestelProjectId` del cuerpo no se confía por sí solo.
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
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "m1", ...cuerpo }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const COLAB = [{ uid: "u1", role: "owner" }];
const moddulo = (exploracion: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ name: "M", collaborators: COLAB, phases: { exploracion }, ...extra });
const sembrar = (docs: Record<string, unknown>) => {
  db.reset(structuredClone(docs));
  db.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
};
const enModdulo = () => db.updates().filter((u) => u.path === "moddulo_projects/m1");
const enPestel = (id = "pest1") => db.updates().filter((u) => u.path === `pestel_projects/${id}`);
const PEND = { "pestel_projects/pest1": { userId: "u1", modduloProjectId: "m1" } };
const FORMA_A = { kind: "T22", componente: "centinela", sourceId: "pest1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("unlink-pestel — cancelar un pendiente (forma nueva: solo el back-link)", () => {
  it("[real] borra SOLO el back-link, sin H15 (200 directo) y sin escribir en el Moddulo", async () => {
    sembrar({ "moddulo_projects/m1": moddulo(), ...PEND });
    const r = await llamar({ pestelProjectId: "pest1" });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, pendienteCancelado: true } });
    expect(enPestel()).toEqual([{ path: "pestel_projects/pest1", data: { modduloProjectId: "__DELETE__", updatedAt: "TS" } }]);
    expect(enModdulo()).toEqual([]);
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
  });

  it("[real] sobre un Moddulo express aprobado: el express queda intacto y no se pide confirmación", async () => {
    const express = { kind: "express", componente: "moddulo", sourceId: "m1", payload: { P: {} } };
    sembrar({ "moddulo_projects/m1": moddulo({ linkedSource: express, m1: { creadoEn: "t" } }), ...PEND });
    const r = await llamar({ pestelProjectId: "pest1" });
    expect(r.status).toBe(200);
    expect(enModdulo()).toEqual([]);
  });
});

describe("unlink-pestel — cancelar un pendiente (forma antigua: T22 sin análisis)", () => {
  it("[real] borra el back-link y el linkedSource en UNA transacción; no guarda lastUnlinkedLinkedSource", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({ linkedSource: FORMA_A }), ...PEND });
    const r = await llamar({ pestelProjectId: "pest1" });
    expect(r.status).toBe(200);
    expect(enModdulo()).toEqual([{ path: "moddulo_projects/m1", data: { "phases.exploracion.linkedSource": "__DELETE__", updatedAt: "TS" } }]);
    expect(enPestel()).toHaveLength(1);
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
  });

  it("[real] mezcla N6 (T22 sin análisis pero con un mapa express): devuelve el vínculo a su forma express sin tocar el mapa", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({ linkedSource: { ...FORMA_A, payload: { P: { code: "P" } } } }), ...PEND });
    expect((await llamar({ pestelProjectId: "pest1" })).status).toBe(200);
    expect(enModdulo()[0].data).toEqual({
      "phases.exploracion.linkedSource.kind": "express",
      "phases.exploracion.linkedSource.componente": "moddulo",
      "phases.exploracion.linkedSource.sourceId": "m1",
      updatedAt: "TS",
    });
  });

  it("[real] HUÉRFANO: el PESTEL ya no existe (borrado definitivo): limpia el resto del linkedSource y no escribe ningún PESTEL", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({ linkedSource: FORMA_A }) });
    const r = await llamar({ pestelProjectId: "pest1" });
    expect(r.status).toBe(200);
    expect(enModdulo()).toHaveLength(1);
    expect(db.updates().filter((u) => u.path.startsWith("pestel_projects/"))).toEqual([]);
  });

  it("[real] HUÉRFANO: el PESTEL existe pero es de otro usuario o apunta a otro Moddulo: se limpia SOLO el linkedSource; el PESTEL no se toca", async () => {
    for (const pest of [{ userId: "otro", modduloProjectId: "m1" }, { userId: "u1", modduloProjectId: "m9" }, { userId: "u1" }]) {
      sembrar({ "moddulo_projects/m1": moddulo({ linkedSource: FORMA_A }), "pestel_projects/pest1": pest });
      expect((await llamar({ pestelProjectId: "pest1" })).status).toBe(200);
      expect(enModdulo()).toHaveLength(1);
      expect(enPestel()).toEqual([]);
    }
  });
});

describe("unlink-pestel — el cuerpo no se confía por sí solo", () => {
  it("[real] PESTEL ajeno sin que el linkedSource lo respalde: 400 pendiente_no_encontrado y cero escrituras", async () => {
    sembrar({ "moddulo_projects/m1": moddulo(), "pestel_projects/pest1": { userId: "otro", modduloProjectId: "m1" } });
    const r = await llamar({ pestelProjectId: "pest1" });
    expect(r.status).toBe(400);
    expect(r.cuerpo.error).toBe("pendiente_no_encontrado");
    expect(db.updates()).toEqual([]);
  });

  it("[local] PESTEL propio cuyo back-link apunta a OTRO Moddulo, o inexistente: 400 y cero escrituras", async () => {
    sembrar({ "moddulo_projects/m1": moddulo(), "pestel_projects/pest1": { userId: "u1", modduloProjectId: "m9" } });
    expect((await llamar({ pestelProjectId: "pest1" })).status).toBe(400);
    expect((await llamar({ pestelProjectId: "no-existe" })).status).toBe(400);
    expect(db.updates()).toEqual([]);
  });

  it("[real] el linkedSource de la forma antigua apunta a OTRO id distinto del del cuerpo: no se limpia nada", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({ linkedSource: { ...FORMA_A, sourceId: "otro" } }), "pestel_projects/pest1": { userId: "otro" } });
    expect((await llamar({ pestelProjectId: "pest1" })).status).toBe(400);
    expect(db.updates()).toEqual([]);
  });

  it("[real] quien no es colaborador del Moddulo (visto DENTRO de la transacción): 404 y cero escrituras", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({}, { collaborators: [{ uid: "otro", role: "owner" }] }), ...PEND });
    expect((await llamar({ pestelProjectId: "pest1" })).status).toBe(404);
    expect(db.updates()).toEqual([]);
  });

  it("un pestelProjectId vacío o de solo espacios se trata como ausente: sigue el camino de siempre (400 not_linked)", async () => {
    sembrar({ "moddulo_projects/m1": moddulo(), ...PEND });
    const r = await llamar({ pestelProjectId: "   " });
    expect(r.status).toBe(400);
    expect(r.cuerpo.error).toBe("not_linked");
  });
});

describe("unlink-pestel — pendiente: Fase 2 cerrada, estado cambiado, atomicidad", () => {
  it("[local] Fase 2 cerrada: 409 fase_cerrada y cero escrituras (cancelar un pendiente también es una escritura sobre F2)", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({ status: "completed" }), ...PEND });
    const r = await llamar({ pestelProjectId: "pest1" });
    expect(r).toEqual({ status: 409, cuerpo: { error: "fase_cerrada" } });
    expect(db.updates()).toEqual([]);
  });

  it("[real] el Moddulo ya tiene un análisis importado (la pantalla estaba desactualizada): 409 estado_cambio, cero escrituras", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({ linkedSource: { ...FORMA_A, sourceAnalysisId: "a1", payload: { P: {} } } }), ...PEND });
    const r = await llamar({ pestelProjectId: "pest1" });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("estado_cambio");
    expect(db.updates()).toEqual([]);
  });

  it("Moddulo en papelera: 404", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({}, { deletedAt: "2026-11-01" }), ...PEND });
    vi.mocked(getProject).mockResolvedValue({} as never); // el pre-chequeo de acceso pasa; la transacción lo ve en papelera
    expect((await llamar({ pestelProjectId: "pest1" })).status).toBe(404);
    expect(db.updates()).toEqual([]);
  });

  it("[local] si falla la escritura del PESTEL (la segunda), el linkedSource del Moddulo no queda limpio", async () => {
    sembrar({ "moddulo_projects/m1": moddulo({ linkedSource: FORMA_A }), ...PEND });
    db.failUpdateOn("pestel_projects/pest1");
    await expect(llamar({ pestelProjectId: "pest1" })).rejects.toThrow();
    expect((db.snapshot()["moddulo_projects/m1"] as { phases: { exploracion: { linkedSource: unknown } } }).phases.exploracion.linkedSource).toEqual(FORMA_A);
  });
});
