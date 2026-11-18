// C1b-1 — COSTO de m1-reopen, medido con los contadores del mock: TOTALES (lecturas / escrituras) de la transacción que
// CONFIRMA. `getProject` (acceso) suma +1 lectura y +1 escritura (`lastAccessedAt`) en todos los caminos (H-V23): aquí
// está mockeado y NO entra. Antes de C1b-1: reabrir = 1 lectura / 1 escritura. Conteos del mock; sin emulador (Java 17).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase-admin/firestore")>()),
  FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" },
}));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { aprobacionDe, docProyectoM1, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";
import { registrarVigenteF2 } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";
import { huellaDe } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const M = mapaM1();
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...o }) }) as never;
const aprobado = () => docProyectoM1({ m1: { aprobacion: aprobacionDe(M) } });

function sembrar(doc: unknown) {
  db.reset({ [P]: structuredClone(doc) });
  db.rechazarUndefined(true);
  db.atomico(true);
}
/** Pide la huella (sin medir) y mide SOLO la llamada que confirma. */
async function medirConfirmando() {
  const huella = ((await (await POST(req())).json()) as { huella: string }).huella;
  const antes = db.contadores();
  const res = await POST(req({ confirmar: true, huella }));
  const d = db.contadores();
  return { status: res.status, lecturas: d.lecturas - antes.lecturas, escrituras: d.escrituras - antes.escrituras, borrados: d.borrados - antes.borrados };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  sembrar(aprobado());
});

describe("costo de reabrir (totales de la transacción que confirma)", () => {
  it("SIN historial previo: 1 lectura / 5 escrituras (proyecto + versión previa + versión + revisión + evento)", async () => {
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 1, escrituras: 5, borrados: 0 });
  });

  it("CON historial vigente (régimen): 2 lecturas (proyecto + manifiesto) / 4 escrituras", async () => {
    await registrarVigenteF2(db, P, { aprobado: true, por: "u1", en: "2026-10-15T12:00:00.000Z", huella: huellaDe(M), categoriasEditadas: 0, total: 6 });
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 2, escrituras: 4, borrados: 0 });
  });

  it("con DERIVA: 2 lecturas / 5 escrituras (+1: la versión de deriva)", async () => {
    await registrarVigenteF2(db, P, { aprobado: true, por: "u1", en: "2026-10-15T12:00:00.000Z", huella: huellaDe(M), categoriasEditadas: 0, total: 6 });
    const doc = structuredClone(db.snapshot()[P]) as { phases: { exploracion: { m1: Record<string, unknown> } } };
    doc.phases.exploracion.m1.ediciones = { "P.narrativa": { original: "x", editado: "x", por: "u9", en: "t" } };
    db.seed(P, doc);
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 2, escrituras: 5, borrados: 0 });
  });

  it("la pregunta de confirmación (409), yaReabierto y m1_no_aprobado cuestan 1 lectura / 0 escrituras (como antes)", async () => {
    const antes = db.contadores();
    expect((await POST(req())).status).toBe(409);
    let d = db.contadores();
    expect([d.lecturas - antes.lecturas, d.escrituras - antes.escrituras]).toEqual([1, 0]);
    sembrar(docProyectoM1({ m1: { reabiertoEn: "t", reabiertoPor: "u1" } }));
    expect((await POST(req())).status).toBe(200);
    d = db.contadores();
    expect([d.lecturas, d.escrituras]).toEqual([1, 0]);
    sembrar(docProyectoM1());
    expect((await POST(req())).status).toBe(409);
    d = db.contadores();
    expect([d.lecturas, d.escrituras]).toEqual([1, 0]);
  });
});
