// C1b-3b — HISTORIAL del cierre de fase: `complete-phase` deja una versión de `cierre:{fase}` en la MISMA transacción
// (previa «abierta» con el borrador de `reportText` que se pisa —siempre que el artefacto aún no esté en el manifiesto
// vigente, haya o no puntero—, versión «cerrada» con el sello {aprobado, por, en} y una revisión con `cierre{por}`).
// Proyectos sembrados con `Timestamp` REALES (fixture `siembraCierre`); mock con rechazo de `undefined` y transacciones
// atómicas. Sin emulador (Java 17): todo-o-nada y conteos son del mock. Cerrar una fase NO llama al modelo.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase-admin/firestore")>()),
  FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS", arrayUnion: (...a: unknown[]) => a },
}));
vi.mock("@/lib/moddulo/project", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/moddulo/project")>()), getProject: vi.fn() }));
vi.mock("@/lib/moddulo/rda", () => ({ planRDAUpdate: vi.fn(() => ({ nuevos: [], resueltos: [] })) }));

import { Timestamp } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { planRDAUpdate } from "@/lib/moddulo/rda";
import { PHASE_ORDER, type PhaseId } from "@/types/moddulo.types";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { BORRADOR, REPORTE, RUTA_P as P, docCerrable } from "@/lib/moddulo/__tests__/fixtures/siembraCierre";
import {
  clonar, consolidarF2, eventosDe, expandirFirestore, registrarVigenteF2, revisionesDe, versionesDe,
} from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
type Doc = Record<string, unknown>;

function sembrar(doc: Doc) {
  // La semilla lleva Timestamps REALES: se comprueba ANTES de ejecutar la ruta (lección de C1b-1).
  expect(doc.updatedAt).toBeInstanceOf(Timestamp);
  expect(doc.lastAccessedAt).toBeInstanceOf(Timestamp);
  db.reset({ [P]: clonar(doc) });
  db.rechazarUndefined(true);
  db.atomico(true);
}
const cerrar = async (phaseId: string, reportText?: string) => {
  const r = await POST(
    new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId, ...(reportText ? { reportText } : {}) }) }) as never,
    { params: Promise.resolve({ projectId: "p1" }) }
  );
  return { status: r.status, cuerpo: (await r.json()) as Doc };
};
/** Lo que dejaría Firestore real en el documento (claves con puntos expandidas). */
const proyecto = () => expandirFirestore(db.snapshot()[P] as Doc) as { phases: Record<string, Doc & { revision?: { n: number } }>; status?: string; currentPhase?: string };
const hayHistorial = () => Object.keys(db.snapshot()).some((k) => k.startsWith(`${P}/versiones/`) || k.startsWith(`${P}/revisiones/`) || k.startsWith(`${P}/eventos/`));
const sinHistorial = () => {
  for (const sub of ["versiones", "revisiones", "eventos"]) {
    expect(Object.keys(db.snapshot()).filter((k) => k.startsWith(`${P}/${sub}/`))).toHaveLength(0);
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(planRDAUpdate).mockReturnValue({ nuevos: [], resueltos: [] } as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => ({ id, ...(expandirFirestore((db.snapshot()[`moddulo_projects/${id}`] ?? {}) as Doc)) }) as never);
});

describe("cierre de una fase SIN historial previo (primera vez en el puntero)", () => {
  it("F1: previa «abierta» (por null) + versión «cerrada» con sello + revisión con `cierre` + evento con detalle exacto + puntero", async () => {
    sembrar(docCerrable("proposito", { reportText: BORRADOR }));
    const r = await cerrar("proposito", REPORTE);
    expect(r.status).toBe(200);
    const doc = proyecto();
    expect(doc.phases.proposito.status).toBe("completed");
    const [previa, nueva] = versionesDe(db, P);
    expect(previa.artefacto).toBe("cierre:proposito");
    expect(previa).toMatchObject({ tipoCambio: "previo_sin_historial", por: null, estado: "reemplazada" });
    expect(previa.contenido).toEqual({ fase: "proposito", estado: "abierta", reportText: BORRADOR });
    expect(previa.aprobacion).toBeUndefined();
    expect(nueva).toMatchObject({ tipoCambio: "ajuste_manual", por: "u1", motivo: "cierre_fase", estado: "vigente" });
    expect(nueva.contenido).toEqual({ fase: "proposito", estado: "cerrada", completedAt: doc.phases.proposito.completedAt, reportText: REPORTE });
    expect(nueva.aprobacion).toEqual({ aprobado: true, por: "u1", en: doc.phases.proposito.completedAt });
    const [rev] = revisionesDe(db, P) as unknown as Array<Doc & { cierre?: { por: string }; motivo?: string; n: number }>;
    expect(rev).toMatchObject({ n: 1, fase: "proposito", motivo: "cierre_fase" });
    expect(rev.cierre?.por).toBe("u1");
    const [ev] = eventosDe(db, P);
    expect(ev).toMatchObject({ tipo: "ajuste_manual", fase: "proposito", motivo: "cierre_fase", por: "u1", fuente: "usuario" });
    expect(ev.detalle).toEqual({ reporteNuevo: true, reporteSustituido: true, rdaNuevos: 0, rdaResueltos: 0, proyectoCompletado: false });
    expect(doc.phases.proposito.revision).toMatchObject({ n: 1, por: "u1" });
  });

  it("sin borrador previo y sin reportText: la previa «abierta» lleva reportText null y el detalle lo dice", async () => {
    sembrar(docCerrable("proposito"));
    await cerrar("proposito");
    const [previa, nueva] = versionesDe(db, P);
    expect(previa.contenido).toEqual({ fase: "proposito", estado: "abierta", reportText: null });
    expect((nueva.contenido as Doc).reportText).toBeNull();
    expect(eventosDe(db, P)[0].detalle).toMatchObject({ reporteNuevo: false, reporteSustituido: false });
  });

  it("reportText igual al borrador: no cuenta como sustitución", async () => {
    sembrar(docCerrable("proposito", { reportText: REPORTE }));
    await cerrar("proposito", REPORTE);
    expect(eventosDe(db, P)[0].detalle).toMatchObject({ reporteNuevo: true, reporteSustituido: false });
  });

  it("cierre sin reportText con borrador guardado: el borrador queda como reporte final y se versiona", async () => {
    sembrar(docCerrable("proposito", { reportText: BORRADOR }));
    await cerrar("proposito");
    expect((versionesDe(db, P)[1].contenido as Doc).reportText).toBe(BORRADOR);
  });
});

describe("cierre CON puntero existente pero SIN el artefacto de cierre (F2 con historial de f2M1) — condición a", () => {
  async function f2ConHistorial() {
    sembrar(docCerrable("exploracion", { reportText: BORRADOR }));
    await registrarVigenteF2(db, P, { aprobado: true, por: "uidA", en: "2026-11-10T15:00:00.123Z", huella: "h", categoriasEditadas: 0, total: 6 });
    return db.snapshot()[P];
  }

  it("la previa «abierta» SE CREA aunque ya haya puntero: el borrador de reportText que el cierre pisa no se pierde", async () => {
    await f2ConHistorial();
    expect((await cerrar("exploracion", REPORTE)).status).toBe(200);
    const vers = versionesDe(db, P).filter((v) => v.artefacto === "cierre:exploracion");
    expect(vers).toHaveLength(2);
    expect(vers[0]).toMatchObject({ tipoCambio: "previo_sin_historial", por: null });
    expect(vers[0].contenido).toEqual({ fase: "exploracion", estado: "abierta", reportText: BORRADOR });
    expect(vers[1].contenido).toMatchObject({ estado: "cerrada", reportText: REPORTE });
  });

  it("la revisión de cierre es la n=2 del puntero, conserva f2M1 sin copiar contenido y PROTEGE sus versiones vigentes", async () => {
    await f2ConHistorial();
    await cerrar("exploracion", REPORTE);
    const revs = revisionesDe(db, P) as unknown as Array<Doc & { n: number; cierre?: { por: string }; artefactos: Record<string, { retenidas: Array<{ id: string; protegida: boolean }>; versionId: string }> }>;
    const cierre = revs.find((x) => x.n === 2)!;
    expect(cierre.cierre?.por).toBe("u1");
    expect(Object.keys(cierre.artefactos).sort()).toEqual(["cierre:exploracion", "f2M1"]);
    const m1 = cierre.artefactos.f2M1;
    expect(m1.retenidas.find((x) => x.id === m1.versionId)?.protegida).toBe(true);
    expect(proyecto().phases.exploracion.revision?.n).toBe(2);
  });

  it("F2: el contenido lleva aprobadoEn y la huella del M1 aprobado (para que C4 vincule cierre ↔ aprobación) y NADA más", async () => {
    sembrar(docCerrable("exploracion"));
    await cerrar("exploracion", REPORTE);
    const doc = proyecto();
    const nueva = versionesDe(db, P).at(-1)!;
    const aprobacion = (doc.phases.exploracion.m1 as { aprobacion: { huella: string } }).aprobacion;
    expect(Object.keys(nueva.contenido as Doc).sort()).toEqual(["aprobadoEn", "completedAt", "estado", "fase", "m1HuellaAprobada", "reportText"]);
    expect(nueva.contenido).toMatchObject({ aprobadoEn: doc.phases.exploracion.completedAt, m1HuellaAprobada: aprobacion.huella });
  });
});

describe("las 9 fases cierran con historial", () => {
  for (const fase of PHASE_ORDER) {
    it(`${fase}: deja \`cierre:${fase}\` y el puntero \`phases.${fase}.revision\``, async () => {
      sembrar(docCerrable(fase));
      expect((await cerrar(fase, REPORTE)).status).toBe(200);
      expect(versionesDe(db, P).some((v) => v.artefacto === `cierre:${fase}` && (v.contenido as Doc).estado === "cerrada")).toBe(true);
      expect(proyecto().phases[fase].revision?.n).toBe(1);
      expect(eventosDe(db, P)[0].fase).toBe(fase);
    });
  }

  it("la 9.ª fase: `status: completed` del proyecto y el historial en la MISMA escritura (detalle.proyectoCompletado)", async () => {
    const doc = docCerrable("evaluacion") as Doc & { phases: Record<string, Doc> };
    for (const p of PHASE_ORDER.slice(0, 8)) doc.phases[p] = { status: "completed" };
    sembrar(doc);
    await cerrar("evaluacion");
    expect(proyecto().status).toBe("completed");
    expect(db.updates().filter((u) => u.path === P)).toHaveLength(1);
    expect(eventosDe(db, P)[0].detalle).toMatchObject({ proyectoCompletado: true });
  });

  it("el detalle nombra cuántos ítems del RDA trajo el cierre (solo números)", async () => {
    vi.mocked(planRDAUpdate).mockReturnValue({ nuevos: [{ id: "a" }, { id: "b" }], resueltos: ["c"] } as never);
    sembrar(docCerrable("proposito"));
    await cerrar("proposito");
    expect(eventosDe(db, P)[0].detalle).toMatchObject({ rdaNuevos: 2, rdaResueltos: 1 });
  });
});

describe("re-cierre idempotente: NO registra versión (un cierre se registra UNA vez)", () => {
  it("fase cerrada CON historial: 200 yaCerrada y cero versiones, revisiones o eventos nuevos", async () => {
    sembrar(docCerrable("proposito", { reportText: BORRADOR }));
    await cerrar("proposito", REPORTE);
    const antes = Object.keys(db.snapshot()).length;
    consolidarF2(db, P);
    const r = await cerrar("proposito", "otro texto");
    expect(r.cuerpo).toMatchObject({ success: true, yaCerrada: true });
    expect(db.updates()).toHaveLength(0);
    expect(Object.keys(db.snapshot()).length).toBe(antes);
    expect(versionesDe(db, P)).toHaveLength(2);
  });

  it("fase cerrada SIN historial (legado): tampoco crea nada y el puntero sigue ausente", async () => {
    sembrar(docCerrable("proposito", { status: "completed", extraFase: { completedAt: "2026-10-01T10:00:00.000Z", reportText: REPORTE } }));
    const r = await cerrar("proposito");
    expect(r.cuerpo.yaCerrada).toBe(true);
    sinHistorial();
    expect(proyecto().phases.proposito.revision).toBeUndefined();
  });

  it("la reconciliación del RDA de un re-cierre se sigue aplicando y no registra versión", async () => {
    sembrar(docCerrable("proposito", { status: "completed", extraFase: { completedAt: "2026-10-01T10:00:00.000Z" } }));
    vi.mocked(planRDAUpdate).mockReturnValue({ nuevos: [{ id: "x", fase: "proposito" }], resueltos: [] } as never);
    const r = await cerrar("proposito");
    expect(r.cuerpo.rda).toEqual({ nuevos: 1, resueltos: 0 });
    expect(db.updates()).toHaveLength(1);
    sinHistorial();
  });

  it("F2 ya cerrada sin `aprobadoEn`: se completa (como antes) y no deja versión", async () => {
    sembrar(docCerrable("exploracion", { status: "completed", extraFase: { completedAt: "2026-10-01T10:00:00.000Z" } }));
    await cerrar("exploracion");
    expect(proyecto().phases.exploracion.data).toMatchObject({ aprobadoEn: "2026-10-01T10:00:00.000Z" });
    sinHistorial();
  });
});

describe("caminos que NO escriben dejan el historial intacto", () => {
  it("F2 sin M1 aprobado/Reporte → 409 con su código y cero historial", async () => {
    const d = docCerrable("exploracion") as { phases: { exploracion: { dvs?: unknown } } };
    delete d.phases.exploracion.dvs;
    sembrar(d as unknown as Doc);
    const r = await cerrar("exploracion", REPORTE);
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reporte_f2_no_finalizado");
    expect(db.updates()).toHaveLength(0);
    sinHistorial();
  });
  it("sin permisos (analista) → 403; proyecto en la papelera → 404; sin sesión → 401", async () => {
    sembrar(docCerrable("proposito", { rolAnalyst: true }));
    expect((await cerrar("proposito")).status).toBe(403);
    sinHistorial();
    sembrar({ ...docCerrable("proposito"), deletedAt: Timestamp.fromDate(new Date()) });
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await cerrar("proposito")).status).toBe(404);
    sinHistorial();
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await cerrar("proposito")).status).toBe(401);
  });
});

describe("si el historial no se puede registrar, NO se cierra nada (todo o nada)", () => {
  it("colisión (revisión ya existente) → 409 historial_no_confirmado y el documento queda intacto", async () => {
    sembrar(docCerrable("proposito", { reportText: BORRADOR }));
    db.seed(`${P}/revisiones/proposito_000001`, { n: 1, fase: "proposito" });
    const antes = clonar(db.snapshot());
    const r = await cerrar("proposito", REPORTE);
    expect(r.status).toBe(409);
    expect(r.cuerpo).toMatchObject({ error: "historial_no_confirmado", causa: "colision" });
    expect(db.snapshot()).toEqual(antes);
    expect(proyecto().phases.proposito.status).toBe("in-progress");
  });
  it("inconsistencia (puntero sin manifiesto) → 500 historial_no_confirmado y nada escrito (ni cierre, ni RDA, ni currentPhase)", async () => {
    sembrar(docCerrable("proposito", { extraFase: { revision: { n: 3, huella: "h", por: "x", en: "t" } } }));
    const antes = clonar(db.snapshot());
    const r = await cerrar("proposito", REPORTE);
    expect(r.status).toBe(500);
    expect(r.cuerpo).toMatchObject({ error: "historial_no_confirmado", causa: "inconsistencia" });
    expect(db.snapshot()).toEqual(antes);
    expect(proyecto().currentPhase).toBe("proposito");
  });
  it("el log del error no lleva contenido del reporte ni uids", async () => {
    sembrar(docCerrable("proposito", { extraFase: { revision: { n: 3, huella: "h", por: "x", en: "t" } } }));
    await cerrar("proposito", REPORTE);
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logs).toContain("[historial][complete-phase]");
    expect(logs).not.toContain("Reporte final");
    expect(logs).not.toContain("u1");
  });
});

describe("tamaño: un reporte enorme no bloquea el cierre", () => {
  it("contenido de ~950 KB → el cierre responde 200 y la versión guarda solo la huella (`contenidoOmitido`: «volver» no lo restauraría)", async () => {
    const enorme = "x".repeat(950_000);
    sembrar(docCerrable("proposito"));
    const r = await cerrar("proposito", enorme);
    expect(r.status).toBe(200);
    expect(proyecto().phases.proposito.status).toBe("completed");
    const nueva = versionesDe(db, P).at(-1)! as Doc & { contenidoOmitido?: boolean; huella: string };
    expect(nueva.contenidoOmitido).toBe(true);
    expect(nueva.contenido).toBeUndefined();
    expect(nueva.huella).toMatch(/\w+/);
  });
});
