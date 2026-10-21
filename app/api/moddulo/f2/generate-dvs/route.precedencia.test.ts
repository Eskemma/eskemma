// Paso 6: generate-dvs pasa aprobado=true con m1 aprobado y false sin registro m1 a los 4 motores.
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

beforeEach(() => {
  vi.clearAllMocks();
  espias.length = 0;
  for (const m of ["error", "log", "warn"] as const) espias.push(vi.spyOn(console, m).mockImplementation(() => {}));
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  const exploracion = exploracionGate("sin_m1");
  
  mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
  crear.mockReset();
});
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", saveas: "draft" }) }) as never;

const M_OK = [
  [{ dimension: "X", veredicto: "coherente", argumentacion: "a", senalesPESTEL: [] }],
  [],
  [],
  { hei: { tensionCentral: "t", contexto: "c", condicionesFavorables: [], condicionesAdversas: [], premisaEstrategica: "p" }, pip: [{ numero: 1, pregunta: "q", metodo: "m", vinculoHito: "h", orden: 1, profundidad: "exploratoria" }] },
];
function conEstado(estado: "sin_m1" | "aprobado") {
  const exploracion = exploracionGate(estado);
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
  mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
  crear.mockReset();
  for (const o of M_OK) crear.mockResolvedValueOnce(modelo(JSON.stringify(o)));
}
const prompts = () => (crear.mock.calls as unknown[][]).map((c) => (c[0] as { messages: { content: string }[] }).messages[0].content);

describe("generate-dvs — paso 6: variante de la precedencia", () => {
  it("con M1 aprobado (la compuerta pasa): los 4 motores reciben la variante «revisó y aprobó»", async () => {
    conEstado("aprobado");
    await POST(req());
    const p = prompts();
    expect(p).toHaveLength(4);
    for (const u of p) {
      expect(u).toContain("revisó y aprobó y, en su caso, con los ajustes que hizo");
      expect(u).not.toContain("es el vigente de este proyecto");
    }
  });
  it("sin registro m1 (proyecto anterior a la revisión): los 4 motores reciben «el vigente de este proyecto» y ninguna afirma que el usuario aprobó", async () => {
    conEstado("sin_m1");
    await POST(req());
    const p = prompts();
    expect(p).toHaveLength(4);
    for (const u of p) {
      expect(u).toContain("El análisis PEST-L de arriba es el vigente de este proyecto.");
      expect(u).not.toMatch(/revisó y aprobó|en su caso/);
    }
  });
});
