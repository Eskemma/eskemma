// T6 — caracterización de POST adjust (PESTEL). Escrita ANTES de tocar la ruta y verde contra el código
// anterior. Debe seguir verde sin editarse, salvo las pruebas marcadas [EDITADA EN T6]: (1) un ajuste
// sobre un análisis APPROVED ya no lo deja APPROVED; (2) una justificación de más de 1 000 caracteres ya
// no se acepta. El resto describe lo que NO cambia.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "TS", delete: () => "__DELETE__" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ analysisId: "a1" }) };
const JUST = "Datos de campo muestran un riesgo mayor al estimado.";
const cuerpo = (extra: Record<string, unknown> = {}) => ({
  dimensionCode: "P",
  newPosition: { x: 80, y: 70 },
  newClassification: "AMENAZA",
  justification: JUST,
  ...extra,
});
const llamar = async (body: unknown = cuerpo()) => {
  const r = await POST(
    new Request("http://local/x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }) as never,
    ctx
  );
  return { status: r.status, cuerpo: await r.json() };
};
const dims = [
  { code: "P", classification: "NEUTRAL", intensity: "MEDIA", trend: "ESTABLE" },
  { code: "E", classification: "AMENAZA", intensity: "ALTA", trend: "ASCENDENTE" },
];
const sembrar = (extra: Record<string, unknown> = {}) =>
  db.reset({
    "pestel_analyses/a1": { projectId: "p1", userId: "u1", status: "REVIEWED", vigente: true, dimensions: dims, adjustments: [], ...extra },
    "pestel_projects/p1": { userId: "u1" },
  });
const escrituras = () => db.updates().filter((u) => u.path === "pestel_analyses/a1");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  sembrar();
});

describe("POST adjust — validaciones y propiedad (sin cambio)", () => {
  it("401 sin sesión", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await llamar()).status).toBe(401);
  });
  it("400 con JSON inválido, dimensión inválida, justificación corta o posición inválida", async () => {
    expect((await llamar("{no json")).cuerpo.error).toBe("JSON inválido");
    expect((await llamar(cuerpo({ dimensionCode: "Z" }))).cuerpo.error).toBe("dimensionCode inválido");
    expect((await llamar(cuerpo({ justification: "corta" }))).cuerpo.error).toBe("La justificación debe tener al menos 20 caracteres.");
    expect((await llamar(cuerpo({ newPosition: { x: "a", y: 1 } }))).cuerpo.error).toBe("newPosition debe tener x e y numéricos.");
    expect((await llamar(cuerpo({ newPosition: { x: 101, y: 1 } }))).cuerpo.error).toBe("newPosition x e y deben estar entre 0 y 100.");
    expect((await llamar(cuerpo({ newClassification: "X" }))).cuerpo.error).toBe("newClassification inválido");
    expect(db.updates()).toEqual([]);
  });
  it("404 «Análisis no encontrado» si no existe o es ajeno (mismo mensaje); sin escrituras", async () => {
    db.reset({});
    expect(await llamar()).toEqual({ status: 404, cuerpo: { error: "Análisis no encontrado" } });
    db.reset({ "pestel_analyses/a1": { projectId: "p1", userId: "otro", dimensions: dims }, "pestel_projects/p1": { userId: "otro" } });
    expect(await llamar()).toEqual({ status: 404, cuerpo: { error: "Análisis no encontrado" } });
    expect(db.updates()).toEqual([]);
  });
  it("404 si la dimensión no está en el análisis", async () => {
    sembrar({ dimensions: [dims[1]] });
    expect((await llamar()).status).toBe(404);
  });
});

describe("POST adjust — qué escribe (sin cambio)", () => {
  it("guarda el ajuste con quién, cuándo, originales y nuevos; sin tocar dimensions ni status (REVIEWED)", async () => {
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.ok).toBe(true);
    expect(r.cuerpo.adjustment).toMatchObject({
      dimensionCode: "P",
      adjustedBy: "u1",
      originalClassification: "NEUTRAL",
      newClassification: "AMENAZA",
      justification: JUST,
      newPosition: { x: 80, y: 70 },
    });
    const w = escrituras();
    expect(w).toHaveLength(1);
    expect(Object.keys(w[0].data).sort()).toEqual(["adjustments", "updatedAt"]);
  });
  it("reemplaza el ajuste previo de la MISMA dimensión y conserva el de otras", async () => {
    sembrar({ adjustments: [{ dimensionCode: "P", justification: "vieja ".repeat(5) }, { dimensionCode: "E", justification: "otra ".repeat(6) }] });
    await llamar();
    const lista = escrituras()[0].data.adjustments as { dimensionCode: string; justification: string }[];
    expect(lista.map((a) => a.dimensionCode).sort()).toEqual(["E", "P"]);
    expect(lista.find((a) => a.dimensionCode === "P")!.justification).toBe(JUST);
  });
  it("[EDITADA EN T6] sobre un análisis APPROVED retira la aprobación (ver route.t6.test.ts); el ajuste se guarda igual", async () => {
    sembrar({ status: "APPROVED", approvedAt: "2026-10-01", approvedBy: "u1" });
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(escrituras()[0].data.status).toBe("REVIEWED");
  });
  it("[EDITADA EN T6] una justificación de más de 1 000 caracteres se rechaza (400)", async () => {
    const r = await llamar(cuerpo({ justification: "x".repeat(1001) }));
    expect(r.status).toBe(400);
    expect(db.updates()).toEqual([]);
  });
});
