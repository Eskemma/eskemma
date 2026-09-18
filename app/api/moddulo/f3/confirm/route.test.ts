// app/api/moddulo/f3/confirm/route.test.ts
// Regresión del IDOR de storagePath en Canal 2 (carga manual) — el mismo
// hueco que ya se cerró en canal1/entregar y canal3/vincular (2026-09-15) y
// que confirm nunca recibió. Mismo criterio de mocking que esos 2 tests:
// se prueba la orquestación del handler (orden de checks; que el 403 corta
// antes de tocar Firestore/Storage/attachments), no el SDK de Firebase.

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

import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type {
  createMockAdminDb,
  createMockAdminStorage,
} from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const mockAdminStorage = adminStorage as unknown as ReturnType<typeof createMockAdminStorage>;
const mockGetSessionFromRequest = vi.mocked(getSessionFromRequest);
const mockGetProject = vi.mocked(getProject);
const mockExtractTextPerFile = vi.mocked(extractTextPerFile);

const UID = "uidA";
const OTHER_UID = "uidB";
const PROJECT_ID = "projA";
const RESULTADO_ID = "res1";
const OWN_PATH = `moddulo/${UID}/${PROJECT_ID}/f3/${RESULTADO_ID}/archivo.pdf`;

const bodyBaseValido = {
  projectId: PROJECT_ID,
  resultadoId: RESULTADO_ID,
  storagePath: OWN_PATH,
  nombre: "archivo.pdf",
  tipo: "application/pdf",
  metadatosCarga: { tecnicaDescrita: "encuesta", fechaObtencion: "2026-01-01" },
  moduloPIP: "¿Pregunta?",
  cobertura: { completa: true },
};

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/moddulo/f3/confirm", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/moddulo/f3/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminDb.reset();
    mockAdminStorage.reset();
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
    const ajeno = `moddulo/${OTHER_UID}/${PROJECT_ID}/f3/${RESULTADO_ID}/archivo.pdf`;
    const res = await POST(buildRequest({ ...bodyBaseValido, storagePath: ajeno }));
    expect(res.status).toBe(403);
    expect(mockGetProject).not.toHaveBeenCalled();
    expect(mockAdminStorage.bucket).not.toHaveBeenCalled();
    expect(mockAdminDb.collection).not.toHaveBeenCalled();
    expect(mockExtractTextPerFile).not.toHaveBeenCalled();
  });

  it("responde 403 si storagePath es de otro projectId del mismo uid", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const otroProyecto = `moddulo/${UID}/projB/f3/${RESULTADO_ID}/archivo.pdf`;
    const res = await POST(buildRequest({ ...bodyBaseValido, storagePath: otroProyecto }));
    expect(res.status).toBe(403);
    expect(mockAdminStorage.bucket).not.toHaveBeenCalled();
  });

  it("responde 404 si el proyecto no existe (pasa la autorización, falla después)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue(null);
    const res = await POST(buildRequest(bodyBaseValido));
    expect(res.status).toBe(404);
  });

  it("responde 404 file_not_found si el path es propio pero el archivo no está en Storage", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({} as unknown as ModduloProject);
    const res = await POST(buildRequest(bodyBaseValido));
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toBe("file_not_found");
    expect(mockExtractTextPerFile).not.toHaveBeenCalled();
  });

  it("responde 200 y crea el resultado con datos propios válidos (camino feliz)", async () => {
    mockAdminStorage.reset([OWN_PATH]);
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({} as unknown as ModduloProject);
    mockExtractTextPerFile.mockResolvedValue("texto extraído");

    const res = await POST(buildRequest(bodyBaseValido));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.resultadoId).toBe(RESULTADO_ID);
    expect(mockExtractTextPerFile).toHaveBeenCalledWith(
      expect.objectContaining({ storagePath: OWN_PATH })
    );
    const escrito = mockAdminDb.snapshot()[`moddulo_projects/${PROJECT_ID}/f3Resultados/${RESULTADO_ID}`];
    expect(escrito).toMatchObject({ payload: { archivoUrl: OWN_PATH, extractoTexto: "texto extraído" } });
  });
});
