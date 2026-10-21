// Paso 6: regenerate-m5 pasa aprobado=true con m1 aprobado y false sin registro m1 (mismo builder que generate-dvs).
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

const m5 = { hei: { tensionCentral: "t", contexto: "c", condicionesFavorables: [], condicionesAdversas: [], premisaEstrategica: "p" }, pip: [{ numero: 1, pregunta: "q", metodo: "m", vinculoHito: "h", orden: 1, profundidad: "exploratoria" }] };
function conEstado(estado: "sin_m1" | "aprobado") {
  const exploracion = exploracionGate(estado, { draftDVS: draft });
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: {}, phases: { exploracion } } as never);
  mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
  crear.mockReset();
  crear.mockResolvedValue(modelo(JSON.stringify(m5)));
}
const prompt = () => (crear.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;

describe("regenerate-m5 — paso 6: variante de la precedencia", () => {
  it("con M1 aprobado: «revisó y aprobó»", async () => {
    conEstado("aprobado");
    expect((await POST(req())).status).toBe(200);
    expect(prompt()).toContain("revisó y aprobó y, en su caso, con los ajustes que hizo");
  });
  it("sin registro m1: «el vigente de este proyecto», sin afirmar aprobación", async () => {
    conEstado("sin_m1");
    expect((await POST(req())).status).toBe(200);
    expect(prompt()).toContain("El análisis PEST-L de arriba es el vigente de este proyecto.");
    expect(prompt()).not.toMatch(/revisó y aprobó|en su caso/);
  });
});
