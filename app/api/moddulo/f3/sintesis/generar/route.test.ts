// H-M3 (commit 4) — sintesis/generar: la UI no ofrece «regenerar», así que con una síntesis
// ya existente (pestaña desactualizada) o con F3 cerrada la ruta rechaza ANTES de llamar a
// Claude; la escritura es condicional dentro de una transacción.

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
import { SIEMBRA_SINTESIS, SIEMBRA_VEREDICTO, SIEMBRA_DIE } from "@/lib/moddulo/__tests__/fixtures/siembraF3";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const P = "moddulo_projects/p1";

type Inv = { f3Sintesis?: unknown; f3Veredicto?: unknown; f3DIE?: unknown };
const docProyecto = (inv: Inv = {}) => ({
  phases: { exploracion: { dvs: { pip: [], semaforo: [] } }, investigacion: { f3TareasPIP: [], ...inv } },
});
function estado(inv: Inv = {}) {
  vi.mocked(getProject).mockResolvedValue(docProyecto(inv) as never);
  mockDb.reset({ [P]: docProyecto(inv), [`${P}/f3Resultados/r1`]: { aprobado: true } });
}
const claudeOk = () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(SIEMBRA_SINTESIS) }] }) as never;
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  crear.mockResolvedValue(claudeOk());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST sintesis/generar — pre-chequeo ANTES de Claude", () => {
  it("primera generación (nada existe): 200 y escribe la síntesis", async () => {
    estado();
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(crear).toHaveBeenCalledTimes(1);
    expect(mockDb.updates()[0].data["phases.investigacion.f3Sintesis"]).toBeTruthy();
  });

  it("la síntesis ya existe: 409 f3_ya_existe, Claude NO se invoca y no se escribe nada", async () => {
    estado({ f3Sintesis: SIEMBRA_SINTESIS });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_ya_existe");
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("síntesis + borrador de veredicto: igual, «ya existe» (el borrador no se toca)", async () => {
    estado({ f3Sintesis: SIEMBRA_SINTESIS, f3Veredicto: SIEMBRA_VEREDICTO });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_ya_existe");
    expect(crear).not.toHaveBeenCalled();
  });

  it("Reporte F3 existente: 409 reemplazo_bloqueado con el verbo de la acción y sin «DIE»; Claude NO se invoca", async () => {
    estado({ f3Sintesis: SIEMBRA_SINTESIS, f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true }, f3DIE: SIEMBRA_DIE });
    const res = await POST(req());
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_bloqueado");
    expect(b.mensaje).toContain("Generar la síntesis de nuevo las dejaría inconsistentes");
    expect(b.mensaje).not.toMatch(/\bDIE\b/);
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("veredicto aprobado aunque falte el Reporte F3 (anómalo): bloqueado, sin afirmar un Reporte F3", async () => {
    estado({ f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true } });
    const res = await POST(req());
    const b = await res.json();
    expect(b.error).toBe("reemplazo_bloqueado");
    expect(b.mensaje).not.toContain("Reporte F3");
    expect(crear).not.toHaveBeenCalled();
  });
});

describe("POST sintesis/generar — escritura condicional", () => {
  it("la síntesis APARECE mientras Claude genera (otra pestaña): 409 f3_ya_existe y cero escrituras", async () => {
    estado();
    crear.mockImplementationOnce(async () => {
      mockDb.reset({ [P]: docProyecto({ f3Sintesis: { ...SIEMBRA_SINTESIS, convergencias: [{ texto: "otra pestaña" }] } }), [`${P}/f3Resultados/r1`]: { aprobado: true } });
      return claudeOk();
    });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_ya_existe");
    expect(crear).toHaveBeenCalledTimes(1);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("aparece el Reporte F3 mientras Claude genera: 409 bloqueado y cero escrituras", async () => {
    estado();
    crear.mockImplementationOnce(async () => {
      mockDb.reset({ [P]: docProyecto({ f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true }, f3DIE: SIEMBRA_DIE }) });
      return claudeOk();
    });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("reemplazo_bloqueado");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("la transacción falla: 500 reemplazo_escritura_incierta, sin «se conserva»", async () => {
    estado();
    mockDb.runTransaction.mockRejectedValueOnce(new Error("commit perdido"));
    const res = await POST(req());
    expect(res.status).toBe(500);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_escritura_incierta");
    expect(b.mensaje).toContain("Recarga la página para verificar el estado");
    expect(JSON.stringify(b)).not.toContain("conserva");
  });
});

describe("POST sintesis/generar — fallos antes de escribir y regresiones", () => {
  it("Claude falla: 500 JSON con motor M3 y cero escrituras", async () => {
    estado();
    crear.mockRejectedValueOnce(new Error("Claude caído"));
    const res = await POST(req());
    expect(res.status).toBe(500);
    const b = await res.json();
    expect(b.motor).toBe("M3");
    expect(b.error).toContain("Claude caído");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("respuesta que no se puede parsear: 500 con motor M3 y cero escrituras", async () => {
    estado();
    crear.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "no es json" }] } as never);
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect((await res.json()).motor).toBe("M3");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("sin sesión → 401; proyecto ajeno o inexistente → 404 (antes de cualquier decisión)", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await POST(req())).status).toBe(401);
    vi.mocked(getProject).mockResolvedValueOnce(null as never);
    expect((await POST(req())).status).toBe(404);
  });

  it("negativo — la ruta anterior respondía 200 y sobrescribía con el Reporte F3 presente", async () => {
    estado({ f3Sintesis: SIEMBRA_SINTESIS, f3DIE: SIEMBRA_DIE });
    const antes = { status: 200 }; // HEAD: sin pre-chequeo ni transacción condicional
    expect((await POST(req())).status).not.toBe(antes.status);
  });
});
