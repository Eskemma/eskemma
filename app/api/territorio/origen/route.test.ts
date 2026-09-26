// Portabilidad por id (Paso 4b): GET /api/territorio/origen.
// Cubre 401/400, el MISMO 404 para origen inexistente y ajeno en las 3 apps (no es un oráculo de
// existencia), respuesta sin campos extra, plurales/cve_distrito íntegros y el caso legado.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
// getProject (usado por la resincronización de Fontana) actualiza lastAccessedAt vía snap.ref, que el mock de
// adminDb no modela: se sustituye SOLO ese export; getProjectParaPrellenado (la ruta de Moddulo) es el real.
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return {
    ...real,
    getProject: vi.fn(async (id: string, uid: string) => {
      const p = await real.getProjectParaPrellenado(id, uid);
      return p ? { id, ...p } : null;
    }),
  };
});
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));

import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { GET } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidA";
const AJENO = "uidVictima";

const TERR_ZMG = {
  nivel: "municipal",
  nombre: "ZMG",
  estado: "Jalisco",
  municipio: "Guadalajara",
  pais: "México",
  municipiosPorEstado: [
    { nombre: "Guadalajara", estado: "Jalisco", clave: "14:GUADALAJARA" },
    { nombre: "Zapopan", estado: "Jalisco", clave: "14:ZAPOPAN" },
  ],
};
const TERR_DIST = {
  nivel: "distrito_federal",
  nombre: "PROGRESO",
  estado: "Yucatán",
  cve_distrito: "002",
  distritosSeleccionados: [{ cve: "002", nombre: "PROGRESO", estado: "Yucatán" }],
};

const DOCS = {
  "moddulo_projects/mProp": {
    name: "Mi proyecto", type: "electoral", color: "#026988", territorio: TERR_ZMG,
    collaborators: [{ uid: UID, role: "owner" }], secreto: "no debe salir",
  },
  "moddulo_projects/mAjeno": {
    name: "Ajeno", type: "electoral", territorio: TERR_ZMG, collaborators: [{ uid: AJENO, role: "owner" }],
  },
  "moddulo_projects/mLegado": {
    name: "Legado", type: "gubernamental", territorio: { nivel: "estatal", nombre: "Jalisco", estado: "Jalisco" },
    collaborators: [{ uid: UID, role: "owner" }],
  },
  "pestel_projects/pProp": { userId: UID, nombre: "PESTEL propio", tipo: "legislativo", color: "#111111", territorio: TERR_DIST, alertas: { notificarEmail: true } },
  "pestel_projects/pAjeno": { userId: AJENO, nombre: "PESTEL ajeno", tipo: "legislativo", territorio: TERR_DIST },
  "fontana_sesiones/fProp": { uid: UID, nombre: "Sesión", tipoProyecto: "electoral", color: "#248CC1", territorio: TERR_DIST },
  "fontana_sesiones/fAjeno": { uid: AJENO, tipoProyecto: "electoral", territorio: TERR_DIST },
  "fontana_sesiones/fVinculada": {
    uid: UID, tipoProyecto: "electoral", modduloProjectId: "mProp", territorio: { nivel: "nacional", nombre: "México" },
  },
};

const req = (qs: string) => new NextRequest(`http://localhost/api/territorio/origen?${qs}`);

async function pedir(qs: string) {
  const res = await GET(req(qs));
  return { status: res.status, body: await res.json() };
}

describe("GET /api/territorio/origen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminDb.reset(DOCS);
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
  });

  it("401 sin sesión", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await pedir("app=moddulo&id=mProp")).status).toBe(401);
  });

  it("400 con app fuera de la lista o sin id", async () => {
    expect((await pedir("app=otra&id=mProp")).status).toBe(400);
    expect((await pedir("app=moddulo")).status).toBe(400);
    expect((await pedir("id=mProp")).status).toBe(400);
  });

  it.each([
    ["moddulo", "mAjeno", "mNoExiste"],
    ["pestel", "pAjeno", "pNoExiste"],
    ["fontana", "fAjeno", "fNoExiste"],
  ])("%s: origen ajeno e inexistente responden EXACTAMENTE lo mismo (404, sin oráculo de existencia)", async (app, ajeno, inexistente) => {
    const a = await pedir(`app=${app}&id=${ajeno}`);
    const b = await pedir(`app=${app}&id=${inexistente}`);
    expect(a.status).toBe(404);
    expect(a).toEqual(b);
  });

  it("un id mal formado se trata igual que uno inexistente (mismo 404)", async () => {
    const mal = await pedir("app=moddulo&id=../otra/ruta");
    expect(mal).toEqual(await pedir("app=moddulo&id=mNoExiste"));
  });

  it("moddulo propio: territorio íntegro (plurales y claves) y SOLO los 4 campos", async () => {
    const { status, body } = await pedir("app=moddulo&id=mProp");
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["color", "nombre", "territorio", "tipo"]);
    expect(body.territorio).toEqual(TERR_ZMG);
    expect(body).toMatchObject({ nombre: "Mi proyecto", tipo: "electoral", color: "#026988" });
    expect(JSON.stringify(body)).not.toContain("secreto");
  });

  it("pestel propio: territorio con cve_distrito y distritosSeleccionados íntegros, sin exponer el documento", async () => {
    const { status, body } = await pedir("app=pestel&id=pProp");
    expect(status).toBe(200);
    expect(body.territorio).toEqual(TERR_DIST);
    expect(Object.keys(body).sort()).toEqual(["color", "nombre", "territorio", "tipo"]);
    expect(JSON.stringify(body)).not.toContain("notificarEmail");
  });

  it("fontana propia: territorio y tipo; una sesión vinculada se resincroniza con el proyecto Moddulo", async () => {
    expect((await pedir("app=fontana&id=fProp")).body.territorio).toEqual(TERR_DIST);
    const v = await pedir("app=fontana&id=fVinculada");
    expect(v.status).toBe(200);
    expect(v.body.territorio).toEqual(TERR_ZMG); // no el snapshot nacional guardado en la sesión
  });

  it("caso legado (sin plurales, sin país): se devuelve tal cual, sin inventar campos", async () => {
    const { status, body } = await pedir("app=moddulo&id=mLegado");
    expect(status).toBe(200);
    expect(body.territorio).toEqual({ nivel: "estatal", nombre: "Jalisco", estado: "Jalisco" });
  });

  it("un origen sin territorio responde el mismo 404 (nada que prellenar)", async () => {
    mockAdminDb.reset({ "pestel_projects/pVacio": { userId: UID, nombre: "x", tipo: "electoral" } });
    expect(await pedir("app=pestel&id=pVacio")).toEqual(await pedir("app=pestel&id=pNoExiste"));
  });

  it("el prellenado no muta el proyecto Moddulo origen (sin lastAccessedAt)", async () => {
    await pedir("app=moddulo&id=mProp");
    expect((mockAdminDb.snapshot()["moddulo_projects/mProp"] as Record<string, unknown>).lastAccessedAt).toBeUndefined();
  });
});
