// H25 (7b-1) — repunte: el cambio de tarea (tareaPipIds, indicadores, entregaCanal1) y la
// invalidación del reporte salen en UN batch de 4 operaciones. Mock «todo o nada» (modela, no
// demuestra). Contra la ruta anterior FALLA: la sesión quedaba apuntando a la tarea nueva con el
// reporte de la anterior.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/fontana/reporte/generarReporteSesion", () => ({ generarReporteSesion: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({
  getProject: vi.fn(async () => ({
    name: "Proyecto",
    type: "electoral",
    phases: { investigacion: { pip: [{ pipItemId: "7", pregunta: "¿Cuál es la pobreza?" }], f3TareasPIP: [] } },
  })),
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { GET } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const fam = { minimos: [], seleccionUsuario: [] };
const inicial = {
  "fontana_sesiones/s1": {
    uid: "u1",
    modduloProjectId: "p1",
    tareaPipIds: ["3"],
    territorio: { nivel: "nacional", nombre: "México" },
    indicadoresPorFamilia: { F1: fam, F2: fam, F3: fam, F4: fam, F5: fam },
    reporteSesion: { editadoEn: "x" },
  },
  "fontana_sesiones/s1/reporte/actual": { contenido: "md" },
  "fontana_sesiones/s1/reporte/job": { status: "completed" },
};
const get = () => GET(new Request("http://local/api/fontana/sesion?moddulo_project_id=p1&tarea_pip=7") as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset(structuredClone(inicial));
});

describe("repunte — todo o nada", () => {
  it("si falla el borrado de reporte/job, la sesión NO se repunta", async () => {
    mockDb.failUpdateOn("fontana_sesiones/s1/reporte/job");
    await expect(get()).rejects.toThrow();
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("camino feliz: UN batch con las 4 operaciones (2 updates + 2 deletes)", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(mockDb.batchesCommitted()).toBe(1);
    expect(mockDb.updates()).toHaveLength(2);
    expect(mockDb.deletes()).toHaveLength(2);
  });
});
