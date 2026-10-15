// m1-edit — guarda o restaura la edición (narrativa + clasificación) de UNA dimensión del M1.
// Ruta nueva: todas las pruebas son «API nueva». Las marcadas [local] dependen del mock
// (atomico / failUpdateOn / carrera simulada dentro de getProject): sin emulador de Firestore
// modelan la garantía, no la demuestran.

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
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const DOC = "moddulo_projects/p1";
const base = { narrativa: "IA P", clasificacion: "NEUTRAL" };
const req = (body: Record<string, unknown>) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", dim: "P", base, ...body }) }) as never;
const sembrar = (doc: unknown) => mockDb.reset({ [DOC]: structuredClone(doc) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  sembrar(docProyectoM1());
  mockDb.atomico(true);
});

describe("guardar", () => {
  it("narrativa: escribe payload y m1.ediciones en UNA transacción, con original, edición y autor", async () => {
    const res = await POST(req({ texto: "  Mi lectura  " }));
    expect(res.status).toBe(200);
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0].data["phases.exploracion.linkedSource.payload.P.narrativa"]).toBe("Mi lectura");
    expect(u[0].data).not.toHaveProperty("phases.exploracion.linkedSource.payload.P.clasificacion");
    expect(u[0].data["phases.exploracion.m1.ediciones"]).toEqual({ "P.narrativa": { original: "IA P", editado: "Mi lectura", por: "u1", en: "TS" } });
    const b = await res.json();
    const esperado = mapaM1(); esperado.P!.narrativa = "Mi lectura";
    expect(b).toMatchObject({ ok: true, dim: "P", narrativa: "Mi lectura", clasificacion: "NEUTRAL", editada: true, huella: huellaMapaPESTEL(esperado) });
  });

  it("narrativa y clasificación de la misma dimensión: una sola escritura, dos entradas, la dimensión cuenta una vez", async () => {
    const res = await POST(req({ texto: "otra", clasificacion: "AMENAZA" }));
    expect(res.status).toBe(200);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(Object.keys(u[0].data["phases.exploracion.m1.ediciones"] as object).sort()).toEqual(["P.clasificacion", "P.narrativa"]);
    expect(u[0].data["phases.exploracion.linkedSource.payload.P.clasificacion"]).toBe("AMENAZA");
  });

  it("solo clasificación: no toca la narrativa", async () => {
    await POST(req({ clasificacion: "OPORTUNIDAD" }));
    const d = mockDb.updates()[0].data;
    expect(d).toHaveProperty("phases.exploracion.linkedSource.payload.P.clasificacion", "OPORTUNIDAD");
    expect(d).not.toHaveProperty("phases.exploracion.linkedSource.payload.P.narrativa");
  });

  it("segunda edición conserva el ORIGINAL de la IA (base = lo vigente)", async () => {
    await POST(req({ texto: "uno" }));
    // El mock no interpreta rutas con punto: se siembra el estado resultante como lo dejaría Firestore.
    const doc = docProyectoM1();
    doc.phases.exploracion.linkedSource!.payload!.P!.narrativa = "uno";
    (doc.phases.exploracion as Record<string, unknown>).m1 = { ediciones: { "P.narrativa": { original: "IA P", editado: "uno", por: "u1", en: "t" } } };
    sembrar(doc); mockDb.atomico(true);
    await POST(req({ texto: "dos", base: { narrativa: "uno", clasificacion: "NEUTRAL" } }));
    expect(mockDb.updates()[0].data["phases.exploracion.m1.ediciones"]).toMatchObject({ "P.narrativa": { original: "IA P", editado: "dos" } });
  });

  it("volver a escribir el texto original elimina la edición (no es un ajuste)", async () => {
    const doc = docProyectoM1();
    doc.phases.exploracion.linkedSource!.payload!.P!.narrativa = "uno";
    (doc.phases.exploracion as Record<string, unknown>).m1 = { ediciones: { "P.narrativa": { original: "IA P", editado: "uno", por: "u1", en: "t" } } };
    sembrar(doc); mockDb.atomico(true);
    const res = await POST(req({ texto: "IA P", base: { narrativa: "uno", clasificacion: "NEUTRAL" } }));
    expect((await res.json()).editada).toBe(false);
    expect(mockDb.updates()[0].data["phases.exploracion.m1.ediciones"]).toEqual({});
  });

  it("mismo valor que el vigente: 200 sinCambios y NO escribe", async () => {
    const res = await POST(req({ texto: "IA P", clasificacion: "NEUTRAL" }));
    expect(res.status).toBe(200);
    expect((await res.json()).sinCambios).toBe(true);
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("restaurar", () => {
  const editado = () => {
    const doc = docProyectoM1();
    const p = doc.phases.exploracion.linkedSource!.payload!;
    p.P!.narrativa = "uno"; p.P!.clasificacion = "AMENAZA" as never;
    (doc.phases.exploracion as Record<string, unknown>).m1 = {
      ediciones: {
        "P.narrativa": { original: "IA P", editado: "uno", por: "u1", en: "t" },
        "P.clasificacion": { original: "NEUTRAL", editado: "AMENAZA", por: "u1", en: "t" },
        "S.narrativa": { original: "IA S", editado: "s", por: "u1", en: "t" },
      },
    };
    return doc;
  };

  it("devuelve AMBOS campos al original y quita solo esa dimensión de las ediciones", async () => {
    sembrar(editado()); mockDb.atomico(true);
    const res = await POST(req({ restaurar: true, base: { narrativa: "uno", clasificacion: "AMENAZA" } }));
    expect(res.status).toBe(200);
    const d = mockDb.updates()[0].data;
    expect(d["phases.exploracion.linkedSource.payload.P.narrativa"]).toBe("IA P");
    expect(d["phases.exploracion.linkedSource.payload.P.clasificacion"]).toBe("NEUTRAL");
    expect(Object.keys(d["phases.exploracion.m1.ediciones"] as object)).toEqual(["S.narrativa"]);
    expect(await res.json()).toMatchObject({ editada: false, narrativa: "IA P", clasificacion: "NEUTRAL" });
  });

  it("restaurar una dimensión sin ediciones: 200 sinCambios, sin escribir", async () => {
    const res = await POST(req({ restaurar: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).sinCambios).toBe(true);
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("validación y acceso", () => {
  it.each([
    ["JSON inválido", null],
    ["dim inválida", { dim: "X", texto: "a" }],
    ["clasificación inválida", { clasificacion: "FAVORABLE" }],
    ["texto vacío", { texto: "   " }],
    ["texto no cadena", { texto: 5 }],
    ["texto mayor a 10 000", { texto: "a".repeat(10_001) }],
    ["sin nada que guardar", {}],
    ["sin base", { texto: "a", base: undefined }],
  ])("400: %s (no escribe)", async (_n, body) => {
    const r = body === null ? (new Request("http://local/x", { method: "POST", body: "no-json" }) as never) : req(body as Record<string, unknown>);
    expect((await POST(r)).status).toBe(400);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("acepta exactamente 10 000 caracteres", async () => {
    expect((await POST(req({ texto: "a".repeat(10_000) }))).status).toBe(200);
  });

  it("401 sin sesión; 404 si el proyecto no es accesible (no afirma que exista)", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await POST(req({ texto: "a" }))).status).toBe(401);
    vi.mocked(getProject).mockResolvedValueOnce(null as never);
    const r = await POST(req({ texto: "a" }));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Proyecto no encontrado" });
  });

  it("404 sin M1; 404 si la dimensión no está en el mapa", async () => {
    sembrar(docProyectoM1({ payload: null })); mockDb.atomico(true);
    expect(await (await POST(req({ texto: "a" }))).json()).toEqual({ error: "m1_no_encontrado" });
    const doc = docProyectoM1(); delete (doc.phases.exploracion.linkedSource!.payload as Record<string, unknown>).P;
    sembrar(doc); mockDb.atomico(true);
    expect(await (await POST(req({ texto: "a" }))).json()).toEqual({ error: "dimension_no_encontrada" });
  });
});

describe("409 — nada se escribe", () => {
  it("aprobación válida: m1_aprobado (M1 bloqueado)", async () => {
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1()) } })); mockDb.atomico(true);
    const res = await POST(req({ texto: "a" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "m1_aprobado" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("aprobación INVÁLIDA (la huella ya no coincide con el payload) no bloquea: se puede editar", async () => {
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1(), { huella: "de-otro-contenido" }) } })); mockDb.atomico(true);
    expect((await POST(req({ texto: "a" }))).status).toBe(200);
  });

  it("M1 de Centinela (T22): m1_no_editable_centinela", async () => {
    sembrar(docProyectoM1({ kind: "T22" })); mockDb.atomico(true);
    const res = await POST(req({ texto: "a" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "m1_no_editable_centinela" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("F2 cerrada (solo lectura): fase_cerrada", async () => {
    sembrar(docProyectoM1({ status: "completed" })); mockDb.atomico(true);
    const res = await POST(req({ texto: "a" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "fase_cerrada" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("base distinta de lo guardado (otra pestaña editó): m1_cambio", async () => {
    const res = await POST(req({ texto: "a", base: { narrativa: "lo que veía esta pestaña", clasificacion: "NEUTRAL" } }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "m1_cambio" });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("base con clasificación vieja: m1_cambio", async () => {
    const res = await POST(req({ texto: "a", base: { narrativa: "IA P", clasificacion: "AMENAZA" } }));
    expect((await res.json()).error).toBe("m1_cambio");
  });
});

describe("carreras y atomicidad (simuladas — [local])", () => {
  it("[local] aprobar↔editar: otra pestaña aprueba entre el acceso y la transacción → 409 m1_aprobado y cero escrituras", async () => {
    vi.mocked(getProject).mockImplementationOnce(async () => {
      const vista = structuredClone(mockDb.snapshot()[DOC]);
      sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1()) } })); mockDb.atomico(true);
      return vista as never;
    });
    const res = await POST(req({ texto: "a" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("m1_aprobado");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[local] dos pestañas: otra editó la misma dimensión en el hueco → m1_cambio y no pisa su edición", async () => {
    vi.mocked(getProject).mockImplementationOnce(async () => {
      const vista = structuredClone(mockDb.snapshot()[DOC]);
      const d = docProyectoM1(); d.phases.exploracion.linkedSource!.payload!.P!.narrativa = "edición de la otra pestaña";
      sembrar(d); mockDb.atomico(true);
      return vista as never;
    });
    const res = await POST(req({ texto: "mi edición" }));
    expect((await res.json()).error).toBe("m1_cambio");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[local] el proyecto pasa a la papelera en el hueco → 404", async () => {
    vi.mocked(getProject).mockImplementationOnce(async () => {
      const vista = structuredClone(mockDb.snapshot()[DOC]);
      sembrar(docProyectoM1({ deletedAt: "t" })); mockDb.atomico(true);
      return vista as never;
    });
    expect((await POST(req({ texto: "a" }))).status).toBe(404);
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[local] si falla la escritura, no queda nada a medias (la excepción sale; un 5xx es ambiguo para el cliente)", async () => {
    mockDb.failUpdateOn(DOC);
    await expect(POST(req({ texto: "a" }))).rejects.toThrow();
    expect(mockDb.updates()).toHaveLength(0);
    expect(mockDb.snapshot()[DOC]).toEqual(docProyectoM1());
  });

  it("la huella devuelta es la del mapa ya editado (la pantalla la usará como huellaVista)", async () => {
    const res = await POST(req({ clasificacion: "AMENAZA" }));
    const m = mapaM1(); m.P!.clasificacion = "AMENAZA" as never;
    expect((await res.json()).huella).toBe(huellaDe(m));
  });
});
