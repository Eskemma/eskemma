// find-linked-pestel (T5): el modo 1 es de SOLO LECTURA (sin repair, sin getProject) y deja en el log las asimetrías.
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

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb> & { getAll?: unknown };
const llamar = async (qs: string) => {
  const r = await GET(new Request(`http://local/api/moddulo/f2/find-linked-pestel?${qs}`) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const moddulo = (linkedSource?: unknown, extra: Record<string, unknown> = {}) => ({ collaborators: [{ uid: "u1" }], phases: { exploracion: linkedSource ? { linkedSource } : {} }, ...extra });
let warn: ReturnType<typeof vi.spyOn>;
const asimetrias = () => warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes("[asimetria]"));

beforeEach(() => {
  vi.clearAllMocks();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  (db as { getAll: unknown }).getAll = vi.fn(async (ref: { get: () => Promise<unknown> }) => [await ref.get()]);
});

describe("find-linked-pestel modo 1 — solo lectura (T5)", () => {
  it("[real] encuentra el pendiente por back-link y NO escribe nada, no abre transacción ni llama a getProject", async () => {
    db.reset({ "moddulo_projects/m1": moddulo(), "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1", currentStage: 4 } });
    const r = await llamar("moddulo_project_id=m1");
    expect(r.cuerpo).toEqual({ found: true, sourceId: "p1", currentStage: 4 });
    expect(db.updates()).toEqual([]);
    expect(db.runTransaction).not.toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
    expect(asimetrias()).toEqual([]);
  });

  it("[local] con un linkedSource sin sourceId (lo que el repair completaba) ya NO lo completa", async () => {
    db.reset({ "moddulo_projects/m1": moddulo({ kind: "T22" }), "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" } });
    await llamar("moddulo_project_id=m1");
    expect(db.updates()).toEqual([]);
  });

  it("un PESTEL archivado se marca; uno activo no lleva la clave", async () => {
    db.reset({ "moddulo_projects/m1": moddulo(), "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1", status: "archived" } });
    expect((await llamar("moddulo_project_id=m1")).cuerpo.archivado).toBe(true);
    db.reset({ "moddulo_projects/m1": moddulo(), "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1", status: "active" } });
    expect("archivado" in (await llamar("moddulo_project_id=m1")).cuerpo).toBe(false);
  });

  it("varios pendientes: devuelve el más reciente y deja el aviso en el log (solo tipo e ids)", async () => {
    db.reset({
      "moddulo_projects/m1": moddulo(),
      "pestel_projects/viejo": { userId: "u1", modduloProjectId: "m1", createdAt: { seconds: 1 } },
      "pestel_projects/nuevo": { userId: "u1", modduloProjectId: "m1", createdAt: { seconds: 9 } },
    });
    const r = await llamar("moddulo_project_id=m1");
    expect(r.cuerpo.sourceId).toBe("nuevo");
    expect(asimetrias()).toHaveLength(1);
    expect(asimetrias()[0]).toContain("varios_pendientes");
    expect(asimetrias()[0]).not.toMatch(/nombre|payload|territorio/);
  });

  it("T22 con análisis cuyo back-link es de OTRO PESTEL y la forma antigua distinta: se registran", async () => {
    db.reset({ "moddulo_projects/m1": moddulo({ kind: "T22", sourceId: "pX", sourceAnalysisId: "a1" }), "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" } });
    await llamar("moddulo_project_id=m1");
    expect(asimetrias()[0]).toContain("backlink_con_t22_de_otro");
    warn.mockClear();
    db.reset({ "moddulo_projects/m1": moddulo({ kind: "T22", sourceId: "pX" }), "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" } });
    await llamar("moddulo_project_id=m1");
    expect(asimetrias()[0]).toContain("pendiente_antiguo_distinto");
  });

  it("no se registra nada si el usuario no colabora en el Moddulo o está en papelera; y sin PESTEL: {found:false}", async () => {
    db.reset({ "moddulo_projects/m1": moddulo(undefined, { collaborators: [{ uid: "otro" }] }), "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" }, "pestel_projects/p2": { userId: "u1", modduloProjectId: "m1" } });
    await llamar("moddulo_project_id=m1");
    db.reset({ "moddulo_projects/m1": moddulo(undefined, { deletedAt: "x" }), "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1" }, "pestel_projects/p2": { userId: "u1", modduloProjectId: "m1" } });
    await llamar("moddulo_project_id=m1");
    expect(asimetrias()).toEqual([]);
    db.reset({ "moddulo_projects/m1": moddulo() });
    expect((await llamar("moddulo_project_id=m1")).cuerpo).toEqual({ found: false });
  });

  it("si la lectura del Moddulo falla, la respuesta no se afecta", async () => {
    (db as { getAll: unknown }).getAll = vi.fn(async () => { throw new Error("boom"); });
    db.reset({ "pestel_projects/p1": { userId: "u1", modduloProjectId: "m1", currentStage: 4 } });
    expect((await llamar("moddulo_project_id=m1")).cuerpo).toMatchObject({ found: true, sourceId: "p1" });
  });

  it("modo 2 con verificar=1: un back-link que no apunta a este Moddulo se registra (t22_sin_backlink) sin cambiar la respuesta", async () => {
    db.reset({ "pestel_projects/p1": { userId: "u1", currentStage: 5 } });
    const r = await llamar("pestel_project_id=p1&moddulo_project_id=m1&verificar=1");
    expect(r.cuerpo).toMatchObject({ found: true, sourceId: "p1", currentStage: 5 });
    expect(asimetrias()[0]).toContain("t22_sin_backlink");
  });
});
