// C3a-2 — HISTORIAL de canal3/vincular: la vinculación de una fuente externa deja su primera versión en el
// historial unificado, en la MISMA transacción. Mock con rechazo de `undefined` y transacciones atómicas.
// Límites: sin emulador de Firestore (Java 17); evaluarCompatibilidad se mockea (la real se prueba aparte);
// la colisión/inconsistencia se simula sembrando el documento que chocaría.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EvaluacionCompatibilidad } from "@/types/shared.types";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb(), adminStorage: createMockAdminStorage() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/moddulo/attachments", () => ({ extractTextPerFile: vi.fn() }));
vi.mock("@/lib/moddulo/canal3Evaluation", () => ({ evaluarCompatibilidad: vi.fn() }));
vi.mock("@/lib/territorio/staleness", () => ({ extraerTerritorioEscalar: vi.fn() }));

import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { evaluarCompatibilidad } from "@/lib/moddulo/canal3Evaluation";
import { extraerTerritorioEscalar } from "@/lib/territorio/staleness";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb, createMockAdminStorage } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { consolidarSemilla, registrarEnSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";
import { estadoResultado, nombreResultado, vivoResultado } from "@/lib/moddulo/versionado/artefactosF3";
import { UID, OWN_PATH, SESION_FONTANA, RESULTADO_ID, rutaProyecto, rutaResultado, proyectoDoc, bodyValido, comoProject } from "./siembraVincular";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const storage = adminStorage as unknown as ReturnType<typeof createMockAdminStorage>;
const compatible: EvaluacionCompatibilidad = {
  pertinencia: { cumple: true, detalle: "ok" },
  vigencia: { cumple: true, detalle: "ok" },
  compatibilidadMetodologica: { cumple: true, detalle: "ok" },
};
const nr = nombreResultado(RESULTADO_ID);
const peticion = (extra: Record<string, unknown> = {}) =>
  new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ ...bodyValido, ...extra }) }) as unknown as Parameters<typeof POST>[0];

type Doc = Record<string, unknown>;
type Version = Doc & { id: string; n: number; contenido?: Doc; aprobacion?: Doc; deriva?: boolean; insumos?: unknown };
const snap = () => db.snapshot() as Record<string, Doc>;
const bajo = (p: string) => Object.entries(snap()).filter(([k]) => k.startsWith(`${rutaProyecto}/${p}/`));
const versiones = (): Version[] => bajo("versiones").map(([k, v]) => ({ id: k.split("/").pop() as string, ...v }) as Version);
const eventos = () => bajo("eventos").map(([, v]) => v);
const updatesProyecto = () => db.updates().filter((u) => u.path === rutaProyecto).map((u) => u.data);
const PREVIO = {
  moduloPIP: "viejo",
  origen: { sourceKind: "external", componente: "external", analisisId: RESULTADO_ID, fechaEntrega: "2026-01-01T00:00:00.000Z" },
  cobertura: { completa: true },
  payload: { archivoUrl: OWN_PATH, extractoTexto: "texto viejo" },
  createdAt: "TS-ANTERIOR",
  aprobado: true,
  notasUsuario: "la aprobé",
};

function sembrar(opts: { resultado?: Doc; proyecto?: Doc } = {}) {
  const proyecto = opts.proyecto ?? proyectoDoc();
  db.reset({ [rutaProyecto]: proyecto, ...(opts.resultado ? { [rutaResultado]: opts.resultado } : {}) });
  db.rechazarUndefined(true);
  db.atomico(true);
  storage.reset([OWN_PATH]);
  vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
  vi.mocked(extractTextPerFile).mockResolvedValue("texto nuevo");
  vi.mocked(evaluarCompatibilidad).mockReturnValue(compatible);
  vi.mocked(extraerTerritorioEscalar).mockReturnValue({ nivel: "estatal" } as ReturnType<typeof extraerTerritorioEscalar>);
});

describe("vincular — primera versión del resultado externo", () => {
  it("resultado nuevo: versión n=1 (tipoCambio «entrega», por = el uid, sin aprobación, dependeDe vacío), revisión 1, evento y puntero", async () => {
    sembrar();
    expect((await POST(peticion())).status).toBe(200);
    const v = versiones();
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ id: `${nr}__000001`, artefacto: nr, n: 1, tipoCambio: "entrega", por: UID, fase: "investigacion", ambito: "moddulo", estado: "vigente" });
    expect(v[0].aprobacion).toBeUndefined();
    expect(v[0].insumos).toBeUndefined(); // dependeDe vacío
    expect(v[0].deriva).toBeUndefined();
    expect((v[0].contenido as Doc).createdAt).toBeUndefined();
    expect((v[0].contenido as Doc).moduloPIP).toBe("¿Pregunta?");
    expect(eventos()).toHaveLength(1);
    expect(eventos()[0]).toMatchObject({ tipo: "entrega", por: UID, artefactos: [nr] });
    const rev = bajo("revisiones")[0][1] as { artefactos: Record<string, { dependeDe: unknown[] }> };
    expect(rev.artefactos[nr].dependeDe).toEqual([]);
    expect(updatesProyecto()).toEqual([{ "phases.investigacion.revision": expect.objectContaining({ n: 1, por: UID }) }]);
  });

  it("el documento vivo conserva su forma de siempre (sin sello, uid ni campos nuevos)", async () => {
    sembrar();
    await POST(peticion());
    const vivo = snap()[rutaResultado];
    expect(Object.keys(vivo).sort()).toEqual(["cobertura", "compatibilidad", "createdAt", "metadatosFuente", "moduloPIP", "origen", "payload", "proyectoTerritorioSnapshotAtVinculacion"]);
    expect(JSON.stringify(vivo)).not.toContain("huella");
  });

  it("con puntero previo (de otro artefacto): la revisión es la 2 y el artefacto empieza en n=1", async () => {
    sembrar();
    await registrarEnSemilla(db, rutaProyecto, [{ artefacto: nombreResultado("otro"), ...estadoResultado(PREVIO), vivo: vivoResultado(PREVIO) }]);
    consolidarSemilla(db, rutaProyecto);
    vi.mocked(getProject).mockResolvedValue(comoProject(snap()[rutaProyecto]));
    expect((await POST(peticion())).status).toBe(200);
    expect(versiones().map((x) => x.id).sort()).toEqual([`${nr}__000001`, `${nombreResultado("otro")}__000001`].sort());
    expect(bajo("revisiones")).toHaveLength(2);
  });
});

describe("vincular — estado previo si el resultadoId YA existía", () => {
  it("sin historial: la versión previa conserva aprobado/notas (por null, sin autoría registrada) y la nueva queda sin aprobación", async () => {
    sembrar({ resultado: PREVIO });
    expect((await POST(peticion())).status).toBe(200);
    const porId: Record<string, Version> = Object.fromEntries(versiones().map((x) => [x.id, x]));
    expect(Object.keys(porId).sort()).toEqual([`${nr}__000001`, `${nr}__000002`]);
    expect(porId[`${nr}__000001`]).toMatchObject({ tipoCambio: "previo_sin_historial", por: null, en: null });
    expect(porId[`${nr}__000001`].aprobacion).toEqual({ aprobado: true, por: null, en: null, notas: "la aprobé" });
    expect((porId[`${nr}__000001`].contenido as Doc).moduloPIP).toBe("viejo");
    expect(porId[`${nr}__000002`]).toMatchObject({ tipoCambio: "entrega", por: UID });
    expect(porId[`${nr}__000002`].aprobacion).toBeUndefined();
    // el vivo se reemplaza completo como siempre (sin aprobado ni notas)
    expect((snap()[rutaResultado] as Doc).aprobado).toBeUndefined();
  });

  it("con historial y un cambio NO registrado (p. ej. revisar-territorio actualizó la compatibilidad) → UNA versión de deriva antes de la nueva", async () => {
    sembrar({ resultado: PREVIO });
    await registrarEnSemilla(db, rutaProyecto, [{ artefacto: nr, ...estadoResultado(PREVIO), vivo: vivoResultado(PREVIO) }]);
    consolidarSemilla(db, rutaProyecto);
    db.reset({ ...snap(), [rutaResultado]: { ...PREVIO, compatibilidad: { cambiada: "sin registro" } } });
    db.rechazarUndefined(true);
    db.atomico(true);
    vi.mocked(getProject).mockResolvedValue(comoProject(snap()[rutaProyecto]));
    expect((await POST(peticion())).status).toBe(200);
    const deriva = versiones().filter((x) => x.deriva === true);
    expect(deriva).toHaveLength(1);
    expect(deriva[0].id).toBe(`${nr}__000002`);
    expect(deriva[0].contenido).toMatchObject({ compatibilidad: { cambiada: "sin registro" } });
    expect(versiones().find((x) => x.id === `${nr}__000003`)).toMatchObject({ tipoCambio: "entrega" });
    expect(eventos().at(-1)?.artefactosConDeriva).toEqual([nr]);
  });

  it("con historial y SIN cambios no registrados → cero deriva (una versión nueva)", async () => {
    sembrar({ resultado: PREVIO });
    await registrarEnSemilla(db, rutaProyecto, [{ artefacto: nr, ...estadoResultado(PREVIO), vivo: vivoResultado(PREVIO) }]);
    consolidarSemilla(db, rutaProyecto);
    vi.mocked(getProject).mockResolvedValue(comoProject(snap()[rutaProyecto]));
    expect((await POST(peticion())).status).toBe(200);
    expect(versiones().filter((x) => x.deriva === true)).toHaveLength(0);
    expect(versiones()).toHaveLength(2);
  });
});

describe("puntero — no se solapa con el borrado del marcador de Fontana", () => {
  it("UN update del proyecto con [marcador, updatedAt, puntero]: ninguna clave es prefijo de otra", async () => {
    sembrar();
    expect((await POST(peticion({ fontanaSesionId: SESION_FONTANA }))).status).toBe(200);
    const upd = updatesProyecto();
    expect(upd).toHaveLength(1);
    const claves = Object.keys(upd[0]).sort();
    expect(claves).toEqual(["phases.investigacion.fontanaPendiente", "phases.investigacion.revision", "updatedAt"]);
    expect(upd[0]["phases.investigacion.fontanaPendiente"]).toBe("FIELD_DELETE");
    for (const a of claves) for (const b of claves) if (a !== b) expect(b.startsWith(`${a}.`)).toBe(false);
  });
});

describe("rechazos y errores — nada queda escrito", () => {
  it("un 422 de compatibilidad no deja historial", async () => {
    sembrar();
    vi.mocked(evaluarCompatibilidad).mockReturnValue({ ...compatible, pertinencia: { cumple: false, detalle: "tipo" } });
    expect((await POST(peticion())).status).toBe(422);
    expect(versiones()).toHaveLength(0);
    expect(db.updates()).toHaveLength(0);
  });

  it("colisión (puntero desfasado: ya existe la revisión siguiente) → 409 historial_no_confirmado/colision y CERO escrituras", async () => {
    sembrar();
    await registrarEnSemilla(db, rutaProyecto, [{ artefacto: nombreResultado("otro"), ...estadoResultado(PREVIO), vivo: vivoResultado(PREVIO) }]);
    consolidarSemilla(db, rutaProyecto);
    db.reset({ ...snap(), [`${rutaProyecto}/revisiones/investigacion_000002`]: { n: 2, fase: "investigacion" } });
    db.rechazarUndefined(true);
    db.atomico(true);
    vi.mocked(getProject).mockResolvedValue(comoProject(snap()[rutaProyecto]));
    const antes = JSON.stringify(snap());
    const res = await POST(peticion());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "historial_no_confirmado", causa: "colision" });
    expect(JSON.stringify(snap())).toBe(antes);
  });

  it("inconsistencia (el puntero apunta a una revisión inexistente) → 500 historial_no_confirmado/inconsistencia y CERO escrituras", async () => {
    const proyecto = proyectoDoc({ phases: { investigacion: { revision: { n: 4, huella: "x", por: "u", en: "TS" } } } });
    sembrar({ proyecto });
    const antes = JSON.stringify(snap());
    const res = await POST(peticion());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "historial_no_confirmado", causa: "inconsistencia" });
    expect(JSON.stringify(snap())).toBe(antes);
    expect(vi.mocked(console.error).mock.calls.map((c) => String(c[0])).join("\n")).not.toContain(UID);
  });
});
