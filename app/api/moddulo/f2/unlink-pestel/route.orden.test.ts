// C1b-2 (condición a) — ORDEN de lecturas y escrituras dentro de la transacción de unlink-pestel. Firestore exige que TODAS
// las lecturas vayan antes de la primera escritura. Se envuelve `runTransaction` del mock para registrar cada `tx.get`,
// `tx.update` y `tx.create` en orden. El mock bufferiza las escrituras (no se aplican hasta terminar), así que esta prueba
// vigila la REGLA de orden que el Firestore real sí hace cumplir con un error en tiempo de ejecución. Sin emulador (Java 17).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

type Op = { op: "get" | "update" | "create" | "set"; path: string };
let ops: Op[] = [];
const original = (db.runTransaction as unknown as { getMockImplementation: () => ((fn: unknown) => Promise<unknown>) | undefined }).getMockImplementation()!;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  ops = [];
  (db.runTransaction as unknown as { mockImplementation: (f: unknown) => void }).mockImplementation((fn: (tx: Record<string, (...a: any[]) => unknown>) => Promise<unknown>) =>
    original(async (tx: Record<string, (...a: any[]) => unknown>) =>
      fn({
        get: (ref: { path: string }) => { ops.push({ op: "get", path: ref.path }); return tx.get(ref); },
        update: (ref: { path: string }, d: unknown) => { ops.push({ op: "update", path: ref.path }); return tx.update(ref, d); },
        create: (ref: { path: string }, d: unknown) => { ops.push({ op: "create", path: ref.path }); return tx.create(ref, d); },
        set: (ref: { path: string }, d: unknown) => { ops.push({ op: "set", path: ref.path }); return tx.set(ref, d); },
      })
    )
  );
});
afterEach(() => (db.runTransaction as unknown as { mockImplementation: (f: unknown) => void }).mockImplementation(original));

const indice = (pred: (o: Op) => boolean, desde = 0) => ops.findIndex((o, i) => i >= desde && pred(o));
const esEscritura = (o: Op) => o.op !== "get";

async function confirmar() {
  const h = await huella();
  ops = []; // solo la transacción que confirma
  return POST(req({ confirmar: true, huella: h }));
}

describe("desvincular — TODAS las lecturas van antes de la primera escritura", () => {
  it("sin historial: lee el proyecto y el PESTEL (back-link) antes de escribir", async () => {
    sembrar(t22());
    expect((await confirmar()).status).toBe(200);
    const primeraEscritura = indice(esEscritura);
    expect(primeraEscritura).toBeGreaterThan(0);
    const ultimaLectura = ops.map((o) => o.op).lastIndexOf("get");
    expect(ultimaLectura).toBeLessThan(primeraEscritura);
    expect(ops.some((o) => o.op === "get" && o.path === P)).toBe(true);
    expect(ops.some((o) => o.op === "get" && o.path === PEST)).toBe(true);
  });

  it("con historial: la lectura del MANIFIESTO (prepararVersion) también precede a cualquier escritura, y al back-link", async () => {
    sembrar(t22());
    await registrarVigenteF2(db, P);
    expect((await confirmar()).status).toBe(200);
    const manifiesto = indice((o) => o.op === "get" && o.path.startsWith(`${P}/revisiones/`));
    expect(manifiesto).toBeGreaterThanOrEqual(0);
    const primeraEscritura = indice(esEscritura);
    const escrituraPestel = indice((o) => o.op === "update" && o.path === PEST);
    expect(manifiesto).toBeLessThan(primeraEscritura);
    expect(manifiesto).toBeLessThan(escrituraPestel); // prepararVersion se resuelve antes de tocar el back-link
    expect(ops.map((o) => o.op).lastIndexOf("get")).toBeLessThan(primeraEscritura);
  });

  it("el back-link se escribe DESPUÉS de las escrituras del historial (versiones, revisión y evento)", async () => {
    sembrar(t22());
    await confirmar();
    const creates = ops.filter((o) => o.op === "create").length;
    expect(creates).toBeGreaterThanOrEqual(4); // previa, nueva, revisión, evento
    expect(indice((o) => o.op === "update" && o.path === PEST)).toBeGreaterThan(indice((o) => o.op === "create"));
  });

  it("ningún camino con error del historial escribe el back-link (colisión e inconsistencia): cero escrituras al PESTEL", async () => {
    sembrar(t22());
    db.seed(`${P}/versiones/f2M1__000001`, { ya: "existe" });
    expect((await confirmar()).status).toBe(409);
    expect(db.updates().some((u) => u.path === PEST)).toBe(false);
    expect((db.snapshot()[PEST] as { modduloProjectId?: string }).modduloProjectId).toBe("p1");

    const d = t22() as unknown as { phases: { exploracion: Record<string, unknown> } };
    d.phases.exploracion.revision = { n: 9, huella: "roto", por: "x", en: "t" };
    sembrar(d);
    expect((await confirmar()).status).toBe(500);
    expect(db.updates().some((u) => u.path === PEST)).toBe(false);
    expect((db.snapshot()[PEST] as { modduloProjectId?: string }).modduloProjectId).toBe("p1");
  });
});
