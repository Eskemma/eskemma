// finalize-dvs: al reemplazar un dvs ya finalizado se conserva el anterior en
// dvsVersiones dentro de la MISMA transacción; la primera finalización no copia;
// si la copia falla el reemplazo se aborta (500) y no se aplica nada.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const dvsA = { hei: { tensionCentral: "A" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [{ pipItemId: "x", numero: 1 }] };
const dvsB = { ...dvsA, hei: { tensionCentral: "B" } };

function req(body: unknown) {
  return new Request("http://local/api/moddulo/f2/finalize-dvs", { method: "POST", body: JSON.stringify(body) }) as never;
}
const versiones = () => Object.entries(mockAdminDb.snapshot()).filter(([p]) => p.startsWith(`${P}/dvsVersiones/`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
});

describe("POST finalize-dvs", () => {
  it("primera finalización (sin dvs previo): 200, sin copia", async () => {
    vi.mocked(getProject).mockResolvedValue({ phases: { exploracion: {} } } as never);
    mockAdminDb.reset({ [P]: { phases: { exploracion: {} } } });
    const res = await POST(req({ projectId: "p1", draftDVS: dvsA }));
    expect(res.status).toBe(200);
    expect(versiones()).toHaveLength(0);
    expect(mockAdminDb.updates()[0].data["phases.exploracion.estado"]).toBe("lista");
  });

  it("reemplazo de un dvs distinto: 200 y deja una copia del anterior con uid y origen", async () => {
    vi.mocked(getProject).mockResolvedValue({ phases: { exploracion: { dvs: dvsA } } } as never);
    mockAdminDb.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } } });
    const res = await POST(req({ projectId: "p1", draftDVS: dvsB }));
    expect(res.status).toBe(200);
    const v = versiones();
    expect(v).toHaveLength(1);
    expect(v[0][1]).toMatchObject({ dvs: dvsA, reemplazadoPor: "uOwner", origen: "finalize-dvs" });
  });

  it("«Guardar cambios» sin cambios (mismo contenido): 200 y NO crea otra copia", async () => {
    vi.mocked(getProject).mockResolvedValue({ phases: { exploracion: { dvs: dvsA } } } as never);
    mockAdminDb.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } } });
    const res = await POST(req({ projectId: "p1", draftDVS: structuredClone(dvsA) }));
    expect(res.status).toBe(200);
    expect(versiones()).toHaveLength(0);
  });

  it("si la copia falla: 500 con mensaje y NO se aplica ninguna escritura", async () => {
    vi.mocked(getProject).mockResolvedValue({ phases: { exploracion: { dvs: dvsA } } } as never);
    mockAdminDb.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } } });
    mockAdminDb.runTransaction.mockRejectedValueOnce(new Error("copia falló"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ projectId: "p1", draftDVS: dvsB }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("el anterior se conserva sin cambios");
    expect(mockAdminDb.updates()).toHaveLength(0);
  });

  it("sigue exigiendo sesión y proyecto", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await POST(req({ projectId: "p1", draftDVS: dvsA }))).status).toBe(401);
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await POST(req({ projectId: "p1", draftDVS: dvsA }))).status).toBe(404);
  });
});
