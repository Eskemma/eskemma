// H25 (7b-1) — «Eliminar reporte»: puntero + reporte/actual + reporte/job en UN batch. Mock
// «todo o nada» (modela, no demuestra). Contra la ruta anterior FALLA: el puntero ya se había
// borrado cuando fallaba el borrado del documento.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/fontana/reporte/generarReporteSesion", () => ({ generarReporteSesion: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn(async () => null) }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { DELETE } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ sesionId: "s1" }) };
const req = () => new Request("http://local/x", { method: "DELETE" }) as never;
const inicial = {
  "fontana_sesiones/s1": { uid: "u1", reporteSesion: { editadoEn: "x" }, territorio: { nivel: "nacional", nombre: "México" } },
  "fontana_sesiones/s1/reporte/actual": { contenido: "md" },
  "fontana_sesiones/s1/reporte/job": { status: "completed" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset(structuredClone(inicial));
});

describe("eliminar reporte — todo o nada", () => {
  it("si falla el borrado de reporte/actual, el puntero NO se borra", async () => {
    mockDb.failUpdateOn("fontana_sesiones/s1/reporte/actual");
    await expect(DELETE(req(), ctx)).rejects.toThrow();
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("si el commit del batch falla, no queda nada aplicado", async () => {
    mockDb.failNextBatchCommit();
    await expect(DELETE(req(), ctx)).rejects.toThrow();
    expect(mockDb.snapshot()).toEqual(inicial);
    expect(mockDb.batchesCommitted()).toBe(0);
  });

  it("camino feliz: un solo batch confirmado", async () => {
    const r = await DELETE(req(), ctx);
    expect(r.status).toBe(200);
    expect(mockDb.batchesCommitted()).toBe(1);
  });
});
