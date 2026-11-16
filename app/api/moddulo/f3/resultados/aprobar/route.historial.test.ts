// C3a-2 — HISTORIAL de resultados/aprobar: aprobar y retirar una aprobación dejan versiones en el historial
// unificado, en la MISMA transacción. Mock con rechazo de `undefined` y transacciones atómicas.
// Límites: sin emulador de Firestore (Java 17): no se prueban aislamiento real ni reintentos; los conteos son del
// mock; la colisión/inconsistencia se simula sembrando el documento que chocaría.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async () => ({
  ...(await vi.importActual<typeof import("@/lib/moddulo/project")>("@/lib/moddulo/project")),
  getProject: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb(), adminStorage: createMockAdminStorage() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/moddulo/attachments", () => ({ extractTextPerFile: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject, normalizeTareaPIP, type LegacyTareaPIP } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { POST } from "./route";
import { POST as ENTREGAR } from "../../canal1/entregar/route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { consolidarSemilla, registrarEnSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";
import {
  estadoAsignacion, estadoResultado, nombreAsignacion, nombreResultado, selloDeAprobacion, vivoAsignacion, vivoResultado,
} from "@/lib/moddulo/versionado/artefactosF3";
import { huellaContenido } from "@/lib/versionado/huella";
import type { AsignacionCanal } from "@/types/moddulo.types";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidAprobador";
const P = "moddulo_projects/p1";
const RES = `${P}/f3Resultados/r1`;
const SES = "fontana_sesiones/s1";
const nr = nombreResultado("r1");
const na = nombreAsignacion("a1");

const body = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", {
    method: "POST",
    body: JSON.stringify({ projectId: "p1", resultadoId: "r1", pipItemId: "t1", asignacionId: "a1", aprobado: true, ...o }),
  }) as never;
const bodyEntregar = () =>
  new Request("http://local/x", {
    method: "POST",
    body: JSON.stringify({ projectId: "p1", sesionId: "s1", storagePath: `moddulo/${UID}/p1/f3/r1/f.json` }),
  }) as never;

const DOC_RES = {
  moduloPIP: "¿Pregunta?",
  origen: { sourceKind: "T10", componente: "centinela", analisisId: "r1", fechaEntrega: "2026-01-01T00:00:00.000Z" },
  cobertura: { completa: true },
  payload: { archivoUrl: "moddulo/otroDueno/p1/f3/r1/f.json", extractoTexto: "texto" },
  createdAt: "TS-ANTERIOR",
};
const asignacionCruda = (extra: Record<string, unknown> = {}) => ({
  asignacionId: "a1", tipo: "primaria", canal: "canal1", tecnicaId: "T10", justificacion: "j", estado: "en_curso", activada: true, ...extra,
});
const TABLERO = (extra: Record<string, unknown> = {}) => [{ pipItemId: "t1", asignaciones: [asignacionCruda(extra)] }];

type Doc = Record<string, unknown>;
type Version = Doc & { id: string; n: number; contenido?: Doc; aprobacion?: Doc; deriva?: boolean; tipoCambio?: string; por?: unknown; en?: unknown };
const snap = () => db.snapshot() as Record<string, Doc>;
const bajo = (prefijo: string) => Object.entries(snap()).filter(([k]) => k.startsWith(`${P}/${prefijo}/`));
const versiones = (): Version[] => bajo("versiones").map(([k, v]) => ({ id: k.split("/").pop() as string, ...v }) as Version);
const eventos = () => bajo("eventos").map(([, v]) => v);
const updatesProyecto = () => db.updates().filter((u) => u.path === P).map((u) => u.data);
const asigViva = (): AsignacionCanal =>
  normalizeTareaPIP((snap()[P] as { phases: { investigacion: { f3TareasPIP: LegacyTareaPIP[] } } }).phases.investigacion.f3TareasPIP[0]).asignaciones[0];

function sembrar(opts: { resultado?: Doc; tablero?: unknown[]; extraDocs?: Record<string, unknown> } = {}) {
  const proyecto = { phases: { investigacion: { f3TareasPIP: opts.tablero ?? TABLERO() } } };
  db.reset({ [P]: proyecto, [RES]: opts.resultado ?? DOC_RES, ...(opts.extraDocs ?? {}) });
  db.rechazarUndefined(true);
  db.atomico(true);
  vi.mocked(getProject).mockResolvedValue({
    phases: { investigacion: { f3TareasPIP: (proyecto.phases.investigacion.f3TareasPIP as unknown[]).map((t) => normalizeTareaPIP(t as never)) } },
  } as never);
}

/** Registra en el historial el estado ACTUAL de resultado (y asignación) como lo dejaría una acción previa, y consolida. */
async function registrarVigente(opts: { aprobado?: boolean; conAsignacion?: boolean } = {}) {
  const vivo = snap()[RES];
  const sello = opts.aprobado ? selloDeAprobacion(vivo, UID, "2026-11-01T10:00:00.000Z") : undefined;
  const artefactos = [{ artefacto: nr, ...estadoResultado(vivo, sello), vivo: vivoResultado(vivo) }];
  if (opts.conAsignacion) artefactos.push({ artefacto: na, ...estadoAsignacion(asigViva()), vivo: vivoAsignacion(asigViva()) });
  await registrarEnSemilla(db, P, artefactos);
  consolidarSemilla(db, P);
  vi.mocked(getProject).mockResolvedValue({
    phases: { investigacion: { f3TareasPIP: [] } },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: UID } as never);
  vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
});

describe("aprobar (aprobado:true) — versión del resultado y de la asignación, con su estado previo", () => {
  it("SIN historial: previa del resultado (sin aprobación, por null) + nueva APROBADA con sello; previa de la asignación + nueva recibida", async () => {
    sembrar();
    const res = await POST(body({ notasUsuario: "buena" }));
    expect(res.status).toBe(200);
    const porId: Record<string, Version> = Object.fromEntries(versiones().map((v) => [v.id, v]));
    expect(Object.keys(porId).sort()).toEqual([`${na}__000001`, `${na}__000002`, `${nr}__000001`, `${nr}__000002`]);

    expect(porId[`${nr}__000001`]).toMatchObject({ tipoCambio: "previo_sin_historial", por: null, en: null, estado: "reemplazada" });
    expect(porId[`${nr}__000001`].aprobacion).toBeUndefined();
    const nueva = porId[`${nr}__000002`];
    expect(nueva).toMatchObject({ tipoCambio: "ajuste_manual", por: UID });
    expect(nueva.aprobacion).toMatchObject({ aprobado: true, por: UID, notas: "buena" });
    // `en` es un valor CONCRETO (ISO), no un FieldValue.serverTimestamp(): entra en la tupla y en su huella
    expect(nueva.aprobacion?.en).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(nueva.aprobacion?.en).not.toBe("SERVER_TIMESTAMP");
    expect(nueva.aprobacion?.huella).toBe(huellaContenido(nueva.contenido));

    expect(porId[`${na}__000001`].contenido).toMatchObject({ estado: "en_curso" });
    expect(porId[`${na}__000002`].contenido).toMatchObject({ estado: "recibido", resultadoId: "r1" });
    expect(porId[`${na}__000002`]).toMatchObject({ tipoCambio: "ajuste_manual", por: UID });
    expect(eventos()[0]).toMatchObject({ tipo: "ajuste_manual", motivo: "aprobacion", artefactos: [nr, na] });
  });

  it("el SELLO vive SOLO en la versión: el documento vivo conserva su forma de siempre y no contiene uid, huella ni sello", async () => {
    sembrar();
    await POST(body({ notasUsuario: "buena" }));
    const vivo = snap()[RES];
    expect(vivo).toEqual({ ...DOC_RES, aprobado: true, notasUsuario: "buena" });
    expect(JSON.stringify(vivo)).not.toContain(UID);
    expect(JSON.stringify(vivo)).not.toContain("huella");
    // el proyecto solo lleva el puntero del historial ({n, huella, por, en}): el sello de la aprobación (`aprobacion`) no está
    expect(JSON.stringify(snap()[P])).not.toContain("aprobacion");
  });

  it("puntero: UN update del proyecto con tablero, updatedAt y puntero (claves hermanas: ninguna es prefijo de otra)", async () => {
    sembrar();
    await POST(body());
    const upd = updatesProyecto();
    expect(upd).toHaveLength(1);
    const claves = Object.keys(upd[0]).sort();
    expect(claves).toEqual(["phases.investigacion.f3TareasPIP", "phases.investigacion.revision", "updatedAt"]);
    for (const a of claves) for (const b of claves) if (a !== b) expect(b.startsWith(`${a}.`)).toBe(false);
  });

  it("CON historial (régimen) y sin deriva: una versión nueva por artefacto, ninguna de deriva", async () => {
    sembrar();
    await registrarVigente({ conAsignacion: true });
    vi.mocked(getProject).mockResolvedValue({ phases: { investigacion: { f3TareasPIP: [] } } } as never);
    const res = await POST(body());
    expect(res.status).toBe(200);
    expect(versiones().filter((v) => v.deriva === true)).toHaveLength(0);
    expect(versiones().map((v) => v.id).sort()).toEqual([`${na}__000001`, `${na}__000002`, `${nr}__000001`, `${nr}__000002`]);
    expect(versiones().find((v) => v.id === `${nr}__000002`)?.aprobacion).toMatchObject({ aprobado: true, por: UID });
  });
});

describe("retirar la aprobación (aprobado:false) — deja constancia y conserva la aprobación anterior en SU versión", () => {
  const APROBADO = { ...DOC_RES, aprobado: true, notasUsuario: "la aprobé" };

  it("sobre un resultado APROBADO sin historial: la previa conserva aprobado:true (por null, con sus notas); la nueva registra el retiro por el usuario", async () => {
    sembrar({ resultado: APROBADO });
    const res = await POST(body({ aprobado: false }));
    expect(res.status).toBe(200);
    const porId: Record<string, Version> = Object.fromEntries(versiones().map((v) => [v.id, v]));
    expect(Object.keys(porId).sort()).toEqual([`${nr}__000001`, `${nr}__000002`]); // la asignación no cambió
    expect(porId[`${nr}__000001`].aprobacion).toEqual({ aprobado: true, por: null, en: null, notas: "la aprobé" });
    expect(porId[`${nr}__000001`].tipoCambio).toBe("previo_sin_historial");
    expect(porId[`${nr}__000002`].aprobacion).toMatchObject({ aprobado: false, por: UID, notas: "la aprobé" });
    expect(eventos()[0]).toMatchObject({ motivo: "aprobacion_retirada", artefactos: [nr] });
    // el vivo: aprobado:false y la nota previa (merge), nada más
    expect(snap()[RES]).toEqual({ ...DOC_RES, aprobado: false, notasUsuario: "la aprobé" });
    // el único update del proyecto es el puntero
    expect(updatesProyecto().map((d) => Object.keys(d))).toEqual([["phases.investigacion.revision"]]);
  });

  it("sobre un resultado NUNCA aprobado (rechazo): la previa no tiene aprobación y la nueva deja constancia aprobado:false", async () => {
    sembrar();
    expect((await POST(body({ aprobado: false, notasUsuario: "no sirve" }))).status).toBe(200);
    const porId: Record<string, Version> = Object.fromEntries(versiones().map((v) => [v.id, v]));
    expect(porId[`${nr}__000001`].aprobacion).toBeUndefined();
    expect(porId[`${nr}__000002`].aprobacion).toMatchObject({ aprobado: false, por: UID, notas: "no sirve" });
    expect(eventos()[0]).toMatchObject({ motivo: "resultado_rechazado" });
  });

  it("CON historial (régimen): una versión nueva del resultado, sin deriva", async () => {
    sembrar({ resultado: APROBADO });
    await registrarVigente({ aprobado: true });
    const res = await POST(body({ aprobado: false }));
    expect(res.status).toBe(200);
    expect(versiones().map((v) => v.id).sort()).toEqual([`${nr}__000001`, `${nr}__000002`]);
    expect(versiones().find((v) => v.id === `${nr}__000002`)?.aprobacion).toMatchObject({ aprobado: false, por: UID });
  });

  it("aprobar → retirar → aprobar de nuevo: tres versiones del resultado, la aprobación original sigue en SU versión", async () => {
    sembrar();
    await POST(body());
    // el mock no expande las claves con puntos: se consolida el puntero entre peticiones
    consolidarSemilla(db, P);
    await POST(body({ aprobado: false }));
    consolidarSemilla(db, P);
    await POST(body());
    const vs = versiones().filter((v) => v.id.startsWith(nr)).sort((a, b) => a.n - b.n);
    expect(vs.map((v) => v.aprobacion?.aprobado)).toEqual([undefined, true, false, true]);
    expect(vs[1].aprobacion?.por).toBe(UID);
  });
});

describe("sello y deriva con la ruta REAL de aprobar", () => {
  it("aprobar y luego ENTREGAR (reentrega de aprobado) → CERO deriva: cada artefacto gana una versión por acción", async () => {
    sembrar({ extraDocs: { [SES]: { uid: UID, modduloProjectId: "p1", tareaPipIds: ["t1"], entregaCanal1: { fecha: "2026-01-01", resultadoId: "r1" } } } });
    vi.mocked(getProject).mockImplementation(async () => ({ phases: { investigacion: { f3TareasPIP: [] } } }) as never);
    // la asignación Canal 1/T10 en curso, ligada al resultado entregado
    expect((await POST(body())).status).toBe(200);
    consolidarSemilla(db, P);
    const antes = versiones().length;
    vi.mocked(getProject).mockResolvedValue({
      phases: { investigacion: { f3TareasPIP: [{ pipItemId: "t1", asignaciones: [asigViva()] }] } },
    } as never);
    const res = await ENTREGAR(bodyEntregar());
    expect(res.status).toBe(200);
    expect(versiones().filter((v) => v.deriva === true)).toHaveLength(0);
    expect(eventos().every((e) => (e as Doc).artefactosConDeriva === undefined)).toBe(true);
    expect(versiones().length).toBeGreaterThan(antes);
    expect(versiones().filter((v) => v.id.startsWith(nr)).map((v) => v.n).sort()).toEqual([1, 2, 3]);
    expect(versiones().filter((v) => v.id.startsWith(na)).map((v) => v.n).sort()).toEqual([1, 2, 3]);
  });

  it("aprobar, un cambio NO registrado de la asignación (tareas/aprobar la desactiva) y entregar → UNA versión de deriva (la asignación)", async () => {
    sembrar({ extraDocs: { [SES]: { uid: UID, modduloProjectId: "p1", tareaPipIds: ["t1"], entregaCanal1: { fecha: "2026-01-01", resultadoId: "r1" } } } });
    await POST(body());
    consolidarSemilla(db, P);
    const p = structuredClone(snap()[P]) as { phases: { investigacion: { f3TareasPIP: Array<{ asignaciones: Doc[] }> } } };
    p.phases.investigacion.f3TareasPIP[0].asignaciones[0].activada = false; // escritor que no registra historial
    db.reset({ ...snap(), [P]: p });
    db.rechazarUndefined(true);
    db.atomico(true);
    vi.mocked(getProject).mockResolvedValue({
      phases: { investigacion: { f3TareasPIP: [{ pipItemId: "t1", asignaciones: [asigViva()] }] } },
    } as never);
    expect((await ENTREGAR(bodyEntregar())).status).toBe(200);
    const deriva = versiones().filter((v) => v.deriva === true);
    expect(deriva).toHaveLength(1);
    expect(deriva[0].id.startsWith(na)).toBe(true);
    expect(deriva[0].contenido).toMatchObject({ activada: false, estado: "recibido" });
  });
});

describe("errores del historial — JSON claro, sin dejar nada escrito", () => {
  it("colisión (ya existe la revisión siguiente) → 409 historial_no_confirmado/colision y CERO escrituras", async () => {
    sembrar();
    await registrarVigente({ conAsignacion: true });
    db.reset({ ...snap(), [`${P}/revisiones/investigacion_000002`]: { n: 2, fase: "investigacion" } });
    db.rechazarUndefined(true);
    db.atomico(true);
    vi.mocked(getProject).mockResolvedValue({ phases: { investigacion: { f3TareasPIP: [] } } } as never);
    const antes = JSON.stringify(snap());
    const res = await POST(body());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "historial_no_confirmado", causa: "colision" });
    expect(JSON.stringify(snap())).toBe(antes);
  });

  it("inconsistencia (el puntero apunta a una revisión inexistente) → 500 historial_no_confirmado/inconsistencia y CERO escrituras", async () => {
    sembrar();
    const p = snap()[P] as { phases: { investigacion: Doc } };
    p.phases.investigacion.revision = { n: 7, huella: "x", por: "u", en: "TS" };
    db.reset({ ...snap(), [P]: p });
    db.rechazarUndefined(true);
    db.atomico(true);
    const antes = JSON.stringify(snap());
    const res = await POST(body());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "historial_no_confirmado", causa: "inconsistencia" });
    expect(JSON.stringify(snap())).toBe(antes);
    expect(vi.mocked(console.error).mock.calls.map((c) => String(c[0])).join("\n")).not.toContain(UID);
  });
});
