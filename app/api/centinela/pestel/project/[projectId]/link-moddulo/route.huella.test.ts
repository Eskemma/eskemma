// link-moddulo (T4): al vincular con un análisis, el vínculo guarda la huella del CONTENIDO de ese análisis
// (`linkedSource.huellaFuente`); sin análisis (solo vínculo) no hay mapa ni huella.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { huellaDeOrigen } from "@/lib/centinela/pestel/huellaOrigen";
import { AJUSTES_EJEMPLO, DIMENSIONES_EJEMPLO } from "@/lib/centinela/pestel/__fixtures__/analisisEjemplo";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const NAC = { nivel: "nacional", nombre: "México" };
const vincular = async (analisis: Record<string, unknown> | null) => {
  db.reset({
    "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: NAC },
    "moddulo_projects/m1": { name: "M", type: "electoral", territorio: NAC, xpcto: { hito: "h" }, phases: { exploracion: {} } },
    ...(analisis ? { "pestel_analyses/a1": { status: "APPROVED", projectId: "pest1", analyzedAt: "2026-10-01T00:00:00Z", ...analisis } } : {}),
  });
  db.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: "m1" }) }) as never, { params: Promise.resolve({ projectId: "pest1" }) });
  const linked = db.updates().find((u) => u.path === "moddulo_projects/m1")?.data["phases.exploracion.linkedSource"] as Record<string, unknown> | undefined;
  return { status: r.status, linked };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("link-moddulo — huellaFuente (T4)", () => {
  it("con análisis: guarda la huella del contenido junto al mapa", async () => {
    const r = await vincular({ dimensions: DIMENSIONES_EJEMPLO, adjustments: AJUSTES_EJEMPLO });
    expect(r.status).toBe(201);
    expect(r.linked?.huellaFuente).toEqual(huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never));
    expect(r.linked?.sourceAnalysisId).toBe("a1");
  });

  it("sin análisis (solo vínculo): no hay mapa ni huella", async () => {
    const r = await vincular(null);
    expect(r.status).toBe(201);
    expect(r.linked).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(r.linked, "huellaFuente")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(r.linked, "payload")).toBe(false);
  });
});
