// CARACTERIZACIÓN (M1, commit 1) de regenerate-m5: fija el comportamiento ACTUAL. Hoy lee el M1 de
// linkedSource.payload (serializado SIN límites desde el paso 5), conserva M2/M3/M4 del borrador y reemplaza solo
// hei y pip; exige draftDVS y payload.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return { ...real, getProject: vi.fn() };
});
vi.mock("@/lib/ai/claude", () => ({
  anthropic: { messages: { create: vi.fn() } },
  CLAUDE_MODEL: "modelo-de-prueba",
}));
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
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;

const senal = (descripcion: string) => ({ descripcion, fuente: "INEGI, 2020", fechaCorte: "2020-01", nivelConfianza: "medio", origenInternacional: false });
const payload = {
  P: { code: "P", label: "Político", clasificacion: "AMENAZA", narrativa: "Narrativa P.", senalesFavorables: [senal("b".repeat(300))], senalesAdversas: [], senalesInciertas: [] },
};
const draft = {
  hei: { tensionCentral: "vieja" }, contrasteXPCTO: [{ dimension: "X", veredicto: "coherente", argumentacion: "arg", senalesPESTEL: [] }],
  semaforo: [{ actorId: "a1", nombre: "Actor", nivelRiesgo: "rojo", motivacion: "m" }], incertidumbres: [{ descripcion: "inc", urgencia: "alta", destino: "F3" }], pip: [],
};
const m5 = {
  hei: { tensionCentral: "nueva", contexto: "c", condicionesFavorables: [], condicionesAdversas: [], premisaEstrategica: "p" },
  pip: [{ numero: 1, pregunta: "¿q?", metodo: "m", vinculoHito: "h", orden: 1, profundidad: "exploratoria" }],
};
function proyecto(over: { draft?: unknown; payload?: unknown } = {}) {
  vi.mocked(getProject).mockResolvedValue({
    id: "p1", type: "electoral", xpcto: {},
    phases: { exploracion: { draftDVS: "draft" in over ? over.draft : draft, linkedSource: "payload" in over ? (over.payload ? { payload: over.payload } : {}) : { payload } } },
  } as never);
}
const req = () => new Request("http://local/api/moddulo/f2/regenerate-m5", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion: {} } } });
  proyecto();
  crear.mockReset();
  crear.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(m5) }] } as never);
});

describe("regenerate-m5 — comportamiento actual", () => {
  it("1. lee el M1 de linkedSource.payload (SIN límites, reescrita a propósito en el paso 5), llama a Claude una vez y conserva M2/M3/M4 reemplazando solo hei y pip", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(crear).toHaveBeenCalledTimes(1);
    const user = (crear.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
    expect(user).toContain("[P] Político — AMENAZA");
    expect(user).toContain("b".repeat(300));
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    const escrito = u[0].data["phases.exploracion.draftDVS"] as Record<string, unknown>;
    expect(escrito.contrasteXPCTO).toEqual(draft.contrasteXPCTO);
    expect(escrito.semaforo).toEqual(draft.semaforo);
    expect((escrito.hei as { tensionCentral: string }).tensionCentral).toBe("nueva");
    expect(Object.keys(u[0].data).sort()).toEqual(["phases.exploracion.draftDVS", "updatedAt"]); // no toca motorAprobaciones
  });

  it("2. sin draftDVS o sin payload: 400 y Claude no se invoca; no exige ninguna aprobación del M1", async () => {
    proyecto({ draft: undefined });
    expect((await POST(req())).status).toBe(400);
    proyecto({ payload: undefined });
    expect((await POST(req())).status).toBe(400);
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("3. si Claude devuelve M5 vacío: 500 y no escribe", async () => {
    crear.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ hei: {}, pip: [] }) }] } as never);
    expect((await POST(req())).status).toBe(500);
    expect(mockDb.updates()).toHaveLength(0);
  });
});
