// C3b — la reentrega sobre un resultado APROBADO pregunta antes de pisarlo (409 `reemplazo_requiere_confirmacion`),
// con la huella del estado actual releído DENTRO de la transacción. Sin emulador de Firestore (Java 17): la carrera
// se simula cambiando el documento entre la pregunta y la confirmación; los conteos son del mock.

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

const peticion = (extra: Record<string, unknown> = {}, base: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/moddulo/f3/canal1/entregar", {
    method: "POST",
    body: JSON.stringify({ projectId: PROJECT_ID, sesionId: SESION_ID, storagePath: OWN_PATH, ...base, ...extra }),
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
const versiones = () => bajo("versiones").map(([k, v]) => ({ id: k.split("/").pop() as string, ...v }) as Doc & { id: string });

function sembrar(opts: { asig?: Doc; sesion?: Doc; resultadoVivo?: Doc | null; proyectoExtra?: Doc } = {}) {
  const proyecto = proyectoDoc(opts.asig ?? {}, opts.proyectoExtra ?? {});
  const docs: Record<string, unknown> = { [rutaProyecto]: proyecto, [rutaSesion]: sesionDoc(opts.sesion ?? {}) };
  if (opts.resultadoVivo) docs[rutaResultado(RESULTADO_PREVIO)] = opts.resultadoVivo;
  db.reset(docs);
  db.rechazarUndefined(true);
  db.atomico(true);
  vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
}

const asigViva = (): AsignacionCanal =>
  normalizeTareaPIP(
    (snap()[rutaProyecto] as { phases: { investigacion: { f3TareasPIP: LegacyTareaPIP[] } } }).phases.investigacion.f3TareasPIP[0]
  ).asignaciones[0];

/** Deja un resultado APROBADO con su sello en el historial, como lo dejaría resultados/aprobar. */
async function sembrarAprobadoConHistorial(sello: { por: string | null; en: string | null }) {
  sembrar({ asig: ASIG_RECIBIDA, sesion: ENTREGADA, resultadoVivo: DOC_APROBADO });
  await registrarEnSemilla(db, rutaProyecto, [
    {
      artefacto: nombreResultado(RESULTADO_PREVIO),
      ...estadoResultado(DOC_APROBADO, { por: sello.por, en: sello.en, huella: "h" } as never),
      vivo: vivoResultado(DOC_APROBADO),
    },
    { artefacto: nombreAsignacion("asig1"), ...estadoAsignacion(asigViva()), vivo: vivoAsignacion(asigViva()) },
  ]);
  consolidarSemilla(db, rutaProyecto);
  vi.mocked(getProject).mockResolvedValue(comoProject(snap()[rutaProyecto]));
}

async function preguntar() {
  const res = await POST(peticion());
  return { status: res.status, cuerpo: (await res.json()) as { error?: string; lineas?: string[]; huella?: string; huellaVencida?: boolean } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
  vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
});

describe("reentrega sobre un resultado APROBADO — la ruta pregunta y NO escribe", () => {
  it("responde 409 con el código de reemplazo, líneas y huella, sin escribir NADA (ni historial)", async () => {
    await sembrarAprobadoConHistorial({ por: UID, en: "2026-11-13T03:30:00.000Z" });
    const antes = structuredClone(snap());
    const c0 = db.contadores();
    const { status, cuerpo } = await preguntar();
    const c1 = db.contadores();
    expect(status).toBe(409);
    expect(cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(cuerpo.huella).toEqual(expect.any(String));
    expect(cuerpo.lineas?.length).toBeGreaterThanOrEqual(4);
    expect(cuerpo.huellaVencida).toBeUndefined();
    expect(c1.escrituras - c0.escrituras).toBe(0);
    expect(c1.borrados - c0.borrados).toBe(0);
    expect(snap()).toEqual(antes); // el resultado sigue aprobado y no hay versiones ni eventos nuevos
  });

  it("las líneas son solo hechos: fecha en hora de México, nada de uid, ni de «volver a la anterior»", async () => {
    await sembrarAprobadoConHistorial({ por: UID, en: "2026-11-13T03:30:00.000Z" });
    const { cuerpo } = await preguntar();
    const texto = (cuerpo.lineas ?? []).join(" | ");
    expect(texto).toContain("desde el 12 de noviembre de 2026"); // 03:30 UTC del 13 = 21:30 del 12 en la Ciudad de México
    expect(texto).toContain("En curso");
    expect(texto).toContain("M2 · Resultados recibidos");
    expect(texto).not.toContain(UID);
    expect(texto.toLowerCase()).not.toContain("volver a la anterior");
    expect(texto).not.toContain("restaurar");
  });

  it("sin sello en el historial (aprobación anterior al historial): «sin autoría registrada»", async () => {
    await sembrarAprobadoConHistorial({ por: null, en: null });
    const { cuerpo } = await preguntar();
    expect((cuerpo.lineas ?? [])[0]).toContain("sin autoría registrada");
  });

  it("sin historial alguno (sin puntero): «sin autoría registrada» y también pregunta", async () => {
    sembrar({ asig: ASIG_RECIBIDA, sesion: ENTREGADA, resultadoVivo: DOC_APROBADO });
    const { status, cuerpo } = await preguntar();
    expect(status).toBe(409);
    expect((cuerpo.lineas ?? [])[0]).toContain("sin autoría registrada");
  });

  it("COSTO del camino que pregunta: solo lecturas (0 escrituras, 0 borrados)", async () => {
    await sembrarAprobadoConHistorial({ por: UID, en: "2026-11-13T03:30:00.000Z" });
    const c0 = db.contadores();
    await preguntar();
    const c1 = db.contadores();
    // sesión (fuera) + sesión, proyecto y resultado (tx) + revisión vigente y versión (sello) = 6 lecturas.
    expect({ lecturas: c1.lecturas - c0.lecturas, escrituras: c1.escrituras - c0.escrituras, borrados: c1.borrados - c0.borrados }).toEqual({
      lecturas: 6, escrituras: 0, borrados: 0,
    });
  });
});

describe("confirmación", () => {
  it("con la huella de la respuesta 409: procede como hoy (resultado sin aprobar, asignación en curso, aprobación anterior guardada)", async () => {
    await sembrarAprobadoConHistorial({ por: UID, en: "2026-11-13T03:30:00.000Z" });
    const { cuerpo } = await preguntar();
    const res = await POST(peticion({ confirmarReemplazo: true, huella: cuerpo.huella }));
    expect(res.status).toBe(200);
    const doc = snap()[rutaResultado(RESULTADO_PREVIO)];
    expect(doc.aprobado).toBeUndefined();
    expect(doc.notasUsuario).toBeUndefined();
    const tablero = snap()[rutaProyecto]["phases.investigacion.f3TareasPIP"] as Array<{ asignaciones: Doc[] }>;
    expect(tablero[0].asignaciones[0]).toMatchObject({ asignacionId: "asig1", estado: "en_curso" });
    expect(tablero[0].asignaciones[0].resultadoId).toBeUndefined();
    // La aprobación anterior queda en SU versión (n=1 del resultado, con el sello) y la nueva es la n=2.
    const delResultado = versiones().filter((v) => v.id.startsWith("f3Resultado:"));
    expect(delResultado.length).toBe(2);
    const aprobada = delResultado.find((v) => (v.aprobacion as { aprobado?: boolean } | undefined)?.aprobado === true);
    expect(aprobada?.aprobacion).toMatchObject({ aprobado: true, por: UID, en: "2026-11-13T03:30:00.000Z", notas: "lo revisé" });
  });

  it("carrera de huella: algo cambia entre el aviso y la confirmación → OTRO 409 con la huella NUEVA (y huellaVencida)", async () => {
    await sembrarAprobadoConHistorial({ por: UID, en: "2026-11-13T03:30:00.000Z" });
    const { cuerpo: primero } = await preguntar();
    // otra pestaña retira la aprobación y vuelve a aprobar con OTRAS notas (lo que resultados/aprobar escribiría)
    const vivo = structuredClone(snap()[rutaResultado(RESULTADO_PREVIO)]);
    db.reset({ ...snap(), [rutaResultado(RESULTADO_PREVIO)]: { ...vivo, notasUsuario: "otras notas" } });
    db.rechazarUndefined(true);
    db.atomico(true);
    const res = await POST(peticion({ confirmarReemplazo: true, huella: primero.huella }));
    const segundo = await res.json();
    expect(res.status).toBe(409);
    expect(segundo.error).toBe("reemplazo_requiere_confirmacion");
    expect(segundo.huella).not.toBe(primero.huella);
    expect(segundo.huellaVencida).toBe(true);
    expect(snap()[rutaResultado(RESULTADO_PREVIO)].aprobado).toBe(true); // nada se escribió
    // con la huella NUEVA sí procede
    const ok = await POST(peticion({ confirmarReemplazo: true, huella: segundo.huella }));
    expect(ok.status).toBe(200);
  });

  it("confirma, pero el resultado ya NO está aprobado (otra pestaña lo retiró): no hay nada que perder, procede", async () => {
    await sembrarAprobadoConHistorial({ por: UID, en: "2026-11-13T03:30:00.000Z" });
    const { cuerpo } = await preguntar();
    const vivo = structuredClone(snap()[rutaResultado(RESULTADO_PREVIO)]);
    delete vivo.aprobado;
    delete vivo.notasUsuario;
    db.reset({ ...snap(), [rutaResultado(RESULTADO_PREVIO)]: vivo });
    db.rechazarUndefined(true);
    db.atomico(true);
    const res = await POST(peticion({ confirmarReemplazo: true, huella: cuerpo.huella }));
    expect(res.status).toBe(200);
  });

  it.each([
    ["confirmarReemplazo true sin huella", { confirmarReemplazo: true }],
    ["huella numérica (malformada)", { confirmarReemplazo: true, huella: 12345 }],
    ["huella vacía", { confirmarReemplazo: true, huella: "" }],
    ["huella que no coincide", { confirmarReemplazo: true, huella: "no-es-la-huella" }],
    ["confirmarReemplazo como texto", { confirmarReemplazo: "true", huella: "x" }],
    ["huella correcta pero SIN confirmarReemplazo", { huella: "x" }],
  ])("%s → «no confirmado» (409), nunca 400", async (_n, extra) => {
    await sembrarAprobadoConHistorial({ por: UID, en: "2026-11-13T03:30:00.000Z" });
    const antes = structuredClone(snap());
    const res = await POST(peticion(extra));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("reemplazo_requiere_confirmacion");
    expect(snap()).toEqual(antes);
  });
});

describe("sin pregunta", () => {
  it("resultado NO aprobado: comportamiento actual, 200 sin pedir confirmación", async () => {
    sembrar({ sesion: ENTREGADA, resultadoVivo: DOC_VIVO });
    const res = await POST(peticion());
    expect(res.status).toBe(200);
  });

  it("primera entrega: 200 sin pedir confirmación", async () => {
    sembrar();
    const res = await POST(peticion());
    expect(res.status).toBe(200);
  });
});

describe("orden: el 409 va DESPUÉS de las validaciones que devuelven 404/400 (sobre un resultado aprobado)", () => {
  const sembrarAprobado = (opts: { asig?: Doc; sesion?: Doc; proyectoExtra?: Doc } = {}) =>
    sembrar({ asig: opts.asig ?? ASIG_RECIBIDA, sesion: opts.sesion ?? ENTREGADA, resultadoVivo: DOC_APROBADO, proyectoExtra: opts.proyectoExtra });

  it("sesión de otro usuario → 404", async () => {
    sembrarAprobado({ sesion: { ...ENTREGADA, uid: "otro" } });
    expect((await POST(peticion())).status).toBe(404);
  });

  it("sesión no vinculada a este proyecto → 404", async () => {
    sembrarAprobado({ sesion: { ...ENTREGADA, modduloProjectId: "otroProyecto" } });
    expect((await POST(peticion())).status).toBe(404);
  });

  it("sesión sin tarea PIP → 400", async () => {
    sembrarAprobado({ sesion: { ...ENTREGADA, tareaPipIds: [] } });
    expect((await POST(peticion())).status).toBe(400);
  });

  it("proyecto no encontrado (getProject) → 404", async () => {
    sembrarAprobado();
    vi.mocked(getProject).mockResolvedValue(null);
    expect((await POST(peticion())).status).toBe(404);
  });

  it("proyecto en la papelera a mitad (dentro de la transacción) → 404", async () => {
    sembrarAprobado({ proyectoExtra: { deletedAt: "2026-11-15" } });
    expect((await POST(peticion())).status).toBe(404);
  });

  it("asignación Canal 1 ausente del tablero → 404", async () => {
    sembrarAprobado();
    const sinAsig = proyectoDoc(ASIG_RECIBIDA);
    sinAsig.phases.investigacion.f3TareasPIP[0].asignaciones = [];
    db.reset({ ...snap(), [rutaProyecto]: sinAsig });
    db.rechazarUndefined(true);
    db.atomico(true);
    vi.mocked(getProject).mockResolvedValue(comoProject(sinAsig));
    expect((await POST(peticion())).status).toBe(404);
  });

  it("storagePath ajeno → 403", async () => {
    sembrarAprobado();
    expect((await POST(peticion({ storagePath: `moddulo/otro/${PROJECT_ID}/x.json` }))).status).toBe(403);
  });
});
