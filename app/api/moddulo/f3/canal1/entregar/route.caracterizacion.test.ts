// 7b-7 — CARACTERIZACIÓN de canal1/entregar escrita ANTES de tocar la ruta: fija lo que hace hoy
// (forma exacta de lo escrito, reutilización del resultadoId en reentregas, códigos y orden de las
// respuestas). Debe pasar contra el código anterior y SIN editarse contra el refactor transaccional.
// Límite: el mock por defecto acepta `undefined` (el SDK real no); eso lo cubre route.undefined.test.ts.

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
import { getProject } from "@/lib/moddulo/project";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import {
  UID, PROJECT_ID, SESION_ID, OWN_PATH, REPORTE_PATH, RESULTADO_PREVIO,
  rutaProyecto, rutaSesion, rutaResultado, proyectoDoc, sesionDoc, comoProject,
} from "./siembraEntregar";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;

function peticion(extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/moddulo/f3/canal1/entregar", {
    method: "POST",
    body: JSON.stringify({ projectId: PROJECT_ID, sesionId: SESION_ID, storagePath: OWN_PATH, ...extra }),
  }) as unknown as Parameters<typeof POST>[0];
}

function sembrar(asig: Record<string, unknown> = {}, sesionExtra: Record<string, unknown> = {}) {
  const proyecto = proyectoDoc(asig);
  db.reset({ [rutaProyecto]: proyecto, [rutaSesion]: sesionDoc(sesionExtra) });
  vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
}

const resultadosEscritos = () =>
  Object.entries(db.snapshot()).filter(([k]) => k.startsWith(`${rutaProyecto}/f3Resultados/`));

describe("canal1/entregar — caracterización (comportamiento actual)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
  });

  it("primera entrega: escribe el resultado con su forma exacta y entregaCanal1; no toca el tablero", async () => {
    sembrar();
    const res = await POST(peticion());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.resultadoId).toEqual(expect.any(String));
    expect(json.fecha).toEqual(expect.any(String));

    const escritos = resultadosEscritos();
    expect(escritos).toHaveLength(1);
    expect(escritos[0][0]).toBe(rutaResultado(json.resultadoId));
    expect(escritos[0][1]).toEqual({
      moduloPIP: "¿Test?",
      origen: { sourceKind: "T10", componente: "centinela", analisisId: json.resultadoId, fechaEntrega: json.fecha },
      cobertura: { completa: true },
      payload: { archivoUrl: OWN_PATH, extractoTexto: "texto extraído" },
      createdAt: "SERVER_TIMESTAMP",
    });
    expect((db.snapshot()[rutaSesion] as { entregaCanal1: unknown }).entregaCanal1).toEqual({
      fecha: json.fecha,
      resultadoId: json.resultadoId,
    });
    // C3a: ANTES `toHaveLength(0)` (la primera entrega no tocaba el proyecto). AHORA el único update del proyecto
    // es el puntero del historial: sin tablero y sin `updatedAt`.
    expect(db.updates().filter((u) => u.path === rutaProyecto).map((u) => Object.keys(u.data))).toEqual([
      ["phases.investigacion.revision"],
    ]);
  });

  it("con reporteStoragePath: el resultado lleva reporteInterpretativoUrl", async () => {
    sembrar();
    const res = await POST(peticion({ reporteStoragePath: REPORTE_PATH }));
    const json = await res.json();
    const doc = db.snapshot()[rutaResultado(json.resultadoId)] as { payload: Record<string, unknown> };
    expect(doc.payload).toEqual({ archivoUrl: OWN_PATH, extractoTexto: "texto extraído", reporteInterpretativoUrl: REPORTE_PATH });
  });

  it("reentrega con la asignación NO aprobada: reutiliza el resultadoId, reescribe el resultado y no toca el tablero", async () => {
    sembrar({}, { entregaCanal1: { fecha: "2026-01-01", resultadoId: RESULTADO_PREVIO } });
    const res = await POST(peticion());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.resultadoId).toBe(RESULTADO_PREVIO);
    expect(resultadosEscritos().map(([k]) => k)).toEqual([rutaResultado(RESULTADO_PREVIO)]);
    // C3a: ANTES `toHaveLength(0)`. AHORA solo el puntero del historial (el tablero sigue sin tocarse).
    expect(db.updates().filter((u) => u.path === rutaProyecto).map((u) => Object.keys(u.data))).toEqual([
      ["phases.investigacion.revision"],
    ]);
    expect((db.snapshot()[rutaSesion] as { entregaCanal1: { resultadoId: string } }).entregaCanal1.resultadoId).toBe(RESULTADO_PREVIO);
  });

  it("reentrega con la asignación ya APROBADA (mock permisivo): reescribe el resultado, deja la asignación en en_curso y sin resultado, y no toca las demás", async () => {
    sembrar(
      { estado: "recibido", resultadoId: RESULTADO_PREVIO },
      { entregaCanal1: { fecha: "2026-01-01", resultadoId: RESULTADO_PREVIO } }
    );
    const res = await POST(peticion());
    expect(res.status).toBe(200);

    const tablero = (db.snapshot()[rutaProyecto] as {
      "phases.investigacion.f3TareasPIP": Array<{ pipItemId: string; asignaciones: Array<Record<string, unknown>> }>;
      updatedAt: string;
    });
    const tareas = tablero["phases.investigacion.f3TareasPIP"];
    expect(tareas).toHaveLength(1);
    expect(tareas[0].pipItemId).toBe("pip1");
    const [a1, a2] = tareas[0].asignaciones;
    expect(a1).toMatchObject({ asignacionId: "asig1", canal: "canal1", tecnicaId: "T10", estado: "en_curso" });
    expect(a1.resultadoId).toBeUndefined(); // ausente (nuevo) o undefined (anterior): el mock permisivo no distingue
    expect(a2).toMatchObject({ asignacionId: "asig2", estado: "pendiente" });
    expect(tablero.updatedAt).toBe("SERVER_TIMESTAMP");
    expect(resultadosEscritos().map(([k]) => k)).toEqual([rutaResultado(RESULTADO_PREVIO)]);
  });

  it("orden y códigos: 401, 400, 403, 404 sesión ajena, 404 sin vínculo, 400 sin tarea PIP, 404 proyecto, 404 sin asignación", async () => {
    sembrar();
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null);
    expect((await POST(peticion())).status).toBe(401);

    expect((await POST(peticion({ storagePath: undefined }))).status).toBe(400);
    expect((await POST(peticion({ storagePath: `moddulo/otro/${PROJECT_ID}/x.json` }))).status).toBe(403);

    db.reset({ [rutaProyecto]: proyectoDoc(), [rutaSesion]: sesionDoc({ uid: "otro" }) });
    expect((await POST(peticion())).status).toBe(404);

    db.reset({ [rutaProyecto]: proyectoDoc(), [rutaSesion]: sesionDoc({ modduloProjectId: "otroProyecto" }) });
    const vinculo = await POST(peticion());
    expect(vinculo.status).toBe(404);
    expect((await vinculo.json()).error).toBe("La sesión no está vinculada a este proyecto");

    db.reset({ [rutaProyecto]: proyectoDoc(), [rutaSesion]: sesionDoc({ tareaPipIds: [] }) });
    expect((await POST(peticion())).status).toBe(400);

    sembrar();
    vi.mocked(getProject).mockResolvedValue(null);
    const sinProyecto = await POST(peticion());
    expect(sinProyecto.status).toBe(404);
    expect((await sinProyecto.json()).error).toBe("Proyecto no encontrado");

    const sinAsignacion = proyectoDoc();
    sinAsignacion.phases.investigacion.f3TareasPIP[0].asignaciones = [];
    db.reset({ [rutaProyecto]: sinAsignacion, [rutaSesion]: sesionDoc() });
    vi.mocked(getProject).mockResolvedValue(comoProject(sinAsignacion));
    const sinAsig = await POST(peticion());
    expect(sinAsig.status).toBe(404);
    expect((await sinAsig.json()).error).toBe("Asignación de Canal 1 (T10) no encontrada en el tablero");
    expect(resultadosEscritos()).toHaveLength(0);
  });
});
