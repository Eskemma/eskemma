// Paso 4 (H) — complete-phase: la Fase 2 solo cierra con un Reporte F2 FINALIZADO y, si el proyecto tiene un M1 en
// revisión (m1 + payload), con ese M1 APROBADO. Caracterización primero (verde con el código anterior): lo que no cambia.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS", arrayUnion: (...a: unknown[]) => a } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/moddulo/rda", () => ({ planRDAUpdate: vi.fn(() => ({ nuevos: [], resueltos: [] })) }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";
import { POST } from "./route";

type Db = { reset(d?: Record<string, unknown>): void; updates(): Array<{ path: string; data: Record<string, unknown> }> };
const db = adminDb as unknown as Db;
const MAPA = { P: { code: "P", label: "P", clasificacion: "NEUTRAL", narrativa: "n", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] } };
const proyecto = (exploracion: Record<string, unknown>) => ({
  id: "p1", status: "active", collaborators: [{ uid: "u1", role: "owner" }], phases: { exploracion },
});
const cerrar = async (phaseId = "exploracion") => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId }) }) as never, { params: Promise.resolve({ projectId: "p1" }) });
  return { status: r.status, cuerpo: await r.json() };
};
const escrituras = () => db.updates().filter((u) => u.path === "moddulo_projects/p1");

beforeEach(() => {
  vi.clearAllMocks();
  db.reset({ "moddulo_projects/p1": { phases: {} } }); // commit 5: the close is a transaction that re-reads the document
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});


const huella = huellaMapaPESTEL(MAPA as never);
const aprobacion = { huella, por: "u1", en: "t", categoriasEditadas: 0, total: 1, mapa: MAPA };
const express = { linkedSource: { kind: "express", payload: MAPA } };
const DVS = { x: 1 };

describe("CARACTERIZACIÓN — lo que NO cambia (verde con el código anterior)", () => {
  it("heredado (payload y Reporte F2, SIN m1) — el caso de los 10 proyectos ya cerrados: cierra", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, ...express }) as never);
    expect((await cerrar()).status).toBe(200);
  });
  it("heredado sin payload (ruta del formulario) con Reporte F2: cierra", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS }) as never);
    expect((await cerrar()).status).toBe(200);
  });
  it("M1 aprobado con el Reporte F2 de ESE M1 (generacion.huella === aprobacion.huella): cierra", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, m1: { creadoEn: "t", aprobacion, generacion: { huella, en: "t" } }, ...express }) as never);
    expect((await cerrar()).status).toBe(200);
  });
  it("M1 en borrador o reabierto CON Reporte F2 (del análisis anterior): 409 m1_no_aprobado", async () => {
    for (const m1 of [{ creadoEn: "t" }, { reabiertoEn: "t" }]) {
      vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, m1, ...express }) as never);
      expect((await cerrar()).cuerpo.error).toBe("m1_no_aprobado");
    }
  });
  it("otras fases no miran ni el Reporte F2 ni el M1", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({}) as never);
    for (const fase of ["proposito", "investigacion"]) expect((await cerrar(fase)).status).toBe(200);
  });
});

describe("Paso 4 (H) — lo nuevo", () => {
  it("SIN Reporte F2 finalizado: 409 reporte_f2_no_finalizado y NO escribe (heredado sin m1, y con payload)", async () => {
    for (const exp of [{}, { ...express }, { draftDVS: { y: 1 } }]) {
      vi.mocked(getProject).mockResolvedValue(proyecto(exp) as never);
      const r = await cerrar();
      expect(r.status).toBe(409);
      expect(r.cuerpo.error).toBe("reporte_f2_no_finalizado");
    }
    expect(escrituras()).toHaveLength(0);
  });
  it("M1 aprobado pero SIN Reporte F2: 409 reporte_f2_no_finalizado", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ m1: { creadoEn: "t", aprobacion, generacion: { huella, en: "t" } }, ...express }) as never);
    expect((await cerrar()).cuerpo.error).toBe("reporte_f2_no_finalizado");
  });
  it("M1 sin aprobar y SIN Reporte F2: gana m1_no_aprobado (sin M1 aprobado no puede haber un Reporte de ese análisis)", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ m1: { creadoEn: "t" }, ...express }) as never);
    expect((await cerrar()).cuerpo.error).toBe("m1_no_aprobado");
  });
  it("aprobación que ya no coincide con el payload (se editó después) y Reporte F2: 409 m1_no_aprobado", async () => {
    const editado = { P: { ...MAPA.P, narrativa: "otra" } };
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, m1: { creadoEn: "t", aprobacion }, linkedSource: { kind: "express", payload: editado } }) as never);
    expect((await cerrar()).cuerpo.error).toBe("m1_no_aprobado");
  });
  it("m1 SIN payload (tras desvincular) con Reporte F2: no se le pide una aprobación que no puede tener", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, m1: { creadoEn: "t" } }) as never);
    expect((await cerrar()).status).toBe(200);
  });
  it("lo que escribe al cerrar no cambió: status, completedAt, currentPhase (y nada de más)", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, ...express }) as never);
    await cerrar();
    const d = escrituras()[0].data;
    expect(Object.keys(d).sort()).toEqual(["currentPhase", "phases.exploracion.completedAt", "phases.exploracion.data.aprobadoEn", "phases.exploracion.status", "updatedAt"]);
  });

  describe("el Reporte F2 debe ser de ESTE M1 (m1.generacion.huella === m1.aprobacion.huella)", () => {
    it("coincide → cierra", async () => {
      vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, m1: { creadoEn: "t", aprobacion, generacion: { huella, en: "t" } }, ...express }) as never);
      expect((await cerrar()).status).toBe(200);
    });
    it("NO coincide (los motores salieron de otra aprobación) → 409 reporte_f2_de_otro_analisis y no escribe", async () => {
      vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, m1: { creadoEn: "t", aprobacion, generacion: { huella: "otra", en: "t" } }, ...express }) as never);
      const r = await cerrar();
      expect(r.status).toBe(409);
      expect(r.cuerpo.error).toBe("reporte_f2_de_otro_analisis");
      expect(escrituras()).toHaveLength(0);
    });
    it("generacion AUSENTE (aprobado, el Reporte F2 es de un análisis anterior) → 409 reporte_f2_de_otro_analisis", async () => {
      vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, m1: { creadoEn: "t", aprobacion }, ...express }) as never);
      expect((await cerrar()).cuerpo.error).toBe("reporte_f2_de_otro_analisis");
    });
    it("sin m1 (heredado) nada cambia aunque no haya generacion: cierra", async () => {
      vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, ...express }) as never);
      expect((await cerrar()).status).toBe(200);
    });
    it("m1 sin payload (tras desvincular): no se exige generacion", async () => {
      vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, m1: { creadoEn: "t", aprobacion } }) as never);
      expect((await cerrar()).status).toBe(200);
    });
  });

describe("Commit 5 — Fase 2 ya cerrada: idempotente, cero escrituras", () => {
  const cerrada = { status: "completed", completedAt: "2026-08-05T21:55:52.003Z", dvs: DVS, ...express };
  const docCompleto = { phases: { exploracion: { status: "completed", completedAt: "2026-08-05T21:55:52.003Z", data: { aprobadoEn: "2026-08-05T21:55:52.003Z" } } } };
  it("doble cierre = 200 {yaCerrada} y 0 escrituras (ni completedAt, ni currentPhase, ni RDA)", async () => {
    db.reset({ "moddulo_projects/p1": docCompleto });
    vi.mocked(getProject).mockResolvedValue(proyecto(cerrada) as never);
    const r = await cerrar();
    expect(r.status).toBe(200);
    expect(r.cuerpo).toEqual({ success: true, yaCerrada: true, nextPhase: "investigacion" });
    expect(escrituras()).toHaveLength(0);
  });
  it("gana sobre las demás reglas: cerrada con M1 en borrador, sin Reporte o con Reporte de otro análisis: sigue 200 sin escribir", async () => {
    db.reset({ "moddulo_projects/p1": docCompleto });
    for (const exp of [{ status: "completed", m1: { creadoEn: "t" }, ...express }, { status: "completed" }, { status: "completed", dvs: DVS, m1: { creadoEn: "t", aprobacion }, ...express }]) {
      vi.mocked(getProject).mockResolvedValue(proyecto(exp) as never);
      expect((await cerrar()).cuerpo.yaCerrada).toBe(true);
    }
    expect(escrituras()).toHaveLength(0);
  });
  it("[carrera] la lectura previa ve la fase abierta pero al escribir otra petición ya la cerró: 200 yaCerrada y cero escrituras", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, ...express }) as never);
    db.reset({ "moddulo_projects/p1": docCompleto });
    const r = await cerrar();
    expect(r.cuerpo.yaCerrada).toBe(true);
    expect(escrituras()).toHaveLength(0);
  });
  it("cerrada SIN aprobadoEn (cierre parcial anterior): completa SOLO eso, con completedAt, sin tocar currentPhase/RDA/completedAt", async () => {
    db.reset({ "moddulo_projects/p1": { phases: { exploracion: { status: "completed", completedAt: "2026-08-05T21:55:52.003Z", data: { pestl: { x: 1 } } } } } });
    vi.mocked(getProject).mockResolvedValue(proyecto(cerrada) as never);
    const r = await cerrar();
    expect(r.cuerpo).toEqual({ success: true, yaCerrada: true, nextPhase: "investigacion" });
    expect(escrituras()).toHaveLength(1);
    expect(escrituras()[0].data).toEqual({ "phases.exploracion.data.aprobadoEn": "2026-08-05T21:55:52.003Z" });
    // a second retry: now complete → zero writes
    const antes = escrituras().length;
    db.reset({ "moddulo_projects/p1": docCompleto });
    await cerrar();
    expect(escrituras().length).toBe(0);
    expect(antes).toBe(1);
  });
  it("el primer cierre escribe aprobadoEn en el MISMO update que el cierre (una sola escritura)", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, ...express }) as never);
    await cerrar();
    expect(escrituras()).toHaveLength(1);
    const d = escrituras()[0].data;
    expect(d["phases.exploracion.status"]).toBe("completed");
    expect(typeof d["phases.exploracion.data.aprobadoEn"]).toBe("string");
    expect(d["phases.exploracion.data.aprobadoEn"]).toBe(d["phases.exploracion.completedAt"]);
  });
  it("otras fases no tienen este atajo (cerrar de nuevo no cambia lo de antes)", async () => {
    vi.mocked(getProject).mockResolvedValue({ ...proyecto({}), phases: { proposito: { status: "completed" } } } as never);
    expect((await cerrar("proposito")).cuerpo.yaCerrada).toBeUndefined();
  });
  it("el cierre normal sigue escribiendo y no trae yaCerrada", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: DVS, ...express }) as never);
    const r = await cerrar();
    expect(r.cuerpo).toEqual({ success: true, nextPhase: "investigacion" });
    expect(escrituras()).toHaveLength(1);
  });
});
});
