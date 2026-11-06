// T7 C2 — import-pestel: el gate de origen (H-P1). Confirma, no bloquea. Orden de rechazos: fase cerrada →
// candado H15 → gate de origen. La huella de «lo mostrado» la calcula y la compara el servidor.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
// Gancho para simular un cambio ENTRE la lectura previa y la transacción: transformToMapaPESTEL se llama justo en ese hueco.
const gancho = vi.hoisted(() => ({ fn: null as null | (() => void) }));
vi.mock("@/lib/centinela/pestel/transformToMapaPESTEL", async () => {
  const real = await vi.importActual<typeof import("@/lib/centinela/pestel/transformToMapaPESTEL")>("@/lib/centinela/pestel/transformToMapaPESTEL");
  return { ...real, transformToMapaPESTEL: (...a: Parameters<typeof real.transformToMapaPESTEL>) => { gancho.fn?.(); return real.transformToMapaPESTEL(...a); } };
});

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { huellaDeOrigen } from "@/lib/centinela/pestel/huellaOrigen";
import { exploracionGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const escribio = () => db.updates().some((u) => u.path === P);
const llamar = async (cuerpo: Record<string, unknown> = {}) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", pestAnalysisId: "a1", ...cuerpo }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const ANALISIS = { status: "APPROVED", projectId: "pest1", vigente: true, analyzedAt: "2026-10-01T10:00:00Z", globalConfidence: 80, biasAlerts: [] as unknown[], dimensions: [] };
const sembrar = (exploracion: Record<string, unknown> = {}, analisis: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => {
  vi.mocked(getProject).mockResolvedValue({ id: "p1", xpcto: { hito: "h" }, phases: { exploracion } } as never);
  db.reset({
    "pestel_analyses/a1": { ...ANALISIS, ...analisis },
    "pestel_projects/pest1": { userId: "u1" },
    [P]: { phases: { exploracion } },
    ...extra,
  });
  db.atomico(true);
};
const modificar = (ruta: string, cambios: Record<string, unknown>) => {
  const s = db.snapshot() as Record<string, Record<string, unknown>>;
  s[ruta] = { ...s[ruta], ...cambios };
  db.reset(s);
  db.atomico(true);
};
const expressCargado = () => {
  const x = exploracionGate("aprobado", { draftDVS: { x: 1 }, motorAprobaciones: { M3: true }, dvs: { f: 1 } });
  (x.linkedSource as { kind: string; sourceId: string }).sourceId = "p1";
  return x;
};
const mismoProyectoRenovado = () => {
  const x = exploracionGate("aprobado");
  x.linkedSource = { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a-vieja", payload: (x.linkedSource as { payload: object }).payload };
  return x;
};

beforeEach(() => {
  vi.clearAllMocks();
  gancho.fn = null;
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("import-pestel — gate de origen: qué pide confirmación", () => {
  it("aprobado, vigente, confianza ≥ 50: importa sin pedir nada", async () => {
    sembrar();
    expect((await llamar()).status).toBe(200);
    expect(escribio()).toBe(true);
  });

  it("confianza baja SOLA (aprobado): no pide confirmación, solo informa en pantalla", async () => {
    sembrar({}, { globalConfidence: 39 });
    expect((await llamar()).status).toBe(200);
  });

  it("PENDING_REVIEW: 409 origen_requiere_confirmacion con razones, huella y `lineas: []`; no escribe", async () => {
    sembrar({}, { status: "PENDING_REVIEW" });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("origen_requiere_confirmacion");
    expect(r.cuerpo.razones).toEqual([{ tipo: "no_aprobado", status: "PENDING_REVIEW" }]);
    expect(r.cuerpo.lineas).toEqual([]);
    expect(r.cuerpo.huella).toMatch(/^[0-9a-f]{64}$/);
    expect(escribio()).toBe(false);
  });

  it("REVIEWED también pide confirmación (no equivale a revisión humana)", async () => {
    sembrar({}, { status: "REVIEWED" });
    expect((await llamar()).cuerpo.razones).toEqual([{ tipo: "no_aprobado", status: "REVIEWED" }]);
  });

  it("sesgos sin revisar: la razón lleva la cantidad real", async () => {
    sembrar({}, { biasAlerts: [{ type: "a", description: "d" }, { type: "b", description: "d", acknowledgedAt: "2026-10-02T00:00:00Z" }, { type: "c", description: "d" }] });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.razones).toEqual([{ tipo: "sesgos_sin_revisar", cantidad: 2 }]);
  });

  it("análisis no vigente: la razón lleva la fecha del análisis y la del vigente real", async () => {
    sembrar({}, { vigente: false }, { "pestel_analyses/a2": { ...ANALISIS, vigente: true, analyzedAt: "2026-11-02T08:30:00Z" } });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.razones).toEqual([{ tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z", fechaVigente: "2026-11-02T08:30:00.000Z" }]);
  });

  it("no vigente y sin ningún vigente existente: la razón va sin la fecha del vigente (no se inventa)", async () => {
    sembrar({}, { vigente: false });
    expect((await llamar()).cuerpo.razones).toEqual([{ tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z" }]);
  });
});

describe("import-pestel — gate de origen: la confirmación", () => {
  it("confirmar con la huella que devolvió el servidor importa y escribe", async () => {
    sembrar({}, { status: "PENDING_REVIEW" });
    const { cuerpo } = await llamar();
    const r = await llamar({ confirmarOrigen: true, huellaOrigen: cuerpo.huella });
    expect(r.status).toBe(200);
    expect(escribio()).toBe(true);
  });

  it("huella equivocada o ausente: 409 origen_huella_vencida con lo nuevo, sin escribir", async () => {
    sembrar({}, { status: "PENDING_REVIEW" });
    for (const extra of [{ confirmarOrigen: true, huellaOrigen: "otra" }, { confirmarOrigen: true }]) {
      const r = await llamar(extra);
      expect(r.status).toBe(409);
      expect(r.cuerpo.error).toBe("origen_huella_vencida");
      expect(r.cuerpo.huella).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(escribio()).toBe(false);
  });

  it("la huella la calcula el servidor: con las mismas razones es la misma en cada llamada", async () => {
    sembrar({}, { status: "PENDING_REVIEW" });
    const a = (await llamar()).cuerpo.huella;
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect((await llamar()).cuerpo.huella).toBe(a);
  });
});

describe("import-pestel — gate de origen: orden de rechazos y evaluación dentro de la transacción", () => {
  it("la fase cerrada va PRIMERO: con un análisis que pediría confirmación sigue siendo fase_cerrada", async () => {
    sembrar({ status: "completed", dvs: { x: 1 } }, { status: "PENDING_REVIEW" });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("fase_cerrada");
    expect(escribio()).toBe(false);
  });

  it("el candado H15 va ANTES que el gate y su 409 trae también las razones de origen (UNA sola confirmación)", async () => {
    sembrar(mismoProyectoRenovado(), { status: "PENDING_REVIEW" });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(r.cuerpo.lineas.length).toBeGreaterThan(0);
    expect(r.cuerpo.razonesOrigen).toEqual([{ tipo: "no_aprobado", status: "PENDING_REVIEW" }]);
    expect(typeof r.cuerpo.huellaOrigen).toBe("string");
    expect(escribio()).toBe(false);
  });

  it("otra fuente (`conflict`) con un análisis sin aprobar: el mismo 409 trae las razones de origen", async () => {
    sembrar(expressCargado(), { status: "PENDING_REVIEW" });
    const r = await llamar();
    expect(r.cuerpo.error).toBe("conflict");
    expect(r.cuerpo.razonesOrigen).toEqual([{ tipo: "no_aprobado", status: "PENDING_REVIEW" }]);
  });

  it("confirmar SOLO el candado H15 no basta: responde el gate de origen (sin segundo reemplazo silencioso)", async () => {
    sembrar(mismoProyectoRenovado(), { status: "PENDING_REVIEW" });
    const primero = await llamar();
    const r = await llamar({ confirmar: true, huella: primero.cuerpo.huella });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("origen_requiere_confirmacion");
    expect(escribio()).toBe(false);
  });

  it("confirmar las dos cosas en una sola petición importa", async () => {
    sembrar(mismoProyectoRenovado(), { status: "PENDING_REVIEW" });
    const primero = await llamar();
    const r = await llamar({ confirmar: true, huella: primero.cuerpo.huella, confirmarOrigen: true, huellaOrigen: primero.cuerpo.huellaOrigen });
    expect(r.status).toBe(200);
    expect(escribio()).toBe(true);
  });

  it("[dentro de la transacción] la lectura previa ve el análisis aprobado pero al escribir ya no lo está: 409 y cero escrituras", async () => {
    sembrar();
    gancho.fn = () => modificar("pestel_analyses/a1", { status: "PENDING_REVIEW" });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("origen_requiere_confirmacion");
    expect(escribio()).toBe(false);
  });

  it("[dentro de la transacción] el usuario confirmó lo que vio, pero apareció un vigente más nuevo: huella_vencida con lo nuevo", async () => {
    sembrar({}, { vigente: false });
    const { cuerpo } = await llamar();
    gancho.fn = () => {
      const s = db.snapshot() as Record<string, unknown>;
      db.reset({ ...s, "pestel_analyses/a2": { ...ANALISIS, vigente: true, analyzedAt: "2026-11-09T00:00:00Z" } });
      db.atomico(true);
    };
    const r = await llamar({ confirmarOrigen: true, huellaOrigen: cuerpo.huella });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("origen_huella_vencida");
    expect(r.cuerpo.razones[0].fechaVigente).toBe("2026-11-09T00:00:00.000Z");
    expect(escribio()).toBe(false);
  });

  it("[dentro de la transacción] el análisis desaparece entre la lectura previa y la escritura: 404 sin escribir", async () => {
    sembrar();
    gancho.fn = () => {
      const s = db.snapshot() as Record<string, unknown>;
      delete s["pestel_analyses/a1"];
      db.reset(s);
      db.atomico(true);
    };
    const r = await llamar();
    expect(r.status).toBe(404);
    expect(escribio()).toBe(false);
  });

  it("el mismo análisis cambiado de contenido conserva su motivo «analisis_cambio» también en el 409 de origen", async () => {
    const exp = mismoProyectoRenovado();
    (exp.linkedSource as Record<string, unknown>).sourceAnalysisId = "a1";
    (exp.linkedSource as Record<string, unknown>).huellaFuente = { v: 1, h: "vieja" };
    sembrar(exp, { status: "PENDING_REVIEW" });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.motivo).toBe("analisis_cambio");
  });

  it("el mismo análisis SIN cambios sigue siendo idempotente (200, sin escrituras) aunque no esté aprobado: no hay nada que importar", async () => {
    const exp = mismoProyectoRenovado();
    (exp.linkedSource as Record<string, unknown>).sourceAnalysisId = "a1";
    (exp.linkedSource as Record<string, unknown>).huellaFuente = huellaDeOrigen([] as never, undefined);
    sembrar(exp, { status: "PENDING_REVIEW" });
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.idempotente).toBe(true);
    expect(db.updates()).toEqual([]);
  });
});
