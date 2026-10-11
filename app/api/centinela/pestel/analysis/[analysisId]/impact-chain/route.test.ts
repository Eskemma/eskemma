// H25 (commit 6b) — impact-chain DELETE: contrato que la pantalla necesita. La ruta borra por
// ÍNDICE, así que estas pruebas fijan lo que hace con un índice que ya no existe (404), con una
// cadena que no es del analista (403) y con un `update` que lanza (la excepción sale: Next
// responde un 500 sin código ni JSON, que guardadoHonesto trata como ambiguo).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", arrayUnion: (x: unknown) => x },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { DELETE } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ analysisId: "a1" }) };
const req = (index?: unknown) =>
  new Request("http://local/x", { method: "DELETE", body: JSON.stringify({ index }) }) as never;

const base = { dimensions: ["P"], description: "d", riskLevel: "MODERADO", recommendation: "r" };
const cadenas = [
  { ...base, description: "de la IA (sin source)" },
  { ...base, description: "mía", source: "analyst", addedByUserId: "u1" },
  { ...base, description: "otra mía", source: "analyst", addedByUserId: "u1" },
];

// La ruta hace `splice` sobre el arreglo que lee: cada prueba parte de una COPIA.
const siembra = () => ({
  "pestel_analyses/a1": { projectId: "p1", impactChains: structuredClone(cadenas) },
  "pestel_projects/p1": { userId: "u1" },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  mockDb.reset(siembra());
});

describe("DELETE impact-chain", () => {
  it("borra la cadena del analista por índice: 200 y UNA escritura con las demás intactas", async () => {
    const res = await DELETE(req(1), ctx);
    expect(res.status).toBe(200);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect((u[0].data.impactChains as Array<{ description: string }>).map((c) => c.description)).toEqual([
      "de la IA (sin source)",
      "otra mía",
    ]);
  });

  it("riesgo del borrado por índice: repetir el MISMO índice con la lista ya cambiada borra OTRA cadena", async () => {
    await DELETE(req(1), ctx); // borra «mía»; «otra mía» pasa al índice 1
    const res = await DELETE(req(1), ctx); // un reintento con la lista vieja
    expect(res.status).toBe(200);
    const ultima = mockDb.updates().at(-1)!.data.impactChains as Array<{ description: string }>;
    expect(ultima.map((c) => c.description)).toEqual(["de la IA (sin source)"]);
  });

  it("índice que ya no existe: 404 «Cadena no encontrada» y cero escrituras", async () => {
    const res = await DELETE(req(7), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Cadena no encontrada");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("cadena que no es del analista (la de la IA no tiene `source`): 403 y cero escrituras", async () => {
    const res = await DELETE(req(0), ctx);
    expect(res.status).toBe(403);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("análisis ajeno o inexistente: 403 «Sin permisos»; sin sesión: 401; sin índice: 400", async () => {
    mockDb.reset({ ...siembra(), "pestel_projects/p1": { userId: "otro" } });
    expect((await DELETE(req(1), ctx)).status).toBe(403);
    mockDb.reset({});
    expect((await DELETE(req(1), ctx)).status).toBe(403);
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await DELETE(req(1), ctx)).status).toBe(401);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
    mockDb.reset(siembra());
    expect((await DELETE(req(undefined), ctx)).status).toBe(400);
  });
});
