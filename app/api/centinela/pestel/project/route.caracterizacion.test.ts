// T5 — CARACTERIZACIÓN de POST /api/centinela/pestel/project, escrita ANTES de reescribirlo (verde contra HEAD).
// Quedan SOLO las pruebas «SE CONSERVA» (verdes sin editarse tras T5). Las 5 que describían lo que T5 invierte a
// propósito (409 `conflict` ×3, `confirmReplace` que reescribía el linkedSource, el dedup que reafirmaba el
// linkedSource) se eliminaron de aquí; su contraparte nueva está en `route.pendiente.test.ts`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModduloProject } from "@/types/moddulo.types";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "TS", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidA";
const M = "modA";
const body = { nombre: "PESTEL de prueba", tipo: "electoral", territorio: { nivel: "nacional", nombre: "México" }, horizonte: 12 };
const llamar = async (extra: Record<string, unknown> = {}) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ ...body, ...extra }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const moddulo = (exploracion: Record<string, unknown> = {}) => ({ [`moddulo_projects/${M}`]: { phases: { exploracion } } });
const nuevos = () => Object.keys(db.snapshot()).filter((k) => k.startsWith("pestel_projects/"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
  vi.mocked(getProject).mockResolvedValue({} as unknown as ModduloProject);
});

describe("POST /pestel/project — caracterización de HEAD", () => {
  it("SE CONSERVA — con un back-link existente, ni confirmReplace crea otro: el dedup devuelve el existente (200)", async () => {
    db.reset({ ...moddulo({ linkedSource: { kind: "T22", sourceId: "viejo" } }), "pestel_projects/viejo": { userId: UID, modduloProjectId: M } });
    const r = await llamar({ modduloProjectId: M, confirmReplace: true });
    expect(r.status).toBe(200);
    expect(r.cuerpo.projectId).toBe("viejo");
  });

  it("SE CONSERVA — el PESTEL creado lleva los campos de siempre y el back-link", async () => {
    db.reset(moddulo());
    const r = await llamar({ modduloProjectId: M, modduloOrigenEscenario: "A", color: "#026988" });
    expect(r.status).toBe(201);
    const doc = db.snapshot()[`pestel_projects/${r.cuerpo.projectId}`] as Record<string, unknown>;
    expect(doc).toMatchObject({
      userId: UID, nombre: "PESTEL de prueba", tipo: "electoral", horizonte: 12, status: "active", isActive: true,
      autoMonitorEnabled: false, currentStage: 3, color: "#026988", modduloProjectId: M, modduloOrigenEscenario: "A",
      alertas: { vectorRiesgoUmbral: 70, notificarEmail: false, notificarInApp: true },
    });
  });

  it("SE CONSERVA — el dedup solo mira PESTEL del propio usuario y devuelve el más reciente", async () => {
    db.reset({
      ...moddulo(),
      "pestel_projects/viejo": { userId: UID, modduloProjectId: M, createdAt: { _seconds: 1 } },
      "pestel_projects/nuevo": { userId: UID, modduloProjectId: M, createdAt: { _seconds: 9 } },
      "pestel_projects/ajeno": { userId: "otro", modduloProjectId: M, createdAt: { _seconds: 99 } },
    });
    const r = await llamar({ modduloProjectId: M });
    expect(r.status).toBe(200);
    expect(r.cuerpo.projectId).toBe("nuevo");
  });

  it("SE CONSERVA — los campos requeridos y el tipo se validan antes de cualquier lectura", async () => {
    db.reset(moddulo());
    expect((await llamar({ nombre: "" })).status).toBe(400);
    expect((await llamar({ tipo: "otro" })).status).toBe(400);
    expect(vi.mocked(getProject)).not.toHaveBeenCalled();
  });
});
