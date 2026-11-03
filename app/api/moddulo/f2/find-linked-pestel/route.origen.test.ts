// find-linked-pestel (T4): `verificar=1` + `moddulo_project_id` en el modo 2 agregan `origen`; sin esos parámetros la
// respuesta es exactamente la de siempre (el helper ni se invoca).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" }, Timestamp: {} }));
vi.mock("@/lib/centinela/pestel/verificarOrigen", () => ({ verificarOrigen: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { verificarOrigen } from "@/lib/centinela/pestel/verificarOrigen";
import { GET } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const llamar = async (qs: string) => {
  const r = await GET(new Request(`http://local/api/moddulo/f2/find-linked-pestel?${qs}`) as never);
  return { status: r.status, cuerpo: await r.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  db.reset({ "pestel_projects/pest1": { userId: "u1", currentStage: 5 }, "pestel_projects/ajena": { userId: "otro", currentStage: 2 } });
});

describe("find-linked-pestel modo 2 — origen (T4)", () => {
  it("sin los parámetros nuevos: la respuesta de siempre y no se verifica nada", async () => {
    const r = await llamar("pestel_project_id=pest1");
    expect(r.cuerpo).toEqual({ found: true, sourceId: "pest1", currentStage: 5 });
    expect(verificarOrigen).not.toHaveBeenCalled();
  });

  it("verificar=1 sin moddulo_project_id: tampoco verifica", async () => {
    const r = await llamar("pestel_project_id=pest1&verificar=1");
    expect(r.cuerpo).toEqual({ found: true, sourceId: "pest1", currentStage: 5 });
    expect(verificarOrigen).not.toHaveBeenCalled();
  });

  it("con verificar=1 y el Moddulo: agrega `origen` y conserva lo de siempre; le pasa el dueño del PESTEL ya leído", async () => {
    vi.mocked(verificarOrigen).mockResolvedValue({ estado: "version_nueva", vigente: { version: 2 } });
    const r = await llamar("pestel_project_id=pest1&moddulo_project_id=m1&verificar=1");
    expect(r.cuerpo).toEqual({ found: true, sourceId: "pest1", currentStage: 5, origen: { estado: "version_nueva", vigente: { version: 2 } } });
    expect(verificarOrigen).toHaveBeenCalledTimes(1);
    expect(vi.mocked(verificarOrigen).mock.calls[0][1]).toEqual({ uid: "u1", pestelProjectId: "pest1", pestelUserId: "u1", modduloProjectId: "m1" });
  });

  it("un PESTEL ajeno responde found:false como siempre y no verifica", async () => {
    const r = await llamar("pestel_project_id=ajena&moddulo_project_id=m1&verificar=1");
    expect(r.cuerpo).toEqual({ found: false });
    expect(verificarOrigen).not.toHaveBeenCalled();
  });

  it("si la verificación falla no se afirma nada: no_verificable, y la respuesta de siempre sigue completa", async () => {
    vi.mocked(verificarOrigen).mockRejectedValue(new Error("boom"));
    const r = await llamar("pestel_project_id=pest1&moddulo_project_id=m1&verificar=1");
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({ found: true, currentStage: 5, origen: { estado: "no_verificable", razon: "error_lectura" } });
  });

  it("sin sesión: 401", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await llamar("pestel_project_id=pest1&moddulo_project_id=m1&verificar=1")).status).toBe(401);
  });
});
