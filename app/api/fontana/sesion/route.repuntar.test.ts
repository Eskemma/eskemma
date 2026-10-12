// H25 (7b-1) — caracterización del repunte de la sesión de Fontana (GET con tarea_pip). Escrita
// ANTES del refactor a batch; debe seguir verde sin editarse.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
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
const sesion = (tarea: string) => ({
  uid: "u1",
  modduloProjectId: "p1",
  tareaPipIds: [tarea],
  territorio: { nivel: "nacional", nombre: "México" },
  indicadoresPorFamilia: { F1: fam, F2: fam, F3: fam, F4: fam, F5: fam },
  entregaCanal1: { x: 1 },
  reporteSesion: { editadoEn: "x" },
});
const get = (tarea?: string) =>
  GET(new Request(`http://local/api/fontana/sesion?moddulo_project_id=p1${tarea ? `&tarea_pip=${tarea}` : ""}`) as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset({
    "fontana_sesiones/s1": sesion("3"),
    "fontana_sesiones/s1/reporte/actual": { contenido: "md" },
    "fontana_sesiones/s1/reporte/job": { status: "completed" },
  });
});

describe("GET con tarea_pip — repunte", () => {
  it("misma tarea: no escribe nada", async () => {
    const r = await get("3");
    expect(r.status).toBe(200);
    expect(mockDb.updates()).toHaveLength(0);
    expect(mockDb.deletes()).toHaveLength(0);
  });

  it("otra tarea: repunta, borra entregaCanal1 e invalida el reporte (puntero + 2 documentos)", async () => {
    const r = await get("7");
    expect(r.status).toBe(200);
    const cuerpo = await r.json();
    expect(cuerpo.existe).toBe(true);
    expect(cuerpo.sesion.tareaPipIds).toEqual(["7"]);
    expect(cuerpo.sesion.reporteSesion).toBeUndefined();
    const u = mockDb.updates();
    const porRuta = (p: string) => u.filter((x) => x.path === p).map((x) => x.data);
    const sesionEscrita = porRuta("fontana_sesiones/s1");
    expect(sesionEscrita.some((d) => JSON.stringify(d.tareaPipIds) === '["7"]' && d.entregaCanal1 === "__DELETE__")).toBe(true);
    expect(sesionEscrita.some((d) => d.reporteSesion === "__DELETE__")).toBe(true);
    expect(mockDb.deletes().sort()).toEqual(["fontana_sesiones/s1/reporte/actual", "fontana_sesiones/s1/reporte/job"]);
  });
});
