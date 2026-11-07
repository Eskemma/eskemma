// T7 C3: import-pestel guarda la nota de aprobación del analista (`linkedSource.aprobacionOrigen`) con la huella v2.
// Una importación v1 NUNCA la adquiere, ni reimportando el mismo análisis sin cambios.

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
const NOTA = { confianza: 39, justificacion: "Se aprueba con reservas documentadas." };
const APROBADO_39 = { status: "APPROVED", globalConfidence: 39, aprobacionJustificacion: NOTA.justificacion, approvedAt: "2026-10-20T15:30:00.000Z" };

function moddulo(huella: { v: number; h: string } | null, aprobacionOrigen?: object) {
  const mapa = transformToMapaPESTEL(clon(DIMENSIONES_EJEMPLO) as never, clon(AJUSTES_EJEMPLO) as never);
  const exp = {
    ...exploracionGate("sin_m1", {}, mapa),
    linkedSource: { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: mapa, ...(huella ? { huellaFuente: huella } : {}), ...(aprobacionOrigen ? { aprobacionOrigen } : {}) },
  };
  vi.mocked(getProject).mockResolvedValue({ id: "p1", xpcto: { hito: "h" }, phases: { exploracion: exp } } as never);
  return exp;
}
function sembrar(exp: Record<string, unknown>, analisis: Record<string, unknown>) {
  db.reset({
    "pestel_analyses/a1": { status: "APPROVED", projectId: "pest1", dimensions: clon(DIMENSIONES_EJEMPLO), adjustments: clon(AJUSTES_EJEMPLO), ...analisis },
    "pestel_projects/pest1": { userId: "u1", modduloProjectId: "p1" },
    [P]: { phases: { exploracion: exp } },
  });
  db.atomico(true);
}
const huella = (version: number, nota: object | null) => huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never, { version, nota: nota as never });
const escrito = () => db.updates().find((u) => u.path === P)!.data["phases.exploracion.linkedSource"] as Record<string, any>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("import-pestel — primera importación: huella v2 y nota", () => {
  beforeEach(() => vi.mocked(getProject).mockResolvedValue({ id: "p1", xpcto: {}, phases: { exploracion: {} } } as never));

  it("aprobado con confianza baja y justificación: huella v2 CON la nota y aprobacionOrigen (confianza, justificación recortada, fecha)", async () => {
    sembrar({}, APROBADO_39);
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(escrito().huellaFuente).toEqual(huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never, { nota: { confianza: 39, justificacion: NOTA.justificacion } }));
    expect(escrito().huellaFuente.v).toBe(2);
    expect(escrito().aprobacionOrigen).toEqual({ ...NOTA, aprobadoEn: "2026-10-20T15:30:00.000Z" });
    expect(r.cuerpo.linkedSource.aprobacionOrigen).toEqual({ ...NOTA, aprobadoEn: "2026-10-20T15:30:00.000Z" });
  });
  it("aprobado con 39 SIN justificación (antes de T6-9a): aprobacionOrigen solo con la confianza (sin clave `justificacion`)", async () => {
    sembrar({}, { status: "APPROVED", globalConfidence: 39 });
    await llamar();
    expect(escrito().aprobacionOrigen).toEqual({ confianza: 39 });
    expect("justificacion" in escrito().aprobacionOrigen).toBe(false);
  });
  it("aprobado con confianza suficiente o sin aprobar: la clave aprobacionOrigen NO existe (ni undefined ni null) y la huella v2 es la de siempre sin nota", async () => {
    for (const a of [{ status: "APPROVED", globalConfidence: 80 }, { status: "REVIEWED", globalConfidence: 39 }]) {
      sembrar({}, a);
      await llamar({ confirmarOrigen: true, huellaOrigen: (await llamar()).cuerpo.huella });
      expect("aprobacionOrigen" in escrito()).toBe(false);
      expect(escrito().huellaFuente).toEqual(huella(2, null));
    }
  });
});

describe("import-pestel — el MISMO análisis: la regla es la de la versión en que se importó", () => {
  it("importación v1 + el analista aprobó con nota: idempotente, CERO escrituras (nunca adquiere la nota, ni reimportando)", async () => {
    sembrar(moddulo(huella(1, null)), APROBADO_39);
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.idempotente).toBe(true);
    expect(db.updates()).toEqual([]);
    expect("aprobacionOrigen" in r.cuerpo.linkedSource).toBe(false);
  });
  it("importación v2 con la misma nota: idempotente", async () => {
    sembrar(moddulo(huella(2, NOTA), NOTA), APROBADO_39);
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.idempotente).toBe(true);
    expect(db.updates()).toEqual([]);
  });
  it("importación v2 sin nota y el analista aprobó después con confianza baja: ya NO es idempotente (409 analisis_cambio) y al confirmar guarda la nota", async () => {
    sembrar(moddulo(huella(2, null)), APROBADO_39);
    const primero = await llamar();
    expect(primero.status).toBe(409);
    expect(primero.cuerpo.motivo).toBe("analisis_cambio");
    expect(db.updates()).toEqual([]);
    const r = await llamar({ confirmar: true, huella: primero.cuerpo.huella });
    expect(r.status).toBe(200);
    expect(escrito().aprobacionOrigen).toEqual({ ...NOTA, aprobadoEn: "2026-10-20T15:30:00.000Z" });
    expect(escrito().huellaFuente).toEqual(huella(2, NOTA));
  });
  it("importación v2 con nota y la aprobación se retiró: se re-sincroniza y la clave aprobacionOrigen desaparece del vínculo", async () => {
    sembrar(moddulo(huella(2, NOTA), NOTA), { status: "REVIEWED", globalConfidence: 39 });
    const primero = await llamar();
    expect(primero.status).toBe(409);
    // REVIEWED = no aprobado → el gate de origen también confirma; con un mapa ya importado gana H15 y trae las razones (UNA sola confirmación).
    expect(primero.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(primero.cuerpo.motivo).toBe("analisis_cambio");
    expect(primero.cuerpo.razonesOrigen.length).toBeGreaterThan(0);
    const r = await llamar({ confirmar: true, huella: primero.cuerpo.huella, confirmarOrigen: true, huellaOrigen: primero.cuerpo.huellaOrigen });
    expect(r.status).toBe(200);
    expect("aprobacionOrigen" in escrito()).toBe(false);
  });
});
