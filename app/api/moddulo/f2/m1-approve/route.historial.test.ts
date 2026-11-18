// C1b-1 — HISTORIAL de m1-approve: aprobar deja una versión de `f2M1` en la MISMA transacción. Mock con rechazo de
// `undefined` y transacciones atómicas. Límites: sin emulador de Firestore (Java 17): no se prueban aislamiento real
// ni reintentos; los conteos son del mock; la colisión/inconsistencia se simula sembrando lo que chocaría.
// La aprobación NO llama al modelo (la ruta solo lee y escribe Firestore).

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
import { POST as REABRIR } from "../m1-reopen/route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { aprobacionDe, docProyectoM1, huellaDe, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";
import {
  consolidarF2, eventosDe, exploracionDe, registrarVigenteF2, revisionesDe, versionesDe,
} from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";
import { huellaContenido } from "@/lib/versionado/huella";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const H = huellaDe(mapaM1());
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", huellaVista: H, ...o }) }) as never;
const reqReabrir = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...o }) }) as never;
const draft = { hei: { tensionCentral: "t" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] };

function sembrar(doc: unknown) {
  db.reset({ [P]: structuredClone(doc) });
  db.rechazarUndefined(true);
  db.atomico(true);
}
async function reabrir() {
  const primera = await REABRIR(reqReabrir());
  const b = (await primera.json()) as { huella: string };
  const r = await REABRIR(reqReabrir({ confirmar: true, huella: b.huella }));
  expect(r.status).toBe(200);
  consolidarF2(db, P);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  sembrar(docProyectoM1());
});

describe("aprobar — versión de f2M1 con su estado previo", () => {
  it("SIN historial: previa (sin aprobación, por null) + nueva con aprobación (por, en ISO, huella, conteos, SIN mapa); revisión, evento y puntero", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002"]);

    expect(v[0]).toMatchObject({ tipoCambio: "previo_sin_historial", por: null, en: null, estado: "reemplazada" });
    expect(v[0].aprobacion).toBeUndefined();

    expect(v[1]).toMatchObject({ tipoCambio: "ajuste_manual", por: "u1", motivo: "aprobacion" });
    expect(v[1].aprobacion).toEqual({ aprobado: true, por: "u1", en: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/), huella: H, categoriasEditadas: 0, total: 6 });
    // decisión 1: el mapa aprobado NO se duplica dentro de `aprobacion`; vive en `contenido.mapa`
    expect(v[1].aprobacion).not.toHaveProperty("mapa");
    expect(v[1].contenido).toEqual({ kind: "express", mapa: mapaM1(), ediciones: {} });
    expect(v[1].huella).toBe(huellaContenido(v[1].contenido));

    expect(revisionesDe(db, P).map((r) => r.id)).toEqual(["exploracion_000001"]);
    const ev = eventosDe(db, P);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ tipo: "ajuste_manual", motivo: "aprobacion", fase: "exploracion", ambito: "moddulo", artefactos: ["f2M1"], por: "u1", fuente: "usuario" });
    expect(Object.keys(ev[0])).not.toContain("detalle"); // nada se descartó
    expect(Object.keys(ev[0])).not.toContain("artefactosConDeriva");
    // el puntero va fusionado en el MISMO update del proyecto (cero escrituras extra al dueño)
    const up = db.updates().filter((u) => u.path === P);
    expect(up).toHaveLength(1);
    expect(up[0].data["phases.exploracion.revision"]).toMatchObject({ n: 1, por: "u1" });
  });

  it("CON historial (sin deriva): solo la versión nueva; ni previa ni deriva", async () => {
    await registrarVigenteF2(db, P); // el M1 sin revisar ya está registrado
    expect((await POST(req())).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002"]);
    expect(v[1].tipoCambio).toBe("ajuste_manual");
    expect(v.some((x) => x.deriva)).toBe(false);
    expect(Object.keys(eventosDe(db, P).at(-1) as object)).not.toContain("artefactosConDeriva");
  });

  it("[sin falsa deriva] aprobar con OTRO autor y otra fecha no cambia la proyección viva", async () => {
    await registrarVigenteF2(db, P);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u2" } as never);
    await POST(req());
    consolidarF2(db, P);
    await reabrir();
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u3" } as never);
    await POST(req());
    expect(versionesDe(db, P).some((x) => x.deriva)).toBe(false);
  });

  it("aprobar → reabrir → aprobar (mismo contenido): 4 versiones, con la reapertura entre medio (cada aprobación es un acto nuevo)", async () => {
    await POST(req());
    consolidarF2(db, P);
    await reabrir();
    expect((await POST(req())).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => `${x.id}:${x.tipoCambio}`)).toEqual([
      "f2M1__000001:previo_sin_historial",
      "f2M1__000002:ajuste_manual",
      "f2M1__000003:reapertura",
      "f2M1__000004:ajuste_manual",
    ]);
    expect(v[2].aprobacion).toMatchObject({ aprobado: false, por: "u1" });
    expect(v[3].aprobacion).toMatchObject({ aprobado: true, huella: H });
    expect(revisionesDe(db, P)).toHaveLength(3);
    expect(eventosDe(db, P).map((e) => e.motivo)).toEqual(expect.arrayContaining(["aprobacion", "reapertura"]));
  });

  it("[aprobación obsoleta sin historial] la versión previa queda marcada previo_sin_historial con SU huella y SIN mapa: no conserva la copia congelada", async () => {
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1(), { huella: "huella-vieja" }) } }));
    expect((await POST(req())).status).toBe(200);
    const [previa, nueva] = versionesDe(db, P);
    expect(previa).toMatchObject({ tipoCambio: "previo_sin_historial", por: null, estado: "reemplazada" });
    expect(previa.aprobacion).toMatchObject({ aprobado: true, por: "u1", huella: "huella-vieja" });
    expect(previa.aprobacion).not.toHaveProperty("mapa");
    expect(nueva.aprobacion).toMatchObject({ aprobado: true, huella: H });
  });

  it("[en inesperado en el vivo] una aprobación previa con `en` basura NO rompe la transacción: la previa queda con en null", async () => {
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1(), { huella: "vieja", en: { _methodName: "x" } }) } }));
    expect((await POST(req())).status).toBe(200);
    expect(versionesDe(db, P)[0].aprobacion).toMatchObject({ aprobado: true, en: null });
  });
});

describe("aprobar — deriva (el M1 cambió por un escritor sin historial)", () => {
  it("versión de deriva (deriva:true, estado detectado) antes de la nueva, y el evento lista el artefacto", async () => {
    await registrarVigenteF2(db, P);
    // un script/otro escritor edita el payload directamente, sin dejar versión
    const doc = structuredClone(db.snapshot()[P]) as { phases: { exploracion: { linkedSource: { payload: { P: { narrativa: string } } } } } };
    doc.phases.exploracion.linkedSource.payload.P.narrativa = "editada fuera del historial";
    db.seed(P, doc);
    const nueva = exploracionDe(db, P).linkedSource!.payload as never;
    expect((await POST(req({ huellaVista: huellaDe(nueva) }))).status).toBe(200);

    const v = versionesDe(db, P);
    expect(v.map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002", "f2M1__000003"]);
    expect(v[1]).toMatchObject({ tipoCambio: "previo_sin_historial", deriva: true, por: null });
    expect((v[1].contenido as { mapa: { P: { narrativa: string } } }).mapa.P.narrativa).toBe("editada fuera del historial");
    expect(v[2].aprobacion).toMatchObject({ aprobado: true });
    expect(eventosDe(db, P).at(-1)).toMatchObject({ artefactosConDeriva: ["f2M1"] });
  });
});

describe("aprobar — qué se descarta (detalle del evento)", () => {
  const conMotores = (generacionHuella: string | null, extra: Record<string, unknown> = {}) =>
    docProyectoM1({
      draftDVS: draft, motorAprobaciones: { M2: true, M3: true },
      m1: { ...(generacionHuella ? { generacion: { huella: generacionHuella, en: "t" } } : {}), reabiertoEn: "t", reabiertoPor: "u1" },
      ...extra,
    });

  it("contenido DISTINTO: el evento nombra los motores aprobados descartados y que había borrador", async () => {
    sembrar(conMotores("huella-de-otro-contenido"));
    expect((await (await POST(req())).json()).motoresDescartados).toBe(true);
    expect(eventosDe(db, P)[0].detalle).toEqual({ motoresAprobadosDescartados: ["M2", "M3"], borradorDescartado: true });
  });

  it("contenido distinto con borrador pero SIN motores aprobados: lista vacía y borradorDescartado true", async () => {
    sembrar(conMotores("otro", { motorAprobaciones: {} }));
    await POST(req());
    expect(eventosDe(db, P)[0].detalle).toEqual({ motoresAprobadosDescartados: [], borradorDescartado: true });
  });

  it("solo la marca de generación (sin borrador ni aprobaciones): se descarta la marca y el detalle lo dice (lista vacía, sin borrador)", async () => {
    sembrar(docProyectoM1({ m1: { generacion: { huella: "otro", en: "t" }, reabiertoEn: "t", reabiertoPor: "u1" } }));
    expect((await (await POST(req())).json()).motoresDescartados).toBe(true);
    expect(eventosDe(db, P)[0].detalle).toEqual({ motoresAprobadosDescartados: [], borradorDescartado: false });
  });

  it("contenido IDÉNTICO al que generó el borrador: no se descarta nada y el evento NO lleva detalle", async () => {
    sembrar(conMotores(H));
    expect((await (await POST(req())).json()).motoresDescartados).toBe(false);
    expect(Object.keys(eventosDe(db, P)[0])).not.toContain("detalle");
  });

  it("sin motores ni borrador: sin detalle", async () => {
    await POST(req());
    expect(Object.keys(eventosDe(db, P)[0])).not.toContain("detalle");
  });

  it("el contenido descartado NO se versiona (deuda H-V28): las versiones no traen el borrador", async () => {
    sembrar(conMotores("otro"));
    await POST(req());
    expect(JSON.stringify(versionesDe(db, P))).not.toContain("tensionCentral");
  });

  it("el detalle del evento es solo nombres y banderas: nunca contenido del usuario", async () => {
    sembrar(conMotores("otro"));
    await POST(req());
    const detalle = eventosDe(db, P)[0].detalle as Record<string, unknown>;
    for (const v of Object.values(detalle)) {
      expect(typeof v === "boolean" || (Array.isArray(v) && v.every((x) => /^M[2-5]$/.test(String(x))))).toBe(true);
    }
  });
});

describe("aprobar — los caminos que NO escriben tampoco dejan historial", () => {
  const sinHistorial = () => {
    expect(db.updates()).toHaveLength(0);
    for (const sub of ["versiones", "revisiones", "eventos"]) {
      expect(Object.keys(db.snapshot()).filter((k) => k.startsWith(`${P}/${sub}/`))).toHaveLength(0);
    }
  };
  it("yaAprobado", async () => {
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1()) } }));
    expect((await (await POST(req())).json()).yaAprobado).toBe(true);
    sinHistorial();
  });
  it("m1_cambio (huella de la pantalla vencida)", async () => {
    const res = await POST(req({ huellaVista: "otra" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("m1_cambio");
    sinHistorial();
  });
  it("fase_cerrada / m1_no_encontrado / proyecto en papelera", async () => {
    sembrar(docProyectoM1({ status: "completed" }));
    expect((await POST(req())).status).toBe(409);
    sembrar(docProyectoM1({ payload: null }));
    expect((await POST(req())).status).toBe(404);
    sembrar(docProyectoM1({ deletedAt: "t" }));
    expect((await POST(req())).status).toBe(404);
    sinHistorial();
  });
});

describe("aprobar — fallos del historial: todo o nada, con el contrato de error", () => {
  it("COLISIÓN (ya existe la versión que se iba a crear): 409 {historial_no_confirmado, colision}; NO se escribió nada", async () => {
    db.seed(`${P}/versiones/f2M1__000001`, { x: 1 });
    const antes = structuredClone(db.snapshot()[P]);
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "historial_no_confirmado", causa: "colision" });
    expect(db.updates()).toHaveLength(0);
    expect(db.snapshot()[P]).toEqual(antes);
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/revisiones/") || k.includes("/eventos/"))).toHaveLength(0);
  });

  it("INCONSISTENCIA (puntero a una revisión inexistente): 500 {historial_no_confirmado, inconsistencia}; NO se escribió nada", async () => {
    const doc = docProyectoM1() as { phases: { exploracion: Record<string, unknown> } };
    doc.phases.exploracion.revision = { n: 5, huella: "x", por: "u1", en: "t" };
    sembrar(doc);
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "historial_no_confirmado", causa: "inconsistencia" });
    expect(db.updates()).toHaveLength(0);
  });

  it("un error que NO es del historial sale tal cual (no se disfraza)", async () => {
    db.failUpdateOn(P);
    await expect(POST(req())).rejects.toThrow();
  });

  it("el log de servidor no lleva contenido ni uid", async () => {
    db.seed(`${P}/versiones/f2M1__000001`, { x: 1 });
    await POST(req());
    const logs = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logs).toContain("m1-approve");
    expect(logs).not.toContain("u1");
    expect(logs).not.toContain("narrativa");
  });
});
