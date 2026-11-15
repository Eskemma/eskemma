// 7b-7 — ATOMICIDAD de canal1/entregar: resultado, tablero y entregaCanal1 de la sesión salen en UNA
// transacción (antes: 3 escrituras sueltas). Modo atómico del mock (todo o nada).
// Límites: sin emulador de Firestore (Java 17; se requiere ≥ 21) no se prueban el aislamiento real ni los
// reintentos; la carrera se simula escribiendo en el hueco entre las lecturas previas y la transacción.

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
  UID, PROJECT_ID, SESION_ID, OWN_PATH, RESULTADO_PREVIO,
  rutaProyecto, rutaSesion, rutaResultado, proyectoDoc, sesionDoc, comoProject,
} from "./siembraEntregar";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;

const peticion = () =>
  new Request("http://localhost/api/moddulo/f3/canal1/entregar", {
    method: "POST",
    body: JSON.stringify({ projectId: PROJECT_ID, sesionId: SESION_ID, storagePath: OWN_PATH }),
  }) as unknown as Parameters<typeof POST>[0];

const APROBADA = { estado: "recibido", resultadoId: RESULTADO_PREVIO };
const SESION_ENTREGADA = { entregaCanal1: { fecha: "2026-01-01", resultadoId: RESULTADO_PREVIO } };
const resultadosEscritos = () =>
  Object.keys(db.snapshot()).filter((k) => k.startsWith(`${rutaProyecto}/f3Resultados/`));

function sembrar(asig: Record<string, unknown> = APROBADA, sesionExtra: Record<string, unknown> = SESION_ENTREGADA) {
  const proyecto = proyectoDoc(asig);
  db.reset({
    [rutaProyecto]: proyecto,
    [rutaSesion]: sesionDoc(sesionExtra),
    [rutaResultado(RESULTADO_PREVIO)]: { marca: "resultado anterior", aprobado: true },
  });
  db.atomico(true);
  vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
}

describe("canal1/entregar — atomicidad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
  });

  it("camino feliz: UNA transacción con las tres escrituras (resultado, tablero, sesión)", async () => {
    sembrar();
    const res = await POST(peticion());
    expect(res.status).toBe(200);
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect((db.snapshot()[rutaResultado(RESULTADO_PREVIO)] as { marca?: string }).marca).toBeUndefined(); // reescrito
    expect(db.updates().map((u) => u.path).sort()).toEqual([rutaProyecto, rutaSesion].sort());
  });

  it("falla la escritura del tablero: el resultado anterior NO queda pisado y la sesión no cambia", async () => {
    sembrar();
    db.failUpdateOn(rutaProyecto);
    await expect(POST(peticion())).rejects.toThrow();
    expect((db.snapshot()[rutaResultado(RESULTADO_PREVIO)] as { marca: string }).marca).toBe("resultado anterior");
    expect((db.snapshot()[rutaSesion] as { entregaCanal1: unknown }).entregaCanal1).toEqual(SESION_ENTREGADA.entregaCanal1);
  });

  it("falla la escritura de la sesión: ni el resultado ni el tablero cambian", async () => {
    sembrar();
    db.failUpdateOn(rutaSesion);
    await expect(POST(peticion())).rejects.toThrow();
    expect((db.snapshot()[rutaResultado(RESULTADO_PREVIO)] as { marca: string }).marca).toBe("resultado anterior");
    const asig = (db.snapshot()[rutaProyecto] as ReturnType<typeof proyectoDoc>).phases.investigacion.f3TareasPIP[0].asignaciones[0];
    expect(asig).toMatchObject(APROBADA);
  });

  it("carrera: otra entrega crea entregaCanal1 entre la lectura previa y la transacción → se reutiliza SU resultadoId", async () => {
    sembrar({}, {}); // al empezar no hay entrega
    vi.mocked(getProject).mockImplementationOnce(async () => {
      await db.collection("fontana_sesiones").doc(SESION_ID).set(sesionDoc(SESION_ENTREGADA)); // la otra entrega ya escribió
      return comoProject(proyectoDoc());
    });
    const res = await POST(peticion());
    expect((await res.json()).resultadoId).toBe(RESULTADO_PREVIO);
    expect(resultadosEscritos()).toEqual([rutaResultado(RESULTADO_PREVIO)]);
  });

  it("carrera: la asignación Canal 1 desaparece del tablero en el hueco → 404 sin ninguna escritura", async () => {
    sembrar();
    const sinAsig = proyectoDoc();
    sinAsig.phases.investigacion.f3TareasPIP[0].asignaciones = [];
    vi.mocked(getProject).mockImplementationOnce(async () => {
      await db.collection("moddulo_projects").doc(PROJECT_ID).set(sinAsig); // el tablero cambió (sincronizar, otra pestaña)
      return comoProject(proyectoDoc(APROBADA));
    });
    const res = await POST(peticion());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Asignación de Canal 1 (T10) no encontrada en el tablero");
    expect(db.updates()).toHaveLength(0);
    expect((db.snapshot()[rutaResultado(RESULTADO_PREVIO)] as { marca: string }).marca).toBe("resultado anterior");
  });

  it("carrera: el proyecto va a la papelera en el hueco → 404 sin ninguna escritura", async () => {
    sembrar();
    vi.mocked(getProject).mockImplementationOnce(async () => {
      await db.collection("moddulo_projects").doc(PROJECT_ID).set({ ...proyectoDoc(APROBADA), deletedAt: "2026-11-15" });
      return comoProject(proyectoDoc(APROBADA));
    });
    const res = await POST(peticion());
    expect(res.status).toBe(404);
    expect(db.updates()).toHaveLength(0);
    expect((db.snapshot()[rutaResultado(RESULTADO_PREVIO)] as { marca: string }).marca).toBe("resultado anterior");
  });
});
