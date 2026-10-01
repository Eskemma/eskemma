// app/api/moddulo/projects/[projectId]/purge-now/route.test.ts
// Papelera de proyectos de Moddulo — fase (c), Punto 4: DELETE .../purge-now
// es owner-only, exige confirmar el nombre exacto y solo entonces reenvía a
// la Cloud Function con el token de servicio. Mismo 404 anti-enumeración
// que restore/route.test.ts; aquí además se prueba el guard de nombre y
// que el fetch a la Cloud Function nunca se dispara si algo antes falla.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { DELETE } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const OWNER = "uidOwner";
const COLLAB = "uidColaborador";
const OTHER = "uidAjeno";

function req(body: unknown) {
  return new Request("http://local/api/moddulo/projects/p1/purge-now", {
    method: "DELETE",
    body: JSON.stringify(body),
  }) as never;
}

function params(projectId: string) {
  return { params: Promise.resolve({ projectId }) };
}

const fetchMock = vi.fn();

beforeEach(() => {
  mockAdminDb.reset();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: OWNER } as never);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.FIREBASE_FUNCTIONS_URL = "https://fake-cf.example.com";
  process.env.MODDULO_PURGE_TOKEN = "test-token";
});

describe("DELETE .../purge-now", () => {
  it("el dueño, confirmando el nombre exacto, reenvía a la Cloud Function con el token → 200", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        name: "Campaña 2027",
        collaborators: [{ uid: OWNER, role: "owner" }],
        deletedAt: "TS",
      },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ estado: "purgado" }),
    });

    const res = await DELETE(req({ confirmName: "Campaña 2027" }), params("p1"));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fake-cf.example.com/purgeModduloProjectNow");
    expect(init.headers["x-moddulo-purge-token"]).toBe("test-token");
    expect(JSON.parse(init.body)).toEqual({ projectId: "p1", userId: OWNER });
  });

  it("nombre que NO coincide → 400, sin llamar a la Cloud Function", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        name: "Campaña 2027",
        collaborators: [{ uid: OWNER, role: "owner" }],
        deletedAt: "TS",
      },
    });

    const res = await DELETE(req({ confirmName: "otro nombre" }), params("p1"));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin confirmName → 400, sin llamar a la Cloud Function", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        name: "Campaña 2027",
        collaborators: [{ uid: OWNER, role: "owner" }],
        deletedAt: "TS",
      },
    });

    const res = await DELETE(req({}), params("p1"));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un colaborador no-owner → 403, sin llamar a la Cloud Function", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: COLLAB } as never);
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        name: "Campaña 2027",
        collaborators: [{ uid: OWNER, role: "owner" }, { uid: COLLAB, role: "analyst" }],
        deletedAt: "TS",
      },
    });

    const res = await DELETE(req({ confirmName: "Campaña 2027" }), params("p1"));

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proyecto ajeno → 404 (mismo mensaje que inexistente/no-en-papelera)", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: OTHER } as never);
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        name: "Campaña 2027",
        collaborators: [{ uid: OWNER, role: "owner" }],
        deletedAt: "TS",
      },
    });

    const res = await DELETE(req({ confirmName: "Campaña 2027" }), params("p1"));

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proyecto inexistente → 404", async () => {
    const res = await DELETE(req({ confirmName: "X" }), params("noExiste"));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proyecto activo (no en papelera) → 404, aunque el usuario sea dueño", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        name: "Campaña 2027",
        collaborators: [{ uid: OWNER, role: "owner" }],
      },
    });

    const res = await DELETE(req({ confirmName: "Campaña 2027" }), params("p1"));

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin sesión → 401, sin llamar a la Cloud Function", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    const res = await DELETE(req({ confirmName: "X" }), params("p1"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("la Cloud Function responde error → se propaga el status y el mensaje", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        name: "Campaña 2027",
        collaborators: [{ uid: OWNER, role: "owner" }],
        deletedAt: "TS",
      },
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: "solo_el_dueno" }),
    });

    const res = await DELETE(req({ confirmName: "Campaña 2027" }), params("p1"));

    expect(res.status).toBe(403);
  });

  it("la Cloud Function responde con cuerpo NO-JSON (ej. 403 de Cloud Run sin invoker público) → se registra el status y el cuerpo crudo, y se devuelve el mensaje genérico", async () => {
    mockAdminDb.reset({
      "moddulo_projects/p1": {
        userId: OWNER,
        name: "Campaña 2027",
        collaborators: [{ uid: OWNER, role: "owner" }],
        deletedAt: "TS",
      },
    });
    const cuerpoCrudo =
      "The request was not authenticated. Either allow unauthenticated invocations or set the proper Authorization header.";
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => cuerpoCrudo,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await DELETE(req({ confirmName: "Campaña 2027" }), params("p1"));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("No se pudo purgar el proyecto.");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("403"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(cuerpoCrudo));
    errorSpy.mockRestore();
  });
});
