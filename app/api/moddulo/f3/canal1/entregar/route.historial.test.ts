// C3a-1 — HISTORIAL de canal1/entregar: la reentrega y la primera entrega dejan versiones en el historial
// unificado, en la MISMA transacción. Mock con rechazo de `undefined` y transacciones atómicas.
// Límites: sin emulador de Firestore (Java 17): no se prueban aislamiento real ni reintentos; los conteos son del
// mock; la carrera/colisión se simula sembrando el documento que chocaría.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb(), adminStorage: createMockAdminStorage() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/moddulo/project")>()),
  getProject: vi.fn(),
}));
vi.mock("@/lib/moddulo/attachments", () => ({ extractTextPerFile: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject, normalizeTareaPIP, type LegacyTareaPIP } from "@/lib/moddulo/project";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { consolidarSemilla, registrarEnSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";
import {
  estadoAsignacion, estadoResultado, nombreAsignacion, nombreResultado, vivoAsignacion, vivoResultado,
} from "@/lib/moddulo/versionado/artefactosF3";
import type { AsignacionCanal } from "@/types/moddulo.types";
import {
  UID, PROJECT_ID, SESION_ID, OWN_PATH, RESULTADO_PREVIO,
  rutaProyecto, rutaSesion, rutaResultado, proyectoDoc, sesionDoc, comoProject,
} from "./siembraEntregar";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;

const peticion = () =>
  new Request("http://localhost/api/moddulo/f3/canal1/entregar", {
    method: "POST",
    body: JSON.stringify({ projectId: PROJECT_ID, sesionId: SESION_ID, storagePath: OWN_PATH }),
  }) as unknown as Parameters<typeof POST>[0];

const ENTREGADA = { entregaCanal1: { fecha: "2026-01-01", resultadoId: RESULTADO_PREVIO } };
const DOC_VIVO = {
  moduloPIP: "¿Test?",
  origen: { sourceKind: "T10", componente: "centinela", analisisId: RESULTADO_PREVIO, fechaEntrega: "2026-01-01T00:00:00.000Z" },
  cobertura: { completa: true },
  payload: { archivoUrl: "moddulo/uidA/projA/f3/res0/fontana-contexto.json", extractoTexto: "texto anterior" },
  createdAt: "TS-ANTERIOR",
};
const DOC_APROBADO = { ...DOC_VIVO, aprobado: true, notasUsuario: "lo revisé" };
const ASIG_RECIBIDA = { estado: "recibido", resultadoId: RESULTADO_PREVIO };

type Doc = Record<string, unknown>;
const snap = () => db.snapshot() as Record<string, Doc>;
const bajo = (prefijo: string) => Object.entries(snap()).filter(([k]) => k.startsWith(`${rutaProyecto}/${prefijo}/`));
type Version = Doc & { id: string; n: number; contenido?: unknown; aprobacion?: unknown; deriva?: boolean; tipoCambio?: string };
const versiones = (): Version[] => bajo("versiones").map(([k, v]) => ({ id: k.split("/").pop() as string, ...v }) as Version);
const eventos = () => bajo("eventos").map(([, v]) => v);
const revisiones = () => bajo("revisiones").map(([, v]) => v);
const updatesProyecto = () => db.updates().filter((u) => u.path === rutaProyecto).map((u) => u.data);

/** Siembra el escenario y deja el mock en modo estricto (sin undefined, atómico). */
function sembrar(opts: { asig?: Record<string, unknown>; sesion?: Record<string, unknown>; resultadoVivo?: Doc | null } = {}) {
  const proyecto = proyectoDoc(opts.asig ?? {});
  const docs: Record<string, unknown> = { [rutaProyecto]: proyecto, [rutaSesion]: sesionDoc(opts.sesion ?? {}) };
  if (opts.resultadoVivo) docs[rutaResultado(RESULTADO_PREVIO)] = opts.resultadoVivo;
  db.reset(docs);
  db.rechazarUndefined(true);
  db.atomico(true);
  vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
}

/**
 * La asignación TAL COMO la ve la ruta (leída del documento CRUDO y normalizada con `normalizeTareaPIP`, que
 * recalcula `estadoApp`): es el estado con el que cualquier escritor registrado construye su artefacto.
 */
const asigViva = (): AsignacionCanal =>
  normalizeTareaPIP(snap()[rutaProyecto] && ((snap()[rutaProyecto] as { phases: { investigacion: { f3TareasPIP: LegacyTareaPIP[] } } }).phases.investigacion.f3TareasPIP[0]))
    .asignaciones[0];

/** Deja registrado en el historial el estado «aprobado» (como lo dejaría resultados/aprobar) y consolida. */
async function sembrarAprobadoRegistrado(derivarDespues?: Record<string, unknown>) {
  sembrar({ asig: ASIG_RECIBIDA, sesion: ENTREGADA, resultadoVivo: DOC_APROBADO });
  await registrarEnSemilla(db, rutaProyecto, [
    {
      artefacto: nombreResultado(RESULTADO_PREVIO),
      ...estadoResultado(DOC_APROBADO, { por: UID, en: "2026-11-01T10:00:00Z", huella: "h" }),
      vivo: vivoResultado(DOC_APROBADO),
    },
    { artefacto: nombreAsignacion("asig1"), ...estadoAsignacion(asigViva()), vivo: vivoAsignacion(asigViva()) },
  ]);
  consolidarSemilla(db, rutaProyecto);
  if (derivarDespues) {
    // un escritor que NO registra historial (p. ej. tareas/aprobar) cambia la asignación DESPUÉS del registro
    const p = structuredClone(snap()[rutaProyecto]) as { phases: { investigacion: { f3TareasPIP: Array<{ asignaciones: Array<Record<string, unknown>> }> } } };
    Object.assign(p.phases.investigacion.f3TareasPIP[0].asignaciones[0], derivarDespues);
    db.reset({ ...snap(), [rutaProyecto]: p });
    db.rechazarUndefined(true);
    db.atomico(true);
  }
  vi.mocked(getProject).mockResolvedValue(comoProject(snap()[rutaProyecto]));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
  vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
});

describe("primera entrega — versión del resultado, sin estado previo", () => {
  it("crea la versión n=1 (tipoCambio «entrega», por = el usuario, sin aprobación), la revisión 1, el evento y el puntero", async () => {
    sembrar();
    const res = await POST(peticion());
    const { resultadoId } = await res.json();
    expect(res.status).toBe(200);

    const v = versiones();
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      id: `f3Resultado:${resultadoId}__000001`, artefacto: `f3Resultado:${resultadoId}`, n: 1, tipoCambio: "entrega", por: UID,
      fase: "investigacion", ambito: "moddulo", estado: "vigente",
    });
    expect(v[0].aprobacion).toBeUndefined();
    expect(v[0].deriva).toBeUndefined();
    expect(revisiones()).toHaveLength(1);
    expect(eventos()).toHaveLength(1);
    expect(eventos()[0]).toMatchObject({ tipo: "entrega", por: UID, artefactos: [`f3Resultado:${resultadoId}`] });
    // el contenido guardado es el del resultado sin lo volátil
    expect((v[0].contenido as Doc).createdAt).toBeUndefined();
    expect((v[0].contenido as Doc).payload).toMatchObject({ archivoUrl: OWN_PATH });
    // el puntero es lo ÚNICO que se escribe en el proyecto: ni tablero ni updatedAt
    expect(updatesProyecto()).toEqual([{ "phases.investigacion.revision": expect.objectContaining({ n: 1, por: UID }) }]);
  });
});

describe("reentrega — la versión previa conserva lo que la persona tenía (estadoPrevio)", () => {
  it("de un resultado APROBADO sin historial: la previa conserva aprobado/notas (por null) y la nueva queda SIN aprobar; la asignación también", async () => {
    sembrar({ asig: ASIG_RECIBIDA, sesion: ENTREGADA, resultadoVivo: DOC_APROBADO });
    const res = await POST(peticion());
    expect(res.status).toBe(200);

    const porId: Record<string, Version> = Object.fromEntries(versiones().map((x) => [x.id, x]));
    const nr = nombreResultado(RESULTADO_PREVIO);
    const na = nombreAsignacion("asig1");
    expect(Object.keys(porId).sort()).toEqual([`${na}__000001`, `${na}__000002`, `${nr}__000001`, `${nr}__000002`].sort());

    // resultado: previa (aprobada, sin autoría) → nueva (sin aprobación)
    expect(porId[`${nr}__000001`]).toMatchObject({
      tipoCambio: "previo_sin_historial", por: null, en: null, estado: "reemplazada",
      aprobacion: { aprobado: true, por: null, en: null, notas: "lo revisé" },
    });
    expect((porId[`${nr}__000001`].contenido as Doc).payload).toMatchObject({ extractoTexto: "texto anterior" });
    expect(porId[`${nr}__000001`].deriva).toBeUndefined();
    expect(porId[`${nr}__000002`]).toMatchObject({ tipoCambio: "reentrega", por: UID });
    expect(porId[`${nr}__000002`].aprobacion).toBeUndefined();

    // asignación: previa (recibido + resultadoId) → nueva (en_curso, SIN resultadoId)
    expect(porId[`${na}__000001`]).toMatchObject({ tipoCambio: "previo_sin_historial", por: null });
    expect(porId[`${na}__000001`].contenido).toMatchObject({ estado: "recibido", resultadoId: RESULTADO_PREVIO });
    expect(porId[`${na}__000002`]).toMatchObject({ tipoCambio: "reentrega", por: UID });
    expect((porId[`${na}__000002`].contenido as Doc).estado).toBe("en_curso");
    expect((porId[`${na}__000002`].contenido as Doc).resultadoId).toBeUndefined();

    // el documento vivo se reescribe como siempre (sin aprobado ni sello): la aprobación anterior quedó SOLO en su versión
    const vivo = snap()[rutaResultado(RESULTADO_PREVIO)];
    expect(vivo.aprobado).toBeUndefined();
    expect(Object.keys(vivo).sort()).toEqual(["cobertura", "createdAt", "moduloPIP", "origen", "payload"]); // la forma de siempre, sin campos nuevos
    expect(eventos()[0]).toMatchObject({ tipo: "reentrega", artefactos: [nr, na] });
  });

  it("de un resultado SIN aprobar y sin historial: previa + nueva del resultado; la asignación NO se versiona (no cambió)", async () => {
    sembrar({ sesion: ENTREGADA, resultadoVivo: DOC_VIVO });
    const res = await POST(peticion());
    expect(res.status).toBe(200);
    const ids = versiones().map((x) => x.id).sort();
    expect(ids).toEqual([`${nombreResultado(RESULTADO_PREVIO)}__000001`, `${nombreResultado(RESULTADO_PREVIO)}__000002`]);
    const previa = versiones().find((x) => x.n === 1);
    expect(previa?.aprobacion).toBeUndefined();
    expect(previa?.tipoCambio).toBe("previo_sin_historial");
  });
});

describe("sello y deriva — la aprobación registrada NO produce falsa deriva; un cambio no registrado produce UNA", () => {
  it("aprobar (registrado) y luego entregar → CERO deriva: una versión nueva por artefacto", async () => {
    await sembrarAprobadoRegistrado();
    const res = await POST(peticion());
    expect(res.status).toBe(200);
    const v = versiones();
    expect(v.filter((x) => x.deriva === true)).toHaveLength(0);
    expect(v.map((x) => x.id).sort()).toEqual([
      `${nombreAsignacion("asig1")}__000001`, `${nombreAsignacion("asig1")}__000002`,
      `${nombreResultado(RESULTADO_PREVIO)}__000001`, `${nombreResultado(RESULTADO_PREVIO)}__000002`,
    ]);
    // la versión 1 del resultado sigue siendo la APROBADA CON SELLO (no se perdió ni se duplicó)
    expect(v.find((x) => x.id === `${nombreResultado(RESULTADO_PREVIO)}__000001`)?.aprobacion).toMatchObject({
      aprobado: true, por: UID, en: "2026-11-01T10:00:00Z", huella: "h",
    });
    expect(eventos().every((e) => (e as Doc).artefactosConDeriva === undefined)).toBe(true);
  });

  it("aprobar (registrado), un cambio NO registrado de la asignación (p. ej. tareas/aprobar la desactiva) y entregar → UNA versión de deriva", async () => {
    await sembrarAprobadoRegistrado({ activada: false });
    const res = await POST(peticion());
    expect(res.status).toBe(200);
    const na = nombreAsignacion("asig1");
    const deriva = versiones().filter((x) => x.deriva === true);
    expect(deriva).toHaveLength(1);
    expect(deriva[0]).toMatchObject({ id: `${na}__000002`, tipoCambio: "previo_sin_historial", por: null });
    expect(deriva[0].contenido).toMatchObject({ activada: false, estado: "recibido" });
    // y luego la versión nueva (en_curso)
    expect(versiones().find((x) => x.id === `${na}__000003`)).toMatchObject({ tipoCambio: "reentrega", por: UID });
    // el evento lista el artefacto con deriva; el resultado NO derivó
    const ultimo = eventos().find((e) => (e as Doc).artefactosConDeriva) as Doc;
    expect(ultimo.artefactosConDeriva).toEqual([na]);
  });
});

describe("errores del historial — JSON claro, sin dejar nada escrito", () => {
  it("colisión (puntero desfasado: ya existe la revisión siguiente) → 409 historial_no_confirmado/colision y CERO escrituras", async () => {
    await sembrarAprobadoRegistrado();
    db.reset({ ...snap(), [`${rutaProyecto}/revisiones/investigacion_000002`]: { n: 2, fase: "investigacion" } });
    db.rechazarUndefined(true);
    db.atomico(true);
    const antes = JSON.stringify(snap());
    const res = await POST(peticion());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "historial_no_confirmado", causa: "colision",
      message: "No se pudo CONFIRMAR el registro del historial. No se guardó nada; vuelve a intentarlo.",
    });
    expect(JSON.stringify(snap())).toBe(antes);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("canal1/entregar"));
  });

  it("inconsistencia (el puntero apunta a una revisión que no existe) → 500 historial_no_confirmado/inconsistencia y CERO escrituras", async () => {
    sembrar({ sesion: ENTREGADA, resultadoVivo: DOC_VIVO });
    const proyecto = snap()[rutaProyecto] as { phases: { investigacion: Record<string, unknown> } };
    proyecto.phases.investigacion.revision = { n: 5, huella: "x", por: "uidA", en: "TS" };
    db.reset({ ...snap(), [rutaProyecto]: proyecto });
    db.rechazarUndefined(true);
    db.atomico(true);
    const antes = JSON.stringify(snap());
    const res = await POST(peticion());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "historial_no_confirmado", causa: "inconsistencia",
      message: "No se pudo CONFIRMAR el registro del historial. No se guardó nada. Si vuelve a pasar, no insistas: hay que revisarlo.",
    });
    expect(JSON.stringify(snap())).toBe(antes);
    const log = vi.mocked(console.error).mock.calls.map((c) => String(c[0])).join("\n");
    expect(log).toContain("HistorialInconsistenteError");
    expect(log).not.toContain(UID);
  });
});

describe("puntero — no se solapa con las rutas que la ruta ya escribe", () => {
  it("las claves de UN mismo update del proyecto no son prefijo unas de otras (Firestore rechaza `specified multiple times`)", async () => {
    sembrar({ asig: ASIG_RECIBIDA, sesion: ENTREGADA, resultadoVivo: DOC_APROBADO });
    await POST(peticion());
    const updates = updatesProyecto();
    expect(updates).toHaveLength(1);
    const claves = Object.keys(updates[0]);
    expect(claves.sort()).toEqual(["phases.investigacion.f3TareasPIP", "phases.investigacion.revision", "updatedAt"]);
    for (const a of claves) for (const b of claves) if (a !== b) expect(b.startsWith(`${a}.`)).toBe(false);
  });
});
