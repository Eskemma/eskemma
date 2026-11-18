// C1b-3a (decisión de Raúl sobre el re-cierre): la rama «ya cerrada» NO toca completedAt, currentPhase, reportText,
// fasesCompletadas ni faseActual, pero RECONCILIA el RDA (`planRDAUpdate` sobre el documento releído DENTRO de la
// transacción) y escribe SOLO si el plan trae ítems nuevos o resueltos. `complete-phase` es el único llamador de
// `planRDAUpdate`: re-cerrar tras editar una fase era la única forma de refrescar el RDA. Aquí el plan está simulado
// (control exacto); el caso «Editar variables» con el evaluador REAL va en `route.rdaReal.test.ts`.
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
import { planRDAUpdate } from "@/lib/moddulo/rda";
import { PHASE_ORDER } from "@/types/moddulo.types";
import { POST } from "./route";

type Db = {
  reset(d?: Record<string, unknown>): void;
  seed(path: string, doc: unknown): void;
  atomico(a?: boolean): void;
  rechazarUndefined(a?: boolean): void;
  contadores(): { lecturas: number; escrituras: number; borrados: number };
  updates(): Array<{ path: string; data: Record<string, unknown> }>;
  snapshot(): Record<string, Record<string, unknown>>;
};
const db = adminDb as unknown as Db;
const RUTA = "moddulo_projects/p1";
const ITEM = (id: string) => ({
  id, faseOrigen: "proposito", origenMecanismo: "criterio_suficiencia", criterioId: id.split(":")[1], nombre: "N", descripcion: "d",
  nivelImpacto: "prioritario", recomendacion: "r", estado: "activo",
});
const CERRADA_F1 = {
  status: "active", collaborators: [{ uid: "u1", role: "owner" }], currentPhase: "investigacion", faseActual: 3, fasesCompletadas: [1, 2],
  rda: { "proposito:3": { ...ITEM("proposito:3"), fechaCreacion: "t" } },
  phases: {
    proposito: { status: "completed", completedAt: "2026-01-01T00:00:00.000Z", reportText: "REPORTE ORIGINAL", data: {} },
    exploracion: { status: "completed", completedAt: "2026-01-02T00:00:00.000Z", data: { aprobadoEn: "2026-01-02T00:00:00.000Z" } },
  },
};
function sembrar(vista: Record<string, unknown>, doc: Record<string, unknown> = vista) {
  vi.mocked(getProject).mockResolvedValue({ id: "p1", ...vista } as never);
  db.seed(RUTA, doc);
}
const cerrar = async (phaseId: string) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId }) }) as never, { params: Promise.resolve({ projectId: "p1" }) });
  return { status: r.status, cuerpo: await r.json() };
};
const escrituras = () => db.updates().filter((u) => u.path === RUTA);
const plan = (nuevos: string[], resueltos: string[]) => ({ nuevos: nuevos.map(ITEM), resueltos });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(planRDAUpdate).mockReturnValue({ nuevos: [], resueltos: [] });
  db.reset({ [RUTA]: CERRADA_F1 });
  db.atomico(true);
  db.rechazarUndefined(true);
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("fase ya cerrada: reconcilia el RDA y NO toca el cierre", () => {
  it("plan con ítems nuevos y resueltos → UNA escritura solo con claves rda.* (+ updatedAt); el cierre queda intacto", async () => {
    vi.mocked(planRDAUpdate).mockReturnValue(plan(["proposito:5"], ["proposito:3"]) as never);
    sembrar(CERRADA_F1);
    const r = await cerrar("proposito");
    expect(r.status).toBe(200);
    expect(r.cuerpo).toEqual({ success: true, yaCerrada: true, nextPhase: "exploracion", rda: { nuevos: 1, resueltos: 1 } });
    expect(escrituras()).toHaveLength(1);
    const claves = Object.keys(escrituras()[0].data).sort();
    expect(claves).toEqual(["rda.proposito:3.estado", "rda.proposito:3.fechaResolucion", "rda.proposito:3.resueltoPor", "rda.proposito:5", "updatedAt"]);
    expect(escrituras()[0].data["rda.proposito:3.resueltoPor"]).toBe("sistema");
    // Lo que NO se toca (el documento sembrado conserva exactamente su cierre).
    const doc = db.snapshot()[RUTA] as typeof CERRADA_F1;
    expect(doc.currentPhase).toBe("investigacion");
    expect(doc.faseActual).toBe(3);
    expect(doc.fasesCompletadas).toEqual([1, 2]);
    expect(doc.phases.proposito).toEqual(CERRADA_F1.phases.proposito);
  });
  it("sin cambios en el plan → cero escrituras y el cuerpo es el de siempre (sin `rda`)", async () => {
    sembrar(CERRADA_F1);
    const r = await cerrar("proposito");
    expect(r.cuerpo).toEqual({ success: true, yaCerrada: true, nextPhase: "exploracion" });
    expect(db.contadores().escrituras).toBe(0);
  });
  it("una segunda llamada seguida da cero escrituras (el plan ya está aplicado)", async () => {
    vi.mocked(planRDAUpdate).mockReturnValueOnce(plan(["proposito:5"], []) as never); // la 2.ª usa el valor por defecto: vacío
    sembrar(CERRADA_F1);
    await cerrar("proposito");
    expect(db.contadores().escrituras).toBe(1);
    const r2 = await cerrar("proposito");
    expect(r2.cuerpo.rda).toBeUndefined();
    expect(db.contadores().escrituras).toBe(1);
  });
  it("el plan se calcula sobre el documento RELEÍDO, no sobre el de getProject", async () => {
    sembrar({ ...CERRADA_F1, phases: { ...CERRADA_F1.phases, proposito: { ...CERRADA_F1.phases.proposito, x: "vista" } } }, { ...CERRADA_F1, phases: { ...CERRADA_F1.phases, proposito: { ...CERRADA_F1.phases.proposito, x: "doc" } } });
    await cerrar("proposito");
    const visto = vi.mocked(planRDAUpdate).mock.calls[0][0] as { phases: { proposito: { x?: string } } };
    expect(visto.phases.proposito.x).toBe("doc");
  });
  for (const fase of PHASE_ORDER) {
    it(`${fase}: aplica a las 9 fases (cierre intacto, solo RDA)`, async () => {
      const doc = { ...CERRADA_F1, phases: { [fase]: { status: "completed", completedAt: "2026-01-03T00:00:00.000Z", reportText: "T", data: { aprobadoEn: "x" } } } };
      vi.mocked(planRDAUpdate).mockReturnValue(plan(["proposito:7"], []) as never);
      sembrar(doc);
      const r = await cerrar(fase);
      expect(r.cuerpo.rda).toEqual({ nuevos: 1, resueltos: 0 });
      expect(escrituras()).toHaveLength(1);
      expect(Object.keys(escrituras()[0].data).sort()).toEqual(["rda.proposito:7", "updatedAt"]);
      expect((db.snapshot()[RUTA].phases as Record<string, unknown>)[fase]).toEqual(doc.phases[fase]);
    });
  }
  it("Fase 2 sin aprobadoEn y con cambios en el plan: UNA escritura con aprobadoEn y el RDA (completedAt intacto)", async () => {
    vi.mocked(planRDAUpdate).mockReturnValue(plan(["proposito:5"], []) as never);
    sembrar({ ...CERRADA_F1, phases: { exploracion: { status: "completed", completedAt: "2026-01-02T00:00:00.000Z", data: {} } } });
    await cerrar("exploracion");
    expect(escrituras()).toHaveLength(1);
    expect(Object.keys(escrituras()[0].data).sort()).toEqual(["phases.exploracion.data.aprobadoEn", "rda.proposito:5", "updatedAt"]);
    expect(escrituras()[0].data["phases.exploracion.data.aprobadoEn"]).toBe("2026-01-02T00:00:00.000Z");
  });
  it("Fase 2 sin aprobadoEn y SIN cambios en el plan: solo aprobadoEn (como antes, sin updatedAt)", async () => {
    sembrar({ ...CERRADA_F1, phases: { exploracion: { status: "completed", completedAt: "2026-01-02T00:00:00.000Z", data: {} } } });
    await cerrar("exploracion");
    expect(escrituras()).toHaveLength(1);
    expect(escrituras()[0].data).toEqual({ "phases.exploracion.data.aprobadoEn": "2026-01-02T00:00:00.000Z" });
  });
  it("un cierre con reportText distinto sobre una fase cerrada sigue sin reemplazarlo (aunque reconcilie)", async () => {
    vi.mocked(planRDAUpdate).mockReturnValue(plan(["proposito:5"], []) as never);
    sembrar(CERRADA_F1);
    await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId: "proposito", reportText: "OTRO" }) }) as never, { params: Promise.resolve({ projectId: "p1" }) });
    expect((db.snapshot()[RUTA].phases as { proposito: { reportText: string } }).proposito.reportText).toBe("REPORTE ORIGINAL");
  });
});

describe("costo de la transacción en la rama «ya cerrada» (getProject aparte: +1 lectura y +1 escritura)", () => {
  it("sin cambios en el RDA: 1 lectura y 0 escrituras", async () => {
    sembrar(CERRADA_F1);
    const a = db.contadores();
    await cerrar("proposito");
    const d = db.contadores();
    expect({ l: d.lecturas - a.lecturas, e: d.escrituras - a.escrituras }).toEqual({ l: 1, e: 0 });
  });
  it("con cambios en el RDA: 1 lectura y 1 escritura (el plan dentro de la transacción no añade lecturas)", async () => {
    vi.mocked(planRDAUpdate).mockReturnValue(plan(["proposito:5"], ["proposito:3"]) as never);
    sembrar(CERRADA_F1);
    const a = db.contadores();
    await cerrar("proposito");
    const d = db.contadores();
    expect({ l: d.lecturas - a.lecturas, e: d.escrituras - a.escrituras }).toEqual({ l: 1, e: 1 });
  });
});
