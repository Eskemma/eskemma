// T7 C1 — caracterización de GET latest-analysis (qué análisis es «el último»). Escrita y verde ANTES de mover
// la regla a `elegirUltimoAnalisis`; debe seguir verde sin editarse. La página `analisis/page.tsx` NO calcula
// el último: consume `analysisId` de esta ruta (no hay prueba de DOM; queda cubierta por estas pruebas).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { GET } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const llamar = () => GET(new Request("http://local/x") as never, ctx);
const an = (extra: Record<string, unknown> = {}) => ({ projectId: "pest1", ...extra });
const sembrar = (analisis: Record<string, Record<string, unknown>>) => {
  const docs: Record<string, unknown> = { "pestel_projects/pest1": { userId: "u1" } };
  for (const [id, d] of Object.entries(analisis)) docs[`pestel_analyses/${id}`] = d;
  mockDb.reset(structuredClone(docs));
};
const id = async () => (await (await llamar()).json()).analysisId;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("GET latest-analysis — acceso", () => {
  it("401 sin sesión y 404 si el proyecto es ajeno o no existe", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await llamar()).status).toBe(401);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "otro" } as never);
    sembrar({ a1: an() });
    expect((await llamar()).status).toBe(404);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
    mockDb.reset({});
    expect((await llamar()).status).toBe(404);
  });

  it("sin análisis → { analysisId: null }", async () => {
    sembrar({});
    expect(await (await llamar()).json()).toEqual({ analysisId: null });
  });
});

describe("GET latest-analysis — regla del último", () => {
  it("prefiere el vigente aunque haya uno no vigente más reciente", async () => {
    sembrar({ viejo: an({ vigente: true, analyzedAt: "2026-01-01T00:00:00Z" }), nuevo: an({ vigente: false, analyzedAt: "2026-06-01T00:00:00Z" }) });
    expect(await id()).toBe("viejo");
  });

  it("entre vigentes toma el más reciente", async () => {
    sembrar({ a: an({ vigente: true, analyzedAt: "2026-01-01T00:00:00Z" }), b: an({ vigente: true, analyzedAt: "2026-03-01T00:00:00Z" }), c: an({ vigente: true, analyzedAt: "2026-02-01T00:00:00Z" }) });
    expect(await id()).toBe("b");
  });

  it("si ninguno es vigente, toma el más reciente de todos", async () => {
    sembrar({ a: an({ vigente: false, analyzedAt: "2026-01-01T00:00:00Z" }), b: an({ vigente: false, analyzedAt: "2026-05-01T00:00:00Z" }) });
    expect(await id()).toBe("b");
  });

  it("`vigente` ausente cuenta como vigente (solo `false` lo excluye)", async () => {
    sembrar({ sinCampo: an({ analyzedAt: "2026-01-01T00:00:00Z" }), noVigente: an({ vigente: false, analyzedAt: "2026-09-01T00:00:00Z" }) });
    expect(await id()).toBe("sinCampo");
  });

  it("acepta fechas {_seconds} y texto ISO en el mismo conjunto", async () => {
    const t = (iso: string) => ({ _seconds: Date.parse(iso) / 1000 });
    sembrar({ iso: an({ analyzedAt: "2026-02-01T00:00:00Z" }), ts: an({ analyzedAt: t("2026-04-01T00:00:00Z") }) });
    expect(await id()).toBe("ts");
  });

  it("sin `analyzedAt` vale 0 y pierde contra cualquiera con fecha", async () => {
    sembrar({ sinFecha: an(), conFecha: an({ analyzedAt: "2000-01-01T00:00:00Z" }) });
    expect(await id()).toBe("conFecha");
  });

  it("empate: gana el primero en el orden de lectura (orden estable)", async () => {
    sembrar({ a: an({ analyzedAt: "2026-01-01T00:00:00Z" }), b: an({ analyzedAt: "2026-01-01T00:00:00Z" }) });
    expect(await id()).toBe("a");
  });

  it("devuelve `analyzedAt` tal como está guardado, o null si falta", async () => {
    sembrar({ a: an({ analyzedAt: "2026-01-01T00:00:00Z" }) });
    expect(await (await llamar()).json()).toEqual({ analysisId: "a", analyzedAt: "2026-01-01T00:00:00Z" });
    sembrar({ a: an() });
    expect(await (await llamar()).json()).toEqual({ analysisId: "a", analyzedAt: null });
  });

  it("una fecha ilegible (NaN) se conserva como hoy: con una sola candidata gana esa", async () => {
    sembrar({ a: an({ analyzedAt: "no-es-fecha" }) });
    expect(await id()).toBe("a");
  });
});
