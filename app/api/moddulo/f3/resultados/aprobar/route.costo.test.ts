// C3a-2 — COSTO del historial en resultados/aprobar, medido con los contadores del mock (lecturas y escrituras de
// documentos, no de Firestore real). Línea base de la ruta ANTES de C3a-2: aprobado:true = 2 lecturas (resultado y
// proyecto) y 2 escrituras (resultado + proyecto); aprobado:false = 1 lectura (solo el resultado) y 1 escritura.
// Con C3a-2 la ruta lee SIEMPRE el proyecto (ahí vive el puntero) y escribe SIEMPRE un update del proyecto
// (el tablero con el puntero fusionado, o solo el puntero). La lectura del manifiesto solo ocurre si el proyecto
// ya tiene puntero. Límites: sin emulador (Java 17); los conteos son del mock.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async () => ({
  ...(await vi.importActual<typeof import("@/lib/moddulo/project")>("@/lib/moddulo/project")),
  getProject: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject, normalizeTareaPIP, type LegacyTareaPIP } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { consolidarSemilla, registrarEnSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";
import {
  estadoAsignacion, estadoResultado, nombreAsignacion, nombreResultado, selloDeAprobacion, vivoAsignacion, vivoResultado,
} from "@/lib/moddulo/versionado/artefactosF3";
import type { AsignacionCanal } from "@/types/moddulo.types";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
type Doc = Record<string, unknown>;
const UID = "uidAprobador";
const P = "moddulo_projects/p1";
const RES = `${P}/f3Resultados/r1`;
const DOC_RES = {
  moduloPIP: "¿Pregunta?",
  origen: { sourceKind: "T10", componente: "centinela", analisisId: "r1", fechaEntrega: "2026-01-01T00:00:00.000Z" },
  cobertura: { completa: true },
  payload: { archivoUrl: "moddulo/otroDueno/p1/f3/r1/f.json", extractoTexto: "texto" },
  createdAt: "TS",
};
const TABLERO = [{ pipItemId: "t1", asignaciones: [{ asignacionId: "a1", tipo: "primaria", canal: "canal1", tecnicaId: "T10", justificacion: "j", estado: "en_curso", activada: true }] }];
const snap = () => db.snapshot() as Record<string, Doc>;
const asigViva = (): AsignacionCanal =>
  normalizeTareaPIP((snap()[P] as { phases: { investigacion: { f3TareasPIP: LegacyTareaPIP[] } } }).phases.investigacion.f3TareasPIP[0]).asignaciones[0];
const body = (aprobado: boolean) =>
  new Request("http://local/x", {
    method: "POST",
    body: JSON.stringify({ projectId: "p1", resultadoId: "r1", pipItemId: "t1", asignacionId: "a1", aprobado }),
  }) as never;

interface Escenario {
  aprobadoVivo?: boolean;
  registrado?: "otro" | "resultado" | "resultado_y_asignacion";
  derivaAsignacion?: boolean;
  derivaResultado?: boolean;
}

async function medir(aprobado: boolean, e: Escenario = {}) {
  const resultado = e.aprobadoVivo ? { ...DOC_RES, aprobado: true, notasUsuario: "n" } : DOC_RES;
  db.reset({ [P]: { phases: { investigacion: { f3TareasPIP: TABLERO } } }, [RES]: resultado });
  db.rechazarUndefined(true);
  db.atomico(true);
  if (e.registrado) {
    const arts = [];
    if (e.registrado === "otro") {
      arts.push({ artefacto: nombreResultado("otro"), ...estadoResultado(DOC_RES), vivo: vivoResultado(DOC_RES) });
    } else {
      const vivo = snap()[RES];
      const sello = e.aprobadoVivo ? selloDeAprobacion(vivo, UID, "2026-11-01T10:00:00.000Z") : undefined;
      arts.push({ artefacto: nombreResultado("r1"), ...estadoResultado(vivo, sello), vivo: vivoResultado(vivo) });
      if (e.registrado === "resultado_y_asignacion") {
        arts.push({ artefacto: nombreAsignacion("a1"), ...estadoAsignacion(asigViva()), vivo: vivoAsignacion(asigViva()) });
      }
    }
    await registrarEnSemilla(db, P, arts);
    consolidarSemilla(db, P);
    if (e.derivaAsignacion) {
      const p = structuredClone(snap()[P]) as { phases: { investigacion: { f3TareasPIP: Array<{ asignaciones: Doc[] }> } } };
      p.phases.investigacion.f3TareasPIP[0].asignaciones[0].activada = false;
      db.reset({ ...snap(), [P]: p });
      db.rechazarUndefined(true);
      db.atomico(true);
    }
    if (e.derivaResultado) {
      db.reset({ ...snap(), [RES]: { ...snap()[RES], notasUsuario: "cambiada sin registro" } });
      db.rechazarUndefined(true);
      db.atomico(true);
    }
  }
  vi.mocked(getProject).mockResolvedValue({ phases: { investigacion: { f3TareasPIP: [] } } } as never);
  const antes = new Set(Object.keys(snap()));
  const c0 = db.contadores();
  const res = await POST(body(aprobado));
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
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: UID } as never);
});

// `lecturas` y `escrituras` son totales de la ruta. Escrituras propias de la ruta: aprobar = 2 (resultado y
// proyecto con el puntero fusionado); retirar = 2 (resultado y un update del proyecto SOLO con el puntero).
describe("aprobar (aprobado:true): costo medido", () => {
  it("A. sin puntero y sin historial: 2 lecturas (sin cambio), 6 escrituras de historial (resultado y asignación, cada uno con su previa)", async () => {
    expect(await medir(true)).toEqual({ lecturas: 2, escrituras: 8, versiones: 4, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("B. con puntero previo (de otro artefacto), sin historial propio: +1 lectura (manifiesto), 6 de historial", async () => {
    expect(await medir(true, { registrado: "otro" })).toEqual({ lecturas: 3, escrituras: 8, versiones: 4, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("C. con historial de ambos (régimen), sin deriva: +1 lectura, 4 de historial", async () => {
    expect(await medir(true, { registrado: "resultado_y_asignacion" })).toEqual({ lecturas: 3, escrituras: 6, versiones: 2, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("D. con historial y deriva en la asignación: +1 lectura, 5 de historial (la deriva suma 1)", async () => {
    expect(await medir(true, { registrado: "resultado_y_asignacion", derivaAsignacion: true })).toEqual({ lecturas: 3, escrituras: 7, versiones: 3, revisiones: 1, eventos: 1, borrados: 0 });
  });
});

describe("aprobar (aprobado:false, retirar o rechazar): costo medido", () => {
  it("A. sin puntero y sin historial: 2 lecturas (+1 el proyecto: ANTES leía solo el resultado), 4 de historial", async () => {
    expect(await medir(false, { aprobadoVivo: true })).toEqual({ lecturas: 2, escrituras: 6, versiones: 2, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("B. con puntero previo (de otro artefacto), sin historial propio: 3 lecturas (+2 respecto de ANTES), 4 de historial", async () => {
    expect(await medir(false, { aprobadoVivo: true, registrado: "otro" })).toEqual({ lecturas: 3, escrituras: 6, versiones: 2, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("C. con historial del resultado (régimen), sin deriva: 3 lecturas, 3 de historial", async () => {
    expect(await medir(false, { aprobadoVivo: true, registrado: "resultado" })).toEqual({ lecturas: 3, escrituras: 5, versiones: 1, revisiones: 1, eventos: 1, borrados: 0 });
  });
  it("D. con historial y deriva en el resultado (cambio sin registro): 3 lecturas, 4 de historial", async () => {
    expect(await medir(false, { aprobadoVivo: true, registrado: "resultado", derivaResultado: true })).toEqual({ lecturas: 3, escrituras: 6, versiones: 2, revisiones: 1, eventos: 1, borrados: 0 });
  });
});
