// H25 (commit 7b-4) — resultados/aprobar: VALIDAR ANTES DE ESCRIBIR y escritura atómica del resultado
// y del tablero, con el tablero releído DENTRO de la transacción. Modo `atomico(true)` del fixture
// (modela el todo-o-nada; no lo demuestra: sin emulador). [real] = falla contra la ruta anterior;
// [local] = pasa también contra la ruta anterior (documenta, no discrimina).

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
const asig = (id: string, estado = "en_curso") => ({ asignacionId: id, tipo: "primaria", canal: "canal1", justificacion: "j", estado, activada: true });
const tablero = (...ids: string[]) => [{ pipItemId: "t1", asignaciones: ids.map((i) => asig(i)) }];

/** `vista` = lo que getProject entrega (lectura previa); `doc` = lo que hay en Firestore al transaccionar. */
function sembrar(doc: unknown[], vista: unknown[] = doc) {
  mockDb.reset({ [RES]: { aprobado: false }, [P]: { phases: { investigacion: { f3TareasPIP: doc } } } });
  mockDb.atomico(true);
  vi.mocked(getProject).mockResolvedValue({
    phases: { investigacion: { f3TareasPIP: vista.map((t) => normalizeTareaPIP(t as never)) } },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("resultados/aprobar — validar antes de escribir y atomicidad", () => {
  it("[real] asignación inexistente: 404 y CERO escrituras (la ruta anterior ya había aprobado el resultado)", async () => {
    sembrar(tablero("a1"));
    const res = await POST(body({ asignacionId: "no-existe" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Asignación no encontrada en el tablero");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[real] camino feliz: UNA transacción con las dos escrituras (resultado y tablero)", async () => {
    sembrar(tablero("a1"));
    const res = await POST(body());
    expect(res.status).toBe(200);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockDb.updates().map((u) => u.path)).toEqual([RES, P]);
  });

  it("[real] falla la escritura del tablero: el resultado NO queda aprobado", async () => {
    sembrar(tablero("a1"));
    mockDb.failUpdateOn(P);
    await expect(POST(body())).rejects.toThrow();
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[real] el tablero cambió entre la lectura previa y la transacción: se usa el de la transacción", async () => {
    // getProject ve [a1]; en Firestore ya hay [a1, a2] (otra pestaña sincronizó).
    sembrar(tablero("a1", "a2"), tablero("a1"));
    const res = await POST(body());
    expect(res.status).toBe(200);
    const escrito = mockDb.updates().find((u) => u.path === P)?.data["phases.investigacion.f3TareasPIP"] as Array<{ asignaciones: Array<{ asignacionId: string; estado: string }> }>;
    expect(escrito[0].asignaciones.map((a) => [a.asignacionId, a.estado])).toEqual([["a1", "recibido"], ["a2", "en_curso"]]);
  });

  it("[real] una asignación que solo existe en la transacción sí se aprueba (la lectura previa es solo acceso)", async () => {
    sembrar(tablero("a1", "a2"), tablero("a1"));
    expect((await POST(body({ asignacionId: "a2" }))).status).toBe(200);
  });

  it("[real] el proyecto desaparece entre la lectura previa y la transacción: 404 sin escribir", async () => {
    sembrar(tablero("a1"));
    mockDb.reset({ [RES]: { aprobado: false } });
    mockDb.atomico(true);
    const res = await POST(body());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Proyecto no encontrado");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[local] aprobado:false escribe SOLO el resultado y no toca el tablero", async () => {
    sembrar(tablero("a1"));
    expect((await POST(body({ aprobado: false }))).status).toBe(200);
    expect(mockDb.updates().map((u) => u.path)).toEqual([RES]);
  });

  it("[local] falla la escritura del resultado: nada queda escrito", async () => {
    sembrar(tablero("a1"));
    mockDb.failUpdateOn(RES);
    await expect(POST(body())).rejects.toThrow();
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[local] resultado inexistente: 404 «Resultado no encontrado» sin escribir", async () => {
    sembrar(tablero("a1"));
    mockDb.reset({ [P]: { phases: { investigacion: { f3TareasPIP: tablero("a1") } } } });
    mockDb.atomico(true);
    const res = await POST(body());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Resultado no encontrado");
    expect(mockDb.updates()).toHaveLength(0);
  });
});
