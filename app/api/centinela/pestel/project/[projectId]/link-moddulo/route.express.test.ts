// link-moddulo (T2, 1c): el M1 de origen Express tiene `linkedSource.sourceId` = el id del propio Moddulo
// (generate-m1-express), no el de un PESTEL. Antes ese valor disparaba `moddulo_already_linked` y bloqueaba
// el paso de Express a Centinela antes de llegar a su rama de «upgrade» (las pruebas anteriores forzaban
// `sourceId = pest1` y ocultaban el caso). Aquí se siembra la FORMA REAL de un Express.

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
import { MENSAJE_MODDULO_CON_OTRO_PESTEL, MENSAJE_MODDULO_OTRA_VERSION } from "@/lib/moddulo/textosVinculo";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const NAC = { nivel: "nacional", nombre: "México" };
const post = async (cuerpo: Record<string, unknown> = {}) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: "m1", ...cuerpo }) }) as never, ctx);
  return { status: r.status, cuerpo: await r.json() };
};
const sembrar = (exploracion: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
  db.reset({
    "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: NAC },
    "moddulo_projects/m1": { name: "M", type: "electoral", territorio: NAC, xpcto: { hito: "h" }, phases: { exploracion } },
    "pestel_analyses/a1": { projectId: "pest1", analyzedAt: "2026-10-01T00:00:00Z", dimensions: [] },
    ...extra,
  });
  db.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
};
// Express REAL: sourceId = id del propio Moddulo ("m1"), sin sourceAnalysisId.
const expressReal = (estado: "aprobado" | "sin_m1" = "aprobado", extra: Record<string, unknown> = {}) => {
  const x = exploracionGate(estado, extra);
  (x.linkedSource as { sourceId: string }).sourceId = "m1";
  return x;
};
const linkedEscrito = () =>
  db.updates().find((u) => u.path === "moddulo_projects/m1")?.data["phases.exploracion.linkedSource"] as Record<string, unknown> | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("link-moddulo — Express → Centinela (1c)", () => {
  it("(ii) Express real con trabajo: pide la confirmación H15 (no moddulo_already_linked) y no escribe", async () => {
    sembrar(expressReal());
    const r = await post();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(db.updates()).toEqual([]);
  });

  it("(ii) confirmado con la huella: vincula (201), escribe el vínculo T22 y el back-link", async () => {
    sembrar(expressReal());
    const { cuerpo } = await post();
    const r = await post({ confirmar: true, huella: cuerpo.huella });
    expect(r.status).toBe(201);
    expect(linkedEscrito()).toMatchObject({ kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1" });
    expect(db.updates().find((u) => u.path === "pestel_projects/pest1")?.data.modduloProjectId).toBe("m1");
  });

  it("(iii) Express sin nada que perder (sin payload ni borrador): vincula directo, sin mensaje", async () => {
    sembrar({ linkedSource: { kind: "express", componente: "moddulo", sourceId: "m1" } });
    expect((await post()).status).toBe(201);
  });

  it("(i) T22 de OTRO PESTEL: 409 moddulo_already_linked con el texto nuevo, sin escribir", async () => {
    sembrar({ linkedSource: { kind: "T22", componente: "centinela", sourceId: "pestOtro", sourceAnalysisId: "x", payload: { P: {} } } });
    const r = await post();
    expect(r.status).toBe(409);
    expect(r.cuerpo).toEqual({ error: "moddulo_already_linked", message: MENSAJE_MODDULO_CON_OTRO_PESTEL });
    expect(db.updates()).toEqual([]);
  });

  it("(i) [carrera] la lectura previa ve un Express pero al escribir ya hay un T22 de otro PESTEL: 409 moddulo_already_linked y cero escrituras", async () => {
    sembrar({ linkedSource: { kind: "T22", componente: "centinela", sourceId: "pestOtro", sourceAnalysisId: "x", payload: { P: {} } } });
    vi.mocked(getProject).mockResolvedValue({ id: "m1", type: "electoral", territorio: NAC, phases: { exploracion: expressReal() } } as never);
    const r = await post();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("moddulo_already_linked");
    expect(r.cuerpo.message).toBe(MENSAJE_MODDULO_CON_OTRO_PESTEL);
    expect(db.updates()).toEqual([]);
  });

  it("otra versión del análisis del MISMO PESTEL (sin back-link): 409 con el texto de «actualizar»", async () => {
    sembrar({ linkedSource: { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a0", payload: { P: {} } } });
    const r = await post();
    expect(r.status).toBe(409);
    expect(r.cuerpo).toEqual({ error: "moddulo_already_linked", message: MENSAJE_MODDULO_OTRA_VERSION });
  });

  it("(iv) Fase 2 cerrada: sigue siendo 409 fase_cerrada", async () => {
    sembrar({ ...expressReal(), status: "completed" });
    expect((await post()).cuerpo).toEqual({ error: "fase_cerrada" });
  });
});
