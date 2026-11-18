// C1b-1 (H-V25, decisión 2) — UN SOLO instante por operación en m1-reopen: `reabiertoEn` del vivo es un Timestamp REAL
// (no un FieldValue) y la versión de reapertura lleva su ISO EXACTO en `aprobacion.en`. El reloj de la prueba avanza
// 1 ms en cada `new Date()` sin argumentos: dos instantes distintos harían fallar la prueba. Sin emulador (Java 17).

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
import { aprobacionDe, docProyectoM1, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";
import { versionesDe } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const RealDate = Date;
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...o }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
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
  db.reset({ [P]: structuredClone(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1()) } })) });
  db.rechazarUndefined(true);
  db.atomico(true);
});
afterEach(() => vi.unstubAllGlobals());

describe("reabrir — el instante del vivo y el de la versión son el MISMO", () => {
  it("`reabiertoEn` vivo es un Timestamp (no un FieldValue) y su ISO es exactamente `aprobacion.en` de la versión de reapertura", async () => {
    const huella = ((await (await POST(req())).json()) as { huella: string }).huella;
    const res = await POST(req({ confirmar: true, huella }));
    expect(res.status).toBe(200);
    const vivo = db.updates()[0].data["phases.exploracion.m1.reabiertoEn"];
    expect(vivo).toBeInstanceOf(Timestamp);
    expect(vivo).not.toBe("TS");
    const reapertura = versionesDe(db, P).at(-1)!;
    expect(reapertura.tipoCambio).toBe("reapertura");
    expect(reapertura.aprobacion?.en).toBe((vivo as Timestamp).toDate().toISOString());
  });
});
