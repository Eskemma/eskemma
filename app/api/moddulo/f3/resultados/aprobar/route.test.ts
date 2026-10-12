// H25 (commit 6c) — resultados/aprobar. Esta prueba fija un HECHO de la ruta que decide el texto
// de la pantalla: escribe `aprobado` en el resultado ANTES de buscar la asignación en el tablero,
// así que su 404 «Asignación no encontrada en el tablero» llega con la escritura YA hecha
// (guardadoHonesto lo trata como ambiguo). No se cambia la ruta: se documenta como hallazgo.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const RES = "moddulo_projects/p1/f3Resultados/r1";
const body = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", {
    method: "POST",
    body: JSON.stringify({ projectId: "p1", resultadoId: "r1", pipItemId: "t1", asignacionId: "a1", aprobado: true, ...o }),
  }) as never;
const tareas = [{ pipItemId: "t1", asignaciones: [{ asignacionId: "a1", estado: "en_curso", activada: true }] }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockResolvedValue({ phases: { investigacion: { f3TareasPIP: tareas } } } as never);
  mockDb.reset({ [RES]: { aprobado: false } });
});

describe("POST resultados/aprobar", () => {
  it("aprueba y enlaza la asignación: 200 y DOS escrituras (resultado y tablero)", async () => {
    const res = await POST(body());
    expect(res.status).toBe(200);
    const u = mockDb.updates();
    expect(u).toHaveLength(2);
    expect(u[0].data).toMatchObject({ aprobado: true });
    expect(u[1].data["phases.investigacion.f3TareasPIP"]).toBeDefined();
  });

  it("HECHO: con una asignación que no está en el tablero, responde 404 DESPUÉS de haber escrito `aprobado`", async () => {
    const res = await POST(body({ asignacionId: "no-existe" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Asignación no encontrada en el tablero");
    const u = mockDb.updates();
    expect(u).toHaveLength(1); // el resultado ya quedó aprobado
    expect(u[0].data).toMatchObject({ aprobado: true });
  });

  it("resultado inexistente: 404 «Resultado no encontrado» y cero escrituras; proyecto ajeno: 404", async () => {
    mockDb.reset({});
    const res = await POST(body());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Resultado no encontrado");
    expect(mockDb.updates()).toHaveLength(0);
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await POST(body())).status).toBe(404);
  });

  it("sin sesión: 401; cuerpo incompleto: 400", async () => {
    expect((await POST(body({ aprobado: "sí" }))).status).toBe(400);
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await POST(body())).status).toBe(401);
  });
});
