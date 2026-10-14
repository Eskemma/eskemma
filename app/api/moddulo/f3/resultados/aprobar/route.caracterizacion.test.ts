// H25 (commit 7b-4) — CARACTERIZACIÓN de resultados/aprobar, escrita ANTES del refactor y verde
// contra la ruta anterior. Fija lo que se escribe en el tablero con ids actuales y con ids legados
// (legacy-N, esquema de un canal por tarea). getProject se simula con la MISMA normalización real
// (normalizeTareaPIP) sobre el documento crudo, así que la comparación es contra la ruta, no contra
// una función que imite lo que hacía.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async () => ({
  ...(await vi.importActual<typeof import("@/lib/moddulo/project")>("@/lib/moddulo/project")),
  getProject: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject, normalizeTareaPIP } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const RES = `${P}/f3Resultados/r1`;
const body = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", {
    method: "POST",
    body: JSON.stringify({ projectId: "p1", resultadoId: "r1", pipItemId: "t1", asignacionId: "a1", aprobado: true, ...o }),
  }) as never;

function sembrar(tablero: unknown[]) {
  mockDb.reset({
    [RES]: { aprobado: false },
    [P]: { phases: { investigacion: { f3TareasPIP: tablero } } },
  });
  vi.mocked(getProject).mockResolvedValue({
    phases: { investigacion: { f3TareasPIP: tablero.map((t) => normalizeTareaPIP(t as never)) } },
  } as never);
}
const tableroEscrito = () =>
  mockDb.updates().find((u) => u.path === P)?.data["phases.investigacion.f3TareasPIP"];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("resultados/aprobar — caracterización (ruta anterior)", () => {
  it("ids actuales: solo la asignación elegida pasa a recibido con resultadoId; el resto intacto", async () => {
    sembrar([
      { pipItemId: "t1", asignaciones: [
        { asignacionId: "a1", tipo: "primaria", canal: "canal1", justificacion: "j", estado: "en_curso", activada: true },
        { asignacionId: "a2", tipo: "complementaria", canal: "canal2", justificacion: "k", estado: "pendiente", activada: true },
      ] },
      { pipItemId: "t2", asignaciones: [
        { asignacionId: "b1", tipo: "primaria", canal: "canal3", justificacion: "m", estado: "pendiente", activada: false },
      ] },
    ]);
    const res = await POST(body());
    expect(res.status).toBe(200);
    const escrito = tableroEscrito() as Array<{ pipItemId: string; asignaciones: Array<Record<string, unknown>> }>;
    expect(escrito.map((t) => Object.keys(t).sort())).toEqual([["asignaciones", "pipItemId"], ["asignaciones", "pipItemId"]]);
    expect(escrito[0].asignaciones[0]).toMatchObject({ asignacionId: "a1", estado: "recibido", resultadoId: "r1" });
    expect(escrito[0].asignaciones[1]).toMatchObject({ asignacionId: "a2", estado: "pendiente" });
    expect(escrito[0].asignaciones[1]).not.toHaveProperty("resultadoId");
    expect(escrito[1]).toMatchObject({ pipItemId: "t2" });
    expect(mockDb.updates().find((u) => u.path === P)?.data.updatedAt).toBe("SERVER_TIMESTAMP");
    expect(mockDb.updates().find((u) => u.path === RES)?.data).toEqual({ aprobado: true });
  });

  it("ids legados (legacy-N, un canal por tarea): el tablero se escribe normalizado, sin `numero`", async () => {
    sembrar([
      { numero: 1, canalAsignado: "canal1", justificacion: "j1", estado: "en_curso" },
      { numero: 2, canalAsignado: "canal2", justificacion: "j2", estado: "pendiente" },
    ]);
    const res = await POST(body({ pipItemId: "legacy-1", asignacionId: "1-0" }));
    expect(res.status).toBe(200);
    const escrito = tableroEscrito() as Array<{ pipItemId: string; asignaciones: Array<Record<string, unknown>> }>;
    expect(escrito.map((t) => t.pipItemId)).toEqual(["legacy-1", "legacy-2"]);
    expect(escrito.every((t) => !("numero" in t))).toBe(true);
    expect(escrito[0].asignaciones).toHaveLength(1);
    expect(escrito[0].asignaciones[0]).toMatchObject({
      asignacionId: "1-0", tipo: "primaria", canal: "canal1", justificacion: "j1", estado: "recibido", resultadoId: "r1", activada: true,
    });
    expect(escrito[1].asignaciones[0]).toMatchObject({ asignacionId: "2-0", estado: "pendiente", activada: true });
    expect(escrito[1].asignaciones[0]).not.toHaveProperty("resultadoId");
  });

  it("aprobado:false escribe SOLO el resultado (con notasUsuario si viene) y no valida la asignación", async () => {
    sembrar([{ pipItemId: "t1", asignaciones: [{ asignacionId: "a1", estado: "en_curso", activada: true }] }]);
    const res = await POST(body({ aprobado: false, asignacionId: "no-existe", notasUsuario: "no sirve" }));
    expect(res.status).toBe(200);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ path: RES, data: { aprobado: false, notasUsuario: "no sirve" } });
  });

  it("notasUsuario solo se escribe cuando viene", async () => {
    sembrar([{ pipItemId: "t1", asignaciones: [{ asignacionId: "a1", estado: "en_curso", activada: true }] }]);
    await POST(body({ notasUsuario: "ok" }));
    expect(mockDb.updates().find((u) => u.path === RES)?.data).toEqual({ aprobado: true, notasUsuario: "ok" });
  });
});
