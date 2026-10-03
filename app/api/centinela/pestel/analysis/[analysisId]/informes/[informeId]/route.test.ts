// PATCH /api/centinela/pestel/analysis/[analysisId]/informes/[informeId]
// Guarda la edición de un informe E7. Se prueba: sesión, validación, guard de
// propiedad (404 idéntico para ajeno/inexistente), que la generación original
// NO se toca y que solo cambia el informe indicado.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { PATCH } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const mockSession = vi.mocked(getSessionFromRequest);

const UID = "uidA";
const informeBase = (id: string, formato: string, texto: string) => ({
  id,
  formato,
  contenidoTexto: texto,
  datosEstructurados: { scorecard: [], mapaPESTEL: {} },
  generadoEn: "2026-10-01T10:00:00.000Z",
});

function seed(ownerUid = UID) {
  db.reset({
    "pestel_projects/p1": { userId: ownerUid, nombre: "P" },
    "pestel_analyses/an1": {
      projectId: "p1",
      informes: [informeBase("i1", "ejecutivo", "gen1"), informeBase("i2", "tecnico", "gen2")],
    },
  });
}

function call(informeId: string, body: unknown) {
  const req = new Request("http://localhost/x", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0];
  return PATCH(req, { params: Promise.resolve({ analysisId: "an1", informeId }) });
}

describe("PATCH informes/[informeId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue(mockSessionPayload({ uid: UID }));
    seed();
  });

  it("401 sin sesión", async () => {
    mockSession.mockResolvedValue(null);
    expect((await call("i1", { contenido: "x" })).status).toBe(401);
  });

  it("400 con JSON inválido o contenido que no es string", async () => {
    expect((await call("i1", "{no")).status).toBe(400);
    expect((await call("i1", { contenido: 5 })).status).toBe(400);
  });

  it("413 si el contenido excede el tope", async () => {
    expect((await call("i1", { contenido: "x".repeat(200_001) })).status).toBe(413);
  });

  it("guarda la edición sin tocar la generación ni los otros informes", async () => {
    const res = await call("i1", { contenido: "mi versión" });
    expect(res.status).toBe(200);
    const informes = (db.snapshot()["pestel_analyses/an1"] as { informes: Record<string, unknown>[] })
      .informes;
    expect(informes[0]).toMatchObject({
      id: "i1",
      contenidoTexto: "gen1",
      contenidoEditado: "mi versión",
      editadoPor: UID,
    });
    expect(typeof informes[0].editadoEn).toBe("string");
    expect(informes[1]).toEqual(informeBase("i2", "tecnico", "gen2"));
  });

  it("un segundo guardado sobrescribe la edición (no es historial)", async () => {
    await call("i1", { contenido: "v1" });
    await call("i1", { contenido: "v2" });
    const informes = (db.snapshot()["pestel_analyses/an1"] as { informes: Record<string, unknown>[] })
      .informes;
    expect(informes[0].contenidoEditado).toBe("v2");
    expect(informes[0].contenidoTexto).toBe("gen1");
  });

  it("acepta contenido vacío (el usuario puede borrar todo)", async () => {
    expect((await call("i1", { contenido: "" })).status).toBe(200);
  });

  it("404 si el informe no existe", async () => {
    expect((await call("nope", { contenido: "x" })).status).toBe(404);
  });

  it("404 idéntico si el análisis es de otro usuario, y no escribe nada", async () => {
    seed("otroUsuario");
    const antes = JSON.stringify(db.snapshot());
    const res = await call("i1", { contenido: "x" });
    expect(res.status).toBe(404);
    expect(JSON.stringify(db.snapshot())).toBe(antes);
  });

  it("404 si el análisis no existe", async () => {
    db.reset({});
    expect((await call("i1", { contenido: "x" })).status).toBe(404);
  });

  it("documento lleno: 413 limite_documento y la edición no se guarda", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.runTransaction.mockImplementationOnce(async () => {
      throw new Error("3 INVALID_ARGUMENT: Document exceeds the maximum size");
    });
    const res = await call("i1", { contenido: "x" });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toBe("limite_documento");
  });

  it("otro error de Firestore no se disfraza de 'lleno'", async () => {
    db.runTransaction.mockImplementationOnce(async () => {
      throw new Error("permission denied");
    });
    await expect(call("i1", { contenido: "x" })).rejects.toThrow("permission denied");
  });

  it("alerta de tamaño al editar: 60 % aviso, 80 % prioridad", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const sembrarGrande = (kb: number) =>
      db.reset({
        "pestel_projects/p1": { userId: UID },
        "pestel_analyses/an1": {
          projectId: "p1",
          informes: [{ ...informeBase("i1", "ejecutivo", "x".repeat(kb * 1024)) }],
        },
      });
    sembrarGrande(650);
    await call("i1", { contenido: "editado" });
    expect(warn.mock.calls.some((c) => String(c[0]).includes("aviso temprano"))).toBe(true);
    sembrarGrande(850);
    await call("i1", { contenido: "editado" });
    expect(error.mock.calls.some((c) => String(c[0]).includes("PRIORIDAD ALTA"))).toBe(true);
  });
});
