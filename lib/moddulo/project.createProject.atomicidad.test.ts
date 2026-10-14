// H25 (commit 7b-6a) — createProject con pestelProjectId: el Moddulo y el back-link del PESTEL se
// crean en UNA transacción (id generado de antemano) y el guard de doble vínculo se evalúa DENTRO.
// Modo `atomico(true)` del fixture (modela el todo-o-nada; no lo demuestra: sin emulador).
// [real] = falla contra el código anterior; [local] = pasa también contra él (documenta, no discrimina).
// El «pre-chequeo» (getPestelProjectPropio) se simula con una lectura rancia para reproducir el hueco
// entre esa lectura y la transacción (no hay concurrencia real).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/centinela/pestel/projectPropio", () => ({ getPestelProjectPropio: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getPestelProjectPropio } from "@/lib/centinela/pestel/projectPropio";
import { createProject, PestelProjectNoPropioError, PestelYaVinculadoError } from "./project";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidA";
const PEST = "pestel_projects/pP";
const base = { type: "electoral" as const, name: "Proyecto de prueba", pestelProjectId: "pP" };
const moddulos = () => Object.keys(mockDb.snapshot()).filter((p) => p.startsWith("moddulo_projects/"));
/** Pre-chequeo «rancio»: dice que el PESTEL es propio y NO tiene vínculo, sin mirar el store. */
const precheckRancio = () => vi.mocked(getPestelProjectPropio).mockResolvedValue({ id: "pP", userId: UID } as never);

/** Pre-chequeo que lee el store como el helper real (para los casos sin hueco). */
function precheckReal() {
  vi.mocked(getPestelProjectPropio).mockImplementation(async (id: string, uid: string) => {
    const d = mockDb.snapshot()[`pestel_projects/${id}`] as Record<string, unknown> | undefined;
    return d && d.userId === uid ? ({ id, ...d } as never) : null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.reset({ [PEST]: { userId: UID, nombre: "Mio" } });
  mockDb.atomico(true);
  precheckReal();
});

describe("createProject — atomicidad del vínculo con PESTEL", () => {
  it("[real] falla el write-back: la creación falla y NO queda ningún Moddulo", async () => {
    mockDb.failUpdateOn(PEST);
    await expect(createProject(UID, base)).rejects.toThrow();
    expect(moddulos()).toEqual([]);
    expect((mockDb.snapshot()[PEST] as Record<string, unknown>).modduloProjectId).toBeUndefined();
  });

  it("[real] camino feliz: UNA transacción que crea el Moddulo y escribe el back-link", async () => {
    const project = await createProject(UID, base);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(moddulos()).toEqual([`moddulo_projects/${project.id}`]);
    expect((mockDb.snapshot()[PEST] as Record<string, unknown>).modduloProjectId).toBe(project.id);
  });

  it("[real] dos creaciones simultáneas: la 2.ª ve el back-link de la 1.ª DENTRO de la transacción → 409 y un solo Moddulo", async () => {
    precheckRancio(); // ambas pasaron el pre-chequeo antes de que la 1.ª escribiera
    const primero = await createProject(UID, base);
    await expect(createProject(UID, base)).rejects.toBeInstanceOf(PestelYaVinculadoError);
    expect(moddulos()).toEqual([`moddulo_projects/${primero.id}`]);
    expect((mockDb.snapshot()[PEST] as Record<string, unknown>).modduloProjectId).toBe(primero.id);
  });

  it("[real] el PESTEL cambia de dueño entre el pre-chequeo y la transacción: 404 y nada escrito", async () => {
    precheckRancio();
    mockDb.reset({ [PEST]: { userId: "otro" } });
    mockDb.atomico(true);
    await expect(createProject(UID, base)).rejects.toBeInstanceOf(PestelProjectNoPropioError);
    expect(moddulos()).toEqual([]);
    expect((mockDb.snapshot()[PEST] as Record<string, unknown>).modduloProjectId).toBeUndefined();
  });

  it("[real] el PESTEL desaparece entre el pre-chequeo y la transacción: 404 y nada escrito", async () => {
    precheckRancio();
    mockDb.reset({});
    mockDb.atomico(true);
    await expect(createProject(UID, base)).rejects.toBeInstanceOf(PestelProjectNoPropioError);
    expect(moddulos()).toEqual([]);
    expect(mockDb.snapshot()[PEST]).toBeUndefined();
  });

  it("[real] el vínculo con un Moddulo EN PAPELERA aparece entre ambos: 409 sin escribir", async () => {
    precheckRancio();
    mockDb.reset({
      [PEST]: { userId: UID, modduloProjectId: "mPapelera" },
      "moddulo_projects/mPapelera": { userId: UID, deletedAt: "TS" },
    });
    mockDb.atomico(true);
    await expect(createProject(UID, base)).rejects.toBeInstanceOf(PestelYaVinculadoError);
    expect(moddulos()).toEqual(["moddulo_projects/mPapelera"]);
  });

  it("[local] referencia stale a un Moddulo ya borrado: se permite y el back-link apunta al nuevo", async () => {
    mockDb.reset({ [PEST]: { userId: UID, modduloProjectId: "mBorrado" } });
    mockDb.atomico(true);
    const project = await createProject(UID, base);
    expect((mockDb.snapshot()[PEST] as Record<string, unknown>).modduloProjectId).toBe(project.id);
  });

  it("[local] sin pestelProjectId el camino no cambia: sin transacción, sin tocar PESTEL", async () => {
    const project = await createProject(UID, { type: "electoral", name: "X" });
    expect(mockDb.runTransaction).not.toHaveBeenCalled();
    expect(moddulos()).toEqual([`moddulo_projects/${project.id}`]);
    expect(mockDb.updates()).toHaveLength(0);
  });
});
