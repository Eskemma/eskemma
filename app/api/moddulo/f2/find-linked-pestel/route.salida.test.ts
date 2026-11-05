// find-linked-pestel T5b: opt-in `salida=1` (modo 1). 2 lecturas (consulta + 1 documento), 0 escrituras, sin getProject.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" }, Timestamp: {} }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/centinela/pestel/verificarOrigen", () => ({ verificarOrigen: vi.fn(async () => ({ estado: "no_verificable" })) }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { GET } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const MARCA = "CONTENIDO-SECRETO-DEL-MAPA";
const mapa = { P: { code: "P", classification: "NEUTRAL", narrative: MARCA, senalesFavorables: [], senalesAdversas: [], senalesInciertas: [] } };
const llamar = async (qs: string) => {
  const r = await GET(new Request(`http://local/api/moddulo/f2/find-linked-pestel?${qs}`) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const expressConMotores = {
  collaborators: [{ uid: "u1" }],
  phases: { exploracion: { linkedSource: { kind: "express", componente: "moddulo", sourceId: "m1", payload: mapa }, motorAprobaciones: { M2: true } } },
};
let getAll: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  getAll = vi.fn(async (ref: { get: () => Promise<unknown> }) => [await ref.get()]);
  (db as unknown as { getAll: unknown }).getAll = getAll;
});

describe("find-linked-pestel modo 1 con salida=1", () => {
  it("pendiente sobre un Express con motores: devuelve el pendiente y `salida` con líneas", async () => {
    db.reset({ "moddulo_projects/m1": expressConMotores, "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1", currentStage: 4 } });
    const r = await llamar("moddulo_project_id=m1&salida=1");
    expect(r.cuerpo.found).toBe(true);
    expect(r.cuerpo.sourceId).toBe("p1");
    expect(r.cuerpo.salida.estado).toBe("con_lineas");
    expect(r.cuerpo.salida.lineas.length).toBeGreaterThan(0);
  });
  it("sin PESTEL (found:false) también trae `salida`", async () => {
    db.reset({ "moddulo_projects/m1": expressConMotores });
    const r = await llamar("moddulo_project_id=m1&salida=1");
    expect(r.cuerpo.found).toBe(false);
    expect(r.cuerpo.salida.estado).toBe("con_lineas");
  });
  it("proyecto limpio → sin_lineas", async () => {
    db.reset({ "moddulo_projects/m1": { collaborators: [{ uid: "u1" }], phases: { exploracion: {} } }, "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" } });
    expect((await llamar("moddulo_project_id=m1&salida=1")).cuerpo.salida).toEqual({ estado: "sin_lineas" });
  });
  it("[privacidad] la respuesta no lleva el contenido del mapa, la copia aprobada, el reporte ni el payload; `salida` solo tiene estado y lineas", async () => {
    db.reset({
      "moddulo_projects/m1": { collaborators: [{ uid: "u1" }], phases: { exploracion: { ...expressConMotores.phases.exploracion, dvs: { pip: [{ pregunta: MARCA }] }, m1: { aprobacion: { huella: "h", mapa } } } } },
      "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" },
    });
    const r = await llamar("moddulo_project_id=m1&salida=1");
    expect(Object.keys(r.cuerpo.salida).sort()).toEqual(["estado", "lineas"]);
    expect(JSON.stringify(r.cuerpo)).not.toContain(MARCA);
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/payload|senales|narrative/i);
  });
  it("quien no es colaborador, Moddulo en papelera o inexistente → no_verificable (nunca revela el estado)", async () => {
    db.reset({ "moddulo_projects/m1": { ...expressConMotores, collaborators: [{ uid: "otro" }] } });
    expect((await llamar("moddulo_project_id=m1&salida=1")).cuerpo.salida).toEqual({ estado: "no_verificable" });
    db.reset({ "moddulo_projects/m1": { ...expressConMotores, deletedAt: "x" } });
    expect((await llamar("moddulo_project_id=m1&salida=1")).cuerpo.salida).toEqual({ estado: "no_verificable" });
    db.reset({});
    expect((await llamar("moddulo_project_id=m1&salida=1")).cuerpo.salida).toEqual({ estado: "no_verificable" });
  });
  it("si falla la lectura del Moddulo → no_verificable (la respuesta no se rompe)", async () => {
    db.reset({ "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1", currentStage: 4 } });
    getAll.mockRejectedValueOnce(new Error("boom"));
    const r = await llamar("moddulo_project_id=m1&salida=1");
    expect(r.cuerpo).toMatchObject({ found: true, sourceId: "p1", salida: { estado: "no_verificable" } });
  });
  it("peso: UN solo getAll del Moddulo (2 lecturas con la consulta), 0 escrituras, sin transacción ni getProject", async () => {
    db.reset({ "moddulo_projects/m1": expressConMotores, "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" } });
    await llamar("moddulo_project_id=m1&salida=1");
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(db.updates()).toEqual([]);
    expect(db.runTransaction).not.toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
  });
  it("la máscara del getAll se amplía SOLO con salida=1", async () => {
    db.reset({ "moddulo_projects/m1": expressConMotores, "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" } });
    await llamar("moddulo_project_id=m1");
    const sin = (getAll.mock.calls[0][1] as { fieldMask: string[] }).fieldMask;
    getAll.mockClear();
    await llamar("moddulo_project_id=m1&salida=1");
    const con = (getAll.mock.calls[0][1] as { fieldMask: string[] }).fieldMask;
    expect(sin).not.toContain("phases.exploracion.m1");
    expect(con).toEqual(expect.arrayContaining([...sin, "phases.exploracion.status", "phases.exploracion.linkedSource.payload", "phases.exploracion.m1", "phases.exploracion.dvs", "phases.exploracion.draftDVS", "phases.exploracion.motorAprobaciones"]));
  });
  it("[no regresión] sin salida=1 la respuesta no lleva `salida` (found true y false)", async () => {
    db.reset({ "moddulo_projects/m1": expressConMotores, "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1", currentStage: 4 } });
    expect(await llamar("moddulo_project_id=m1")).toEqual({ status: 200, cuerpo: { found: true, sourceId: "p1", currentStage: 4 } });
    db.reset({ "moddulo_projects/m1": expressConMotores });
    expect((await llamar("moddulo_project_id=m1")).cuerpo).toEqual({ found: false });
  });
});
