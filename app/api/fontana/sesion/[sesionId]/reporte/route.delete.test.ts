// H25 (7b-1) — caracterización de DELETE .../reporte (eliminar reporte de sesión). Escrita ANTES
// del refactor a batch; debe seguir verde sin editarse.

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset({
    "fontana_sesiones/s1": { uid: "u1", reporteSesion: { editadoEn: "x" }, territorio: { nivel: "nacional", nombre: "México" } },
    "fontana_sesiones/s1/reporte/actual": { contenido: "md" },
    "fontana_sesiones/s1/reporte/job": { status: "completed" },
  });
});

describe("DELETE reporte", () => {
  it("401 sin sesión; 404 si la sesión no existe o es ajena (sin escrituras)", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await DELETE(req(), ctx)).status).toBe(401);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "otro" } as never);
    const r = await DELETE(req(), ctx);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Sesión no encontrada" });
    expect(mockDb.updates()).toHaveLength(0);
    expect(mockDb.deletes()).toHaveLength(0);
  });

  it("200: borra el puntero y los dos documentos; responde la sesión sin reporteSesion", async () => {
    const r = await DELETE(req(), ctx);
    expect(r.status).toBe(200);
    const cuerpo = await r.json();
    expect(cuerpo.sesion.reporteSesion).toBeUndefined();
    expect(mockDb.updates()).toEqual([{ path: "fontana_sesiones/s1", data: { reporteSesion: "__DELETE__" } }]);
    expect(mockDb.deletes().sort()).toEqual(["fontana_sesiones/s1/reporte/actual", "fontana_sesiones/s1/reporte/job"]);
    const estado = mockDb.snapshot();
    expect(estado["fontana_sesiones/s1/reporte/actual"]).toBeUndefined();
    expect(estado["fontana_sesiones/s1/reporte/job"]).toBeUndefined();
  });

  it("es idempotente cuando los documentos de reporte no existen", async () => {
    mockDb.reset({ "fontana_sesiones/s1": { uid: "u1", territorio: { nivel: "nacional", nombre: "México" } } });
    expect((await DELETE(req(), ctx)).status).toBe(200);
  });
});
