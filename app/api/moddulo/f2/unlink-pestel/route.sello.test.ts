// C1b-2 (H-V25) — UN SOLO instante por operación en unlink-pestel: `lastUnlinkedLinkedSource.desvinculadoEn` del vivo es un
// Timestamp REAL (no un FieldValue) y la versión nueva lleva su ISO EXACTO en `aprobacion.en`. El reloj de la prueba
// avanza 1 ms en cada `new Date()` sin argumentos: dos instantes distintos harían fallar la prueba. Sin emulador (Java 17).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase-admin/firestore")>()),
  FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" },
}));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { Timestamp } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { docProyectoT22, type OpcionesT22 } from "@/lib/moddulo/__tests__/fixtures/m1SiembraT22";
import { clonar, registrarVigenteF2, versionesDe } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const PEST = "pestel_projects/pest1";
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...o }) }) as never;
const t22 = (o: OpcionesT22 = {}) =>
  docProyectoT22({ draftDVS: { hei: { x: 1 } }, motorAprobaciones: { M2: true }, dvs: { final: 1 }, ...o });
function sembrar(doc: unknown, conBacklink = true) {
  db.reset({ [P]: clonar(doc), ...(conBacklink ? { [PEST]: { userId: "u1", modduloProjectId: "p1" } } : {}) });
  db.rechazarUndefined(true);
  db.atomico(true);
}
const huella = async () => ((await (await POST(req())).json()) as { huella: string }).huella;

const RealDate = Date;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  let tick = 0;
  class RelojQueAvanza extends RealDate {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(1_800_000_000_000 + tick++);
      else super(...(a as [number]));
    }
  }
  vi.stubGlobal("Date", RelojQueAvanza);
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  sembrar(t22());
});
afterEach(() => vi.unstubAllGlobals());

describe("desvincular — el instante del vivo y el de la versión son el MISMO", () => {
  it("`desvinculadoEn` vivo es un Timestamp (no un FieldValue) y su ISO es exactamente `aprobacion.en` de la versión nueva", async () => {
    const res = await POST(req({ confirmar: true, huella: await huella() }));
    expect(res.status).toBe(200);
    const ls = db.updates()[0].data["phases.exploracion.lastUnlinkedLinkedSource"] as { desvinculadoEn: unknown };
    expect(ls.desvinculadoEn).toBeInstanceOf(Timestamp);
    expect(ls.desvinculadoEn).not.toBe("TS");
    const nueva = versionesDe(db, P).at(-1)!;
    expect(nueva.motivo).toBe("desvinculacion");
    expect(nueva.aprobacion?.en).toBe((ls.desvinculadoEn as Timestamp).toDate().toISOString());
  });

  it("también cuando NO hay versión (T22 vacío): el vivo lleva su instante igualmente", async () => {
    sembrar(t22({ sinPayload: true, sinM1: true, draftDVS: null, motorAprobaciones: {}, dvs: null }));
    await POST(req({ confirmar: true, huella: await huella() }));
    const ls = db.updates()[0].data["phases.exploracion.lastUnlinkedLinkedSource"] as { desvinculadoEn: unknown };
    expect(ls.desvinculadoEn).toBeInstanceOf(Timestamp);
  });
});
