// C1b-3b — ORDEN de lecturas y escrituras dentro de la transacción de `complete-phase`. Firestore exige que TODAS las
// lecturas (el proyecto y el manifiesto del historial) vayan antes de la primera escritura. Se envuelve `runTransaction`
// del mock para registrar cada `tx.get`, `tx.update` y `tx.create` en orden. El mock bufferiza las escrituras, así que
// esta prueba vigila la REGLA de orden que el Firestore real sí hace cumplir con un error. Sin emulador (Java 17).

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

type Op = { op: "get" | "update" | "create" | "set"; path: string };
let ops: Op[] = [];
const original = (db.runTransaction as unknown as { getMockImplementation: () => ((fn: unknown) => Promise<unknown>) | undefined }).getMockImplementation()!;
beforeEach(() => {
  ops = [];
  (db.runTransaction as unknown as { mockImplementation: (f: unknown) => void }).mockImplementation((fn: (tx: Record<string, (...a: any[]) => unknown>) => Promise<unknown>) =>
    original(async (tx: Record<string, (...a: any[]) => unknown>) =>
      fn({
        get: (ref: { path: string }) => { ops.push({ op: "get", path: ref.path }); return tx.get(ref); },
        update: (ref: { path: string }, d: unknown) => { ops.push({ op: "update", path: ref.path }); return tx.update(ref, d); },
        create: (ref: { path: string }, d: unknown) => { ops.push({ op: "create", path: ref.path }); return tx.create(ref, d); },
        set: (ref: { path: string }, d: unknown) => { ops.push({ op: "set", path: ref.path }); return tx.set(ref, d); },
      })
    )
  );
});
afterEach(() => (db.runTransaction as unknown as { mockImplementation: (f: unknown) => void }).mockImplementation(original));

const primeraEscritura = () => ops.findIndex((o) => o.op !== "get");
const ultimaLectura = () => ops.map((o) => o.op).lastIndexOf("get");

describe("cierre — TODAS las lecturas van antes de la primera escritura", () => {
  it("sin historial: lee el proyecto y después escribe (versiones, revisión, evento y proyecto)", async () => {
    sembrar(docCerrable("proposito"));
    await cerrar("proposito", REPORTE);
    expect(ops[0]).toEqual({ op: "get", path: P });
    expect(primeraEscritura()).toBeGreaterThan(ultimaLectura());
    expect(ops.filter((o) => o.op === "create").length).toBe(4);
    expect(ops.at(-1)).toEqual({ op: "update", path: P });
  });
  it("con puntero: lee el proyecto Y el manifiesto antes de la primera escritura; `prepararVersion` antes del `update` del proyecto", async () => {
    sembrar(docCerrable("exploracion"));
    await registrarVigenteF2(db, P, { aprobado: true, por: "uidA", en: "2026-11-10T15:00:00.123Z", huella: "h", categoriasEditadas: 0, total: 6 });
    ops = [];
    await cerrar("exploracion", REPORTE);
    const lecturas = ops.filter((o) => o.op === "get");
    expect(lecturas.map((o) => o.path)).toEqual([P, `${P}/revisiones/exploracion_000001`]);
    expect(primeraEscritura()).toBeGreaterThan(ultimaLectura());
    const iUpdate = ops.findIndex((o) => o.op === "update");
    expect(ops.slice(0, iUpdate).filter((o) => o.op === "create").length).toBe(4);
  });
  it("un fallo del historial (colisión, que Firestore detecta al confirmar): ninguna escritura llegó a aplicarse", async () => {
    sembrar(docCerrable("proposito"));
    db.seed(`${P}/revisiones/proposito_000001`, { n: 1, fase: "proposito" });
    expect((await cerrar("proposito")).status).toBe(409);
    expect(db.updates()).toHaveLength(0);
  });
  it("las compuertas (409 de F2) no escriben nada: solo la lectura del proyecto", async () => {
    const d = docCerrable("exploracion") as { phases: { exploracion: { dvs?: unknown } } };
    delete d.phases.exploracion.dvs;
    sembrar(d as unknown as Doc);
    expect((await cerrar("exploracion")).status).toBe(409);
    expect(ops).toEqual([{ op: "get", path: P }]);
  });
});
