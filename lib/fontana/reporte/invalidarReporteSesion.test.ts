// H25 (7b-1) — invalidarReporteSesion con y sin batch externo.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__" } }));

import { adminDb } from "@/lib/firebase-admin";
import { invalidarReporteSesion } from "./invalidarReporteSesion";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ref = () => mockDb.collection("fontana_sesiones").doc("s1") as never;
const inicial = {
  "fontana_sesiones/s1": { uid: "u1", reporteSesion: { editadoEn: "x" } },
  "fontana_sesiones/s1/reporte/actual": { contenido: "md" },
  "fontana_sesiones/s1/reporte/job": { status: "completed" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.reset(structuredClone(inicial));
});

describe("invalidarReporteSesion", () => {
  it("sin batch: crea el suyo y lo confirma (1 batch, 1 update, 2 deletes)", async () => {
    await invalidarReporteSesion(ref());
    expect(mockDb.batchesCommitted()).toBe(1);
    expect(mockDb.updates()).toEqual([{ path: "fontana_sesiones/s1", data: { reporteSesion: "__DELETE__" } }]);
    expect(mockDb.deletes().sort()).toEqual(["fontana_sesiones/s1/reporte/actual", "fontana_sesiones/s1/reporte/job"]);
  });

  it("con batch externo: agrega las operaciones y NO confirma; se aplican al confirmar quien lo creó", async () => {
    const batch = mockDb.batch();
    await invalidarReporteSesion(ref(), batch as never);
    expect(mockDb.batchesCommitted()).toBe(0);
    expect(mockDb.snapshot()).toEqual(inicial);
    await batch.commit();
    expect(mockDb.updates()).toHaveLength(1);
    expect(mockDb.deletes()).toHaveLength(2);
  });

  it("si el documento de sesión NO existe, el batch completo falla y no se aplica nada (antes solo fallaba la 1.ª operación)", async () => {
    mockDb.reset({
      "fontana_sesiones/s1/reporte/actual": { contenido: "md" },
      "fontana_sesiones/s1/reporte/job": { status: "completed" },
    });
    await expect(invalidarReporteSesion(ref())).rejects.toThrow();
    expect(mockDb.deletes()).toHaveLength(0);
  });
});
