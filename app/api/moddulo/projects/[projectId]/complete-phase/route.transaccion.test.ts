// C1b-3a (H-V20, H-V21, H-V22): complete-phase decide DENTRO de la transacción sobre el documento releído.
//   · carrera: `getProject` ve un estado que permite cerrar, pero al escribir el documento ya cambió → 409 y CERO
//     escrituras (antes la decisión salía de la lectura previa y la fase se cerraba igual);
//   · re-cierre de cualquier fase: 200 yaCerrada sin escribir (antes F1/F3 reescribían `completedAt` y `currentPhase`);
//   · el estado `completed` del proyecto (9.ª fase) sale en la MISMA escritura (antes un `update` aparte);
//   · costo medido con los contadores del mock (solo la transacción: `getProject` suma 1 lectura y 1 escritura
//     —`lastAccessedAt`— en TODOS los caminos y no cambia).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS", arrayUnion: (...a: unknown[]) => a } }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/moddulo/project")>()), getProject: vi.fn() }));
vi.mock("@/lib/moddulo/rda", () => ({ planRDAUpdate: vi.fn(() => ({ nuevos: [], resueltos: [] })) }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";
import { PHASE_ORDER } from "@/types/moddulo.types";
import { POST } from "./route";

type Db = {
  reset(d?: Record<string, unknown>): void;
  seed(path: string, doc: unknown): void;
  atomico(a?: boolean): void;
  rechazarUndefined(a?: boolean): void;
  failUpdateOn(p: string): void;
  contadores(): { lecturas: number; escrituras: number; borrados: number };
  updates(): Array<{ path: string; data: Record<string, unknown> }>;
  snapshot(): Record<string, Record<string, unknown>>;
};
const db = adminDb as unknown as Db;
const RUTA = "moddulo_projects/p1";
const MAPA = { P: { code: "P", label: "P", clasificacion: "NEUTRAL", narrativa: "n", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] } };
const HUELLA = huellaMapaPESTEL(MAPA as never);
const aprobacion = { huella: HUELLA, por: "u1", en: "t", categoriasEditadas: 0, total: 1, mapa: MAPA };
const express = { linkedSource: { kind: "express", payload: MAPA } };
const DVS = { x: 1 };
const APROBADO = { dvs: DVS, ...express, m1: { creadoEn: "t", aprobacion, generacion: { huella: HUELLA, en: "t" } } };
const REABIERTO = { dvs: DVS, ...express, m1: { creadoEn: "t", reabiertoEn: "t", generacion: { huella: HUELLA, en: "t" } } };

const base = (phases: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  status: "active", collaborators: [{ uid: "u1", role: "owner" }], currentPhase: "exploracion", phases, ...extra,
});
/** `getProject` ve `vista`; el documento de Firestore (lo que la transacción relee) es `doc`. */
function sembrar(vista: Record<string, unknown>, doc: Record<string, unknown> = vista) {
  vi.mocked(getProject).mockResolvedValue({ id: "p1", ...vista } as never);
  db.seed(RUTA, doc);
}
const cerrar = async (phaseId: string) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId }) }) as never, { params: Promise.resolve({ projectId: "p1" }) });
  return { status: r.status, cuerpo: await r.json() };
};
const escrituras = () => db.updates().filter((u) => u.path === RUTA);

beforeEach(() => {
  vi.clearAllMocks();
  db.reset({ [RUTA]: base({}) });
  db.atomico(true);
  db.rechazarUndefined(true);
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("carrera: la decisión se toma sobre el documento releído, no sobre el de getProject", () => {
  it("getProject ve el M1 aprobado pero al escribir ya se reabrió → 409 m1_no_aprobado y cero escrituras", async () => {
    sembrar(base({ exploracion: APROBADO }), base({ exploracion: REABIERTO }));
    const r = await cerrar("exploracion");
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("m1_no_aprobado");
    expect(escrituras()).toHaveLength(0);
    expect(db.contadores().escrituras).toBe(0);
  });
  it("getProject ve el Reporte F2 de ESTE M1 pero el documento ya trae otro (generación distinta) → 409 reporte_f2_de_otro_analisis", async () => {
    const otro = { ...APROBADO, m1: { ...APROBADO.m1, generacion: { huella: "otra", en: "t" } } };
    sembrar(base({ exploracion: APROBADO }), base({ exploracion: otro }));
    const r = await cerrar("exploracion");
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reporte_f2_de_otro_analisis");
    expect(db.contadores().escrituras).toBe(0);
  });
  it("getProject ve el Reporte F2 finalizado pero el documento ya no lo tiene → 409 reporte_f2_no_finalizado", async () => {
    const { dvs: _dvs, ...sinReporte } = APROBADO;
    sembrar(base({ exploracion: APROBADO }), base({ exploracion: sinReporte }));
    const r = await cerrar("exploracion");
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reporte_f2_no_finalizado");
    expect(db.contadores().escrituras).toBe(0);
  });
  it("lo inverso: getProject ve el M1 reabierto pero el documento ya está aprobado → cierra (la decisión es del documento)", async () => {
    sembrar(base({ exploracion: REABIERTO }), base({ exploracion: APROBADO }));
    const r = await cerrar("exploracion");
    expect(r.status).toBe(200);
    expect(escrituras()).toHaveLength(1);
  });
  it("el RDA se calcula sobre el documento releído (la copia aprobada del documento, no la de getProject)", async () => {
    const { planRDAUpdate } = await import("@/lib/moddulo/rda");
    sembrar(base({ exploracion: { ...REABIERTO, x: "vista" } }), base({ exploracion: { ...APROBADO, x: "doc" } }));
    await cerrar("exploracion");
    const visto = vi.mocked(planRDAUpdate).mock.calls[0][0] as { phases: { exploracion: { x?: string } } };
    expect(visto.phases.exploracion.x).toBe("doc");
  });
  it("la Fase 1 se cierra en otra pestaña entre la lectura y la escritura → 200 yaCerrada, cero escrituras, currentPhase intacto", async () => {
    sembrar(base({ proposito: { status: "in-progress" } }), base({ proposito: { status: "completed", completedAt: "2026-01-01T00:00:00.000Z" } }, { currentPhase: "investigacion" }));
    const r = await cerrar("proposito");
    expect(r.cuerpo).toEqual({ success: true, yaCerrada: true, nextPhase: "exploracion" });
    expect(escrituras()).toHaveLength(0);
    expect(db.snapshot()[RUTA].currentPhase).toBe("investigacion");
  });
});

describe("re-cierre idempotente en TODAS las fases (H-V21)", () => {
  for (const fase of ["proposito", "investigacion", "diagnostico", "evaluacion"] as const) {
    it(`${fase}: fase ya cerrada → 200 yaCerrada, no reescribe completedAt ni currentPhase ni el reporte`, async () => {
      const doc = base({ [fase]: { status: "completed", completedAt: "2026-01-01T00:00:00.000Z", reportText: "original" } }, { currentPhase: "estrategia" });
      sembrar(doc);
      const i = PHASE_ORDER.indexOf(fase);
      const r = await cerrar(fase);
      expect(r.cuerpo).toEqual({ success: true, yaCerrada: true, nextPhase: PHASE_ORDER[i + 1] ?? fase });
      expect(db.contadores().escrituras).toBe(0);
      expect(db.snapshot()[RUTA]).toEqual(doc);
    });
  }
  it("un cierre con reportText sobre una fase ya cerrada NO reemplaza el texto guardado", async () => {
    const doc = base({ proposito: { status: "completed", completedAt: "2026-01-01T00:00:00.000Z", reportText: "original" } });
    sembrar(doc);
    const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId: "proposito", reportText: "nuevo" }) }) as never, { params: Promise.resolve({ projectId: "p1" }) });
    expect((await r.json()).yaCerrada).toBe(true);
    expect((db.snapshot()[RUTA].phases as Record<string, { reportText: string }>).proposito.reportText).toBe("original");
  });
  it("la Fase 2 cerrada sin aprobadoEn sigue completando SOLO eso (como antes)", async () => {
    sembrar(base({ exploracion: { status: "completed", completedAt: "2026-01-01T00:00:00.000Z", data: {} } }));
    await cerrar("exploracion");
    expect(escrituras()).toHaveLength(1);
    expect(escrituras()[0].data).toEqual({ "phases.exploracion.data.aprobadoEn": "2026-01-01T00:00:00.000Z" });
  });
});

describe("el estado `completed` del proyecto sale en la MISMA escritura (H-V22)", () => {
  const ochoCerradas = () => {
    const ph: Record<string, unknown> = {};
    for (const p of PHASE_ORDER.slice(0, 8)) ph[p] = { status: "completed", completedAt: "2026-01-01T00:00:00.000Z", data: { aprobadoEn: "x" } };
    return ph;
  };
  it("cerrar la 9.ª fase: UNA sola escritura que trae status=completed junto con el cierre", async () => {
    sembrar(base(ochoCerradas()));
    const r = await cerrar("evaluacion");
    expect(r.status).toBe(200);
    expect(escrituras()).toHaveLength(1);
    expect(escrituras()[0].data.status).toBe("completed");
    expect(escrituras()[0].data["phases.evaluacion.status"]).toBe("completed");
    expect(db.contadores().escrituras).toBe(1);
  });
  it("si falla la escritura no queda NI el cierre NI el estado del proyecto (todo o nada)", async () => {
    sembrar(base(ochoCerradas()));
    db.failUpdateOn(RUTA);
    const r = await cerrar("evaluacion");
    expect(r.status).toBe(500);
    const doc = db.snapshot()[RUTA] as { status: string; phases: Record<string, { status?: string }> };
    expect(doc.status).toBe("active");
    expect(doc.phases.evaluacion?.status).toBeUndefined();
  });
  it("con una de las 8 fases sin cerrar NO marca el proyecto completado", async () => {
    const ph = ochoCerradas();
    ph.tactica = { status: "in-progress" };
    sembrar(base(ph));
    await cerrar("evaluacion");
    expect("status" in escrituras()[0].data).toBe(false);
  });
  it("si el proyecto ya estaba completado no vuelve a escribir status", async () => {
    sembrar(base(ochoCerradas(), { status: "completed" }));
    await cerrar("evaluacion");
    expect("status" in escrituras()[0].data).toBe(false);
  });
  it("la decisión de «las 9 cerradas» usa el documento releído, no el de getProject", async () => {
    const ph = ochoCerradas();
    sembrar(base({ ...ph, tactica: { status: "completed" } }), base({ ...ph, tactica: { status: "in-progress" } }));
    await cerrar("evaluacion");
    expect("status" in escrituras()[0].data).toBe(false);
  });
});

describe("costo en lecturas/escrituras de la transacción (getProject aparte: +1 lectura y +1 escritura en todos)", () => {
  const medir = async (fase: string) => {
    const antes = db.contadores();
    const r = await cerrar(fase);
    const d = db.contadores();
    return { r, lecturas: d.lecturas - antes.lecturas, escrituras: d.escrituras - antes.escrituras };
  };
  it("cierre normal: 1 lectura y 1 escritura (el plan de RDA dentro de la transacción no añade lecturas)", async () => {
    sembrar(base({ exploracion: APROBADO }));
    const m = await medir("exploracion");
    expect(m.r.status).toBe(200);
    expect({ l: m.lecturas, e: m.escrituras }).toEqual({ l: 1, e: 1 });
  });
  it("cierre de la 9.ª fase: 1 lectura y 1 escritura (antes: 1 y 2)", async () => {
    const ph: Record<string, unknown> = {};
    for (const p of PHASE_ORDER.slice(0, 8)) ph[p] = { status: "completed" };
    sembrar(base(ph));
    const m = await medir("evaluacion");
    expect({ l: m.lecturas, e: m.escrituras }).toEqual({ l: 1, e: 1 });
  });
  it("fase ya cerrada: 1 lectura y 0 escrituras", async () => {
    sembrar(base({ proposito: { status: "completed" } }));
    const m = await medir("proposito");
    expect({ l: m.lecturas, e: m.escrituras }).toEqual({ l: 1, e: 0 });
  });
  it("409: 1 lectura y 0 escrituras", async () => {
    sembrar(base({ exploracion: REABIERTO }));
    const m = await medir("exploracion");
    expect(m.r.status).toBe(409);
    expect({ l: m.lecturas, e: m.escrituras }).toEqual({ l: 1, e: 0 });
  });
});
