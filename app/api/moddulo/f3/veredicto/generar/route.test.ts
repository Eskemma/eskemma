// H-M3 (commit 4) — veredicto/generar: con un veredicto ya existente (borrador o aprobado) o
// con F3 cerrada rechaza ANTES de llamar a Claude; la escritura es condicional.

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
import { SIEMBRA_DIE, SIEMBRA_SINTESIS, SIEMBRA_VEREDICTO } from "@/lib/moddulo/__tests__/fixtures/siembraF3";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const P = "moddulo_projects/p1";

const asigCubierta = { asignacionId: "a", tipo: "primaria", canal: "canal2", justificacion: "", estado: "recibido", activada: true };
type Inv = { f3Sintesis?: unknown; f3Veredicto?: unknown; f3DIE?: unknown; f3TareasPIP?: unknown[] };
const docProyecto = (inv: Inv = {}) => ({
  phases: {
    exploracion: { dvs: { hei: { tensionCentral: "t" }, pip: [], semaforo: [] } },
    investigacion: { f3TareasPIP: [{ pipItemId: "x", asignaciones: [asigCubierta] }], f3Sintesis: SIEMBRA_SINTESIS, ...inv },
  },
});
function estado(inv: Inv = {}) {
  vi.mocked(getProject).mockResolvedValue(docProyecto(inv) as never);
  mockDb.reset({ [P]: docProyecto(inv) });
}
const claudeOk = () =>
  ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ resultado: "validada", contraste: "c", argumentacion: "a", premisaResultante: "p" }) }] }) as never;
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  crear.mockResolvedValue(claudeOk());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST veredicto/generar — pre-chequeo ANTES de Claude", () => {
  it("primera generación (síntesis sí, veredicto no): 200 y escribe el borrador sin aprobar", async () => {
    estado();
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(crear).toHaveBeenCalledTimes(1);
    expect(mockDb.updates()[0].data["phases.investigacion.f3Veredicto"]).toMatchObject({ resultado: "validada", aprobadoPorUsuario: false });
  });

  it("el veredicto ya existe como borrador: 409 f3_ya_existe, Claude NO se invoca y no se escribe nada", async () => {
    estado({ f3Veredicto: SIEMBRA_VEREDICTO });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_ya_existe");
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("Reporte F3 existente: 409 reemplazo_bloqueado con el verbo de la acción y sin «DIE»; Claude NO se invoca", async () => {
    estado({ f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true }, f3DIE: SIEMBRA_DIE });
    const res = await POST(req());
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_bloqueado");
    expect(b.mensaje).toContain("Generar el veredicto de nuevo las dejaría inconsistentes");
    expect(b.mensaje).not.toMatch(/\bDIE\b/);
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("Reporte F3 sin veredicto (anómalo): bloqueado", async () => {
    estado({ f3DIE: SIEMBRA_DIE });
    const res = await POST(req());
    expect((await res.json()).error).toBe("reemplazo_bloqueado");
    expect(crear).not.toHaveBeenCalled();
  });

  it("veredicto aprobado sin Reporte F3 (anómalo): bloqueado sin afirmar el reporte", async () => {
    estado({ f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true } });
    const b = await (await POST(req())).json();
    expect(b.error).toBe("reemplazo_bloqueado");
    expect(b.mensaje).not.toContain("Reporte F3");
  });
});

describe("POST veredicto/generar — escritura condicional", () => {
  it("el veredicto APARECE mientras Claude genera: 409 f3_ya_existe y cero escrituras", async () => {
    estado();
    crear.mockImplementationOnce(async () => {
      mockDb.reset({ [P]: docProyecto({ f3Veredicto: SIEMBRA_VEREDICTO }) });
      return claudeOk();
    });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_ya_existe");
    expect(crear).toHaveBeenCalledTimes(1);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("el Reporte F3 aparece mientras Claude genera: 409 bloqueado y cero escrituras", async () => {
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
    expect(JSON.stringify(b)).not.toContain("conserva");
  });
});

describe("POST veredicto/generar — fallos antes de escribir y regresiones", () => {
  it("Claude falla: 500 JSON con motor M4 y cero escrituras", async () => {
    estado();
    crear.mockRejectedValueOnce(new Error("Claude caído"));
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect((await res.json()).motor).toBe("M4");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("sin síntesis → 400 (sin cambios)", async () => {
    estado({ f3Sintesis: undefined });
    vi.mocked(getProject).mockResolvedValue(docProyecto({ f3Sintesis: undefined }) as never);
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(crear).not.toHaveBeenCalled();
  });

  it("sin HEI → 400 (sin cambios)", async () => {
    const sinHei = { phases: { exploracion: { dvs: { pip: [] } }, investigacion: { f3Sintesis: SIEMBRA_SINTESIS, f3TareasPIP: [] } } };
    vi.mocked(getProject).mockResolvedValue(sinHei as never);
    mockDb.reset({ [P]: sinHei });
    expect((await POST(req())).status).toBe(400);
  });

  it("tarea sin cubrir → 400 tareas_sin_cubrir (sin cambios) y Claude no se invoca", async () => {
    estado({ f3TareasPIP: [{ pipItemId: "x", asignaciones: [{ ...asigCubierta, estado: "pendiente" }] }] });
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("tareas_sin_cubrir");
    expect(crear).not.toHaveBeenCalled();
  });

  it("sin sesión → 401; proyecto ajeno o inexistente → 404", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await POST(req())).status).toBe(401);
    vi.mocked(getProject).mockResolvedValueOnce(null as never);
    expect((await POST(req())).status).toBe(404);
  });

  it("negativo — la ruta anterior respondía 200 y pisaba el veredicto con el Reporte F3 presente", async () => {
    estado({ f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true }, f3DIE: SIEMBRA_DIE });
    const antes = { status: 200 };
    expect((await POST(req())).status).not.toBe(antes.status);
  });
});
