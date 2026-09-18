// app/api/centinela/pestel/project/route.test.ts
// Regresión del hueco de escritura cross-tenant en POST /project:
// modduloProjectId llegaba del body y se usaba para LEER y ESCRIBIR
// moddulo_projects/{id} (phases.exploracion.linkedSource) vía Admin SDK sin
// verificar que session.uid fuera colaborador de ese proyecto — a diferencia
// de link-moddulo/route.ts, que sí llama getProject(id, session.uid).
// El check (getProject) cubre los 4 usos de modduloProjectId del handler:
// write-back del dedup, lectura del guard de conflicto, lectura de
// confirmReplace y write-back final. Aquí se prueba que un modduloProjectId
// ajeno corta ANTES de cualquier lectura/escritura, y que los flujos
// legítimos (con y sin modduloProjectId) siguen funcionando.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModduloProject } from "@/types/moddulo.types";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const mockGetSessionFromRequest = vi.mocked(getSessionFromRequest);
const mockGetProject = vi.mocked(getProject);

const UID = "uidA";
const MODDULO_ID = "modProjA";

const bodyBase = {
  nombre: "Análisis PESTEL de prueba",
  tipo: "electoral",
  territorio: { nivel: "nacional", nombre: "México" },
  horizonte: "2027",
};

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/centinela/pestel/project", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/centinela/pestel/project", () => {
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
    const res = await POST(buildRequest({ nombre: "x" }));
    expect(res.status).toBe(400);
  });

  it("responde 400 si el tipo es inválido", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const res = await POST(buildRequest({ ...bodyBase, tipo: "otro" }));
    expect(res.status).toBe(400);
  });

  it("responde 404 si modduloProjectId es de un proyecto ajeno, SIN leer ni escribir nada", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue(null); // getProject devuelve null si uid no es colaborador
    mockAdminDb.reset({
      [`moddulo_projects/${MODDULO_ID}`]: { phases: { exploracion: { linkedSource: { sourceId: "victima" } } } },
    });

    const res = await POST(buildRequest({ ...bodyBase, modduloProjectId: MODDULO_ID }));

    expect(res.status).toBe(404);
    expect(mockGetProject).toHaveBeenCalledWith(MODDULO_ID, UID);
    expect(mockAdminDb.collection).not.toHaveBeenCalled();
    // El vínculo de la víctima queda intacto y no se creó ningún pestel_project.
    const estado = mockAdminDb.snapshot();
    expect(estado[`moddulo_projects/${MODDULO_ID}`]).toEqual({
      phases: { exploracion: { linkedSource: { sourceId: "victima" } } },
    });
    expect(Object.keys(estado).some((p) => p.startsWith("pestel_projects/"))).toBe(false);
  });

  it("también rechaza (404) con confirmReplace:true — el atajo que además desvinculaba el PESTEL legítimo", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue(null);
    const res = await POST(
      buildRequest({ ...bodyBase, modduloProjectId: MODDULO_ID, confirmReplace: true })
    );
    expect(res.status).toBe(404);
    expect(mockAdminDb.collection).not.toHaveBeenCalled();
  });

  it("responde 201 y vincula con un modduloProjectId propio (camino feliz)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({} as unknown as ModduloProject);
    mockAdminDb.reset({ [`moddulo_projects/${MODDULO_ID}`]: { phases: { exploracion: {} } } });

    const res = await POST(buildRequest({ ...bodyBase, modduloProjectId: MODDULO_ID }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.projectId).toBeDefined();
    const estado = mockAdminDb.snapshot();
    expect(estado[`pestel_projects/${json.projectId}`]).toMatchObject({
      userId: UID,
      modduloProjectId: MODDULO_ID,
    });
    expect(estado[`moddulo_projects/${MODDULO_ID}`]).toMatchObject({
      "phases.exploracion.linkedSource.sourceId": json.projectId,
      "phases.exploracion.linkedSource.kind": "T22",
      "phases.exploracion.linkedSource.componente": "centinela",
    });
  });

  it("responde 200 con el proyecto existente (dedup) si el modduloProjectId propio ya tiene un pestel_project del usuario", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({} as unknown as ModduloProject);
    mockAdminDb.reset({
      [`moddulo_projects/${MODDULO_ID}`]: { phases: { exploracion: {} } },
      "pestel_projects/pestExistente": { userId: UID, modduloProjectId: MODDULO_ID },
    });

    const res = await POST(buildRequest({ ...bodyBase, modduloProjectId: MODDULO_ID }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.projectId).toBe("pestExistente");
  });

  it("responde 201 sin modduloProjectId y NO consulta getProject (flujo sin vínculo intacto)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));

    const res = await POST(buildRequest(bodyBase));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(mockGetProject).not.toHaveBeenCalled();
    expect(mockAdminDb.snapshot()[`pestel_projects/${json.projectId}`]).toMatchObject({ userId: UID });
  });
});
