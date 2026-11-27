// C1b-1 — HISTORIAL de m1-reopen: reabrir deja una versión `reapertura` de `f2M1` en la MISMA transacción, con
// `aprobacion {aprobado:false, por, en}` como constancia; la aprobación anterior queda en SU versión.
// Reabrir NO descarta nada (el borrador y las aprobaciones de motores quedan en pausa): el evento no lleva `detalle`.
// Mock con rechazo de `undefined` y transacciones atómicas. Sin emulador (Java 17): conteos y todo-o-nada son del mock.
// La reapertura NO llama al modelo.

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
import { aprobacionDe, docProyectoM1, huellaDe, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";
import {
  eventosDe, exploracionDe, registrarVigenteF2, revisionesDe, versionesDe,
} from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const M = mapaM1();
const H = huellaDe(M);
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...o }) }) as never;
const draft = { hei: { tensionCentral: "t" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] };
const aprobado = (extra: Record<string, unknown> = {}) =>
  docProyectoM1({ m1: { aprobacion: aprobacionDe(M), generacion: { huella: H, en: "t" } }, draftDVS: draft, motorAprobaciones: { M2: true, M3: true }, ...extra });

function sembrar(doc: unknown) {
  db.reset({ [P]: structuredClone(doc) });
  db.rechazarUndefined(true);
  db.atomico(true);
}
async function pedirHuella() {
  const r = await POST(req());
  expect(r.status).toBe(409);
  return ((await r.json()) as { huella: string }).huella;
}
const reabrirConfirmando = async () => POST(req({ confirmar: true, huella: await pedirHuella() }));
const sinHistorial = () => {
  expect(db.updates()).toHaveLength(0);
  for (const sub of ["versiones", "revisiones", "eventos"]) {
    expect(Object.keys(db.snapshot()).filter((k) => k.startsWith(`${P}/${sub}/`))).toHaveLength(0);
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  sembrar(aprobado());
});

describe("reabrir — versión `reapertura` de f2M1", () => {
  it("SIN historial: la previa guarda la aprobación ANTERIOR completa (con su autor y fecha); la nueva es la reapertura con constancia {aprobado:false}", async () => {
    expect((await reabrirConfirmando()).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002"]);

    expect(v[0]).toMatchObject({ tipoCambio: "previo_sin_historial", por: null, estado: "reemplazada" });
    expect(v[0].aprobacion).toEqual({ aprobado: true, por: "u1", en: "2026-10-15T12:00:00.000Z", huella: H, categoriasEditadas: 0, total: 6 });
    expect(v[0].aprobacion).not.toHaveProperty("mapa");

    expect(v[1]).toMatchObject({ tipoCambio: "reapertura", por: "u1", motivo: "reapertura" });
    expect(v[1].aprobacion).toEqual({ aprobado: false, por: "u1", en: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) });
    expect(v[1].contenido).toEqual({ kind: "express", mapa: M, ediciones: {}, origen: { componente: "moddulo", sourceId: "p1" } });

    expect(revisionesDe(db, P).map((r) => r.id)).toEqual(["exploracion_000001"]);
    const ev = eventosDe(db, P);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ tipo: "reapertura", motivo: "reapertura", fase: "exploracion", ambito: "moddulo", artefactos: ["f2M1"], por: "u1", fuente: "usuario" });
    // reabrir no descarta nada: sin detalle
    expect(Object.keys(ev[0])).not.toContain("detalle");
    const up = db.updates().filter((u) => u.path === P);
    expect(up).toHaveLength(1);
    expect(up[0].data["phases.exploracion.revision"]).toMatchObject({ n: 1, por: "u1" });
    // el borrador y las aprobaciones de motores NO se tocan (en pausa)
    for (const k of ["phases.exploracion.draftDVS", "phases.exploracion.motorAprobaciones", "phases.exploracion.m1.generacion"]) {
      expect(up[0].data).not.toHaveProperty(k);
    }
  });

  it("CON historial: solo la versión de reapertura; la aprobación anterior queda en SU versión", async () => {
    await registrarVigenteF2(db, P, { aprobado: true, por: "uAprobador", en: "2026-10-15T12:00:00.000Z", huella: H, categoriasEditadas: 0, total: 6 });
    expect((await reabrirConfirmando()).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => `${x.id}:${x.tipoCambio}`)).toEqual(["f2M1__000001:ajuste_manual", "f2M1__000002:reapertura"]);
    expect(v[0].aprobacion).toMatchObject({ aprobado: true, por: "uAprobador" });
    expect(v.some((x) => x.deriva)).toBe(false);
  });

  it("[deriva real] una EDICIÓN registrada fuera del historial cambia la proyección: versión de deriva + evento", async () => {
    await registrarVigenteF2(db, P, { aprobado: true, por: "u1", en: "2026-10-15T12:00:00.000Z", huella: H, categoriasEditadas: 0, total: 6 });
    const doc = structuredClone(db.snapshot()[P]) as { phases: { exploracion: { m1: Record<string, unknown> } } };
    doc.phases.exploracion.m1.ediciones = { "P.narrativa": { original: "IA P", editado: "IA P", por: "u9", en: "t" } };
    db.seed(P, doc);
    expect((await reabrirConfirmando()).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002", "f2M1__000003"]);
    expect(v[1]).toMatchObject({ tipoCambio: "previo_sin_historial", deriva: true, por: null });
    expect(v[2].tipoCambio).toBe("reapertura");
    expect(eventosDe(db, P).at(-1)).toMatchObject({ artefactosConDeriva: ["f2M1"] });
  });

  it("[en inesperado] una aprobación vigente con `en` ilegible NO rompe la transacción: la previa queda con en null", async () => {
    sembrar(aprobado({ m1: { aprobacion: aprobacionDe(M, { en: { _methodName: "x" } }), generacion: { huella: H, en: "t" } } }));
    expect((await reabrirConfirmando()).status).toBe(200);
    expect(versionesDe(db, P)[0].aprobacion).toMatchObject({ aprobado: true, en: null });
  });
});

describe("reabrir — los caminos que NO escriben tampoco dejan historial", () => {
  it("la pregunta de confirmación (409 reemplazo_requiere_confirmacion) y la huella vencida (409 reemplazo_huella_vencida)", async () => {
    const r = await POST(req());
    expect((await r.json()).error).toBe("reemplazo_requiere_confirmacion");
    const v = await POST(req({ confirmar: true, huella: "equivocada" }));
    expect((await v.json()).error).toBe("reemplazo_huella_vencida");
    sinHistorial();
  });
  it("yaReabierto, m1_no_aprobado, fase_cerrada, m1_no_encontrado, papelera", async () => {
    sembrar(docProyectoM1({ m1: { reabiertoEn: "t", reabiertoPor: "u1" } }));
    expect((await (await POST(req())).json()).yaReabierto).toBe(true);
    sembrar(docProyectoM1());
    expect((await (await POST(req())).json()).error).toBe("m1_no_aprobado");
    sembrar(aprobado({ status: "completed" }));
    expect((await POST(req())).status).toBe(409);
    sembrar(docProyectoM1({ payload: null }));
    expect((await POST(req())).status).toBe(404);
    sembrar(docProyectoM1({ deletedAt: "t" }));
    expect((await POST(req())).status).toBe(404);
    sinHistorial();
  });
});

describe("reabrir — fallos del historial: todo o nada, con el contrato de error", () => {
  it("COLISIÓN al CONFIRMAR: 409 {historial_no_confirmado, colision} (mismo status que la pregunta H15, otro `error`); NO se reabrió nada", async () => {
    const huella = await pedirHuella();
    db.seed(`${P}/versiones/f2M1__000001`, { x: 1 });
    const antes = structuredClone(db.snapshot()[P]);
    const res = await POST(req({ confirmar: true, huella }));
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b).toMatchObject({ error: "historial_no_confirmado", causa: "colision" });
    expect(b.error).not.toBe("reemplazo_requiere_confirmacion");
    expect(db.updates()).toHaveLength(0);
    expect(db.snapshot()[P]).toEqual(antes);
  });

  it("INCONSISTENCIA: 500 {historial_no_confirmado, inconsistencia}; el análisis sigue aprobado", async () => {
    const huella = await pedirHuella();
    const doc = structuredClone(db.snapshot()[P]) as { phases: { exploracion: Record<string, unknown> } };
    doc.phases.exploracion.revision = { n: 4, huella: "x", por: "u1", en: "t" };
    db.seed(P, doc);
    const res = await POST(req({ confirmar: true, huella }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "historial_no_confirmado", causa: "inconsistencia" });
    expect(db.updates()).toHaveLength(0);
    expect(exploracionDe(db, P).m1?.aprobacion).toBeTruthy();
  });

  it("un error que NO es del historial sale tal cual", async () => {
    const huella = await pedirHuella();
    db.failUpdateOn(P);
    await expect(POST(req({ confirmar: true, huella }))).rejects.toThrow();
  });
});
