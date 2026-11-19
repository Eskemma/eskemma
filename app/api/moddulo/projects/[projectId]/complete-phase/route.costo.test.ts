// C1b-3b — COSTO del cierre con historial, medido con los contadores del mock (TOTALES de la transacción; `getProject`
// suma +1 lectura y +1 escritura —`lastAccessedAt`— en todos los caminos y no cambia, H-V23). Sin emulador (Java 17).

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

const medir = async (fase: string, reportText?: string) => {
  const antes = db.contadores();
  const r = await cerrar(fase, reportText);
  const d = db.contadores();
  return { r, l: d.lecturas - antes.lecturas, e: d.escrituras - antes.escrituras };
};
const sello = { aprobado: true as const, por: "uidA", en: "2026-11-10T15:00:00.123Z", huella: "h", categoriasEditadas: 0, total: 6 };

describe("costo de cerrar con historial (totales de la transacción)", () => {
  it("sin puntero (F1): 1 L / 5 E — proyecto, previa, versión, revisión y evento (antes 1 / 1)", async () => {
    sembrar(docCerrable("proposito", { reportText: BORRADOR }));
    const m = await medir("proposito", REPORTE);
    expect(m.r.status).toBe(200);
    expect({ l: m.l, e: m.e }).toEqual({ l: 1, e: 5 });
  });
  it("con puntero y el artefacto de cierre AÚN NO en el manifiesto (F2 con historial de f2M1): 2 L / 5 E — condición a", async () => {
    sembrar(docCerrable("exploracion", { reportText: BORRADOR }));
    await registrarVigenteF2(db, P, sello);
    const m = await medir("exploracion", REPORTE);
    expect(m.r.status).toBe(200);
    expect({ l: m.l, e: m.e }).toEqual({ l: 2, e: 5 });
  });
  it("9.ª fase: igual que un cierre normal (el estado del proyecto va en la misma escritura): 1 L / 5 E", async () => {
    const doc = docCerrable("evaluacion") as Doc & { phases: Record<string, Doc> };
    for (const p of PHASE_ORDER.slice(0, 8)) doc.phases[p] = { status: "completed" };
    sembrar(doc);
    expect(await medir("evaluacion")).toMatchObject({ l: 1, e: 5 });
  });
  it("con DERIVA (el cierre ya estaba registrado y la fase se reabrió sin registro): 2 L / 5 E, versión de deriva marcada", async () => {
    sembrar(docCerrable("proposito", { reportText: BORRADOR }));
    await cerrar("proposito", REPORTE);
    consolidarF2(db, P);
    // «reapertura silenciosa»: el vivo vuelve a «en curso» sin historial (p. ej. H-V36).
    const todo = clonar(db.snapshot()) as Record<string, unknown>;
    const doc = todo[P] as { phases: { proposito: Doc } };
    doc.phases.proposito.status = "in-progress";
    delete doc.phases.proposito.completedAt;
    db.reset(todo);
    db.rechazarUndefined(true);
    db.atomico(true);
    const m = await medir("proposito", "Reporte 2");
    expect(m.r.status).toBe(200);
    expect({ l: m.l, e: m.e }).toEqual({ l: 2, e: 5 });
    expect(eventosDe(db, P).at(-1)).toMatchObject({ artefactosConDeriva: ["cierre:proposito"] });
    expect(versionesDe(db, P).some((v) => v.deriva === true)).toBe(true);
  });
  it("re-cierre: 1 L / 0 E (sin cambios de RDA)", async () => {
    sembrar(docCerrable("proposito", { status: "completed", extraFase: { completedAt: "2026-10-01T10:00:00.000Z" } }));
    expect(await medir("proposito")).toMatchObject({ l: 1, e: 0 });
  });
  it("409 y 403: 1 L / 0 E y 0 L / 0 E (nada se escribe)", async () => {
    const d = docCerrable("exploracion") as { phases: { exploracion: { dvs?: unknown } } };
    delete d.phases.exploracion.dvs;
    sembrar(d as unknown as Doc);
    expect(await medir("exploracion")).toMatchObject({ l: 1, e: 0 });
    sembrar(docCerrable("proposito", { rolAnalyst: true }));
    expect(await medir("proposito")).toMatchObject({ l: 0, e: 0 });
  });
});
