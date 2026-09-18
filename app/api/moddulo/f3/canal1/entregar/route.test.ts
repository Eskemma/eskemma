// app/api/moddulo/f3/canal1/entregar/route.test.ts
// Regresión del fix de IDOR de storagePath (2026-09-15) a nivel de
// endpoint completo — complementa lib/moddulo/storagePathAuth.test.ts
// (que prueba solo la función aislada) probando la orquestación real
// del route handler: orden de checks, y que el 403 corta antes de
// tocar Firestore/Storage.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModduloProject } from "@/types/moddulo.types";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import(
    "@/lib/moddulo/__tests__/fixtures/adminMocks"
  );
  return {
    adminDb: createMockAdminDb(),
    adminStorage: createMockAdminStorage(),
  };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/moddulo/attachments", () => ({ extractTextPerFile: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const mockGetSessionFromRequest = vi.mocked(getSessionFromRequest);
const mockGetProject = vi.mocked(getProject);
const mockExtractTextPerFile = vi.mocked(extractTextPerFile);

const UID = "uidA";
const OTHER_UID = "uidB";
const PROJECT_ID = "projA";
const OTHER_PROJECT_ID = "projB";
const SESION_ID = "sesA";
const OWN_PATH = `moddulo/${UID}/${PROJECT_ID}/f3/res1/fontana-contexto.json`;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/moddulo/f3/canal1/entregar", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const projectConAsignacionCanal1 = {
  phases: {
    investigacion: {
      f3TareasPIP: [
        {
          pipItemId: "pip1",
          asignaciones: [
            {
              asignacionId: "asig1",
              tipo: "primaria",
              canal: "canal1",
              tecnicaId: "T10",
              justificacion: "test",
              estado: "en_curso",
              activada: true,
            },
          ],
        },
      ],
    },
    exploracion: { dvs: { pip: [{ pipItemId: "pip1", pregunta: "¿Test?" }] } },
  },
} as unknown as ModduloProject;

describe("POST /api/moddulo/f3/canal1/entregar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminDb.reset();
  });

  it("responde 401 sin sesión", async () => {
    mockGetSessionFromRequest.mockResolvedValue(null);
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(401);
  });

  it("responde 400 si faltan campos requeridos", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const res = await POST(buildRequest({ projectId: PROJECT_ID }));
    expect(res.status).toBe(400);
  });

  it("responde 403 si storagePath pertenece a otro uid, sin tocar Firestore/Storage/attachments", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const ajeno = `moddulo/${OTHER_UID}/${PROJECT_ID}/f3/res1/fontana-contexto.json`;
    const res = await POST(
      buildRequest({ projectId: PROJECT_ID, sesionId: SESION_ID, storagePath: ajeno })
    );
    expect(res.status).toBe(403);
    expect(mockAdminDb.collection).not.toHaveBeenCalled();
    expect(mockGetProject).not.toHaveBeenCalled();
    expect(mockExtractTextPerFile).not.toHaveBeenCalled();
  });

  it("responde 403 si reporteStoragePath pertenece a otro projectId (storagePath propio válido)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const reporteAjeno = `moddulo/${UID}/${OTHER_PROJECT_ID}/f3/res1/fontana-reporte.md`;
    const res = await POST(
      buildRequest({
        projectId: PROJECT_ID,
        sesionId: SESION_ID,
        storagePath: OWN_PATH,
        reporteStoragePath: reporteAjeno,
      })
    );
    expect(res.status).toBe(403);
    expect(mockAdminDb.collection).not.toHaveBeenCalled();
  });

  it("responde 404 si la sesión de Fontana no existe (pasa la autorización, falla después)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const res = await POST(
      buildRequest({ projectId: PROJECT_ID, sesionId: SESION_ID, storagePath: OWN_PATH })
    );
    expect(res.status).toBe(404);
  });

  it("responde 200 y crea el resultado con datos propios válidos (camino feliz)", async () => {
    mockAdminDb.reset({
      [`fontana_sesiones/${SESION_ID}`]: {
        uid: UID,
        modduloProjectId: PROJECT_ID,
        tareaPipIds: ["pip1"],
      },
    });
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue(projectConAsignacionCanal1);
    mockExtractTextPerFile.mockResolvedValue("texto extraído");

    const res = await POST(
      buildRequest({ projectId: PROJECT_ID, sesionId: SESION_ID, storagePath: OWN_PATH })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.resultadoId).toBeDefined();
    expect(mockExtractTextPerFile).toHaveBeenCalledWith(
      expect.objectContaining({ storagePath: OWN_PATH })
    );
  });
});
