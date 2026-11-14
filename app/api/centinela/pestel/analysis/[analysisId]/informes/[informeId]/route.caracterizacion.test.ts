// Caracterización del PATCH de edición ANTES de H75: editar un informe conserva TODOS sus demás campos
// (incluidos los que se agreguen después, como `truncado`/`stopReason`), porque la ruta reescribe el elemento
// con `...informes[idx]`. Verde contra el código anterior (con un campo cualquiera) y sin editar después.

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
const UID = "uidA";

describe("PATCH informes/[informeId] — conserva los campos que no edita (caracterización)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    db.reset({
      "pestel_projects/p1": { userId: UID, nombre: "P" },
      "pestel_analyses/an1": {
        projectId: "p1",
        informes: [
          {
            id: "i1",
            formato: "tecnico",
            contenidoTexto: "gen",
            datosEstructurados: { scorecard: [], mapaPESTEL: {} },
            generadoEn: "2026-10-01T10:00:00.000Z",
            campoFuturo: "se conserva",
          },
        ],
      },
    });
  });

  it("un campo desconocido del informe sobrevive a la edición", async () => {
    const req = new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ contenido: "editado" }) }) as unknown as Parameters<typeof PATCH>[0];
    const res = await PATCH(req, { params: Promise.resolve({ analysisId: "an1", informeId: "i1" }) });
    expect(res.status).toBe(200);
    const inf = (db.snapshot()["pestel_analyses/an1"] as { informes: Record<string, unknown>[] }).informes[0];
    expect(inf).toMatchObject({ contenidoTexto: "gen", contenidoEditado: "editado", campoFuturo: "se conserva" });
  });
});
