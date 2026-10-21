// Commit 2 (estados de trabajo): complete-phase exige que el Reporte F2 salga de la aprobación vigente (sello de
// finalización, o la regla de compatibilidad sin sello); una fase YA cerrada no recibe 409 nuevos.
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
const HUELLA = huellaMapaPESTEL(MAPA as never);
const OTRA = "huella-de-una-version-anterior";
const aprobacion = { huella: HUELLA, por: "u1", en: "t", categoriasEditadas: 0, total: 1, mapa: MAPA };
const proyecto = (exploracion: Record<string, unknown>) => ({ id: "p1", status: "active", collaborators: [{ uid: "u1", role: "owner" }], phases: { exploracion } });
const base = { dvs: { x: 1 }, linkedSource: { kind: "express", payload: MAPA } };
const cerrar = async () => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ phaseId: "exploracion" }) }) as never, { params: Promise.resolve({ projectId: "p1" }) });
  return { status: r.status, cuerpo: await r.json() };
};
function sembrar(exploracion: Record<string, unknown>) {
  vi.mocked(getProject).mockResolvedValue(proyecto(exploracion) as never);
  db.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("complete-phase — sello de finalización", () => {
  it("sello distinto de la aprobación + borrador pendiente → 409 reporte_f2_de_otro_analisis y NO escribe", async () => {
    sembrar({ ...base, draftDVS: { x: 2 }, m1: { aprobacion, generacion: { huella: HUELLA, en: "t" }, finalizacion: { huella: OTRA, en: "t" } } });
    const r = await cerrar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reporte_f2_de_otro_analisis");
    expect(db.updates()).toEqual([]);
  });
  it("sello distinto aunque NO haya borrador (el sello manda sobre la compatibilidad) → 409", async () => {
    sembrar({ ...base, m1: { aprobacion, generacion: { huella: HUELLA, en: "t" }, finalizacion: { huella: OTRA, en: "t" } } });
    expect((await cerrar()).status).toBe(409);
  });
  it("sello igual a la aprobación → cierra, aunque quede un borrador guardado", async () => {
    sembrar({ ...base, draftDVS: { x: 2 }, m1: { aprobacion, generacion: { huella: HUELLA, en: "t" }, finalizacion: { huella: HUELLA, en: "t" } } });
    expect((await cerrar()).status).toBe(200);
  });
  it("COMPATIBILIDAD: sin sello y sin borrador pendiente → se asume vigente y cierra", async () => {
    sembrar({ ...base, m1: { aprobacion, generacion: { huella: HUELLA, en: "t" } } });
    expect((await cerrar()).status).toBe(200);
  });
  it("COMPATIBILIDAD (el caso del hueco): sin sello y CON borrador pendiente → 409 y NO escribe", async () => {
    sembrar({ ...base, draftDVS: { x: 2 }, m1: { aprobacion, generacion: { huella: HUELLA, en: "t" } } });
    const r = await cerrar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reporte_f2_de_otro_analisis");
    expect(db.updates()).toEqual([]);
  });
  it("sin registro m1 (proyecto anterior) con borrador pendiente: sigue cerrando como siempre", async () => {
    sembrar({ ...base, draftDVS: { x: 2 } });
    expect((await cerrar()).status).toBe(200);
  });
  it("fase YA CERRADA: ni 409 nuevos ni cambios — responde yaCerrada aunque el sello no coincida", async () => {
    const exploracion = { ...base, status: "completed", completedAt: "t0", data: { aprobadoEn: "t0" }, draftDVS: { x: 2 }, m1: { aprobacion, generacion: { huella: HUELLA, en: "t" }, finalizacion: { huella: OTRA, en: "t" } } };
    sembrar(exploracion);
    const r = await cerrar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.yaCerrada).toBe(true);
    expect(db.updates()).toEqual([]);
  });
});
