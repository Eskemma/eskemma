// GET /api/moddulo/projects/[projectId] ahora entrega, junto a `project`, el estado de revisión del M1
// con la huella YA calculada (la pantalla no puede: node:crypto). Aditivo: `project` no cambia.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return { ...real, getProject: vi.fn() };
});

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { GET } from "./route";
import { aprobacionDe, docProyectoM1, huellaDe, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";

const llamar = () => GET(new Request("http://local/x") as never, { params: Promise.resolve({ projectId: "p1" }) });
const proyecto = (o: Parameters<typeof docProyectoM1>[0] = {}) =>
  ({ id: "p1", xpcto: { hito: "h", sujeto: "s", justificacion: "j" }, ...docProyectoM1(o) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("GET proyecto — resumen del M1", () => {
  it("entrega `project` intacto y `m1` con la huella del M1 que ve la pantalla", async () => {
    const p = proyecto();
    vi.mocked(getProject).mockResolvedValue(p);
    const b = await (await llamar()).json();
    expect(b.project.id).toBe("p1");
    expect(b.project.phases.exploracion.linkedSource.payload.P.narrativa).toBe("IA P");
    expect(b.m1).toEqual({
      estado: "borrador", aprobacionValida: false, motoresSinGenerar: false,
      huella: huellaDe(mapaM1()), kind: "express", dimensionesEditadas: [],
    });
  });

  it("con aprobación válida: aprobado, y motoresSinGenerar mientras no haya generación de esa huella", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ m1: { aprobacion: aprobacionDe(mapaM1()) } }));
    const b = await (await llamar()).json();
    expect(b.m1).toMatchObject({ estado: "aprobado", aprobacionValida: true, motoresSinGenerar: true });
  });

  it("proyecto anterior (payload con dvs y sin m1) → «anterior»; sin M1 → huella null", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ dvs: { hei: {} } }));
    expect((await (await llamar()).json()).m1.estado).toBe("anterior");
    vi.mocked(getProject).mockResolvedValue(proyecto({ payload: null }));
    expect((await (await llamar()).json()).m1).toMatchObject({ estado: "sin_m1", huella: null, kind: null });
  });

  it("401 sin sesión y 404 sin acceso siguen igual (sin `m1`)", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await llamar()).status).toBe(401);
    vi.mocked(getProject).mockResolvedValue(null as never);
    const r = await llamar();
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Proyecto no encontrado" });
  });
});
