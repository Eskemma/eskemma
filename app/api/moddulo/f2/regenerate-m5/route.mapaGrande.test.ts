// Paso 5: regenerate-m5 — mapa_demasiado_grande: 422 antes del modelo, sin escrituras, solo estructural, por origen.
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


const enorme = { P: { code: "P", label: "Político", clasificacion: "AMENAZA", narrativa: MARCA + "n".repeat(150_001) } };
const conOrigen = (kind: string | undefined) => {
  const exploracion = { ...exploracionGate("sin_m1", { draftDVS: draft }), linkedSource: { ...(kind ? { kind } : {}), payload: enorme } };
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
  mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
};

describe("regenerate-m5 — paso 5: mapa_demasiado_grande", () => {
  it.each([["T22", "centinela"], ["express", "express"], [undefined, "desconocido"], ["otro", "desconocido"]] as const)(
    "origen %s → 422 con origen %s, sin llamar al modelo, sin escrituras y sin contenido",
    async (kind, origen) => {
      conOrigen(kind);
      const res = await POST(req());
      expect(res.status).toBe(422);
      const cuerpo = await res.json();
      expect(cuerpo.codigo).toBe("mapa_demasiado_grande");
      expect(cuerpo.origen).toBe(origen);
      expect(JSON.stringify(cuerpo)).not.toContain(MARCA);
      expect(crear).not.toHaveBeenCalled();
      expect(mockDb.updates()).toEqual([]);
      expect(registros()).toContain("mapa_demasiado_grande longitud=");
      expect(registros()).not.toContain(MARCA);
    }
  );
  it("la línea de medición sale antes de las llamadas, solo con números", async () => {
    conOrigen("express");
    crear.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "[]" }] } as never);
    const exploracion = { ...exploracionGate("sin_m1", { draftDVS: draft }), linkedSource: { kind: "express", payload: { P: { ...enorme.P, narrativa: MARCA } } } };
    vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
    await POST(req());
    expect(registros()).toMatch(/\[regenerate-m5\] mapa longitud=\d+ senales=0 dims=P:\d+ max_desc=0 narrativa_total=\d+/);
    expect(registros()).not.toContain(MARCA);
  });
});
