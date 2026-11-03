// T4: import-pestel guarda la huella del contenido del análisis de origen (`linkedSource.huellaFuente`) y el
// MISMO análisis con contenido distinto ya no es idempotente: se re-sincroniza por el mismo camino y con el
// mismo candado H15. Importaciones sin huella: solo se re-sincronizan si hay ajustes que su mapa no trae.

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
import { exploracionGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import { huellaDeOrigen } from "@/lib/centinela/pestel/huellaOrigen";
import { transformToMapaPESTEL } from "@/lib/centinela/pestel/transformToMapaPESTEL";
import { AJUSTES_EJEMPLO, DIMENSIONES_EJEMPLO } from "@/lib/centinela/pestel/__fixtures__/analisisEjemplo";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const clon = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const llamar = async (cuerpo: Record<string, unknown> = {}) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", pestAnalysisId: "a1", ...cuerpo }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
/** Reemplazar un mapa existente SIEMPRE pide confirmación (H15): primer paso sin confirmar, segundo con la huella. */
const confirmando = async () => {
  const primero = await llamar();
  expect(primero.status).toBe(409);
  return { primero, segundo: await llamar({ confirmar: true, huella: primero.cuerpo.huella }) };
};
const escrituras = () => db.updates().filter((u) => u.path === P);

/** Moddulo que ya importó el análisis a1 del PESTEL pest1 (con o sin huella), aprobado o no. */
function moddulo(opts: { huella?: { v: number; h: string } | null; adjustments?: unknown[]; aprobado?: boolean; completada?: boolean }) {
  const ajustesImportados = opts.adjustments ?? AJUSTES_EJEMPLO;
  const mapa = transformToMapaPESTEL(clon(DIMENSIONES_EJEMPLO) as never, clon(ajustesImportados) as never);
  const base = exploracionGate(opts.aprobado ? "aprobado" : "sin_m1", {}, mapa);
  const exp = {
    ...base,
    ...(opts.completada ? { status: "completed" } : {}),
    linkedSource: {
      kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: mapa,
      ...(opts.huella ? { huellaFuente: opts.huella } : {}),
    },
  };
  vi.mocked(getProject).mockResolvedValue({ id: "p1", xpcto: { hito: "h" }, phases: { exploracion: exp } } as never);
  return exp;
}
/** El análisis a1 tal como está AHORA en Centinela. */
function sembrar(exp: Record<string, unknown>, analisis: { adjustments?: unknown[]; dimensions?: unknown[] } = {}) {
  db.reset({
    "pestel_analyses/a1": { projectId: "pest1", dimensions: clon(analisis.dimensions ?? DIMENSIONES_EJEMPLO), adjustments: clon(analisis.adjustments ?? AJUSTES_EJEMPLO) },
    "pestel_projects/pest1": { userId: "u1", modduloProjectId: "p1" },
    [P]: { phases: { exploracion: exp } },
  });
  db.atomico(true);
}
const huellaDe = (adj: unknown[] = AJUSTES_EJEMPLO) => huellaDeOrigen(DIMENSIONES_EJEMPLO as never, adj as never);
const AJUSTE_NUEVO = [{ ...AJUSTES_EJEMPLO[0], newClassification: "NEUTRAL", justification: "Cambió otra vez." }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("import-pestel — huellaFuente", () => {
  it("el primer import guarda la huella del contenido del análisis junto al mapa", async () => {
    vi.mocked(getProject).mockResolvedValue({ id: "p1", xpcto: {}, phases: { exploracion: {} } } as never);
    sembrar({});
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.linkedSource.huellaFuente).toEqual(huellaDe());
    expect(escrituras()[0].data["phases.exploracion.linkedSource"]).toMatchObject({ huellaFuente: huellaDe() });
  });
});

describe("import-pestel — el MISMO análisis (T4)", () => {
  it("con huella igual: idempotente, 200 y cero escrituras", async () => {
    const exp = moddulo({ huella: huellaDe() });
    sembrar(exp);
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(db.updates()).toEqual([]);
  });

  it("con huella DISTINTA (el analista ajustó después): se re-sincroniza (con la confirmación de siempre), escribe el mapa y la huella nuevos", async () => {
    const exp = moddulo({ huella: huellaDe() });
    sembrar(exp, { adjustments: AJUSTE_NUEVO });
    const { primero, segundo: r } = await confirmando();
    expect(primero.cuerpo.motivo).toBe("analisis_cambio");
    expect(r.status).toBe(200);
    expect(escrituras()).toHaveLength(1);
    expect(r.cuerpo.linkedSource.huellaFuente).toEqual(huellaDe(AJUSTE_NUEVO));
    expect(r.cuerpo.linkedSource.payload.P.ajuste.clasificacionAjustada).toBe("NEUTRAL");
  });

  it("con huella distinta y el M1 aprobado: pasa por el candado H15 (409 con líneas y huella), con motivo «analisis_cambio», sin escribir", async () => {
    const exp = moddulo({ huella: huellaDe(), aprobado: true });
    sembrar(exp, { adjustments: AJUSTE_NUEVO });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(r.cuerpo.motivo).toBe("analisis_cambio");
    expect(r.cuerpo.lineas.length).toBeGreaterThan(0);
    expect(typeof r.cuerpo.huella).toBe("string");
    expect(db.updates()).toEqual([]);
  });

  it("esa confirmación (confirmar + huella) re-sincroniza", async () => {
    const exp = moddulo({ huella: huellaDe(), aprobado: true });
    sembrar(exp, { adjustments: AJUSTE_NUEVO });
    const { cuerpo } = await llamar();
    const r = await llamar({ confirmar: true, huella: cuerpo.huella });
    expect(r.status).toBe(200);
    expect(escrituras()).toHaveLength(1);
  });

  it("un análisis DISTINTO con el M1 aprobado no lleva el motivo «analisis_cambio» (el texto es el de siempre)", async () => {
    const exp = moddulo({ huella: huellaDe(), aprobado: true });
    sembrar(exp);
    db.reset({
      "pestel_analyses/a2": { projectId: "pest1", dimensions: clon(DIMENSIONES_EJEMPLO), adjustments: [] },
      "pestel_projects/pest1": { userId: "u1", modduloProjectId: "p1" },
      [P]: { phases: { exploracion: exp } },
    });
    db.atomico(true);
    const r = await llamar({ pestAnalysisId: "a2" });
    expect(r.status).toBe(409);
    expect(r.cuerpo.motivo).toBeUndefined();
  });

  it("huella con otra versión de la regla (v:2): se trata como sin huella, no como «cambió»", async () => {
    const exp = moddulo({ huella: { v: 2, h: "xx" } });
    sembrar(exp);
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(db.updates()).toEqual([]);
  });
});

describe("import-pestel — importaciones SIN huella (anteriores a T4)", () => {
  it("con los ajustes del análisis ya reflejados en su mapa: idempotente, como hoy", async () => {
    const exp = moddulo({ huella: null });
    sembrar(exp);
    expect((await llamar()).status).toBe(200);
    expect(db.updates()).toEqual([]);
  });

  it("sin ningún ajuste en el análisis: idempotente", async () => {
    const exp = moddulo({ huella: null, adjustments: [] });
    sembrar(exp, { adjustments: [] });
    expect((await llamar()).status).toBe(200);
    expect(db.updates()).toEqual([]);
  });

  it("con ajustes que su mapa NO trae (la promesa de la nota de T3): se re-sincroniza y queda con huella", async () => {
    const exp = moddulo({ huella: null, adjustments: [] }); // importó antes de que el analista ajustara
    sembrar(exp, { adjustments: AJUSTES_EJEMPLO });
    const { primero, segundo: r } = await confirmando();
    expect(primero.cuerpo.motivo).toBe("analisis_cambio");
    expect(r.status).toBe(200);
    expect(escrituras()).toHaveLength(1);
    expect(r.cuerpo.linkedSource.huellaFuente).toEqual(huellaDe());
    expect(r.cuerpo.linkedSource.payload.P.ajuste).toBeDefined();
  });

  it("con ajustes que su mapa no trae y el M1 aprobado: 409 de confirmación con el motivo «analisis_cambio»", async () => {
    const exp = moddulo({ huella: null, adjustments: [], aprobado: true });
    sembrar(exp, { adjustments: AJUSTES_EJEMPLO });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.motivo).toBe("analisis_cambio");
  });

  it("Anaya (Fase 2 cerrada, importó antes de los ajustes): responde fase_cerrada y no cambia nada", async () => {
    const exp = moddulo({ huella: null, adjustments: [], completada: true });
    sembrar(exp, { adjustments: AJUSTES_EJEMPLO });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("fase_cerrada");
    expect(db.updates()).toEqual([]);
  });
});
