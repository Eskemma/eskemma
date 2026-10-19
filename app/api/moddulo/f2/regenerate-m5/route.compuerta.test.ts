// Paso 4 — regenerate-m5 bajo la compuerta del M1 (409 antes de llamar al modelo; copia congelada;
// la huella aprobada capturada al inicio se compara en la transacción final) y no regresión sin m1.

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
import { exploracionGate, otroMapaGate, type EstadoGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const P = "moddulo_projects/p1";
const draft = { hei: { tensionCentral: "vieja" }, contrasteXPCTO: [], semaforo: [{ actorId: "a1", nombre: "A", nivelRiesgo: "rojo", motivacion: "m" }], incertidumbres: [], pip: [] };
const m5 = {
  hei: { tensionCentral: "nueva", contexto: "c", condicionesFavorables: [], condicionesAdversas: [], premisaEstrategica: "p" },
  pip: [{ numero: 1, pregunta: "¿q?", metodo: "m", vinculoHito: "h", orden: 1, profundidad: "exploratoria" }],
};
function sembrar(estado: EstadoGate) {
  const exploracion = exploracionGate(estado, { draftDVS: draft });
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: {}, phases: { exploracion } } as never);
  mockDb.reset({ [P]: { phases: { exploracion } } });
}
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of ["error", "log", "warn"] as const) vi.spyOn(console, m).mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  crear.mockReset();
  crear.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(m5) }] } as never);
});

describe("regenerate-m5 — compuerta del M1", () => {
  it.each(["borrador", "reabierto", "copia_alterada"] as const)("M1 %s → 409 m1_no_aprobado, sin llamar al modelo y sin escribir", async (estado) => {
    sembrar(estado);
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "m1_no_aprobado" });
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toEqual([]);
  });
  it("aprobado → 200, usa la copia congelada y reemplaza solo hei y pip", async () => {
    sembrar("aprobado");
    expect((await POST(req())).status).toBe(200);
    expect(JSON.stringify(crear.mock.calls[0][0])).toContain("Político");
    const d = mockDb.updates()[0].data["phases.exploracion.draftDVS"] as Record<string, unknown>;
    expect(d.semaforo).toEqual(draft.semaforo);
    expect((d.hei as { tensionCentral: string }).tensionCentral).toBe("nueva");
  });
  it("[carrera] el M1 se vuelve a aprobar con OTRO contenido mientras el modelo genera → 409 y cero escrituras", async () => {
    sembrar("aprobado");
    crear.mockImplementation(async () => {
      mockDb.reset({ [P]: { phases: { exploracion: exploracionGate("aprobado", { draftDVS: draft }, otroMapaGate) } } });
      return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(m5) }] } as never;
    });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(mockDb.updates()).toEqual([]);
  });
  it("[carrera] se reabre el M1 mientras genera → 409 y cero escrituras", async () => {
    sembrar("aprobado");
    crear.mockImplementation(async () => {
      mockDb.reset({ [P]: { phases: { exploracion: exploracionGate("reabierto", { draftDVS: draft }) } } });
      return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(m5) }] } as never;
    });
    expect((await POST(req())).status).toBe(409);
    expect(mockDb.updates()).toEqual([]);
  });
});

describe("regenerate-m5 — sin m1 / sin payload: comportamiento de siempre (no regresión)", () => {
  it("sin m1: 200 y escribe SOLO draftDVS + updatedAt, de linkedSource.payload", async () => {
    sembrar("sin_m1");
    expect((await POST(req())).status).toBe(200);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(Object.keys(u[0].data).sort()).toEqual(["phases.exploracion.draftDVS", "updatedAt"]);
  });
  it("m1 sin payload: sigue respondiendo 400 «No hay mapaPESTEL» como antes (no es la compuerta)", async () => {
    sembrar("sin_payload");
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(crear).not.toHaveBeenCalled();
  });
});
