// 4f: el 500 de fallo del modelo lleva `motor`, `causa` y ningún texto del proveedor.
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


const PROVEEDOR = Object.assign(new Error("SECRETO-xyz request_id=req_FAKE123 credit balance is too low"), { name: "APIError", status: 400 });
const errCon = (status: number) => Object.assign(new Error("SECRETO-xyz request_id=req_FAKE123"), { name: "APIError", status });

describe("regenerate-m5 — 4f: causa del fallo del modelo", () => {
  it.each([
    [400, "saldo"], [429, "limite"], [529, "sobrecarga"], [503, "sobrecarga"], [402, "saldo"], [500, "otro"],
  ] as const)("status %s → causa %s, 500 cierto con motor, sin mensaje del proveedor y sin escrituras", async (status, causa) => {
    crear.mockRejectedValue(status === 400 ? PROVEEDOR : errCon(status));
    const res = await POST(req());
    expect(res.status).toBe(500);
    const cuerpo = await res.json();
    expect(cuerpo.codigo).toBe("fallo_modelo");
    expect(cuerpo.causa).toBe(causa);
    expect(typeof cuerpo.motor).toBe("string");
    const texto = JSON.stringify(cuerpo);
    expect(texto).not.toContain("SECRETO");
    expect(texto).not.toContain("req_FAKE123");
    expect(texto).not.toContain("credit balance");
    expect(mockDb.updates()).toEqual([]);
    expect(registros()).not.toContain("SECRETO");
    expect(registros()).not.toContain("req_FAKE123");
    expect(registros()).toContain("causa=" + causa);
  });
});
