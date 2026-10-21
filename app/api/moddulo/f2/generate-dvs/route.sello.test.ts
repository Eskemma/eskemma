// Commit 2 (estados de trabajo): generate-dvs en modo final también sella el análisis finalizado con la huella aprobada.
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
import { exploracionGate, huellaGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const modelo = (o: unknown) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(o) }] }) as never;
const M5 = { hei: { tensionCentral: "t", contexto: "c", condicionesFavorables: [], condicionesAdversas: [], premisaEstrategica: "p" }, pip: [{ numero: 1, pregunta: "q", metodo: "m", vinculoHito: "h", orden: 1, profundidad: "exploratoria" }] };

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of ["error", "log", "warn"] as const) vi.spyOn(console, m).mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  crear.mockReset();
  crear.mockResolvedValueOnce(modelo([{ dimension: "X", veredicto: "coherente", argumentacion: "a", senalesPESTEL: [] }]))
    .mockResolvedValueOnce(modelo([])).mockResolvedValueOnce(modelo([])).mockResolvedValue(modelo(M5));
});
const req = (body: Record<string, unknown>) => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...body }) }) as never;

describe("generate-dvs final — sello de finalización", () => {
  it("con M1 aprobado: la primera generación final escribe el sello con la huella aprobada", async () => {
    const exploracion = exploracionGate("aprobado");
    vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
    mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
    const res = await POST(req({ saveas: "final" }));
    expect(res.status).toBe(200);
    const w = mockDb.updates().find((u) => "phases.exploracion.dvs" in u.data)!;
    expect(w.data["phases.exploracion.m1.finalizacion"]).toEqual({ huella: huellaGate(), en: "SERVER_TIMESTAMP" });
  });
  it("el borrador (saveas draft) NO sella: el sello es de lo FINALIZADO", async () => {
    const exploracion = exploracionGate("aprobado");
    vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
    mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
    await POST(req({ saveas: "draft" }));
    for (const u of mockDb.updates()) expect(u.data).not.toHaveProperty("phases.exploracion.m1.finalizacion");
  });
  it("sin registro m1: sin sello", async () => {
    const exploracion = exploracionGate("sin_m1");
    vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
    mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
    await POST(req({ saveas: "final" }));
    const w = mockDb.updates().find((u) => "phases.exploracion.dvs" in u.data)!;
    expect(w.data).not.toHaveProperty("phases.exploracion.m1.finalizacion");
  });
});
