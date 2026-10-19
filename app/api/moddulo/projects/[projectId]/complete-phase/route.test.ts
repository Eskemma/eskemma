// complete-phase: caracterización del cierre de fase (verde contra el código anterior) y el guard nuevo de
// «Cerrar Fase 2» cuando existe un Reporte F2 finalizado pero el M1 nuevo no está aprobado (409 m1_no_aprobado).

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
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";
import { POST } from "./route";

type Db = { reset(d?: Record<string, unknown>): void; updates(): Array<{ path: string; data: Record<string, unknown> }> };
const db = adminDb as unknown as Db;
const MAPA = { P: { code: "P", label: "P", clasificacion: "NEUTRAL", narrativa: "n", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] } };
const proyecto = (exploracion: Record<string, unknown>) => ({
  id: "p1", status: "active", collaborators: [{ uid: "u1", role: "owner" }], phases: { exploracion },
});
const cerrar = async (phaseId = "exploracion") => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId }) }) as never, { params: Promise.resolve({ projectId: "p1" }) });
  return { status: r.status, cuerpo: await r.json() };
};
const escrituras = () => db.updates().filter((u) => u.path === "moddulo_projects/p1");

beforeEach(() => {
  vi.clearAllMocks();
  db.reset({});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("complete-phase — caracterización", () => {
  it("cierra la fase: marca completed, avanza currentPhase y responde nextPhase", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: { x: 1 } }) as never);
    const r = await cerrar();
    expect(r.status).toBe(200);
    expect(r.cuerpo).toEqual({ success: true, nextPhase: "investigacion" });
    expect(escrituras()[0].data["phases.exploracion.status"]).toBe("completed");
  });
  it("un proyecto «anterior» (payload y Reporte F2, sin m1) sigue pudiendo cerrar la Fase 2", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: { x: 1 }, linkedSource: { kind: "express", payload: MAPA } }) as never);
    expect((await cerrar()).status).toBe(200);
  });
  it("una fase distinta de exploración no mira el M1", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: { x: 1 }, m1: {}, linkedSource: { kind: "express", payload: MAPA } }) as never);
    expect((await cerrar("proposito")).status).toBe(200);
  });
});

describe("complete-phase — M1 nuevo sin aprobar con Reporte F2 anterior", () => {
  it("borrador + dvs → 409 m1_no_aprobado y NO escribe", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: { x: 1 }, m1: { creadoEn: "t" }, linkedSource: { kind: "express", payload: MAPA } }) as never);
    const r = await cerrar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("m1_no_aprobado");
    expect(escrituras()).toHaveLength(0);
  });
  it("reabierto + dvs → 409", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: { x: 1 }, m1: { reabiertoEn: "t" }, linkedSource: { kind: "express", payload: MAPA } }) as never);
    expect((await cerrar()).status).toBe(409);
  });
  it("aprobado (con la aprobación válida) + dvs de ESE M1 (paso 4: generacion.huella coincide) → cierra", async () => {
    const huella = huellaMapaPESTEL(MAPA as never);
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: { x: 1 }, m1: { aprobacion: { huella, por: "u1", en: "t", categoriasEditadas: 0, total: 1, mapa: MAPA }, generacion: { huella, en: "t" } }, linkedSource: { kind: "express", payload: MAPA } }) as never);
    expect((await cerrar()).status).toBe(200);
  });
  it("borrador SIN dvs → (paso 4) 409 m1_no_aprobado: ya no cierra con un M1 sin aprobar, haya o no Reporte F2", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ m1: { creadoEn: "t" }, linkedSource: { kind: "express", payload: MAPA } }) as never);
    const r = await cerrar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("m1_no_aprobado");
    expect(escrituras()).toHaveLength(0);
  });
});
