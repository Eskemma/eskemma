// H25 #6 (commit 5a) — veredicto/aprobar con guard: no se re-aprueba, no se reconstruye el
// Reporte F3, y la escritura es condicional (veredicto Y síntesis siguen siendo los aprobados).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { SIEMBRA_DIE, SIEMBRA_SINTESIS, SIEMBRA_VEREDICTO } from "@/lib/moddulo/__tests__/fixtures/siembraF3";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";

// El tablero que getProject entrega lleva `numero` adjunto (nunca persistido en la tarea cruda):
// el DIE se sigue armando desde getProject, con `numero` incluido, como antes de este commit.
const tareaCruda = { pipItemId: "x", asignaciones: [{ asignacionId: "a", estado: "recibido", activada: true }] };
const tareaConNumero = { ...tareaCruda, numero: 1 };

type Inv = { f3Sintesis?: unknown; f3Veredicto?: unknown; f3DIE?: unknown };
const raw = (inv: Inv) => ({ phases: { investigacion: { f3TareasPIP: [tareaCruda], ...inv } } });
const norm = (inv: Inv) => ({ phases: { investigacion: { f3TareasPIP: [tareaConNumero], ...inv } } });
const borrador: Inv = { f3Sintesis: SIEMBRA_SINTESIS, f3Veredicto: SIEMBRA_VEREDICTO };
function estado(inv: Inv = borrador) {
  vi.mocked(getProject).mockResolvedValue(norm(inv) as never);
  mockDb.reset({ [P]: raw(inv) });
}
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST veredicto/aprobar — camino feliz", () => {
  it("aprueba el borrador: 200 con el DIE, y escribe veredicto aprobado + DIE + estado «lista» en UNA escritura", async () => {
    estado();
    const res = await POST(req());
    expect(res.status).toBe(200);
    const { die } = await res.json();
    expect(die.veredictoHEI.aprobadoPorUsuario).toBe(true);
    expect(die.tableroTareasPIP).toEqual([tareaConNumero]); // 4 — el DIE conserva `numero`, como hoy
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0].data["phases.investigacion.f3Veredicto"]).toMatchObject({ aprobadoPorUsuario: true });
    expect(u[0].data["phases.investigacion.f3DIE"]).toEqual(die);
    expect(u[0].data["phases.investigacion.estado"]).toBe("lista");
  });
});

describe("POST veredicto/aprobar — guard de servidor (pre-chequeo)", () => {
  it("el Reporte F3 ya existe: 409 f3_ya_aprobado y el DIE NO se reconstruye (cero escrituras)", async () => {
    estado({ ...borrador, f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true }, f3DIE: SIEMBRA_DIE });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_ya_aprobado");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("veredicto aprobado SIN Reporte F3 (anómalo): 409, sin reparar por la ruta", async () => {
    estado({ ...borrador, f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true } });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_ya_aprobado");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("Reporte F3 sin veredicto (anómalo): 409 f3_ya_aprobado (gana el Reporte, no el 400)", async () => {
    estado({ f3Sintesis: SIEMBRA_SINTESIS, f3DIE: SIEMBRA_DIE });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_ya_aprobado");
  });

  it("sin veredicto → 400 con el texto de siempre", async () => {
    estado({ f3Sintesis: SIEMBRA_SINTESIS });
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("No hay veredicto generado para aprobar");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("veredicto sin síntesis → 400 con el texto de siempre", async () => {
    estado({ f3Veredicto: SIEMBRA_VEREDICTO });
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("No hay síntesis (M3) generada");
  });

  it("sin sesión → 401; proyecto ajeno o inexistente → 404", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await POST(req())).status).toBe(401);
    vi.mocked(getProject).mockResolvedValueOnce(null as never);
    expect((await POST(req())).status).toBe(404);
  });
});

describe("POST veredicto/aprobar — escritura condicional", () => {
  const conCarrera = (despues: Inv) => {
    const real = mockDb.runTransaction.getMockImplementation()!;
    mockDb.runTransaction.mockImplementationOnce(((fn: never) => {
      mockDb.reset({ [P]: raw(despues) });
      return real(fn);
    }) as never);
  };

  it("el Reporte F3 aparece entre el pre-chequeo y la transacción (otra pestaña aprobó): 409 f3_ya_aprobado y cero escrituras", async () => {
    estado();
    conCarrera({ ...borrador, f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true }, f3DIE: SIEMBRA_DIE });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_ya_aprobado");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("1 — la SÍNTESIS cambia entre ambos (el DIE la embebe): 409 f3_estado_cambio y cero escrituras", async () => {
    estado();
    conCarrera({ ...borrador, f3Sintesis: { ...SIEMBRA_SINTESIS, convergencias: [{ texto: "otra" }] } });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("f3_estado_cambio");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("el VEREDICTO cambia entre ambos: 409 f3_estado_cambio y cero escrituras", async () => {
    estado();
    conCarrera({ ...borrador, f3Veredicto: { ...SIEMBRA_VEREDICTO, resultado: "refutada" } });
    const res = await POST(req());
    expect((await res.json()).error).toBe("f3_estado_cambio");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("el veredicto desaparece entre ambos: 409 f3_estado_cambio", async () => {
    estado();
    conCarrera({ f3Sintesis: SIEMBRA_SINTESIS });
    expect((await (await POST(req())).json()).error).toBe("f3_estado_cambio");
  });

  it("la transacción falla: 500 reemplazo_escritura_incierta (ambiguo), sin «se conserva»", async () => {
    estado();
    mockDb.runTransaction.mockRejectedValueOnce(new Error("commit perdido"));
    const res = await POST(req());
    expect(res.status).toBe(500);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_escritura_incierta");
    expect(b.mensaje).toContain("Recarga la página para verificar el estado");
    expect(JSON.stringify(b)).not.toContain("conserva");
  });

  it("negativo — la ruta anterior re-aprobaba con el Reporte F3 presente (200) y reconstruía el DIE", async () => {
    estado({ ...borrador, f3Veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true }, f3DIE: SIEMBRA_DIE });
    const antes = { status: 200 };
    expect((await POST(req())).status).not.toBe(antes.status);
  });
});
