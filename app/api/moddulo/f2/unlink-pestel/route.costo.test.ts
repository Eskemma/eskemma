// C1b-2 — COSTO de unlink-pestel, medido con los contadores del mock: TOTALES (lecturas / escrituras) de la transacción
// que CONFIRMA. `getProject` (acceso) suma +1 lectura y +1 escritura (`lastAccessedAt`) en todos los caminos (H-V23): aquí
// está mockeado y NO entra. ANTES de C1b-2: desvincular con back-link = 2 L / 2 E; sin back-link = 1 L / 1 E (o 2 L / 1 E si
// el PESTEL ya no existe). Conteos del mock; sin emulador (Java 17).

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

import { Timestamp } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { docProyectoT22, type OpcionesT22 } from "@/lib/moddulo/__tests__/fixtures/m1SiembraT22";
import { clonar, registrarVigenteF2, versionesDe } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const PEST = "pestel_projects/pest1";
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...o }) }) as never;
const t22 = (o: OpcionesT22 = {}) =>
  docProyectoT22({ draftDVS: { hei: { x: 1 } }, motorAprobaciones: { M2: true }, dvs: { final: 1 }, ...o });
function sembrar(doc: unknown, conBacklink = true) {
  db.reset({ [P]: clonar(doc), ...(conBacklink ? { [PEST]: { userId: "u1", modduloProjectId: "p1" } } : {}) });
  db.rechazarUndefined(true);
  db.atomico(true);
}
const huella = async () => ((await (await POST(req())).json()) as { huella: string }).huella;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
});

/** Pide la huella (sin medir) y mide SOLO la llamada que confirma. */
async function medirConfirmando() {
  const h = await huella();
  const antes = db.contadores();
  const res = await POST(req({ confirmar: true, huella: h }));
  const d = db.contadores();
  return { status: res.status, lecturas: d.lecturas - antes.lecturas, escrituras: d.escrituras - antes.escrituras, borrados: d.borrados - antes.borrados };
}

describe("costo de desvincular (totales de la transacción que confirma)", () => {
  it("SIN historial previo, con back-link: 2 lecturas (proyecto + PESTEL) / 6 escrituras (proyecto, PESTEL, previa, nueva, revisión, evento)", async () => {
    sembrar(t22());
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 2, escrituras: 6, borrados: 0 });
  });

  it("CON historial vigente (régimen): 3 lecturas (+ manifiesto) / 5 escrituras", async () => {
    sembrar(t22());
    await registrarVigenteF2(db, P);
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 3, escrituras: 5, borrados: 0 });
  });

  it("con DERIVA: 3 lecturas / 6 escrituras (+1: la versión de deriva)", async () => {
    sembrar(t22());
    await registrarVigenteF2(db, P);
    const doc = clonar(db.snapshot()[P]) as { phases: { exploracion: { m1: Record<string, unknown> } } };
    doc.phases.exploracion.m1.ediciones = { "P.narrativa": { original: "x", editado: "x", por: "u9", en: Timestamp.fromDate(new Date("2026-11-11T00:00:00Z")) } };
    db.seed(P, doc);
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 3, escrituras: 6, borrados: 0 });
  });

  it("SIN back-link (el vínculo no trae sourceId): 1 lectura / 5 escrituras (sin PESTEL)", async () => {
    sembrar(t22({ sourceId: null }), false);
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 1, escrituras: 5, borrados: 0 });
  });

  it("con sourceId pero el PESTEL ya no existe: 2 lecturas / 5 escrituras (se lee, no se escribe)", async () => {
    sembrar(t22(), false);
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 2, escrituras: 5, borrados: 0 });
  });

  it("con RESTOS sin M1 (borrador y aprobaciones, sin payload ni m1): igual que el caso base, 2 L / 6 E", async () => {
    sembrar(t22({ sinPayload: true, sinM1: true }));
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 2, escrituras: 6, borrados: 0 });
  });

  it("T22 totalmente vacío (nada que versionar): como ANTES de C1b-2, 2 L / 2 E", async () => {
    sembrar(t22({ sinPayload: true, sinM1: true, draftDVS: null, motorAprobaciones: {}, dvs: null }));
    expect(await medirConfirmando()).toEqual({ status: 200, lecturas: 2, escrituras: 2, borrados: 0 });
  });

  it("la pregunta H15 (409), not_linked, 404 y fase_cerrada cuestan 1 lectura / 0 escrituras (como antes)", async () => {
    sembrar(t22());
    let antes = db.contadores();
    expect((await POST(req())).status).toBe(409);
    let d = db.contadores();
    expect([d.lecturas - antes.lecturas, d.escrituras - antes.escrituras]).toEqual([1, 0]);
    sembrar(t22({ status: "completed" }));
    antes = db.contadores();
    expect((await POST(req())).status).toBe(409);
    d = db.contadores();
    expect([d.lecturas - antes.lecturas, d.escrituras - antes.escrituras]).toEqual([1, 0]);
  });
});
