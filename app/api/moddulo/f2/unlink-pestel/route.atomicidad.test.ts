// H25 (7b-2) — atomicidad de unlink-pestel. Mock «todo o nada» (modela la garantía; no la demuestra:
// no hay emulador de Firestore). Contra la ruta anterior las pruebas marcadas [real] FALLAN.

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
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "m1" }) }) as never;
// Paso 4: unlinking ALWAYS asks first; the probe writes nothing, the second request confirms.
async function POSTc() {
  const sondeo = await POST(req());
  expect(sondeo.status).toBe(409);
  const { huella } = await sondeo.json();
  return POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "m1", confirmar: true, huella }) }) as never);
}
const T22 = { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } };
const inicial = {
  "moddulo_projects/m1": { name: "M", phases: { exploracion: { linkedSource: T22 } } },
  "pestel_projects/pest1": { userId: "u1", modduloProjectId: "m1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset(structuredClone(inicial));
  mockDb.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
});

describe("unlink-pestel — todo o nada", () => {
  it("[real] si falla la escritura de PESTEL, el Moddulo NO queda desvinculado", async () => {
    mockDb.failUpdateOn("pestel_projects/pest1");
    await expect(POSTc()).rejects.toThrow();
    expect(mockDb.updates()).toHaveLength(0);
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("[local] si falla la escritura del Moddulo (la primera), PESTEL conserva su back-link", async () => {
    mockDb.failUpdateOn("moddulo_projects/m1");
    await expect(POSTc()).rejects.toThrow();
    expect(mockDb.snapshot()).toEqual(inicial);
  });

  it("[real] camino feliz: UNA transacción con las dos escrituras (la confirmada; la sonda no escribe)", async () => {
    const r = await POSTc();
    expect(r.status).toBe(200);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(2); // the probe (nothing written) + the confirmed request
    expect(mockDb.updates().map((u) => u.path).sort()).toEqual(["moddulo_projects/m1", "pestel_projects/pest1"]);
  });

  it("[real] dos desvinculaciones simultáneas: la 2.ª ve (dentro de la transacción) que ya no hay vínculo → 400 y no escribe", async () => {
    // getProject devuelve la foto VIEJA (con vínculo) mientras el documento ya fue desvinculado por otra petición.
    const vieja = structuredClone(inicial["moddulo_projects/m1"]);
    vi.mocked(getProject).mockResolvedValue(vieja as never);
    mockDb.reset({ "moddulo_projects/m1": { name: "M", phases: { exploracion: {} } }, "pestel_projects/pest1": { userId: "u1" } });
    mockDb.atomico(true);
    const r = await POST(req()); // sin vínculo no hay nada que confirmar: 400 directo
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe("not_linked");
    expect(mockDb.updates()).toHaveLength(0);
  });
});
