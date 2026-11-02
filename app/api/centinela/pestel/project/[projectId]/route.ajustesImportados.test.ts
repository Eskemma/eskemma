// GET /api/centinela/pestel/project/[projectId]?ajustesImportados=1 (T3): resumen mínimo del mapa que F2 importó.
// Opt-in: sin el parámetro la respuesta es la de siempre.
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
const payload = { P: { code: "P", narrativa: "secreta", ajuste: { clasificacionOriginal: "AMENAZA", clasificacionAjustada: "OPORTUNIDAD", justificacion: "j" } }, E: { code: "E" } };
const sembrar = (modduloExtra: Record<string, unknown> = {}, pest: Record<string, unknown> = { modduloProjectId: "m1" }) =>
  db.reset({
    "pestel_projects/pest1": { userId: "u1", nombre: "P", ...pest },
    "moddulo_projects/m1": { collaborators: [{ uid: "u1", role: "owner" }], phases: { exploracion: { linkedSource: { kind: "T22", payload } } }, ...modduloExtra },
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("GET proyecto PESTEL — ajustesImportados (T3)", () => {
  it("sin el parámetro: solo { project }, como siempre (y sin leer el Moddulo)", async () => {
    sembrar();
    const r = await get();
    expect(r.status).toBe(200);
    expect(Object.keys(r.cuerpo)).toEqual(["project"]);
  });
  it("con el parámetro: la proyección mínima del ajuste importado, sin narrativa ni nada más", async () => {
    sembrar();
    const r = await get("?ajustesImportados=1");
    expect(r.cuerpo.importado).toEqual({ ajustes: { P: { clasificacionAjustada: "OPORTUNIDAD", justificacion: "j" } } });
    expect(JSON.stringify(r.cuerpo.importado)).not.toContain("secreta");
  });
  it("proyecto sin Moddulo vinculado: no hay `importado`", async () => {
    sembrar({}, {});
    expect((await get("?ajustesImportados=1")).cuerpo.importado).toBeUndefined();
  });
  it("Moddulo en papelera, inexistente o sin acceso: importado null (la pantalla no afirma nada)", async () => {
    sembrar({ deletedAt: "2026-10-01" });
    expect((await get("?ajustesImportados=1")).cuerpo.importado).toBeNull();
    sembrar({ collaborators: [{ uid: "otro", role: "owner" }] });
    expect((await get("?ajustesImportados=1")).cuerpo.importado).toBeNull();
    db.reset({ "pestel_projects/pest1": { userId: "u1", modduloProjectId: "fantasma" } });
    expect((await get("?ajustesImportados=1")).cuerpo.importado).toBeNull();
  });
  it("proyecto ajeno: 404 aunque pida el resumen", async () => {
    sembrar({}, { userId: "otro", modduloProjectId: "m1" });
    expect((await get("?ajustesImportados=1")).status).toBe(404);
  });
});
