// H25 (commit 7a) — impact-chain: cada cadena del analista tiene un id estable y se borra por id.
// El respaldo por índice solo opera sobre cadenas SIN id. Este archivo es aparte de route.test.ts
// (6b), que sigue intacto y cubre el respaldo por índice con cadenas sin id.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { DELETE, POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ analysisId: "a1" }) };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const delReq = (cuerpo: unknown) =>
  new Request("http://local/x", { method: "DELETE", body: JSON.stringify(cuerpo) }) as never;
const postReq = (cuerpo: unknown) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify(cuerpo) }) as never;

const base = { dimensions: ["P"], riskLevel: "MODERADO", recommendation: "r" };
const ia = { ...base, description: "de la IA (sin id ni source)" };
const mia = { ...base, description: "mía", source: "analyst", addedByUserId: "u1", id: "id-mia" };
const otra = { ...base, description: "otra mía", source: "analyst", addedByUserId: "u1", id: "id-otra" };
const sinId = { ...base, description: "analista sin id", source: "analyst", addedByUserId: "u1" };

const siembra = (cadenas: unknown[]) => ({
  "pestel_analyses/a1": { projectId: "p1", impactChains: structuredClone(cadenas) },
  "pestel_projects/p1": { userId: "u1" },
});
const descripciones = () => {
  const u = mockDb.updates();
  return (u.at(-1)!.data.impactChains as Array<{ description: string }>).map((c) => c.description);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockDb.reset(siembra([ia, mia, otra]));
});
afterEach(() => vi.restoreAllMocks());

describe("POST impact-chain — id estable", () => {
  it("la cadena nueva lleva un UUID, source analyst y el autor; lo escrito es lo devuelto", async () => {
    const res = await POST(postReq({ dimensions: ["P"], description: "nueva", riskLevel: "ALTO" }), ctx);
    expect(res.status).toBe(200);
    const { chain } = await res.json();
    expect(chain.id).toMatch(UUID);
    expect(chain).toMatchObject({ source: "analyst", addedByUserId: "u1", description: "nueva" });
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0].data.impactChains).toEqual(chain); // arrayUnion (mock: identidad) recibe la misma cadena
  });

  it("dos altas dan ids distintos (por eso un reintento ya no se deduplica)", async () => {
    const cuerpo = { dimensions: ["P"], description: "igual", riskLevel: "ALTO" };
    const a = (await (await POST(postReq(cuerpo), ctx)).json()).chain.id;
    const b = (await (await POST(postReq(cuerpo), ctx)).json()).chain.id;
    expect(a).toMatch(UUID);
    expect(b).toMatch(UUID);
    expect(a).not.toBe(b);
  });

  it("validación de siempre: sin dimensiones o sin descripción → 400 sin escrituras", async () => {
    expect((await POST(postReq({ dimensions: [], description: "x", riskLevel: "ALTO" }), ctx)).status).toBe(400);
    expect((await POST(postReq({ dimensions: ["P"], description: " ", riskLevel: "ALTO" }), ctx)).status).toBe(400);
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("DELETE impact-chain — por chainId", () => {
  it("borra SOLO la cadena con ese id: 200 y UNA escritura", async () => {
    const res = await DELETE(delReq({ chainId: "id-mia" }), ctx);
    expect(res.status).toBe(200);
    expect(mockDb.updates()).toHaveLength(1);
    expect(descripciones()).toEqual(["de la IA (sin id ni source)", "otra mía"]);
  });

  it("NEGATIVO real: una lista desactualizada ya no borra OTRA cadena — el id borrado da 404 y la otra queda intacta", async () => {
    await DELETE(delReq({ chainId: "id-mia" }), ctx); // otra pestaña la borró
    const antes = mockDb.updates().length;
    const res = await DELETE(delReq({ chainId: "id-mia" }), ctx); // la pestaña con la lista vieja
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Cadena no encontrada");
    expect(mockDb.updates()).toHaveLength(antes); // sin escrituras nuevas
    expect(descripciones()).toEqual(["de la IA (sin id ni source)", "otra mía"]);
  });

  it("id inexistente → 404 sin escrituras", async () => {
    const res = await DELETE(delReq({ chainId: "no-existe" }), ctx);
    expect(res.status).toBe(404);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("id duplicado → 409 cadena_id_duplicado y NO borra ninguna", async () => {
    mockDb.reset(siembra([ia, { ...mia, id: "dup" }, { ...otra, id: "dup" }]));
    const res = await DELETE(delReq({ chainId: "dup" }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("cadena_id_duplicado");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("una cadena con id pero que no es del analista → 403 sin escrituras", async () => {
    mockDb.reset(siembra([{ ...ia, id: "id-ia" }, mia]));
    const res = await DELETE(delReq({ chainId: "id-ia" }), ctx);
    expect(res.status).toBe(403);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("si llegan chainId e index, manda el id (no se borra la cadena de esa posición)", async () => {
    const res = await DELETE(delReq({ chainId: "id-otra", index: 0 }), ctx);
    expect(res.status).toBe(200);
    expect(descripciones()).toEqual(["de la IA (sin id ni source)", "mía"]);
  });

  it("el camino por id no usa el respaldo (sin aviso de log)", async () => {
    await DELETE(delReq({ chainId: "id-mia" }), ctx);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("DELETE impact-chain — respaldo por índice SOLO sobre cadenas sin id", () => {
  it("índice sobre una cadena CON id → 409 requiere_chain_id y no borra nada", async () => {
    const res = await DELETE(delReq({ index: 1 }), ctx); // «mía» tiene id
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("requiere_chain_id");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("el caso de la pestaña vieja: lista desactualizada con ids + índice → ya no borra otra cadena", async () => {
    await DELETE(delReq({ chainId: "id-mia" }), ctx); // se borra «mía»; «otra» pasa al índice 1
    const antes = mockDb.updates().length;
    const res = await DELETE(delReq({ index: 1 }), ctx); // el cliente viejo reintenta el índice 1
    expect(res.status).toBe(409); // «otra» tiene id: no se borra por posición
    expect(mockDb.updates()).toHaveLength(antes);
    expect(descripciones()).toEqual(["de la IA (sin id ni source)", "otra mía"]);
  });

  it("índice sobre una cadena del analista SIN id → como hoy (200) y deja el rastro de log del respaldo", async () => {
    mockDb.reset(siembra([ia, sinId, otra]));
    const res = await DELETE(delReq({ index: 1 }), ctx);
    expect(res.status).toBe(200);
    expect(descripciones()).toEqual(["de la IA (sin id ni source)", "otra mía"]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[impact-chain][respaldo-indice]"), "borrada");
  });

  it("índice sobre una cadena de la IA sin id → 403; índice fuera de rango → 404 (como hoy)", async () => {
    mockDb.reset(siembra([ia, sinId]));
    expect((await DELETE(delReq({ index: 0 }), ctx)).status).toBe(403);
    expect((await DELETE(delReq({ index: 9 }), ctx)).status).toBe(404);
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("DELETE impact-chain — validación del cuerpo", () => {
  it.each([
    ["número", 123],
    ["objeto", { a: 1 }],
    ["null", null],
    ["cadena vacía", ""],
    ["solo espacios", "   "],
    ["arreglo", ["id-mia"]],
  ])("chainId presente pero inválido (%s) → 400 y NO cae al índice, aunque haya un index válido", async (_n, chainId) => {
    mockDb.reset(siembra([sinId, mia]));
    const res = await DELETE(delReq({ chainId, index: 0 }), ctx);
    expect(res.status).toBe(400);
    expect(mockDb.updates()).toHaveLength(0); // la cadena sin id en la posición 0 NO se borró
  });

  it.each([
    ["negativo", -1],
    ["decimal", 1.5],
    ["texto numérico", "1"],
    ["null", null],
    ["objeto", {}],
    ["booleano", true],
  ])("index presente pero inválido (%s) → 400", async (_n, index) => {
    const res = await DELETE(delReq({ index }), ctx);
    expect(res.status).toBe(400);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("sin chainId ni index → 400; JSON inválido → 400", async () => {
    expect((await DELETE(delReq({}), ctx)).status).toBe(400);
    const roto = new Request("http://local/x", { method: "DELETE", body: "{no es json" }) as never;
    expect((await DELETE(roto, ctx)).status).toBe(400);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("análisis ajeno → 403; sin sesión → 401", async () => {
    mockDb.reset({ ...siembra([mia]), "pestel_projects/p1": { userId: "otro" } });
    expect((await DELETE(delReq({ chainId: "id-mia" }), ctx)).status).toBe(403);
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await DELETE(delReq({ chainId: "id-mia" }), ctx)).status).toBe(401);
  });
});

describe("DELETE impact-chain — transacción", () => {
  it("se hace dentro de una transacción (lectura y escritura juntas)", async () => {
    await DELETE(delReq({ chainId: "id-mia" }), ctx);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
  });

  it("si la transacción rechaza, la excepción sale (la ruta no la captura: Next responde 500 sin código)", async () => {
    mockDb.runTransaction.mockRejectedValueOnce(new Error("commit perdido"));
    await expect(DELETE(delReq({ chainId: "id-mia" }), ctx)).rejects.toThrow("commit perdido");
  });

  it("los caminos 404, 403 y 409 no escriben (solo la rama de éxito hace tx.update)", async () => {
    mockDb.reset(siembra([{ ...ia, id: "id-ia" }, { ...mia, id: "dup" }, { ...otra, id: "dup" }]));
    await DELETE(delReq({ chainId: "no-existe" }), ctx); // 404
    await DELETE(delReq({ chainId: "id-ia" }), ctx); // 403
    await DELETE(delReq({ chainId: "dup" }), ctx); // 409
    await DELETE(delReq({ index: 1 }), ctx); // 409 (índice sobre cadena con id)
    expect(mockDb.updates()).toHaveLength(0);
  });
});
