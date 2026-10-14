// H25 (commit 7b-6b) — repair de find-linked-pestel: transacción de REVALIDACIÓN. Escribe solo si el
// Moddulo existe y no está en papelera, el PESTEL sigue siendo del usuario y sigue apuntando a ese
// Moddulo, y el linkedSource no tiene sourceId (ni un kind distinto de T22). Modo `atomico(true)`
// (modela el todo-o-nada; no lo demuestra: sin emulador). [real] = falla contra la ruta anterior;
// [local] = pasa también contra ella. El hueco entre la consulta y el repair se simula dentro de
// getProject (mockeado), que cambia el store justo ahí; no hay concurrencia real.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  Timestamp: {},
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { GET } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidDueno";
const M = "moddulo_projects/m1";
const P = "pestel_projects/pest1";
const req = () => new Request("http://local/api/moddulo/f2/find-linked-pestel?moddulo_project_id=m1") as never;
const moddulo = (exploracion: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  userId: UID, collaborators: [{ uid: UID, role: "owner" }], phases: { exploracion }, ...extra,
});
const pestel = (extra: Record<string, unknown> = {}) => ({ userId: UID, modduloProjectId: "m1", currentStage: 5, ...extra });
const repairs = () => mockDb.updates().filter((u) => u.path === M);

function sembrar(docs: Record<string, unknown>) {
  mockDb.reset(docs);
  mockDb.atomico(true);
}
/** Cambia el store en el hueco entre la consulta y el repair (justo al validar el acceso). */
function conHueco(despues: Record<string, unknown>) {
  vi.mocked(getProject).mockImplementation(async () => {
    sembrar(despues);
    return { id: "m1" } as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: UID } as never);
  vi.mocked(getProject).mockResolvedValue({ id: "m1" } as never);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("find-linked-pestel — repair con revalidación", () => {
  it("[real] el back-link se borra entre la consulta y el repair: no escribe", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo() });
    conHueco({ [P]: pestel({ modduloProjectId: undefined }), [M]: moddulo() });
    const res = await GET(req());
    expect((await res.json()).found).toBe(true);
    expect(repairs()).toHaveLength(0);
  });

  it("[real] el PESTEL cambia de dueño entre ambos: no escribe", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo() });
    conHueco({ [P]: pestel({ userId: "otro" }), [M]: moddulo() });
    await GET(req());
    expect(repairs()).toHaveLength(0);
  });

  it("[real] el PESTEL apunta ahora a OTRO Moddulo: no escribe", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo() });
    conHueco({ [P]: pestel({ modduloProjectId: "m2" }), [M]: moddulo() });
    await GET(req());
    expect(repairs()).toHaveLength(0);
  });

  it("[real] el PESTEL desaparece entre ambos: no escribe", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo() });
    conHueco({ [M]: moddulo() });
    await GET(req());
    expect(repairs()).toHaveLength(0);
  });

  it("[real] el Moddulo pasa a la papelera entre ambos: no escribe", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo() });
    conHueco({ [P]: pestel(), [M]: moddulo({}, { deletedAt: "TS" }) });
    await GET(req());
    expect(repairs()).toHaveLength(0);
  });

  it("[real] linkedSource.sourceId ya distinto: NO se sobrescribe", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo({ linkedSource: { kind: "T22", componente: "centinela", sourceId: "otroPestel" } }) });
    const res = await GET(req());
    expect(await res.json()).toMatchObject({ found: true, sourceId: "pest1" });
    expect(repairs()).toHaveLength(0);
  });

  it("[real] ya correcto: CERO escrituras (sin bump de updatedAt)", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo({ linkedSource: { kind: "T22", componente: "centinela", sourceId: "pest1" } }) });
    await GET(req());
    expect(repairs()).toHaveLength(0);
  });

  it("[real] vínculo express (kind distinto de T22): NO se convierte en T22", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo({ linkedSource: { kind: "express", componente: "moddulo", sourceId: "m1" } }) });
    await GET(req());
    expect(repairs()).toHaveLength(0);
  });

  it("[real] kind distinto de T22 aunque falte sourceId: no escribe", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo({ linkedSource: { kind: "express", componente: "moddulo" } }) });
    await GET(req());
    expect(repairs()).toHaveLength(0);
  });

  it("[real] el repair legítimo va en UNA transacción", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo() });
    await GET(req());
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(repairs()).toHaveLength(1);
  });

  it("[real] si el repair falla, avisa con la etiqueta identificable y sigue sin ser fatal", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo() });
    mockDb.failUpdateOn(M);
    const res = await GET(req());
    expect(await res.json()).toMatchObject({ found: true, sourceId: "pest1" });
    expect(vi.mocked(console.warn).mock.calls.some((c) => String(c[0]).includes("[find-linked-pestel][repair]"))).toBe(true);
  });

  it("[local] falta el linkedSource: el repair escribe los 3 campos y updatedAt, una sola vez", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo() });
    await GET(req());
    expect(repairs()).toHaveLength(1);
    expect(repairs()[0].data).toEqual({
      "phases.exploracion.linkedSource.sourceId": "pest1",
      "phases.exploracion.linkedSource.kind": "T22",
      "phases.exploracion.linkedSource.componente": "centinela",
      updatedAt: "SERVER_TIMESTAMP",
    });
  });

  it("[local] Moddulo sin acceso (getProject null): no escribe y no abre transacción", async () => {
    sembrar({ [P]: pestel(), [M]: moddulo() });
    vi.mocked(getProject).mockResolvedValue(null as never);
    const res = await GET(req());
    expect((await res.json()).found).toBe(true);
    expect(repairs()).toHaveLength(0);
    expect(mockDb.runTransaction).not.toHaveBeenCalled();
  });

  it("[local] sin PESTEL que apunte: found:false y sin transacción", async () => {
    sembrar({ [M]: moddulo() });
    expect(await (await GET(req())).json()).toEqual({ found: false });
    expect(mockDb.runTransaction).not.toHaveBeenCalled();
  });
});
