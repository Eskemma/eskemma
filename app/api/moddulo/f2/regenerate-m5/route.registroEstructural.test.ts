// G (paso 4): regenerate-m5 no registra texto del modelo y su 500 ya no devuelve `raw`.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return { ...real, getProject: vi.fn() };
});
vi.mock("@/lib/ai/claude", () => ({ anthropic: { messages: { create: vi.fn() } }, CLAUDE_MODEL: "modelo-de-prueba" }));
vi.mock("@/lib/moddulo/knowledge-injector", () => ({ buildPhaseContext: vi.fn(async () => "") }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { anthropic } from "@/lib/ai/claude";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { exploracionGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const MARCA = "MARCADOR-DEL-PROYECTO-123";
const modelo = (text: string, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "text", text }] }) as never;
/** Every console.* argument of the run, flattened. */
const espias: Array<ReturnType<typeof vi.spyOn>> = [];
const registros = () =>
  espias.flatMap((e) => e.mock.calls as unknown[][]).map((c) => c.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")).join("\n");

const draft = { hei: {}, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] };
beforeEach(() => {
  vi.clearAllMocks();
  espias.length = 0;
  for (const m of ["error", "log", "warn"] as const) espias.push(vi.spyOn(console, m).mockImplementation(() => {}));
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  const exploracion = exploracionGate("sin_m1", { draftDVS: draft });
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: {}, phases: { exploracion } } as never);
  mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
  crear.mockReset();
});
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never;

describe("regenerate-m5 — registros estructurales", () => {
  it("respuesta que no parsea: ni el log ni el cuerpo llevan el texto", async () => {
    crear.mockResolvedValue(modelo(`{"hei": ${MARCA}`));
    const res = await POST(req());
    expect(res.status).toBe(500);
    const cuerpo = await res.json();
    expect(cuerpo).not.toHaveProperty("raw");
    expect(JSON.stringify(cuerpo)).not.toContain(MARCA);
    expect(registros()).toContain("parse failure longitud=");
    expect(registros()).not.toContain(MARCA);
  });
  it("M5 vacío tras sanitizar: se registra la forma, no el contenido", async () => {
    crear.mockResolvedValue(modelo(JSON.stringify({ hei: { x: MARCA }, pip: [] })));
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(registros()).toContain("empty after sanitization longitud=");
    expect(registros()).not.toContain(MARCA);
  });
});
