// T7 C1 — caracterización de la elección del análisis en POST link-moddulo (la misma regla de «el último» que
// latest-analysis). Escrita y verde ANTES de mover la regla a `elegirUltimoAnalisis`; debe seguir verde sin
// editarse. Se observa por `sourceAnalysisId` (respuesta) y por el vínculo y la huella que se escriben.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: "m1" }) }) as never;
const NAC = { nivel: "nacional", nombre: "México" };
const an = (extra: Record<string, unknown> = {}) => ({ status: "APPROVED", projectId: "pest1", dimensions: [], ...extra });

function sembrar(analisis: Record<string, Record<string, unknown>>) {
  const docs: Record<string, unknown> = {
    "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: NAC },
    "moddulo_projects/m1": { name: "M", type: "electoral", territorio: NAC, xpcto: { hito: "h" }, phases: { exploracion: {} } },
  };
  for (const [id, d] of Object.entries(analisis)) docs[`pestel_analyses/${id}`] = d;
  mockDb.reset(structuredClone(docs));
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
}
const elegido = async () => {
  const r = await POST(req(), ctx);
  expect(r.status).toBe(201);
  return (await r.json()).sourceAnalysisId as string | null;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("link-moddulo — qué análisis elige (misma regla que latest-analysis)", () => {
  it("sin análisis → sourceAnalysisId null y vínculo sin mapa", async () => {
    sembrar({});
    expect(await elegido()).toBeNull();
  });

  it("prefiere el vigente aunque haya uno no vigente más reciente", async () => {
    sembrar({ viejo: an({ vigente: true, analyzedAt: "2026-01-01T00:00:00Z" }), nuevo: an({ vigente: false, analyzedAt: "2026-06-01T00:00:00Z" }) });
    expect(await elegido()).toBe("viejo");
  });

  it("entre vigentes toma el más reciente", async () => {
    sembrar({ a: an({ vigente: true, analyzedAt: "2026-01-01T00:00:00Z" }), b: an({ vigente: true, analyzedAt: "2026-03-01T00:00:00Z" }), c: an({ vigente: true, analyzedAt: "2026-02-01T00:00:00Z" }) });
    expect(await elegido()).toBe("b");
  });

  // INVERTIDA A PROPÓSITO en T7 C2 (antes: «201 con el más reciente»): un análisis con `vigente: false` ahora pide
  // confirmación de origen (409, razón no_vigente con la fecha del análisis elegido). La regla de elección no cambia:
  // confirmado con la huella que devolvió el servidor, vincula con el más reciente de todos.
  it("si ninguno es vigente, toma el más reciente de todos (ahora tras confirmar el origen)", async () => {
    sembrar({ a: an({ vigente: false, analyzedAt: "2026-01-01T00:00:00Z" }), b: an({ vigente: false, analyzedAt: "2026-05-01T00:00:00Z" }) });
    const pide = await POST(req(), ctx);
    expect(pide.status).toBe(409);
    const cuerpo = await pide.json();
    expect(cuerpo.error).toBe("origen_requiere_confirmacion");
    expect(cuerpo.razones).toEqual([{ tipo: "no_vigente", fechaAnalisis: "2026-05-01T00:00:00.000Z" }]);
    expect(mockDb.updates()).toHaveLength(0);
    const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: "m1", confirmarOrigen: true, huellaOrigen: cuerpo.huella }) }) as never, ctx);
    expect(r.status).toBe(201);
    expect((await r.json()).sourceAnalysisId).toBe("b");
  });

  it("`vigente` ausente cuenta como vigente (solo `false` lo excluye)", async () => {
    sembrar({ sinCampo: an({ analyzedAt: "2026-01-01T00:00:00Z" }), noVigente: an({ vigente: false, analyzedAt: "2026-09-01T00:00:00Z" }) });
    expect(await elegido()).toBe("sinCampo");
  });

  it("acepta fechas {_seconds} y texto ISO en el mismo conjunto", async () => {
    sembrar({ iso: an({ analyzedAt: "2026-02-01T00:00:00Z" }), ts: an({ analyzedAt: { _seconds: Date.parse("2026-04-01T00:00:00Z") / 1000 } }) });
    expect(await elegido()).toBe("ts");
  });

  it("sin `analyzedAt` vale 0 y pierde contra cualquiera con fecha", async () => {
    sembrar({ sinFecha: an(), conFecha: an({ analyzedAt: "2000-01-01T00:00:00Z" }) });
    expect(await elegido()).toBe("conFecha");
  });

  it("empate: gana el primero en el orden de lectura (orden estable)", async () => {
    sembrar({ a: an({ analyzedAt: "2026-01-01T00:00:00Z" }), b: an({ analyzedAt: "2026-01-01T00:00:00Z" }) });
    expect(await elegido()).toBe("a");
  });

  it("el mapa y la huella que se escriben salen del análisis elegido, no de otro", async () => {
    const dim = (code: string) => ({ code, classification: "AMENAZA", narrative: `n-${code}` });
    sembrar({ viejo: an({ vigente: true, analyzedAt: "2026-01-01T00:00:00Z", dimensions: [dim("P")] }), nuevo: an({ vigente: true, analyzedAt: "2026-05-01T00:00:00Z", dimensions: [dim("E")] }) });
    expect(await elegido()).toBe("nuevo");
    const ls = mockDb.updates().find((u) => u.path === "moddulo_projects/m1")?.data["phases.exploracion.linkedSource"] as { sourceAnalysisId: string; payload: Record<string, unknown>; huellaFuente: { v: number; h: string } };
    expect(ls.sourceAnalysisId).toBe("nuevo");
    expect(Object.keys(ls.payload)).toEqual(["E"]);
    expect(ls.huellaFuente.v).toBe(1);
  });
});
