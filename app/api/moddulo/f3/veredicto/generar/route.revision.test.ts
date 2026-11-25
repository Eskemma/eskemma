// H-V48 (C4b-0) — veredicto/generar: si `phases.investigacion.revision.n` cambia mientras Claude genera, la
// escritura se rechaza (409 f3_estado_cambio, cero escrituras). Las guardias previas (Reporte, aprobado, «ya
// existe») quedan en route.test.ts, sin editar.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/ai/claude", () => ({
  anthropic: { messages: { create: vi.fn() } },
  CLAUDE_MODEL: "modelo-de-prueba",
}));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { anthropic } from "@/lib/ai/claude";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { SIEMBRA_SINTESIS } from "@/lib/moddulo/__tests__/fixtures/siembraF3";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const P = "moddulo_projects/p1";

type Inv = Record<string, unknown>;
const docProyecto = (inv: Inv = {}) => ({
  phases: { exploracion: { dvs: { pip: [], semaforo: [], hei: { h: 1 } } }, investigacion: { f3TareasPIP: [], f3Sintesis: SIEMBRA_SINTESIS, ...inv } },
});
/** El proyecto que lee getProject (pre-chequeo) y el documento de Firestore (transacción). */
function estado(inv: Inv = {}) {
  vi.mocked(getProject).mockResolvedValue(docProyecto(inv) as never);
  mockDb.reset({ [P]: docProyecto(inv), [`${P}/f3Resultados/r1`]: { aprobado: true } });
}
const claudeOk = () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ resultado: "ajustada", contraste: "c", argumentacion: "a", premisaResultante: "p" }) }] }) as never;
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never;
const rev = (n: number) => ({ revision: { n, huella: "h", por: "u1", en: "2026-11-25T00:00:00.000Z" } });
/** Mientras Claude genera, otra petición deja el documento de Firestore con este `inv`. */
const cambiaMientrasGenera = (inv: Inv) =>
  crear.mockImplementationOnce(async () => {
    mockDb.reset({ [P]: docProyecto(inv), [`${P}/f3Resultados/r1`]: { aprobado: true } });
    return claudeOk();
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  crear.mockResolvedValue(claudeOk());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST veredicto/generar — H-V48: la investigación cambia mientras se genera", () => {
  it("n igual antes y después: escribe y responde 200", async () => {
    estado(rev(3));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockDb.updates()).toHaveLength(1);
    expect(mockDb.updates()[0].data["phases.investigacion.f3Veredicto"]).toBeTruthy();
  });

  it("n distinto (se entregó o aprobó algo): 409 f3_estado_cambio, cero escrituras y el modelo se llamó UNA vez", async () => {
    estado(rev(3));
    cambiaMientrasGenera(rev(4));
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_estado_cambio");
    expect(crear).toHaveBeenCalledTimes(1);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("sin `revision` antes y con `revision` después (la primera entrega la crea): cuenta como cambio", async () => {
    estado();
    cambiaMientrasGenera(rev(1));
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_estado_cambio");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("sin `revision` ni antes ni después (undefined normalizado a 0 en ambos lados): escribe", async () => {
    estado();
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockDb.updates()).toHaveLength(1);
  });

  it("compara contra el documento RELEÍDO en la transacción, no contra el del pre-chequeo (carrera simulada)", async () => {
    // getProject (pre-chequeo) ve n=2; el documento de la transacción ya trae n=5.
    vi.mocked(getProject).mockResolvedValue(docProyecto(rev(2)) as never);
    mockDb.reset({ [P]: docProyecto(rev(5)), [`${P}/f3Resultados/r1`]: { aprobado: true } });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_estado_cambio");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("LÍMITE (H-V89): el guard NO detecta confirm, tareas/* ni revisar-territorio, porque no suben revision.n", async () => {
    estado(rev(3));
    // Un escritor sin historial cambia el tablero mientras se genera; `revision.n` no se mueve.
    cambiaMientrasGenera({ ...rev(3), f3TareasPIP: [{ pipItemId: "x", asignaciones: [] }] });
    const res = await POST(req());
    expect(res.status).toBe(200); // pasa: es el límite declarado, no un comportamiento deseado
    expect(mockDb.updates()).toHaveLength(1);
  });

  it("cero llamadas reales al modelo: solo el mock, y una sola vez por petición", async () => {
    estado(rev(1));
    await POST(req());
    expect(crear).toHaveBeenCalledTimes(1);
  });
});
