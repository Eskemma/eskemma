// app/api/moddulo/f3/canal3/vincular/route.test.ts
// Regresión del fix de IDOR de storagePath (2026-09-15) a nivel de
// endpoint completo — mismo criterio que entregar/route.test.ts.
// evaluarCompatibilidad/extraerTerritorioEscalar se mockean ("todo
// compatible") — esa lógica queda fuera de alcance, igual que en el
// fix original de seguridad.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModduloProject } from "@/types/moddulo.types";
import type { EvaluacionCompatibilidad } from "@/types/shared.types";

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
import type {
  createMockAdminDb,
  createMockAdminStorage,
} from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const mockAdminStorage = adminStorage as unknown as ReturnType<typeof createMockAdminStorage>;
const mockGetSessionFromRequest = vi.mocked(getSessionFromRequest);
const mockGetProject = vi.mocked(getProject);
const mockExtractTextPerFile = vi.mocked(extractTextPerFile);
const mockEvaluarCompatibilidad = vi.mocked(evaluarCompatibilidad);
const mockExtraerTerritorioEscalar = vi.mocked(extraerTerritorioEscalar);

const UID = "uidA";
const OTHER_UID = "uidB";
const PROJECT_ID = "projA";
const OTHER_PROJECT_ID = "projB";
const RESULTADO_ID = "res1";
const OWN_PATH = `moddulo/${UID}/${PROJECT_ID}/f3/${RESULTADO_ID}/archivo.pdf`;

const todoCompatible: EvaluacionCompatibilidad = {
  pertinencia: { cumple: true, detalle: "ok" },
  vigencia: { cumple: true, detalle: "ok" },
  compatibilidadMetodologica: { cumple: true, detalle: "ok" },
};

const metadatosFuenteBase = {
  nombreHerramienta: "Test",
  territorioDeclarado: { nivel: "nacional", nombre: "México" },
  fechaObtencion: "2026-01-01",
  metodoDeclarado: "prueba",
  familiaMetodologica: "otro",
  tipoProyectoDeclarado: "electoral",
};

const bodyBaseValido = {
  projectId: PROJECT_ID,
  resultadoId: RESULTADO_ID,
  storagePath: OWN_PATH,
  nombre: "archivo.pdf",
  tipo: "application/pdf",
  metadatosFuente: metadatosFuenteBase,
  moduloPIP: "¿Pregunta?",
  cobertura: { completa: true },
};

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/moddulo/f3/canal3/vincular", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/moddulo/f3/canal3/vincular", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminDb.reset();
    mockAdminStorage.reset();
    mockEvaluarCompatibilidad.mockReturnValue(todoCompatible);
    mockExtraerTerritorioEscalar.mockReturnValue({} as ReturnType<typeof extraerTerritorioEscalar>);
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
    expect(mockAdminDb.collection).not.toHaveBeenCalled();
    expect(mockGetProject).not.toHaveBeenCalled();
    expect(mockAdminStorage.bucket).not.toHaveBeenCalled();
  });

  it("responde 403 si reporteStoragePath pertenece a otro projectId (storagePath propio válido)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const reporteAjeno = `moddulo/${UID}/${OTHER_PROJECT_ID}/f3/${RESULTADO_ID}/reporte.md`;
    const res = await POST(
      buildRequest({ ...bodyBaseValido, reporteStoragePath: reporteAjeno })
    );
    expect(res.status).toBe(403);
    expect(mockAdminDb.collection).not.toHaveBeenCalled();
  });

  it("responde 404 si el proyecto no existe (pasa la autorización, falla después)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue(null);
    const res = await POST(buildRequest(bodyBaseValido));
    expect(res.status).toBe(404);
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
  });
});
