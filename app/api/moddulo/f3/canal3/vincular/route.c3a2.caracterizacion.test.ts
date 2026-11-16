// C3a-2 — CARACTERIZACIÓN de canal3/vincular escrita ANTES de adoptar el historial: qué pasa hoy cuando el
// resultadoId YA existe (se REEMPLAZA el documento completo, sin conservar nada del anterior) y qué escritura
// al proyecto hace cada caso del marcador de Fontana. Debe pasar contra el código anterior (cb1c1f8).

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
import { UID, OWN_PATH, SESION_FONTANA, rutaProyecto, rutaResultado, proyectoDoc, bodyValido, comoProject } from "./siembraVincular";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const storage = adminStorage as unknown as ReturnType<typeof createMockAdminStorage>;
const compatible: EvaluacionCompatibilidad = {
  pertinencia: { cumple: true, detalle: "ok" },
  vigencia: { cumple: true, detalle: "ok" },
  compatibilidadMetodologica: { cumple: true, detalle: "ok" },
};
const peticion = (extra: Record<string, unknown> = {}) =>
  new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ ...bodyValido, ...extra }) }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
  vi.mocked(extractTextPerFile).mockResolvedValue("texto nuevo");
  vi.mocked(evaluarCompatibilidad).mockReturnValue(compatible);
  vi.mocked(extraerTerritorioEscalar).mockReturnValue({ nivel: "estatal" } as ReturnType<typeof extraerTerritorioEscalar>);
});

describe("canal3/vincular — caracterización C3a-2 (comportamiento actual)", () => {
  it("si el resultadoId YA existe, el documento se REEMPLAZA completo (no se conserva aprobado, notas ni campos previos)", async () => {
    const proyecto = proyectoDoc();
    db.reset({
      [rutaProyecto]: proyecto,
      [rutaResultado]: { moduloPIP: "viejo", aprobado: true, notasUsuario: "n", campoViejo: 1, payload: { extractoTexto: "texto viejo" } },
    });
    storage.reset([OWN_PATH]);
    vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
    expect((await POST(peticion())).status).toBe(200);
    const doc = db.snapshot()[rutaResultado] as Record<string, unknown>;
    expect(doc.aprobado).toBeUndefined();
    expect(doc.notasUsuario).toBeUndefined();
    expect(doc.campoViejo).toBeUndefined();
    expect(doc.moduloPIP).toBe("¿Pregunta?");
    expect(Object.keys(doc).sort()).toEqual(["cobertura", "compatibilidad", "createdAt", "metadatosFuente", "moduloPIP", "origen", "payload", "proyectoTerritorioSnapshotAtVinculacion"]);
  });

  it("sin marcador que coincida solo se escribe el puntero; con marcador, UN update con borrado del marcador, updatedAt y puntero", async () => {
    const proyecto = proyectoDoc();
    db.reset({ [rutaProyecto]: proyecto });
    storage.reset([OWN_PATH]);
    vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
    await POST(peticion());
    // C3a-2: ANTES `toHaveLength(0)` (sin marcador no se escribía el proyecto). AHORA: solo el puntero del historial.
    expect(db.updates().filter((u) => u.path === rutaProyecto).map((u) => Object.keys(u.data))).toEqual([["phases.investigacion.revision"]]);

    db.reset({ [rutaProyecto]: proyecto });
    await POST(peticion({ fontanaSesionId: SESION_FONTANA }));
    const upd = db.updates().filter((u) => u.path === rutaProyecto);
    expect(upd).toHaveLength(1);
    // C3a-2: ANTES las claves eran [fontanaPendiente, updatedAt]; AHORA el mismo update lleva además el puntero.
    expect(Object.keys(upd[0].data).sort()).toEqual(["phases.investigacion.fontanaPendiente", "phases.investigacion.revision", "updatedAt"]);
  });
});
