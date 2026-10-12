// H25 (7b-1) — atomicidad de desvincular (Fontana). Modelo del mock: «todo o nada» (NO prueba la
// atomicidad real de Firestore; no hay emulador). Contra la ruta anterior (dos escrituras en
// secuencia) estas pruebas FALLAN: el marcador ya se había borrado cuando fallaba la sesión.

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
import { PATCH } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ sesionId: "s1" }) };
const req = () => new Request("http://local/x", { method: "PATCH", body: JSON.stringify({ desvincular: true }) }) as never;
const inicial = {
  "fontana_sesiones/s1": { uid: "u1", modduloProjectId: "p1", tareaPipIds: [], territorio: { nivel: "nacional", nombre: "México" } },
  "moddulo_projects/p1": { phases: { investigacion: { fontanaPendiente: { sesionId: "s1" } } } },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset(structuredClone(inicial));
  mockDb.atomico(true);
});

describe("desvincular — todo o nada", () => {
  it("si falla la escritura de la sesión, el marcador del proyecto NO se borra", async () => {
    mockDb.failUpdateOn("fontana_sesiones/s1");
    await expect(PATCH(req(), ctx)).rejects.toThrow();
    expect(mockDb.updates()).toHaveLength(0);
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("si falla la escritura del proyecto, la sesión sigue vinculada", async () => {
    mockDb.failUpdateOn("moddulo_projects/p1");
    await expect(PATCH(req(), ctx)).rejects.toThrow();
    expect(mockDb.updates()).toHaveLength(0);
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("camino feliz: usa UNA transacción con las dos escrituras", async () => {
    const r = await PATCH(req(), ctx);
    expect(r.status).toBe(200);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockDb.updates().map((u) => u.path).sort()).toEqual(["fontana_sesiones/s1", "moddulo_projects/p1"]);
  });
});
