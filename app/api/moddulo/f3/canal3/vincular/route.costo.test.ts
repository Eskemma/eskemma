// C3a-2 — COSTO del historial en canal3/vincular, medido con los contadores del mock. Línea base de la ruta ANTES de
// C3a-2: 1 lectura (el proyecto) y 1 escritura (el resultado) más 1 update del proyecto SOLO con marcador de Fontana.
// Con C3a-2 la ruta lee además el resultado (por si ya existía) y siempre escribe un update del proyecto (el marcador
// con el puntero fusionado, o solo el puntero). La lectura del manifiesto solo ocurre si el proyecto ya tiene puntero.
// Límites: sin emulador (Java 17); los conteos son del mock.

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
type Doc = Record<string, unknown>;
const compatible: EvaluacionCompatibilidad = {
  pertinencia: { cumple: true, detalle: "ok" },
  vigencia: { cumple: true, detalle: "ok" },
  compatibilidadMetodologica: { cumple: true, detalle: "ok" },
};
const PREVIO = {
  moduloPIP: "viejo",
  origen: { sourceKind: "external", componente: "external", analisisId: RESULTADO_ID, fechaEntrega: "2026-01-01T00:00:00.000Z" },
  cobertura: { completa: true },
  payload: { archivoUrl: OWN_PATH, extractoTexto: "texto viejo" },
  createdAt: "TS",
  aprobado: true,
};
const snap = () => db.snapshot() as Record<string, Doc>;
const peticion = (extra: Record<string, unknown> = {}) =>
  new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ ...bodyValido, ...extra }) }) as unknown as Parameters<typeof POST>[0];

interface Escenario {
  resultado?: Doc;
  registrado?: "otro" | "resultado";
  conMarcador?: boolean;
}

async function medir(e: Escenario = {}) {
  const proyecto = proyectoDoc();
  db.reset({ [rutaProyecto]: proyecto, ...(e.resultado ? { [rutaResultado]: e.resultado } : {}) });
  db.rechazarUndefined(true);
  db.atomico(true);
  storage.reset([OWN_PATH]);
  if (e.registrado) {
    const doc = e.registrado === "otro" ? PREVIO : (e.resultado as Doc);
    await registrarEnSemilla(db, rutaProyecto, [
      { artefacto: nombreResultado(e.registrado === "otro" ? "otro" : RESULTADO_ID), ...estadoResultado(doc), vivo: vivoResultado(doc) },
    ]);
    consolidarSemilla(db, rutaProyecto);
  }
  vi.mocked(getProject).mockResolvedValue(comoProject(snap()[rutaProyecto]));
  const antes = new Set(Object.keys(snap()));
  const c0 = db.contadores();
  const res = await POST(peticion(e.conMarcador ? { fontanaSesionId: SESION_FONTANA } : {}));
  expect(res.status).toBe(200);
  const c1 = db.contadores();
  const nuevas = Object.keys(snap()).filter((k) => !antes.has(k));
  const cuenta = (s: string) => nuevas.filter((k) => k.includes(`/${s}/`)).length;
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
  vi.mocked(extractTextPerFile).mockResolvedValue("texto nuevo");
  vi.mocked(evaluarCompatibilidad).mockReturnValue(compatible);
  vi.mocked(extraerTerritorioEscalar).mockReturnValue({ nivel: "estatal" } as ReturnType<typeof extraerTerritorioEscalar>);
});

// `escrituras` incluye las 2 propias de la ruta (resultado y update del proyecto con el puntero).
describe("vincular: costo medido", () => {
  it("A. resultado nuevo, sin puntero previo: +1 lectura (el resultado), 3 escrituras de historial", async () => {
    expect(await medir()).toEqual({ lecturas: 2, escrituras: 5, versiones: 1, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("B. resultado nuevo, con puntero previo (otro artefacto): +2 lecturas (resultado y manifiesto), 3 de historial", async () => {
    expect(await medir({ registrado: "otro" })).toEqual({ lecturas: 3, escrituras: 5, versiones: 1, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("C. el resultadoId ya existía, sin historial: +1 lectura, 4 de historial (previa + nueva + revisión + evento)", async () => {
    expect(await medir({ resultado: PREVIO })).toEqual({ lecturas: 2, escrituras: 6, versiones: 2, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("D. el resultadoId ya existía, con historial (régimen) y sin deriva: +2 lecturas, 3 de historial", async () => {
    expect(await medir({ resultado: PREVIO, registrado: "resultado" })).toEqual({ lecturas: 3, escrituras: 5, versiones: 1, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("E. con marcador de Fontana: el update del marcador lleva el puntero fusionado (mismas escrituras que A)", async () => {
    expect(await medir({ conMarcador: true })).toEqual({ lecturas: 2, escrituras: 5, versiones: 1, revisiones: 1, eventos: 1, borrados: 0 });
  });
});
