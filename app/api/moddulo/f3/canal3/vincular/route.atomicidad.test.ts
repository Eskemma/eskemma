// 7b-7 — ATOMICIDAD de canal3/vincular: el resultado y el borrado del marcador de Fontana salen en UNA
// transacción (antes: 2 escrituras sueltas), y la compatibilidad (evaluarCompatibilidad es pura) se
// reevalúa DENTRO con el proyecto releído: un cambio de territorio entre el pre-chequeo y la escritura da
// el mismo 422. Usa la evaluación REAL (sin mocks de canal3Evaluation ni de staleness).
// Límites: sin emulador de Firestore (Java 17; se requiere ≥ 21) no se prueban aislamiento real ni
// reintentos; la carrera se simula escribiendo en el hueco entre getProject y la transacción.

import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb, createMockAdminStorage } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import {
  UID, OWN_PATH, SESION_FONTANA, rutaProyecto, rutaResultado, proyectoDoc, bodyValido, comoProject, territorioYucatan,
} from "./siembraVincular";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const storage = adminStorage as unknown as ReturnType<typeof createMockAdminStorage>;
const peticion = (extra: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/moddulo/f3/canal3/vincular", {
    method: "POST",
    body: JSON.stringify({ ...bodyValido, ...extra }),
  }) as unknown as Parameters<typeof POST>[0];

function sembrar() {
  const proyecto = proyectoDoc();
  db.reset({ [rutaProyecto]: proyecto });
  db.atomico(true);
  storage.reset([OWN_PATH]);
  vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
}
const hayResultado = () => db.snapshot()[rutaResultado] !== undefined;

describe("canal3/vincular — atomicidad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
  });

  it("camino feliz con marcador: UNA transacción con resultado + borrado del marcador", async () => {
    sembrar();
    const res = await POST(peticion({ fontanaSesionId: SESION_FONTANA }));
    expect(res.status).toBe(200);
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect(hayResultado()).toBe(true);
    expect(db.updates().filter((u) => u.path === rutaProyecto)).toHaveLength(1);
  });

  it("falla el borrado del marcador: el resultado NO queda escrito", async () => {
    sembrar();
    db.failUpdateOn(rutaProyecto);
    await expect(POST(peticion({ fontanaSesionId: SESION_FONTANA }))).rejects.toThrow();
    expect(hayResultado()).toBe(false);
  });

  it("carrera: el marcador de Fontana ya no coincide en el hueco → no se actualiza el proyecto", async () => {
    sembrar();
    vi.mocked(getProject).mockImplementationOnce(async () => {
      await db.collection("moddulo_projects").doc("projA").set(proyectoDoc({ phases: { investigacion: {} } })); // otra pestaña ya lo resolvió
      return comoProject(proyectoDoc()); // la copia del pre-chequeo aún lo trae
    });
    const res = await POST(peticion({ fontanaSesionId: SESION_FONTANA }));
    expect(res.status).toBe(200);
    expect(hayResultado()).toBe(true);
    // C3a-2: ANTES `toHaveLength(0)`. AHORA solo el puntero del historial: el marcador NO se borra (ya no coincidía).
    expect(db.updates().map((u) => Object.keys(u.data))).toEqual([["phases.investigacion.revision"]]);
  });

  it("carrera: el proyecto va a la papelera en el hueco → 404 y NADA se escribe (cambio declarado)", async () => {
    sembrar();
    vi.mocked(getProject).mockImplementationOnce(async () => {
      await db.collection("moddulo_projects").doc("projA").set(proyectoDoc({ deletedAt: "2026-11-15" }));
      return comoProject(proyectoDoc());
    });
    const res = await POST(peticion());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Proyecto no encontrado");
    expect(hayResultado()).toBe(false);
  });

  it("carrera de territorio: cambia en el hueco → el mismo 422 que habría dado un instante después, sin escribir", async () => {
    sembrar();
    vi.mocked(getProject).mockImplementationOnce(async () => {
      await db.collection("moddulo_projects").doc("projA").set(proyectoDoc({ territorio: territorioYucatan }));
      return comoProject(proyectoDoc()); // el pre-chequeo vio Jalisco (compatible)
    });
    const res = await POST(peticion());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("territorio_requiere_confirmacion");
    expect(hayResultado()).toBe(false);
  });

  it("control: sin carrera, el mismo cuerpo con territorio compatible da 200 (la prueba anterior mide lo que dice)", async () => {
    sembrar();
    expect((await POST(peticion())).status).toBe(200);
  });

  it("carrera de vigencia: la fecha límite del proyecto cambia en el hueco → vigencia_rechazada sin escribir", async () => {
    sembrar();
    vi.mocked(getProject).mockImplementationOnce(async () => {
      await db.collection("moddulo_projects").doc("projA").set(proyectoDoc({ xpcto: { tiempo: { fechaLimite: "2025-06-30" } } }));
      return comoProject(proyectoDoc());
    });
    const res = await POST(peticion());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("vigencia_rechazada");
    expect(hayResultado()).toBe(false);
  });
});
