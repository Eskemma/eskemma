// GET /api/centinela/pestel/project/[projectId]?ajustesImportados=1 (T7 C3): además del resumen de ajustes, trae la nota
// de aprobación que F2 importó y la versión de su huella, de la MISMA lectura del Moddulo (0 lecturas extra).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));

import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { GET } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const get = async (query = "") => {
  const r = await GET(new NextRequest(`http://local/api/x${query}`), ctx);
  return { status: r.status, cuerpo: await r.json() };
};
const sembrar = (linkedSource: Record<string, unknown>) =>
  db.reset({
    "pestel_projects/pest1": { userId: "u1", nombre: "P", modduloProjectId: "m1" },
    "moddulo_projects/m1": { collaborators: [{ uid: "u1", role: "owner" }], phases: { exploracion: { linkedSource: { kind: "T22", sourceAnalysisId: "a1", payload: {}, ...linkedSource } } } },
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("GET proyecto PESTEL — notaImportada (T7 C3)", () => {
  it("vínculo v2 con nota: versión, nota (sin forma inventada) y el análisis que F2 importó", async () => {
    sembrar({ huellaFuente: { v: 2, h: "x" }, aprobacionOrigen: { confianza: 39, justificacion: "Con reservas.", aprobadoEn: "2026-10-20T00:00:00.000Z" } });
    expect((await get("?ajustesImportados=1")).cuerpo.notaImportada).toEqual({
      v: 2, nota: { confianza: 39, justificacion: "Con reservas.", aprobadoEn: "2026-10-20T00:00:00.000Z" }, sourceAnalysisId: "a1",
    });
  });
  it("vínculo v1 o sin huella: v:1 / v:null y nota null (la pantalla NO avisa)", async () => {
    sembrar({ huellaFuente: { v: 1, h: "x" } });
    expect((await get("?ajustesImportados=1")).cuerpo.notaImportada).toEqual({ v: 1, nota: null, sourceAnalysisId: "a1" });
    sembrar({});
    expect((await get("?ajustesImportados=1")).cuerpo.notaImportada).toEqual({ v: null, nota: null, sourceAnalysisId: "a1" });
  });
  it("una nota guardada con forma inválida se lee como ausente", async () => {
    sembrar({ huellaFuente: { v: 2, h: "x" }, aprobacionOrigen: { confianza: "39" } });
    expect((await get("?ajustesImportados=1")).cuerpo.notaImportada.nota).toBeNull();
  });
  it("sin el parámetro: solo { project }; Moddulo en papelera o sin acceso: notaImportada null", async () => {
    sembrar({});
    expect(Object.keys((await get()).cuerpo)).toEqual(["project"]);
    db.reset({
      "pestel_projects/pest1": { userId: "u1", modduloProjectId: "m1" },
      "moddulo_projects/m1": { deletedAt: "2026-10-01", collaborators: [{ uid: "u1" }], phases: { exploracion: { linkedSource: { huellaFuente: { v: 2, h: "x" } } } } },
    });
    expect((await get("?ajustesImportados=1")).cuerpo.notaImportada).toBeNull();
  });
});
