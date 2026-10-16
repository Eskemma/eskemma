// M1 de F2 (3b): la pantalla ya envía `confirmar` (y `huella` al reintentar) al desvincular; el servidor
// los exige desde el commit 4. Mientras tanto la ruta responde y escribe IGUAL con o sin esos campos.

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
const T22 = { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } };
const docs = () => ({
  "moddulo_projects/m1": { name: "M", phases: { exploracion: { linkedSource: T22 } } },
  "pestel_projects/pest1": { userId: "u1", modduloProjectId: "m1" },
});
const llamar = async (cuerpo: Record<string, unknown>) => {
  mockDb.reset(structuredClone(docs()));
  mockDb.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never);
  return { status: r.status, cuerpo: await r.json(), escrituras: mockDb.updates().map((u) => ({ path: u.path, data: u.data })) };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("unlink-pestel ignora los campos de confirmación que aún no exige", () => {
  it("con `confirmar` y `huella` responde y escribe exactamente lo mismo que sin ellos", async () => {
    const sin = await llamar({ projectId: "m1" });
    const con = await llamar({ projectId: "m1", confirmar: true, huella: "abc" });
    expect(sin.status).toBe(200);
    expect(con.status).toBe(200);
    expect(con.cuerpo).toEqual(sin.cuerpo);
    expect(con.escrituras).toEqual(sin.escrituras);
  });
});
