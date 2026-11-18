// C1b-2 — HISTORIAL de unlink-pestel: desvincular un M1 (o los restos de uno) deja versiones de `f2M1` en la MISMA
// transacción: la previa (solo la primera vez) con TODO lo que se pierde y la nueva «sin M1» (`kind: null`) con la
// constancia `aprobacion {aprobado:false, por, en}`. El proyecto se siembra con `Timestamp` REALES (fixture
// `m1SiembraT22`; en C1b-1 se sembraban textos). Mock con rechazo de `undefined` y transacciones atómicas. Sin emulador
// (Java 17): conteos y todo-o-nada son del mock. Desvincular NO llama al modelo.

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
import { docProyectoT22, INSTANTE_APROBACION, type OpcionesT22 } from "@/lib/moddulo/__tests__/fixtures/m1SiembraT22";
import { huellaDe, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";
import { huellaContenido } from "@/lib/versionado/huella";
import { vivoF2M1 } from "@/lib/moddulo/versionado/artefactosF2";
import {
  clonar, consolidarF2, eventosDe, exploracionDe, registrarVigenteF2, revisionesDe, versionesDe,
} from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const PEST = "pestel_projects/pest1";
const M = mapaM1();
const H = huellaDe(M);
const ISO = INSTANTE_APROBACION.toISOString();
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...o }) }) as never;

function sembrar(doc: unknown, conBacklink = true) {
  db.reset({
    [P]: clonar(doc),
    ...(conBacklink ? { [PEST]: { userId: "u1", modduloProjectId: "p1" } } : {}),
  });
  db.rechazarUndefined(true);
  db.atomico(true);
}
const t22 = (o: OpcionesT22 = {}) =>
  docProyectoT22({ draftDVS: { hei: { tensionCentral: "TEXTO-DEL-BORRADOR-SECRETO" } }, motorAprobaciones: { M2: true, M3: true }, dvs: { final: 1 }, ...o });
async function pedirHuella() {
  const r = await POST(req());
  expect(r.status).toBe(409);
  return ((await r.json()) as { huella: string }).huella;
}
const desvincularConfirmando = async () => POST(req({ confirmar: true, huella: await pedirHuella() }));
const sinHistorial = () => {
  expect(db.updates()).toHaveLength(0);
  for (const sub of ["versiones", "revisiones", "eventos"]) {
    expect(Object.keys(db.snapshot()).filter((k) => k.startsWith(`${P}/${sub}/`))).toHaveLength(0);
  }
};
const hayHistorial = () => Object.keys(db.snapshot()).some((k) => k.startsWith(`${P}/versiones/`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  sembrar(t22());
});

describe("fixture: marcas de tiempo REALES (la lección de C1b-1)", () => {
  it("el valor sembrado es un Timestamp de Firestore, no un texto ni un objeto plano", () => {
    const exp = exploracionDe(db, P) as unknown as { m1: { aprobacion: { en: unknown }; creadoEn: unknown; generacion: { en: unknown }; finalizacion: { en: unknown } } };
    for (const v of [exp.m1.aprobacion.en, exp.m1.creadoEn, exp.m1.generacion.en, exp.m1.finalizacion.en]) expect(v).toBeInstanceOf(Timestamp);
    sembrar(t22({ conEdiciones: true }));
    const ed = (exploracionDe(db, P) as unknown as { m1: { ediciones: Record<string, { en: unknown }> } }).m1.ediciones["P.narrativa"].en;
    expect(ed).toBeInstanceOf(Timestamp);
  });
});

describe("desvincular — versiones de f2M1", () => {
  it("SIN historial: la previa guarda TODO lo que se pierde (aprobación con autor y fecha, mapa); la nueva es «sin M1» con constancia", async () => {
    expect((await desvincularConfirmando()).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002"]);

    expect(v[0]).toMatchObject({ tipoCambio: "previo_sin_historial", por: null, estado: "reemplazada" });
    expect(v[0].aprobacion).toEqual({ aprobado: true, por: "u1", en: ISO, huella: H, categoriasEditadas: 2, total: 6 });
    expect(v[0].aprobacion).not.toHaveProperty("mapa");
    expect(v[0].contenido).toEqual({ kind: "T22", mapa: M, ediciones: {} });

    expect(v[1]).toMatchObject({ tipoCambio: "ajuste_manual", por: "u1", motivo: "desvinculacion" });
    expect(v[1].contenido).toEqual({ kind: null, mapa: null, ediciones: {} });
    expect(v[1].aprobacion).toEqual({ aprobado: false, por: "u1", en: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) });

    expect(revisionesDe(db, P).map((r) => r.id)).toEqual(["exploracion_000001"]);
    const ev = eventosDe(db, P);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ tipo: "ajuste_manual", motivo: "desvinculacion", fase: "exploracion", ambito: "moddulo", artefactos: ["f2M1"], por: "u1", fuente: "usuario" });
  });

  it("CON historial vigente: solo la versión nueva; la aprobación anterior queda en SU versión; sin deriva", async () => {
    await registrarVigenteF2(db, P);
    expect(versionesDe(db, P)).toHaveLength(1);
    expect((await desvincularConfirmando()).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => `${x.id}:${x.tipoCambio}`)).toEqual(["f2M1__000001:ajuste_manual", "f2M1__000002:ajuste_manual"]);
    expect(v[0].aprobacion).toMatchObject({ aprobado: true, por: "u1", en: ISO });
    expect(v[1]).toMatchObject({ motivo: "desvinculacion", contenido: { kind: null, mapa: null, ediciones: {} } });
    expect(v.some((x) => x.deriva)).toBe(false);
  });

  it("[deriva real] un escritor del M1 SIN historial (p. ej. import-pestel) mueve la proyección: versión de deriva + evento", async () => {
    await registrarVigenteF2(db, P);
    const doc = clonar(db.snapshot()[P]) as { phases: { exploracion: { m1: Record<string, unknown> } } };
    doc.phases.exploracion.m1.ediciones = { "P.narrativa": { original: "IA P", editado: "x", por: "u9", en: Timestamp.fromDate(new Date("2026-11-11T00:00:00.000Z")) } };
    db.seed(P, doc);
    expect((await desvincularConfirmando()).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002", "f2M1__000003"]);
    expect(v[1]).toMatchObject({ tipoCambio: "previo_sin_historial", deriva: true, por: null });
    expect(eventosDe(db, P).at(-1)).toMatchObject({ artefactosConDeriva: ["f2M1"] });
  });

  it("[ediciones con Timestamp] un M1 que vino de express y tiene ediciones[].en como Timestamp: se versiona sin lanzar y la huella es estable", async () => {
    sembrar(t22({ conEdiciones: true }));
    expect((await desvincularConfirmando()).status).toBe(200);
    const previa = versionesDe(db, P)[0];
    expect(Object.keys(previa.contenido?.ediciones as object)).toEqual(["P.narrativa"]);
    expect(typeof previa.huella).toBe("string");
    sembrar(t22({ conEdiciones: true }));
    await desvincularConfirmando();
    expect(versionesDe(db, P)[0].huella).toBe(previa.huella);
  });

  it("[aprobación obsoleta] el payload cambió después de aprobar: la previa conserva la huella APROBADA y no lanza", async () => {
    const d = t22() as unknown as { phases: { exploracion: { m1: { aprobacion: Record<string, unknown> } } } };
    d.phases.exploracion.m1.aprobacion.huella = "huella-de-otro-contenido";
    sembrar(d);
    expect((await desvincularConfirmando()).status).toBe(200);
    expect(versionesDe(db, P)[0].aprobacion).toMatchObject({ aprobado: true, huella: "huella-de-otro-contenido" });
  });

  it("[sin aprobación] solo borrador y marcas de generación: la previa no trae `aprobacion`; la nueva sí la constancia", async () => {
    sembrar(t22({ sinAprobacion: true }));
    expect((await desvincularConfirmando()).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v[0]).not.toHaveProperty("aprobacion");
    expect(v[1].aprobacion).toMatchObject({ aprobado: false, por: "u1" });
  });

  it("[en inesperado] una aprobación con `en` ilegible NO rompe la transacción: la previa queda con en null", async () => {
    const d = t22() as unknown as { phases: { exploracion: { m1: { aprobacion: Record<string, unknown> } } } };
    d.phases.exploracion.m1.aprobacion.en = { _methodName: "FieldValue.serverTimestamp" };
    sembrar(d);
    expect((await desvincularConfirmando()).status).toBe(200);
    expect(versionesDe(db, P)[0].aprobacion).toMatchObject({ aprobado: true, en: null });
  });

  it("[sin falsa deriva] la proyección viva tras desvincular coincide con la guardada en el manifiesto (la siguiente operación no verá deriva)", async () => {
    await desvincularConfirmando();
    const manifiesto = (revisionesDe(db, P)[0] as unknown as { artefactos: { f2M1: { vivo: string } } }).artefactos.f2M1.vivo;
    consolidarF2(db, P); // aplica las claves con puntos y los borrados como lo deja Firestore real
    expect(exploracionDe(db, P)).not.toHaveProperty("m1");
    expect(exploracionDe(db, P)).not.toHaveProperty("linkedSource");
    expect(huellaContenido(vivoF2M1(exploracionDe(db, P)))).toBe(manifiesto);
  });

  it("el CONTENIDO del borrador de motores no aparece en ninguna versión (H-V28: solo se nombra)", async () => {
    await desvincularConfirmando();
    const todo = JSON.stringify([versionesDe(db, P), revisionesDe(db, P), eventosDe(db, P)]);
    expect(todo).not.toContain("TEXTO-DEL-BORRADOR-SECRETO");
    expect(todo).not.toContain("tensionCentral");
  });
});

describe("desvincular — el evento nombra lo que se descarta (`detalle`)", () => {
  it("con aprobación, motores, borrador y Reporte F2: detalle exacto", async () => {
    await desvincularConfirmando();
    expect(eventosDe(db, P)[0].detalle).toEqual({
      teniaAprobacion: true, categoriasEditadas: 2, totalCategorias: 6,
      motoresAprobadosDescartados: ["M2", "M3"], borradorDescartado: true, reporteF2Conservado: true,
    });
  });

  it("SIN aprobación, sin motores ni borrador ni Reporte F2: ceros y false (el detalle existe igual)", async () => {
    sembrar(t22({ sinAprobacion: true, draftDVS: null, motorAprobaciones: { M2: false }, dvs: null }));
    await desvincularConfirmando();
    expect(eventosDe(db, P)[0].detalle).toEqual({
      teniaAprobacion: false, categoriasEditadas: 0, totalCategorias: 0,
      motoresAprobadosDescartados: [], borradorDescartado: false, reporteF2Conservado: false,
    });
  });

  it("solo booleanos, números y nombres de motor: nunca texto del usuario ni ids de proyecto o de PESTEL", async () => {
    await desvincularConfirmando();
    const d = eventosDe(db, P)[0].detalle as Record<string, unknown>;
    for (const v of Object.values(d)) {
      if (Array.isArray(v)) for (const m of v) expect(m).toMatch(/^M[2-5]$/);
      else expect(["boolean", "number"]).toContain(typeof v);
    }
    const txt = JSON.stringify(d);
    for (const prohibido of ["pest1", "p1", "u1", "a1", "TEXTO-DEL-BORRADOR-SECRETO", "Proyecto T22"]) expect(txt).not.toContain(prohibido);
  });
});

describe("desvincular — el estado vivo y el puntero", () => {
  it("el puntero se CONSERVA (no se borra) y apunta a la revisión escrita; la historia de f2M1 continúa", async () => {
    await desvincularConfirmando();
    const up = db.updates().filter((u) => u.path === P);
    expect(up).toHaveLength(1);
    expect(up[0].data["phases.exploracion.revision"]).toMatchObject({ n: 1, por: "u1" });
    expect(up[0].data["phases.exploracion.revision"]).not.toBe("__DELETE__");
  });

  it("con historial el puntero AVANZA a n+1 (no choca con f2M1__000001)", async () => {
    await registrarVigenteF2(db, P);
    const antes = (exploracionDe(db, P) as unknown as { revision: { n: number } }).revision.n;
    await desvincularConfirmando();
    const up = db.updates().find((u) => u.path === P)!;
    expect((up.data["phases.exploracion.revision"] as { n: number }).n).toBe(antes + 1);
  });

  it("[un solo instante] lastUnlinkedLinkedSource conserva el vínculo completo y lleva desvinculadoEn (Timestamp) = el `en` de la versión nueva", async () => {
    await desvincularConfirmando();
    const up = db.updates().find((u) => u.path === P)!;
    const ls = up.data["phases.exploracion.lastUnlinkedLinkedSource"] as Record<string, unknown>;
    expect(ls).toMatchObject({ kind: "T22", sourceId: "pest1", sourceAnalysisId: "a1", payload: M, huellaFuente: { v: 2, h: "huella-origen" } });
    expect(ls.desvinculadoEn).toBeInstanceOf(Timestamp);
    expect((ls.desvinculadoEn as Timestamp).toDate().toISOString()).toBe((versionesDe(db, P)[1].aprobacion as { en: string }).en);
  });

  it("el back-link de PESTEL se borra en la MISMA transacción (y `dvs` no se toca)", async () => {
    await desvincularConfirmando();
    expect(db.updates().find((u) => u.path === PEST)!.data.modduloProjectId).toBe("__DELETE__");
    expect(db.updates().find((u) => u.path === P)!.data).not.toHaveProperty("phases.exploracion.dvs");
  });
});

describe("desvincular — cuándo se registra: payload, m1, borrador o aprobaciones de motores", () => {
  it("[T22 totalmente vacío] sin payload, sin m1, sin borrador y sin motores: se desvincula SIN versión (y sin puntero), con el instante", async () => {
    sembrar(t22({ sinPayload: true, sinM1: true, draftDVS: null, motorAprobaciones: {}, dvs: null }));
    expect((await desvincularConfirmando()).status).toBe(200);
    expect(hayHistorial()).toBe(false);
    const d = db.updates().find((u) => u.path === P)!.data;
    expect(d).not.toHaveProperty("phases.exploracion.revision");
    expect((d["phases.exploracion.lastUnlinkedLinkedSource"] as { desvinculadoEn: unknown }).desvinculadoEn).toBeInstanceOf(Timestamp);
    expect(d["phases.exploracion.linkedSource"]).toBe("__DELETE__");
  });

  it("[restos de motores SIN M1] sin payload ni m1 pero con borrador y aprobaciones: SÍ se registra y el evento los nombra", async () => {
    sembrar(t22({ sinPayload: true, sinM1: true }));
    expect((await desvincularConfirmando()).status).toBe(200);
    const v = versionesDe(db, P);
    expect(v.map((x) => x.tipoCambio)).toEqual(["previo_sin_historial", "ajuste_manual"]);
    expect(v[0].contenido).toEqual({ kind: "T22", mapa: null, ediciones: {} });
    expect(v[0]).not.toHaveProperty("aprobacion");
    expect(eventosDe(db, P)[0].detalle).toMatchObject({ teniaAprobacion: false, motoresAprobadosDescartados: ["M2", "M3"], borradorDescartado: true });
  });

  it("[solo borrador] sin payload, sin m1 y sin aprobaciones: el borrador basta para registrar", async () => {
    sembrar(t22({ sinPayload: true, sinM1: true, motorAprobaciones: {}, dvs: null }));
    await desvincularConfirmando();
    expect(versionesDe(db, P)).toHaveLength(2);
  });

  it("[solo aprobaciones de motores] sin payload, sin m1 y sin borrador, pero con motorAprobaciones: basta para registrar", async () => {
    sembrar(t22({ sinPayload: true, sinM1: true, draftDVS: null, dvs: null }));
    await desvincularConfirmando();
    expect(versionesDe(db, P)).toHaveLength(2);
  });

  it("[con payload, sin m1] el análisis importado sin revisar se versiona", async () => {
    sembrar(t22({ sinM1: true, draftDVS: null, motorAprobaciones: {}, dvs: null }));
    await desvincularConfirmando();
    expect(versionesDe(db, P)[0].contenido).toMatchObject({ kind: "T22", mapa: M });
  });
});

describe("desvincular — los caminos que NO escriben tampoco dejan historial", () => {
  it("la pregunta H15 (409 reemplazo_requiere_confirmacion) y la huella vencida (409 reemplazo_huella_vencida)", async () => {
    const r = await POST(req());
    expect((await r.json()).error).toBe("reemplazo_requiere_confirmacion");
    const v = await POST(req({ confirmar: true, huella: "equivocada" }));
    expect((await v.json()).error).toBe("reemplazo_huella_vencida");
    sinHistorial();
  });

  it("not_linked, fase_cerrada, 404 y papelera", async () => {
    const sinVinculo = docProyectoT22({ sinPayload: true, sinM1: true }) as { phases: { exploracion: Record<string, unknown> } };
    delete sinVinculo.phases.exploracion.linkedSource;
    sembrar(sinVinculo);
    expect((await (await POST(req())).json()).error).toBe("not_linked");
    sembrar(t22({ status: "completed" }));
    expect((await POST(req())).status).toBe(409);
    sembrar(t22());
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await POST(req())).status).toBe(404);
    vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
    sembrar({ ...(t22() as object), deletedAt: Timestamp.now() });
    expect((await POST(req())).status).toBe(404);
    sinHistorial();
  });

  it("la rama del vínculo PENDIENTE (cancelar) no descarta nada y no deja historial", async () => {
    sembrar({ name: "M", collaborators: [{ uid: "u1", role: "owner" }], phases: { exploracion: { draftDVS: { x: 1 } } } });
    const r = await POST(req({ pestelProjectId: "pest1" }));
    expect(r.status).toBe(200);
    expect((await r.json()).pendienteCancelado).toBe(true);
    for (const sub of ["versiones", "revisiones", "eventos"]) expect(Object.keys(db.snapshot()).filter((k) => k.startsWith(`${P}/${sub}/`))).toHaveLength(0);
    expect(db.updates().some((u) => "phases.exploracion.revision" in u.data)).toBe(false);
  });
});

describe("desvincular — un fallo del historial aborta TODO (nada escrito: ni vínculo, ni M1, ni back-link)", () => {
  it("[colisión] existe f2M1__000001 sin puntero: 409 historial_no_confirmado (causa colision); el estado queda intacto", async () => {
    sembrar(t22());
    db.seed(`${P}/versiones/f2M1__000001`, { ya: "existe" });
    const antes = clonar(db.snapshot());
    const r = await desvincularConfirmando();
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: "historial_no_confirmado", causa: "colision" });
    expect(db.snapshot()).toEqual(antes);
    expect((db.snapshot()[PEST] as { modduloProjectId?: string }).modduloProjectId).toBe("p1"); // el back-link NO se tocó
  });

  it("[inconsistencia] el puntero apunta a una revisión que no existe: 500 historial_no_confirmado (causa inconsistencia); nada escrito", async () => {
    const d = t22() as unknown as { phases: { exploracion: Record<string, unknown> } };
    d.phases.exploracion.revision = { n: 9, huella: "roto", por: "x", en: "t" };
    sembrar(d);
    const antes = clonar(db.snapshot());
    const r = await desvincularConfirmando();
    expect(r.status).toBe(500);
    expect(await r.json()).toMatchObject({ error: "historial_no_confirmado", causa: "inconsistencia" });
    expect(db.snapshot()).toEqual(antes);
    expect(db.updates()).toHaveLength(0);
  });

  it("el log de servidor no lleva contenido ni uids", async () => {
    const d = t22() as unknown as { phases: { exploracion: Record<string, unknown> } };
    d.phases.exploracion.revision = { n: 9, huella: "roto", por: "x", en: "t" };
    sembrar(d);
    await desvincularConfirmando();
    const log = vi.mocked(console.error).mock.calls.map((c) => c.join(" ")).join("\n");
    expect(log).toContain("[historial][unlink-pestel]");
    for (const prohibido of ["u1", "TEXTO-DEL-BORRADOR-SECRETO", "pest1"]) expect(log).not.toContain(prohibido);
  });
});
