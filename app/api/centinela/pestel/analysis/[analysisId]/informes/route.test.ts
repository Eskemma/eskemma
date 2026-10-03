// POST /api/centinela/pestel/analysis/[analysisId]/informes
// Sube un texto de la caché local legada como informe nuevo (migración).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
const ctl = vi.hoisted(() => ({ falla: null as null | Error }));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: (...items: unknown[]) => {
      if (ctl.falla) throw ctl.falla;
      return { __arrayUnion: items };
    },
  },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const mockSession = vi.mocked(getSessionFromRequest);
const UID = "uidA";

function seed(ownerUid = UID) {
  db.reset({
    "pestel_projects/p1": { userId: ownerUid },
    "pestel_analyses/an1": { projectId: "p1", dimensions: [] },
  });
}

function call(body: unknown) {
  const req = new Request("http://localhost/x", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
  return POST(req, { params: Promise.resolve({ analysisId: "an1" }) });
}

describe("POST informes (migración desde localStorage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctl.falla = null;
    mockSession.mockResolvedValue(mockSessionPayload({ uid: UID }));
    seed();
  });

  it("401 sin sesión", async () => {
    mockSession.mockResolvedValue(null);
    expect((await call({ formato: "executive", contenido: "x" })).status).toBe(401);
  });

  it("400 con formato o contenido inválidos", async () => {
    expect((await call({ formato: "otro", contenido: "x" })).status).toBe(400);
    expect((await call({ formato: "executive", contenido: "  " })).status).toBe(400);
    expect((await call({ formato: "executive" })).status).toBe(400);
  });

  it("crea el informe marcado como migrado, con el texto local como contenidoTexto", async () => {
    const res = await call({ formato: "foda", contenido: "texto local" });
    expect(res.status).toBe(201);
    const { informeId } = (await res.json()) as { informeId: string };
    const guardado = db.snapshot()["pestel_analyses/an1"] as {
      informes: { __arrayUnion: Record<string, unknown>[] };
    };
    const informe = guardado.informes.__arrayUnion[0];
    expect(informe).toMatchObject({
      id: informeId,
      formato: "foda_lista",
      contenidoTexto: "texto local",
      origen: "migrado_localstorage",
    });
  });

  it("404 idéntico si el análisis es ajeno, sin escribir", async () => {
    seed("otro");
    const antes = JSON.stringify(db.snapshot());
    expect((await call({ formato: "executive", contenido: "x" })).status).toBe(404);
    expect(JSON.stringify(db.snapshot())).toBe(antes);
  });

  it("documento lleno: 413 limite_documento", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    ctl.falla = new Error("3 INVALID_ARGUMENT: Document exceeds the maximum size");
    const res = await call({ formato: "executive", contenido: "texto" });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toBe("limite_documento");
  });
});
