// C1b-3b (H-V25, condición f) — UN SOLO instante por operación: `completedAt` del vivo (texto ISO), `contenido.completedAt` y
// `aprobacion.en` de la versión salen del MISMO `new Date()`. El reloj de la prueba avanza 1 ms en cada `new Date()` sin
// argumentos: tomar un segundo instante en cualquiera de las rutas hace fallar la prueba. Sin emulador (Java 17).

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

const RealDate = Date;
beforeEach(() => {
  let tick = 0;
  class RelojQueAvanza extends RealDate {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(1_800_000_000_000 + tick++);
      else super(...(a as [number]));
    }
  }
  vi.stubGlobal("Date", RelojQueAvanza);
});
afterEach(() => vi.unstubAllGlobals());

describe("cierre — el instante del vivo y el de la versión son el MISMO", () => {
  it("F1: `phases.proposito.completedAt` === `aprobacion.en` === `contenido.completedAt`", async () => {
    sembrar(docCerrable("proposito"));
    await cerrar("proposito", REPORTE);
    const nueva = versionesDe(db, P).at(-1)!;
    const vivo = proyecto().phases.proposito.completedAt as string;
    expect(nueva.aprobacion?.en).toBe(vivo);
    expect((nueva.contenido as Doc).completedAt).toBe(vivo);
    expect(vivo).toMatch(/^2027-01-15T/); // el reloj de la prueba (no el real)
  });
  it("F2: además `data.aprobadoEn` es ese mismo instante", async () => {
    sembrar(docCerrable("exploracion"));
    await cerrar("exploracion", REPORTE);
    const nueva = versionesDe(db, P).at(-1)!;
    const exp = proyecto().phases.exploracion as { completedAt: string; data: { aprobadoEn: string } };
    expect(exp.data.aprobadoEn).toBe(exp.completedAt);
    expect(nueva.aprobacion?.en).toBe(exp.completedAt);
    expect((nueva.contenido as Doc).aprobadoEn).toBe(exp.completedAt);
  });
});
