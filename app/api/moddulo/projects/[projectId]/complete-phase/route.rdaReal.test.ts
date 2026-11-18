// C1b-3a: el caso «Editar variables» en una Fase 1 CERRADA con el evaluador REAL (`planRDAUpdate` sin simular):
// editar el XPCTO cambia los criterios; re-cerrar crea o resuelve ítems del RDA y deja el cierre intacto; repetir = 0 escrituras.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
// Marcadores de servidor con la misma semántica que Firestore real: `update()` con claves con punto escribe la ruta anidada.
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS", arrayUnion: (...a: unknown[]) => a } }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/moddulo/project")>()), getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";

type Db = {
  reset(d?: Record<string, unknown>): void;
  seed(path: string, doc: unknown): void;
  atomico(a?: boolean): void;
  contadores(): { lecturas: number; escrituras: number; borrados: number };
  updates(): Array<{ path: string; data: Record<string, unknown> }>;
};
const db = adminDb as unknown as Db;
const RUTA = "moddulo_projects/p1";
const COMPLETO = {
  hito: "Ganar la alcaldía en 2027 (prueba de variables)", sujeto: "Candidato de prueba",
  capacidades: { financiero: "Presupuesto de prueba", humano: "Equipo de diez personas", logistico: "Dos vehículos" },
  tiempo: { fechaLimite: "2027-06-06", duracionMeses: 12 }, justificacion: "Justificación de prueba para cerrar la Fase 1 con todo.",
};
const CRUCES = [1, 2, 3, 4, 5].map((id) => ({ id, etiqueta: `c${id}`, pregunta: "p", veredicto: "coherente", argumentacion: "a" }));
const doc = (xpcto: Record<string, unknown>) => ({
  status: "active", collaborators: [{ uid: "u1", role: "owner" }], currentPhase: "investigacion", faseActual: 3, fasesCompletadas: [1, 2], type: "electoral", xpcto,
  phases: {
    proposito: { status: "completed", completedAt: "2026-01-01T00:00:00.000Z", reportText: "REPORTE ORIGINAL", dictamen: { cruces: CRUCES }, data: {} },
    exploracion: { status: "completed", completedAt: "2026-01-02T00:00:00.000Z", data: { aprobadoEn: "2026-01-02T00:00:00.000Z" } },
  },
});
/** Lo que el servidor tiene guardado (aplica las claves con punto de los `update` del mock sobre el documento). */
function aplicar(actual: Record<string, any>, data: Record<string, unknown>) {
  for (const [k, v] of Object.entries(data)) {
    const ruta = k.split(".");
    // Las claves de RDA llevan ":" y sin punto en el id: `rda.proposito:2.estado` → ["rda", "proposito:2", "estado"].
    let o = actual;
    for (const p of ruta.slice(0, -1)) o = (o[p] ??= {});
    o[ruta[ruta.length - 1]] = v;
  }
  return actual;
}
let vivo: Record<string, any>;
function sembrar(d: Record<string, any>) { vivo = d; db.seed(RUTA, vivo); vi.mocked(getProject).mockResolvedValue({ id: "p1", ...d } as never); }
const cerrar = async () => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId: "proposito" }) }) as never, { params: Promise.resolve({ projectId: "p1" }) });
  return { status: r.status, cuerpo: await r.json() };
};
const escrituras = () => db.updates().filter((u) => u.path === RUTA);
/** Re-lee el resultado de la última escritura y lo deja sembrado como el nuevo estado (lo que haría Firestore). */
function persistirUltima() { const u = escrituras().at(-1); if (u) { aplicar(vivo, u.data); db.seed(RUTA, vivo); } }

beforeEach(() => {
  vi.clearAllMocks();
  db.reset({});
  db.atomico(true);
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("«Editar variables» en una Fase 1 cerrada y re-cerrar (evaluador REAL)", () => {
  it("con todo completo y sin cambios: el RDA no trae nada → cero escrituras", async () => {
    sembrar(doc(COMPLETO));
    const r = await cerrar();
    expect(r.cuerpo).toEqual({ success: true, yaCerrada: true, nextPhase: "exploracion" });
    expect(db.contadores().escrituras).toBe(0);
  });
  it("se edita una variable (justificación corta) → el re-cierre CREA el ítem del RDA y el cierre queda intacto; repetir = 0 escrituras", async () => {
    // El usuario edita (PATCH de xpcto: el documento cambia; `getProject` ve lo mismo).
    sembrar(doc({ ...COMPLETO, justificacion: "Corta." }));
    const r = await cerrar();
    expect(r.status).toBe(200);
    expect(r.cuerpo).toEqual({ success: true, yaCerrada: true, nextPhase: "exploracion", rda: { nuevos: 1, resueltos: 0 } });
    expect(escrituras()).toHaveLength(1);
    const d = escrituras()[0].data as Record<string, any>;
    expect(Object.keys(d).sort()).toEqual(["rda.proposito:5", "updatedAt"]);
    expect(d["rda.proposito:5"]).toMatchObject({ id: "proposito:5", faseOrigen: "proposito", estado: "activo", nombre: "Solidez del propósito" });
    persistirUltima();
    // El cierre NO se tocó.
    expect(vivo.currentPhase).toBe("investigacion");
    expect(vivo.faseActual).toBe(3);
    expect(vivo.fasesCompletadas).toEqual([1, 2]);
    expect(vivo.phases.proposito.completedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(vivo.phases.proposito.reportText).toBe("REPORTE ORIGINAL");
    expect(vivo.rda["proposito:5"].estado).toBe("activo");
    // Segunda llamada seguida: ya reconciliado → cero escrituras.
    vi.mocked(getProject).mockResolvedValue({ id: "p1", ...vivo } as never);
    const antes = db.contadores().escrituras;
    const r2 = await cerrar();
    expect(r2.cuerpo.rda).toBeUndefined();
    expect(db.contadores().escrituras).toBe(antes);
  });
  it("se vuelve a completar la variable → el re-cierre RESUELVE el ítem (resueltoPor: sistema) y el cierre sigue intacto", async () => {
    const conItem = doc({ ...COMPLETO, justificacion: "Corta." });
    sembrar(conItem);
    await cerrar();
    persistirUltima();
    // Segunda edición: el XPCTO vuelve a estar completo.
    vivo.xpcto = COMPLETO;
    db.seed(RUTA, vivo);
    vi.mocked(getProject).mockResolvedValue({ id: "p1", ...vivo } as never);
    const r = await cerrar();
    expect(r.cuerpo.rda).toEqual({ nuevos: 0, resueltos: 1 });
    const u = escrituras().at(-1)!.data;
    expect(Object.keys(u).sort()).toEqual(["rda.proposito:5.estado", "rda.proposito:5.fechaResolucion", "rda.proposito:5.resueltoPor", "updatedAt"]);
    persistirUltima();
    expect(vivo.rda["proposito:5"].estado).toBe("resuelto");
    expect(vivo.currentPhase).toBe("investigacion");
    expect(vivo.phases.proposito.completedAt).toBe("2026-01-01T00:00:00.000Z");
    // Y otra llamada: cero escrituras.
    vi.mocked(getProject).mockResolvedValue({ id: "p1", ...vivo } as never);
    const antes = db.contadores().escrituras;
    await cerrar();
    expect(db.contadores().escrituras).toBe(antes);
  });
  it("la reconciliación usa el documento releído: getProject ve el XPCTO completo pero el documento ya está editado → crea el ítem", async () => {
    vivo = doc({ ...COMPLETO, justificacion: "Corta." });
    db.seed(RUTA, vivo);
    vi.mocked(getProject).mockResolvedValue({ id: "p1", ...doc(COMPLETO) } as never);
    const r = await cerrar();
    expect(r.cuerpo.rda).toEqual({ nuevos: 1, resueltos: 0 });
  });
});
