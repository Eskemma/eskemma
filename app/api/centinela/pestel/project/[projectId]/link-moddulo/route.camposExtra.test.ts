// M1 de F2 (3b): la pantalla envía `confirmar` y `huella` al vincular. Paso 4: el servidor los EXIGE solo cuando
// algo se perdería (ver route.candado.test.ts); con un proyecto limpio la ruta responde IGUAL con o sin esos campos.

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
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const NAC = { nivel: "nacional", nombre: "México" };
const docs = () => ({
  "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: NAC },
  "moddulo_projects/m1": { name: "M", type: "electoral", territorio: NAC, xpcto: { hito: "h" }, phases: { exploracion: {} } },
  "pestel_analyses/a1": { projectId: "pest1", analyzedAt: "2026-10-01T00:00:00Z", dimensions: [] },
});
const llamar = async (cuerpo: Record<string, unknown>) => {
  mockDb.reset(structuredClone(docs()));
  mockDb.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never, ctx);
  return { status: r.status, cuerpo: await r.json(), escrituras: mockDb.updates().map((u) => u.path).sort() };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("link-moddulo ignora los campos de confirmación que aún no exige", () => {
  it("con `confirmar` y `huella` responde y escribe exactamente lo mismo que sin ellos", async () => {
    const sin = await llamar({ modduloProjectId: "m1" });
    const con = await llamar({ modduloProjectId: "m1", confirmar: true, huella: "abc" });
    expect(sin.status).toBe(201);
    expect(con.status).toBe(sin.status);
    expect(con.cuerpo).toEqual(sin.cuerpo);
    expect(con.escrituras).toEqual(sin.escrituras);
  });
});
