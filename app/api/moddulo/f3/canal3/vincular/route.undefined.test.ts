// 7b-7 (N3) — un proyecto SIN territorio escribía `proyectoTerritorioSnapshotAtVinculacion: undefined`
// y el Admin SDK real rechaza `undefined` (lib/firebase-admin.ts no activa ignoreUndefinedProperties).
// Aquí el mock rechaza `undefined` con el mensaje literal del SDK real (rechazarUndefined).
// Contra el código anterior la prueba falla con:
//   Value for argument "data" is not a valid Firestore document. Cannot use "undefined" as a Firestore
//   value (found in field "proyectoTerritorioSnapshotAtVinculacion"). …
// Usa la evaluación de compatibilidad REAL (sin mocks) para que el escenario sea el de producción.

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
import { UID, OWN_PATH, rutaProyecto, rutaResultado, proyectoDoc, bodyValido, comoProject, metadatosFuente } from "./siembraVincular";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const storage = adminStorage as unknown as ReturnType<typeof createMockAdminStorage>;
const peticion = (extra: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/moddulo/f3/canal3/vincular", {
    method: "POST",
    body: JSON.stringify({ ...bodyValido, ...extra }),
  }) as unknown as Parameters<typeof POST>[0];

function sembrar(proyecto: Record<string, unknown>) {
  db.reset({ [rutaProyecto]: proyecto });
  db.rechazarUndefined(true);
  storage.reset([OWN_PATH]);
  vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
}

describe("canal3/vincular — N3: nada llega a Firestore con undefined", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
  });

  it("proyecto sin territorio: 200 y el resultado se escribe SIN la clave del snapshot", async () => {
    // Sin territorio el proyecto no coincide con el declarado: el usuario confirma (confirmarPeseATerritorio).
    sembrar(proyectoDoc({ territorio: undefined }));
    const res = await POST(peticion({ confirmarPeseATerritorio: true }));
    expect(res.status).toBe(200);
    const doc = db.snapshot()[rutaResultado] as Record<string, unknown>;
    expect(doc).toBeDefined();
    expect("proyectoTerritorioSnapshotAtVinculacion" in doc).toBe(false);
  });

  it("proyecto CON territorio: el snapshot sigue escribiéndose", async () => {
    sembrar(proyectoDoc());
    const res = await POST(peticion());
    expect(res.status).toBe(200);
    const doc = db.snapshot()[rutaResultado] as { proyectoTerritorioSnapshotAtVinculacion?: string };
    expect(typeof doc.proyectoTerritorioSnapshotAtVinculacion).toBe("string");
    expect(metadatosFuente.tipoProyectoDeclarado).toBe("electoral");
  });
});
