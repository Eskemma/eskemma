// regenerate-m5: registro por llamada (solo cifras), códigos por motor y textos sin el nombre del proveedor.

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
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion: {} } } });
  proyecto();
  crear.mockReset();
  crear.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(m5) }] } as never);
});

const logs = () => vi.mocked(console.log).mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[regenerate-m5]"));

describe("regenerate-m5 — registro y códigos", () => {
  it("registra la llamada (motor, intento, stop_reason, tokens, duración, desde inicio) y una línea total", async () => {
    crear.mockResolvedValue({ stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 7 }, content: [{ type: "text", text: JSON.stringify(m5) }] } as never);
    await POST(req());
    const l = logs();
    expect(l.some((x) => /motor=M5 intento=1 stop_reason=end_turn input_tokens=5 output_tokens=7 duracion_ms=\d+ desde_inicio_ms=\d+$/.test(x))).toBe(true);
    expect(l.some((x) => /total resultado=ok duracion_ms=\d+$/.test(x))).toBe(true);
    expect(l.join("\n")).not.toMatch(/tensión|nueva|Narrativa/);
  });
  it("fallo del modelo → codigo fallo_modelo; cortada → respuesta_truncada; vacía → respuesta_invalida; sin «Claude» para el usuario", async () => {
    crear.mockRejectedValue(new Error("x"));
    const a = await (await POST(req())).json();
    expect(a.codigo).toBe("fallo_modelo");
    crear.mockResolvedValue({ stop_reason: "max_tokens", content: [{ type: "text", text: "{\"hei\":" }] } as never);
    const b = await (await POST(req())).json();
    expect(b.codigo).toBe("respuesta_truncada");
    crear.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ hei: {}, pip: [] }) }] } as never);
    const c = await (await POST(req())).json();
    expect(c.codigo).toBe("respuesta_invalida");
    for (const r of [a, b, c]) expect(r.error).not.toMatch(/claude/i);
  });
});
