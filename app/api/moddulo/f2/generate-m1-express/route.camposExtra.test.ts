// M1 de F2 (3b): la pantalla ya envía `confirmar` y `huella` a generate-m1-express (el servidor los exige
// desde el commit 4). Hoy la ruta solo lee `projectId`: con esos campos debe llegar a la misma
// comprobación que sin ellos (aquí, el 404 de un proyecto inaccesible), no a un 400.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/ai/claude", () => ({ anthropic: { messages: { create: vi.fn() } }, CLAUDE_MODEL: "m" }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { anthropic } from "@/lib/ai/claude";
import { POST } from "./route";

const llamar = async (cuerpo: Record<string, unknown>) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockResolvedValue(null as never);
});

describe("generate-m1-express ignora los campos de confirmación que aún no exige", () => {
  it("con `confirmar` y `huella` llega a la misma comprobación (404) que sin ellos, y no llama a Claude", async () => {
    const sin = await llamar({ projectId: "p1" });
    const con = await llamar({ projectId: "p1", confirmar: true, huella: "abc" });
    expect(sin.status).toBe(404);
    expect(con).toEqual(sin);
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });
});
