// Paso 4 — unlink-pestel: confirmación SIEMPRE (huella de lo que el usuario vio), 409 fase_cerrada con la Fase 2
// cerrada, y al desvincular se descartan el borrador de motores, sus aprobaciones y el registro del M1 (el Reporte
// F2 finalizado NO se toca).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { huellaGate, otroMapaGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const post = async (cuerpo: Record<string, unknown>) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "m1", ...cuerpo }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const T22 = (payload: object = { P: { code: "P" } }) => ({ kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload });
const aprobacion = (mapa: object) => ({ huella: huellaGate(mapa), por: "u", en: "t", categoriasEditadas: 0, total: 1, mapa });
const cargado = (extra: Record<string, unknown> = {}) => {
  const mapa = { P: { code: "P" } };
  return { linkedSource: T22(mapa), m1: { creadoEn: "t", aprobacion: aprobacion(mapa) }, draftDVS: { x: 1 }, motorAprobaciones: { M2: true }, dvs: { final: 1 }, ...extra };
};
const sembrar = (exploracion: Record<string, unknown>) => {
  db.reset({ "moddulo_projects/m1": { name: "M", phases: { exploracion } }, "pestel_projects/pest1": { userId: "u1", modduloProjectId: "m1" } });
  db.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("unlink-pestel — confirmación siempre", () => {
  it("sin confirmar: 409 reemplazo_requiere_confirmacion con las líneas reales y la huella; NO escribe", async () => {
    sembrar(cargado());
    const r = await post({});
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(typeof r.cuerpo.huella).toBe("string");
    expect(r.cuerpo.lineas.join(" ")).toContain("Se perderá la aprobación del análisis");
    expect(r.cuerpo.lineas.join(" ")).toContain("El Reporte F2 finalizado no cambia");
    expect(db.updates()).toEqual([]);
  });

  it("incluso con un proyecto «limpio» (vínculo sin nada más) pide confirmación — líneas vacías, pero exige huella", async () => {
    sembrar({ linkedSource: T22() });
    const r = await post({});
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(db.updates()).toEqual([]);
    const ok = await post({ confirmar: true, huella: r.cuerpo.huella });
    expect(ok.status).toBe(200);
  });

  it("confirmar sin huella o con huella de otro estado: sigue pidiendo / huella_vencida; nada escrito", async () => {
    sembrar(cargado());
    expect((await post({ confirmar: true })).cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    const v = await post({ confirmar: true, huella: "vieja" });
    expect(v.status).toBe(409);
    expect(v.cuerpo.error).toBe("reemplazo_huella_vencida");
    expect(db.updates()).toEqual([]);
  });

  it("confirmado: borra vínculo, borrador de motores, aprobaciones y el registro del M1; NO toca el Reporte F2; limpia el back-link de PESTEL", async () => {
    sembrar(cargado());
    const { cuerpo } = await post({});
    const r = await post({ confirmar: true, huella: cuerpo.huella });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true } });
    const d = db.updates().find((u) => u.path === "moddulo_projects/m1")!.data;
    expect(d["phases.exploracion.linkedSource"]).toBe("__DELETE__");
    expect(d["phases.exploracion.draftDVS"]).toBe("__DELETE__");
    expect(d["phases.exploracion.m1"]).toBe("__DELETE__");
    expect(d["phases.exploracion.motorAprobaciones"]).toEqual({});
    expect(d).not.toHaveProperty("phases.exploracion.dvs");
    expect(db.updates().find((u) => u.path === "pestel_projects/pest1")!.data.modduloProjectId).toBe("__DELETE__");
  });

  it("[carrera] el contenido cambió entre la sonda y la confirmación (otra pestaña editó y aprobó otra versión): huella_vencida, cero escrituras", async () => {
    sembrar(cargado());
    const { cuerpo } = await post({});
    sembrar(cargado({ linkedSource: T22(otroMapaGate), m1: { creadoEn: "t", aprobacion: aprobacion(otroMapaGate) } }));
    const r = await post({ confirmar: true, huella: cuerpo.huella });
    expect(r.cuerpo.error).toBe("reemplazo_huella_vencida");
    expect(db.updates()).toEqual([]);
  });
});

describe("unlink-pestel — Fase 2 cerrada", () => {
  it("409 fase_cerrada (mismo cuerpo que las demás rutas), antes de pedir confirmación, sin escrituras", async () => {
    sembrar(cargado({ status: "completed" }));
    expect(await post({})).toEqual({ status: 409, cuerpo: { error: "fase_cerrada" } });
    expect(await post({ confirmar: true, huella: "x" })).toEqual({ status: 409, cuerpo: { error: "fase_cerrada" } });
    expect(db.updates()).toEqual([]);
  });
  it("[carrera] se cierra entre la lectura previa y la transacción: 409 fase_cerrada, cero escrituras", async () => {
    sembrar(cargado());
    const previa = structuredClone(db.snapshot()["moddulo_projects/m1"]);
    db.reset({ "moddulo_projects/m1": { name: "M", phases: { exploracion: cargado({ status: "completed" }) } }, "pestel_projects/pest1": { userId: "u1", modduloProjectId: "m1" } });
    db.atomico(true);
    vi.mocked(getProject).mockResolvedValue(previa as never);
    expect((await post({})).cuerpo.error).toBe("fase_cerrada");
    expect(db.updates()).toEqual([]);
  });
});

describe("unlink-pestel — lo que no cambia", () => {
  it("sin vínculo T22: 400 not_linked (antes de pedir confirmación)", async () => {
    sembrar({});
    expect((await post({})).status).toBe(400);
  });
});
