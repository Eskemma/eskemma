// C3a-1 — COSTO del historial en canal1/entregar, medido con los contadores del mock (lecturas y escrituras de
// documentos, no de Firestore real). Línea base de la ruta ANTES de C3a: 3 lecturas (pre-chequeo de la sesión,
// sesión y proyecto de la transacción) y 2 o 3 escrituras (resultado + sesión [+ tablero si la reentrega reinicia
// la asignación]). Con C3a la ruta siempre hace 3 escrituras propias (el puntero del historial se fusiona en el
// update del tablero o va en un update propio) más los `create` del historial.
// Límites: sin emulador (Java 17); la lectura del manifiesto solo ocurre si el proyecto ya tiene puntero.

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
import {
  UID, PROJECT_ID, SESION_ID, OWN_PATH, RESULTADO_PREVIO,
  rutaProyecto, rutaSesion, rutaResultado, proyectoDoc, sesionDoc, comoProject,
} from "./siembraEntregar";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
type Doc = Record<string, unknown>;
const snap = () => db.snapshot() as Record<string, Doc>;

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
  payload: { archivoUrl: "moddulo/uidA/projA/f3/res0/f.json", extractoTexto: "texto anterior" },
  createdAt: "TS",
};
const DOC_APROBADO = { ...DOC_VIVO, aprobado: true, notasUsuario: "ok" };
const APROBADA = { estado: "recibido", resultadoId: RESULTADO_PREVIO };
const asigViva = () =>
  normalizeTareaPIP(
    (snap()[rutaProyecto] as { phases: { investigacion: { f3TareasPIP: LegacyTareaPIP[] } } }).phases.investigacion.f3TareasPIP[0]
  ).asignaciones[0];

interface Escenario {
  asig?: Record<string, unknown>;
  sesion?: Record<string, unknown>;
  resultadoVivo?: Doc;
  /** Historial previo registrado (con puntero en el proyecto). */
  registrado?: "resultado" | "resultado_y_asignacion" | "otro_resultado";
  /** Cambio NO registrado de la asignación después del registro. */
  derivaAsignacion?: boolean;
}

async function medir(e: Escenario) {
  const proyecto = proyectoDoc(e.asig ?? {});
  const docs: Record<string, unknown> = { [rutaProyecto]: proyecto, [rutaSesion]: sesionDoc(e.sesion ?? {}) };
  if (e.resultadoVivo) docs[rutaResultado(RESULTADO_PREVIO)] = e.resultadoVivo;
  db.reset(docs);
  db.rechazarUndefined(true);
  db.atomico(true);
  if (e.registrado) {
    const artefactos = [];
    if (e.registrado === "otro_resultado") {
      artefactos.push({ artefacto: nombreResultado("otro"), ...estadoResultado(DOC_VIVO), vivo: vivoResultado(DOC_VIVO) });
    } else {
      const sello = e.resultadoVivo && "aprobado" in e.resultadoVivo ? { por: UID, en: "2026-11-01", huella: "h" } : undefined;
      artefactos.push({
        artefacto: nombreResultado(RESULTADO_PREVIO),
        ...estadoResultado(e.resultadoVivo as Doc, sello),
        vivo: vivoResultado(e.resultadoVivo as Doc),
      });
      if (e.registrado === "resultado_y_asignacion") {
        artefactos.push({ artefacto: nombreAsignacion("asig1"), ...estadoAsignacion(asigViva()), vivo: vivoAsignacion(asigViva()) });
      }
    }
    await registrarEnSemilla(db, rutaProyecto, artefactos);
    consolidarSemilla(db, rutaProyecto);
    if (e.derivaAsignacion) {
      const p = structuredClone(snap()[rutaProyecto]) as { phases: { investigacion: { f3TareasPIP: Array<{ asignaciones: Doc[] }> } } };
      p.phases.investigacion.f3TareasPIP[0].asignaciones[0].activada = false;
      db.reset({ ...snap(), [rutaProyecto]: p });
      db.rechazarUndefined(true);
      db.atomico(true);
    }
  }
  vi.mocked(getProject).mockResolvedValue(comoProject(snap()[rutaProyecto]));
  const antesClaves = new Set(Object.keys(snap()));
  const c0 = db.contadores();
  const res = await POST(peticion());
  expect(res.status).toBe(200);
  const c1 = db.contadores();
  const nuevas = Object.keys(snap()).filter((k) => !antesClaves.has(k));
  const cuenta = (sub: string) => nuevas.filter((k) => k.includes(`/${sub}/`)).length;
  return {
    lecturas: c1.lecturas - c0.lecturas,
    escrituras: c1.escrituras - c0.escrituras,
    versiones: cuenta("versiones"),
    revisiones: cuenta("revisiones"),
    eventos: cuenta("eventos"),
    borrados: c1.borrados - c0.borrados,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
  vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
});

// `lecturas` incluye las 3 de la línea base; `escrituras` incluye las 3 propias de la ruta (resultado, sesión y
// proyecto —tablero con puntero fusionado, o solo puntero—). Historial = versiones + revisión + evento.
describe("costo medido por caso (contadores del mock)", () => {
  it("1. primera entrega, proyecto SIN puntero previo: +0 lecturas, 3 escrituras de historial", async () => {
    expect(await medir({})).toEqual({ lecturas: 3, escrituras: 6, versiones: 1, revisiones: 1, eventos: 1, borrados: 0 });
  });

  it("2. primera entrega, proyecto CON puntero previo: +1 lectura (manifiesto), 3 escrituras de historial", async () => {
    expect(await medir({ registrado: "otro_resultado" })).toEqual({ lecturas: 4, escrituras: 6, versiones: 1, revisiones: 1, eventos: 1, borrados: 0 });
  });

  it("3. reentrega SIN aprobar, sin historial previo: +1 lectura (resultado vivo), 4 escrituras (previa + nueva + revisión + evento)", async () => {
    expect(await medir({ sesion: ENTREGADA, resultadoVivo: DOC_VIVO })).toEqual({ lecturas: 4, escrituras: 7, versiones: 2, revisiones: 1, eventos: 1, borrados: 0 });
  });

  it("4. reentrega SIN aprobar, con historial vigente y sin deriva: +2 lecturas (resultado vivo + manifiesto), 3 escrituras", async () => {
    expect(await medir({ sesion: ENTREGADA, resultadoVivo: DOC_VIVO, registrado: "resultado" })).toEqual({ lecturas: 5, escrituras: 6, versiones: 1, revisiones: 1, eventos: 1, borrados: 0 });
  });

  it("5. reentrega de APROBADO, sin historial previo: +1 lectura, 6 escrituras (resultado y asignación con su previa)", async () => {
    expect(await medir({ asig: APROBADA, sesion: ENTREGADA, resultadoVivo: DOC_APROBADO })).toEqual({ lecturas: 4, escrituras: 9, versiones: 4, revisiones: 1, eventos: 1, borrados: 0 });
  });

  it("6. reentrega de APROBADO, con historial vigente y sin deriva (régimen): +2 lecturas, 4 escrituras", async () => {
    expect(await medir({ asig: APROBADA, sesion: ENTREGADA, resultadoVivo: DOC_APROBADO, registrado: "resultado_y_asignacion" })).toEqual({ lecturas: 5, escrituras: 7, versiones: 2, revisiones: 1, eventos: 1, borrados: 0 });
  });

  it("7. reentrega de APROBADO, con historial vigente y CON deriva en la asignación: +2 lecturas, 5 escrituras (la deriva suma 1)", async () => {
    expect(
      await medir({ asig: APROBADA, sesion: ENTREGADA, resultadoVivo: DOC_APROBADO, registrado: "resultado_y_asignacion", derivaAsignacion: true })
    ).toEqual({ lecturas: 5, escrituras: 8, versiones: 3, revisiones: 1, eventos: 1, borrados: 0 });
  });
});
