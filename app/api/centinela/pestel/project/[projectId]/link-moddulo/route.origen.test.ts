// T7 C2 — link-moddulo: el gate de origen (H-P1) del selector de Centinela. Confirma, no bloquea; la huella de lo
// mostrado la calcula y compara el servidor; mismo orden de rechazos que import-pestel (fase cerrada → H15 → origen).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
// Gancho para simular un cambio ENTRE la lectura previa y la transacción: huellaDeOrigen se llama justo en ese hueco.
const gancho = vi.hoisted(() => ({ fn: null as null | (() => void) }));
vi.mock("@/lib/centinela/pestel/huellaOrigen", async () => {
  const real = await vi.importActual<typeof import("@/lib/centinela/pestel/huellaOrigen")>("@/lib/centinela/pestel/huellaOrigen");
  return { ...real, huellaDeOrigen: (...a: Parameters<typeof real.huellaDeOrigen>) => { gancho.fn?.(); return real.huellaDeOrigen(...a); } };
});

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { exploracionGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const NAC = { nivel: "nacional", nombre: "México" };
const ANALISIS = { status: "APPROVED", projectId: "pest1", vigente: true, analyzedAt: "2026-10-01T10:00:00Z", globalConfidence: 80, biasAlerts: [] as unknown[], dimensions: [] };
const llamar = async (cuerpo: Record<string, unknown> = {}) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: "m1", ...cuerpo }) }) as never, ctx);
  return { status: r.status, cuerpo: await r.json() };
};
const sembrar = (analisis: Record<string, unknown> | null = {}, exploracion: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => {
  mockDb.reset(structuredClone({
    "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: NAC },
    "moddulo_projects/m1": { name: "M", type: "electoral", territorio: NAC, xpcto: { hito: "h" }, phases: { exploracion } },
    ...(analisis ? { "pestel_analyses/a1": { ...ANALISIS, ...analisis } } : {}),
    ...extra,
  }));
  mockDb.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
};
const escribio = () => mockDb.updates().length > 0;

beforeEach(() => {
  vi.clearAllMocks();
  gancho.fn = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("link-moddulo — gate de origen", () => {
  it("aprobado y vigente: vincula sin pedir nada (201)", async () => {
    sembrar();
    expect((await llamar()).status).toBe(201);
  });

  it("confianza baja SOLA: no pide confirmación", async () => {
    sembrar({ globalConfidence: 39 });
    expect((await llamar()).status).toBe(201);
  });

  it("sin análisis: no hay nada que revisar (201 con sourceAnalysisId null)", async () => {
    sembrar(null);
    const r = await llamar();
    expect(r.status).toBe(201);
    expect(r.cuerpo.sourceAnalysisId).toBeNull();
  });

  it("PENDING_REVIEW: 409 origen_requiere_confirmacion con razones y huella; no escribe", async () => {
    sembrar({ status: "PENDING_REVIEW" });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("origen_requiere_confirmacion");
    expect(r.cuerpo.razones).toEqual([{ tipo: "no_aprobado", status: "PENDING_REVIEW" }]);
    expect(r.cuerpo.lineas).toEqual([]);
    expect(r.cuerpo.huella).toMatch(/^[0-9a-f]{64}$/);
    expect(escribio()).toBe(false);
  });

  it("sesgos sin revisar y no vigente se piden juntos, en orden fijo", async () => {
    sembrar({ vigente: false, biasAlerts: [{ type: "u", description: "d" }] });
    const r = await llamar();
    expect(r.cuerpo.razones).toEqual([
      { tipo: "sesgos_sin_revisar", cantidad: 1 },
      { tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z" },
    ]);
  });

  it("confirmar con la huella que devolvió el servidor vincula (201) y escribe el vínculo", async () => {
    sembrar({ status: "REVIEWED" });
    const { cuerpo } = await llamar();
    const r = await llamar({ confirmarOrigen: true, huellaOrigen: cuerpo.huella });
    expect(r.status).toBe(201);
    expect(r.cuerpo.sourceAnalysisId).toBe("a1");
    expect(escribio()).toBe(true);
  });

  it("huella equivocada o ausente: 409 origen_huella_vencida, sin escribir", async () => {
    sembrar({ status: "REVIEWED" });
    for (const extra of [{ confirmarOrigen: true, huellaOrigen: "otra" }, { confirmarOrigen: true }]) {
      const r = await llamar(extra);
      expect(r.status).toBe(409);
      expect(r.cuerpo.error).toBe("origen_huella_vencida");
    }
    expect(escribio()).toBe(false);
  });
});

describe("link-moddulo — gate de origen: orden y ramas que no lo evalúan", () => {
  it("el territorio (422) se resuelve antes: con forceLink ausente y un análisis sin aprobar sigue siendo territorio_mismatch", async () => {
    sembrar({ status: "PENDING_REVIEW" }, {}, { "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: { nivel: "estatal", estado: "Jalisco", nombre: "Jalisco" } } });
    expect((await llamar()).cuerpo.error).toBe("territorio_mismatch");
  });

  it("la fase cerrada va primero", async () => {
    sembrar({ status: "PENDING_REVIEW" }, { status: "completed", dvs: { x: 1 } });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("fase_cerrada");
  });

  it("el candado H15 va antes: un Moddulo con M1 aprobado y un análisis sin aprobar responde primero el candado de reemplazo", async () => {
    const exp = exploracionGate("aprobado", { draftDVS: { x: 1 } });
    exp.linkedSource = { kind: "express", componente: "moddulo", sourceId: "m1", payload: (exp.linkedSource as { payload: object }).payload };
    sembrar({ status: "PENDING_REVIEW" }, exp);
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(escribio()).toBe(false);
  });

  it("el mismo análisis ya importado (rama idempotente) NO evalúa el gate: 200 y solo se reafirma el back-link", async () => {
    sembrar({ status: "PENDING_REVIEW" }, { linkedSource: { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: { P: {} } } });
    const r = await llamar();
    expect(r.status).toBe(200);
  });

  it("otra versión ya importada: sigue siendo moddulo_already_linked, no el gate", async () => {
    sembrar({ status: "PENDING_REVIEW" }, { linkedSource: { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a0", payload: { P: {} } } });
    expect((await llamar()).cuerpo.error).toBe("moddulo_already_linked");
  });
});

describe("link-moddulo — gate de origen: dentro de la transacción", () => {
  it("la lectura previa ve el análisis aprobado pero al escribir ya no lo está: 409 y cero escrituras", async () => {
    sembrar();
    gancho.fn = () => {
      const s = mockDb.snapshot() as Record<string, Record<string, unknown>>;
      s["pestel_analyses/a1"] = { ...s["pestel_analyses/a1"], status: "PENDING_REVIEW" };
      mockDb.reset(s);
      mockDb.atomico(true);
    };
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("origen_requiere_confirmacion");
    expect(escribio()).toBe(false);
  });

  it("el usuario confirmó lo que vio, pero cambió el estado antes de escribir: huella_vencida con lo nuevo", async () => {
    sembrar({ status: "REVIEWED" });
    const { cuerpo } = await llamar();
    gancho.fn = () => {
      const s = mockDb.snapshot() as Record<string, Record<string, unknown>>;
      s["pestel_analyses/a1"] = { ...s["pestel_analyses/a1"], biasAlerts: [{ type: "u", description: "d" }] };
      mockDb.reset(s);
      mockDb.atomico(true);
    };
    const r = await llamar({ confirmarOrigen: true, huellaOrigen: cuerpo.huella });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("origen_huella_vencida");
    expect(r.cuerpo.razones.map((x: { tipo: string }) => x.tipo)).toEqual(["no_aprobado", "sesgos_sin_revisar"]);
    expect(escribio()).toBe(false);
  });

  it("el análisis desaparece entre la lectura previa y la escritura: 404 sin escribir", async () => {
    sembrar();
    gancho.fn = () => {
      const s = mockDb.snapshot() as Record<string, unknown>;
      delete s["pestel_analyses/a1"];
      mockDb.reset(s);
      mockDb.atomico(true);
    };
    const r = await llamar();
    expect(r.status).toBe(404);
    expect(escribio()).toBe(false);
  });
});
