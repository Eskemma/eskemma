// C3a-2 — CARACTERIZACIÓN de resultados/aprobar escrita ANTES de adoptar el historial: fija lo que hace hoy
// en los casos que C3a-2 toca (forma del documento vivo tras aprobar o retirar, aprobar repetido, y el caso
// aprobado:false con un proyecto que ya no existe). Debe pasar contra el código anterior (cb1c1f8).

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

const TABLERO = [
  { pipItemId: "t1", asignaciones: [{ asignacionId: "a1", tipo: "primaria", canal: "canal1", justificacion: "j", estado: "en_curso", activada: true }] },
];
const DOC_RES = {
  moduloPIP: "¿Pregunta?",
  origen: { sourceKind: "T10", componente: "centinela", analisisId: "r1", fechaEntrega: "2026-01-01T00:00:00.000Z" },
  cobertura: { completa: true },
  payload: { archivoUrl: "moddulo/u1/p1/f3/r1/f.json", extractoTexto: "texto" },
  createdAt: "TS-ANTERIOR",
};

function sembrar(resultado: Record<string, unknown>, tablero: unknown[] = TABLERO, conProyecto = true) {
  const proyecto = { phases: { investigacion: { f3TareasPIP: tablero } } };
  mockDb.reset({ [RES]: resultado, ...(conProyecto ? { [P]: proyecto } : {}) });
  vi.mocked(getProject).mockResolvedValue({
    phases: { investigacion: { f3TareasPIP: tablero.map((t) => normalizeTareaPIP(t as never)) } },
  } as never);
}
const vivo = () => mockDb.snapshot()[RES] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("resultados/aprobar — caracterización C3a-2 (comportamiento actual)", () => {
  it("el documento vivo tras aprobar es el previo + {aprobado, notasUsuario}: SIN sello ni ningún campo nuevo", async () => {
    sembrar(DOC_RES);
    expect((await POST(body({ notasUsuario: "ok" }))).status).toBe(200);
    expect(vivo()).toEqual({ ...DOC_RES, aprobado: true, notasUsuario: "ok" });
  });

  it("retirar la aprobación (aprobado:false) deja el resto del documento y CONSERVA notasUsuario previo si no viene otra", async () => {
    sembrar({ ...DOC_RES, aprobado: true, notasUsuario: "nota previa" });
    expect((await POST(body({ aprobado: false }))).status).toBe(200);
    expect(vivo()).toEqual({ ...DOC_RES, aprobado: false, notasUsuario: "nota previa" });
  });

  it("aprobar un resultado ya aprobado: 200 y vuelve a escribir la misma forma (idempotente en el vivo)", async () => {
    sembrar({ ...DOC_RES, aprobado: true, notasUsuario: "ok" }, [
      { pipItemId: "t1", asignaciones: [{ asignacionId: "a1", tipo: "primaria", canal: "canal1", justificacion: "j", estado: "recibido", resultadoId: "r1", activada: true }] },
    ]);
    expect((await POST(body({ notasUsuario: "ok" }))).status).toBe(200);
    expect(vivo()).toEqual({ ...DOC_RES, aprobado: true, notasUsuario: "ok" });
    const tablero = mockDb.updates().find((u) => u.path === P)?.data["phases.investigacion.f3TareasPIP"] as Array<{ asignaciones: Array<Record<string, unknown>> }>;
    expect(tablero[0].asignaciones[0]).toMatchObject({ estado: "recibido", resultadoId: "r1" });
  });

  // ÚNICA prueba de este archivo que cambia de sentido con C3a-2 (declarada): ANTES (cb1c1f8) respondía 200 y
  // escribía solo el resultado `[RES]`; AHORA el proyecto es necesario (el puntero del historial vive ahí) y
  // responde 404 «Proyecto no encontrado» sin escribir nada.
  it("aprobado:false con el proyecto SIN documento en la transacción: 404 y cero escrituras (antes: 200 y solo el resultado)", async () => {
    sembrar(DOC_RES, TABLERO, false);
    const res = await POST(body({ aprobado: false }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Proyecto no encontrado");
    expect(mockDb.updates()).toHaveLength(0);
  });
});
