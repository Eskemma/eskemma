// H25 (7b-1) — atomicidad de vincular-moddulo (Fontana): el marcador del proyecto y el
// modduloProjectId de la sesión se escriben juntos. Mock «todo o nada» (modela, no demuestra).
// Contra la ruta anterior FALLA: quedaba un marcador apuntando a una sesión no vinculada.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/fontana/reporte/generarReporteSesion", () => ({ generarReporteSesion: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn(async () => ({ currentPhase: "proposito" })) }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ sesionId: "s1" }) };
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: "p1" }) }) as never;
const inicial = {
  "fontana_sesiones/s1": { uid: "u1", territorio: { nivel: "nacional", nombre: "México" } },
  "moddulo_projects/p1": { phases: {} },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset(structuredClone(inicial));
  mockDb.atomico(true);
});

describe("vincular-moddulo — todo o nada", () => {
  it("si falla la escritura de la sesión, el proyecto NO queda con marcador", async () => {
    mockDb.failUpdateOn("fontana_sesiones/s1");
    await expect(POST(req(), ctx)).rejects.toThrow();
    expect(mockDb.updates()).toHaveLength(0);
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("si falla la escritura del proyecto, la sesión NO queda vinculada", async () => {
    mockDb.failUpdateOn("moddulo_projects/p1");
    await expect(POST(req(), ctx)).rejects.toThrow();
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("camino feliz: una transacción con las dos escrituras", async () => {
    const r = await POST(req(), ctx);
    expect(r.status).toBe(200);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockDb.updates().map((u) => u.path).sort()).toEqual(["fontana_sesiones/s1", "moddulo_projects/p1"]);
  });
});
