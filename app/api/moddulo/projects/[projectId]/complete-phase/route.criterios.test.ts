// Paso 7, commit 2: al cerrar una fase, el RDA de F2 se calcula sobre la copia aprobada del análisis (si la
// aprobación es válida) y no sobre el payload de trabajo.
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
import { planRDAUpdate } from "@/lib/moddulo/rda";
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";
import { POST } from "./route";

type Db = { reset(d?: Record<string, unknown>): void };
const db = adminDb as unknown as Db;
const dim = (n: string) => ({ code: "P", label: "P", clasificacion: "NEUTRAL", narrativa: n, senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] });
const PAYLOAD = { P: dim("del payload") };
const COPIA = { P: dim("de la copia aprobada") };
const HUELLA = huellaMapaPESTEL(PAYLOAD as never);
const exploracion = (m1: Record<string, unknown> | undefined) => ({
  dvs: { x: 1 }, linkedSource: { kind: "express", payload: PAYLOAD }, ...(m1 ? { m1 } : {}),
});
const valida = { aprobacion: { huella: HUELLA, por: "u1", en: "t", categoriasEditadas: 0, total: 1, mapa: COPIA }, generacion: { huella: HUELLA, en: "t" }, finalizacion: { huella: HUELLA, en: "t" } };
async function cerrarCon(exp: Record<string, unknown>) {
  vi.mocked(getProject).mockResolvedValue({ id: "p1", status: "active", collaborators: [{ uid: "u1", role: "owner" }], phases: { exploracion: exp } } as never);
  db.reset({ "moddulo_projects/p1": { phases: { exploracion: exp } } });
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId: "exploracion" }) }) as never, { params: Promise.resolve({ projectId: "p1" }) });
  return r.status;
}
const mapaVisto = () => (vi.mocked(planRDAUpdate).mock.calls[0][0] as { phases: { exploracion: { linkedSource: { payload: unknown } } } }).phases.exploracion.linkedSource.payload;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("complete-phase — mapa que lee el RDA de F2", () => {
  it("aprobación válida: el RDA ve la COPIA aprobada, no el payload", async () => {
    expect(await cerrarCon(exploracion(valida))).toBe(200);
    expect(mapaVisto()).toBe(COPIA);
  });
  it("proyecto anterior (sin registro m1): el RDA ve el payload, como siempre", async () => {
    expect(await cerrarCon(exploracion(undefined))).toBe(200);
    expect(mapaVisto()).toBe(PAYLOAD);
  });
  it("aprobación vencida (ya no coincide con el payload): no cierra y el RDA ni se calcula", async () => {
    expect(await cerrarCon(exploracion({ aprobacion: { ...valida.aprobacion, huella: "vieja" } }))).toBe(409);
    expect(vi.mocked(planRDAUpdate)).not.toHaveBeenCalled();
  });
});
