// C1b-1 (H-V25, decisión 2) — UN SOLO instante por operación: el documento vivo lleva un Timestamp REAL
// (`Timestamp.fromDate(instante)`, no un FieldValue) y la versión `instante.toISOString()` del MISMO momento.
// El reloj de la prueba AVANZA 1 ms en cada `new Date()` sin argumentos: si la ruta tomara dos instantes (uno para el
// vivo y otro para la versión) las dos marcas diferirían y la prueba fallaría (mutación: version.en ≠ live.en).
// Sin emulador de Firestore (Java 17).

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
import { docProyectoM1, huellaDe, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";
import { versionesDe } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const RealDate = Date;

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
  db.reset({ [P]: structuredClone(docProyectoM1()) });
  db.rechazarUndefined(true);
  db.atomico(true);
});
afterEach(() => vi.unstubAllGlobals());

describe("aprobar — el instante del vivo y el de la versión son el MISMO", () => {
  it("el valor vivo es un Timestamp (no un FieldValue) y su ISO es exactamente `aprobacion.en` de la versión", async () => {
    const res = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", huellaVista: huellaDe(mapaM1()) }) }) as never);
    expect(res.status).toBe(200);
    const vivo = db.updates()[0].data["phases.exploracion.m1.aprobacion"] as { en: unknown };
    expect(vivo.en).toBeInstanceOf(Timestamp);
    expect(vivo.en).not.toBe("TS"); // no es el stub de serverTimestamp()
    const iso = (vivo.en as Timestamp).toDate().toISOString();
    const nueva = versionesDe(db, P).at(-1)!;
    expect(nueva.aprobacion?.en).toBe(iso);
  });
});
