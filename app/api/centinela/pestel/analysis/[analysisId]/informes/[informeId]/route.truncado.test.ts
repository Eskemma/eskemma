// H75 — editar un informe marcado como truncado conserva la marca: el aviso de la pantalla sigue visible
// tras editar (el PATCH solo agrega contenidoEditado/editadoEn/editadoPor).

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

describe("PATCH informes/[informeId] — conserva truncado y stopReason (H75)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: "uidA" }));
    db.reset({
      "pestel_projects/p1": { userId: "uidA", nombre: "P" },
      "pestel_analyses/an1": {
        projectId: "p1",
        informes: [
          { id: "i1", formato: "tecnico", contenidoTexto: "cortado", datosEstructurados: { scorecard: [], mapaPESTEL: {} }, generadoEn: "2026-11-13T10:00:00.000Z", stopReason: "max_tokens", truncado: true },
        ],
      },
    });
  });

  it("la edición no borra truncado ni stopReason", async () => {
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ contenido: "mi versión completa" }) }) as unknown as Parameters<typeof PATCH>[0];
    expect((await PATCH(req, { params: Promise.resolve({ analysisId: "an1", informeId: "i1" }) })).status).toBe(200);
    const inf = (db.snapshot()["pestel_analyses/an1"] as { informes: Record<string, unknown>[] }).informes[0];
    expect(inf).toMatchObject({ contenidoTexto: "cortado", contenidoEditado: "mi versión completa", truncado: true, stopReason: "max_tokens" });
  });
});
