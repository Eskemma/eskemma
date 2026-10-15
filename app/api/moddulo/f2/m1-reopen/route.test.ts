// m1-reopen — reabre un M1 aprobado con H15 en servidor. Ruta nueva: «API nueva».
// [local] = depende del mock (atomico/failUpdateOn/carrera simulada).

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
import { aprobacionDe, docProyectoM1, huellaDe, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const DOC = "moddulo_projects/p1";
const H = huellaDe(mapaM1());
const req = (body: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...body }) }) as never;
const sembrar = (doc: unknown) => { mockDb.reset({ [DOC]: structuredClone(doc) }); mockDb.atomico(true); };
const draft = { hei: { tensionCentral: "t" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] };
const aprobado = (extra: Record<string, unknown> = {}) =>
  docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1()), generacion: { huella: H, en: "t" } }, draftDVS: draft, motorAprobaciones: { M2: true, M3: true }, ...extra });

async function pedirHuella() {
  const r = await POST(req());
  expect(r.status).toBe(409);
  const b = await r.json();
  expect(b.error).toBe("reemplazo_requiere_confirmacion");
  return b.huella as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  sembrar(aprobado());
});

describe("H15 en servidor", () => {
  it("sin confirmación: 409 con las líneas del estado REAL y la huella; no escribe", async () => {
    const res = await POST(req());
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_requiere_confirmacion");
    expect(b.huella).toMatch(/^[0-9a-f]{64}$/);
    expect(b.lineas).toEqual([
      "Se perderá la aprobación del análisis; podrás aprobarlo de nuevo.",
      "M2–M5 quedarán en pausa mientras esté abierto.",
      "Si al aprobar de nuevo el contenido es distinto, se descartarán el borrador de motores y las aprobaciones de M2, M3 y se regenerarán; si es idéntico, se conservan.",
    ]);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("confirmar sin huella, o con la huella equivocada: no reabre (requiere / vencida con la huella nueva)", async () => {
    expect((await (await POST(req({ confirmar: true }))).json()).error).toBe("reemplazo_requiere_confirmacion");
    const res = await POST(req({ confirmar: true, huella: "equivocada" }));
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_huella_vencida");
    expect(b.huella).not.toBe("equivocada");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("huella válida: borra SOLO la aprobación y marca la reapertura; motores, aprobaciones y generación quedan en pausa", async () => {
    const huella = await pedirHuella();
    const res = await POST(req({ confirmar: true, huella }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, huella: H });
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(2); // la consulta (pedirHuella) + la confirmada: una transacción cada una
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0].data).toEqual({
      "phases.exploracion.m1.aprobacion": "__DELETE__",
      "phases.exploracion.m1.reabiertoEn": "TS",
      "phases.exploracion.m1.reabiertoPor": "u1",
      updatedAt: "TS",
    });
  });

  it("sirve igual a Centinela (T22)", async () => {
    sembrar(aprobado({ kind: "T22" }));
    const huella = await pedirHuella();
    expect((await POST(req({ confirmar: true, huella }))).status).toBe(200);
  });

  it("[local] el estado cambia entre pedir y confirmar (se aprobó un motor más): huella vencida y no reabre", async () => {
    const huella = await pedirHuella();
    sembrar(aprobado({ motorAprobaciones: { M2: true, M3: true, M4: true } }));
    const res = await POST(req({ confirmar: true, huella }));
    expect((await res.json()).error).toBe("reemplazo_huella_vencida");
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("estados", () => {
  it("[idempotencia] ya reabierto → 200 yaReabierto sin escribir", async () => {
    sembrar(docProyectoM1({ m1: { reabiertoEn: "t", reabiertoPor: "u1" } }));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, yaReabierto: true });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("sin aprobación (borrador, o aprobación inválida por cambio del payload): 409 m1_no_aprobado", async () => {
    sembrar(docProyectoM1());
    const r1 = await POST(req());
    expect(r1.status).toBe(409);
    expect((await r1.json()).error).toBe("m1_no_aprobado");
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1(), { huella: "vieja" }) } }));
    expect((await (await POST(req())).json()).error).toBe("m1_no_aprobado");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("F2 cerrada: fase_cerrada; sin M1: 404 m1_no_encontrado", async () => {
    sembrar(aprobado({ status: "completed" }));
    const r = await POST(req());
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("fase_cerrada");
    sembrar(docProyectoM1({ payload: null }));
    const r2 = await POST(req());
    expect(r2.status).toBe(404);
    expect((await r2.json()).error).toBe("m1_no_encontrado");
  });

  it("aprobado sin motores ni borrador: la línea única, y aun así exige confirmación (la aprobación se pierde)", async () => {
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1()) } }));
    const b = await (await POST(req())).json();
    expect(b.error).toBe("reemplazo_requiere_confirmacion");
    expect(b.lineas).toEqual(["Se perderá la aprobación del análisis; podrás aprobarlo de nuevo."]);
  });

  it("con Reporte F2 finalizado agrega la línea de que no cambia", async () => {
    sembrar(aprobado({ dvs: draft }));
    const b = await (await POST(req())).json();
    expect(b.lineas.at(-1)).toBe("El Reporte F2 finalizado no cambia hasta que lo vuelvas a finalizar.");
  });
});

describe("validación y acceso", () => {
  it("400 sin projectId o JSON inválido; 401 sin sesión; 404 sin acceso (no afirma que exista)", async () => {
    expect((await POST(req({ projectId: "" }))).status).toBe(400);
    expect((await POST(new Request("http://local/x", { method: "POST", body: "x" }) as never)).status).toBe(400);
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await POST(req())).status).toBe(401);
    vi.mocked(getProject).mockResolvedValueOnce(null as never);
    const r = await POST(req());
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Proyecto no encontrado" });
  });

  it("[local] si falla la escritura, la aprobación NO se pierde a medias (la excepción sale; un 5xx es ambiguo)", async () => {
    const huella = await pedirHuella();
    const antes = structuredClone(mockDb.snapshot()[DOC]);
    mockDb.failUpdateOn(DOC);
    await expect(POST(req({ confirmar: true, huella }))).rejects.toThrow();
    expect(mockDb.snapshot()[DOC]).toEqual(antes);
  });

  it("[local] el proyecto va a la papelera en el hueco → 404", async () => {
    vi.mocked(getProject).mockImplementationOnce(async () => {
      const vista = structuredClone(mockDb.snapshot()[DOC]);
      sembrar(aprobado({ deletedAt: "t" }));
      return vista as never;
    });
    expect((await POST(req())).status).toBe(404);
  });
});
