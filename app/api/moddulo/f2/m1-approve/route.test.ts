// m1-approve — aprueba el M1 (copia congelada + huella en servidor). Ruta nueva: «API nueva».
// [local] = depende del mock (atomico/failUpdateOn/carrera simulada en getProject): sin emulador de
// Firestore modelan la garantía, no la demuestran.

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
const req = (body: Record<string, unknown>) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", huellaVista: H, ...body }) }) as never;
const sembrar = (doc: unknown) => { mockDb.reset({ [DOC]: structuredClone(doc) }); mockDb.atomico(true); };
const draft = { hei: { tensionCentral: "t" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (mockDb.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  sembrar(docProyectoM1());
});

describe("aprobar", () => {
  it("registra quién, cuándo, huella (calculada en servidor), conteo y copia CONGELADA, en una transacción; NO llama a Claude", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, huella: H, categoriasEditadas: 0, total: 6, motoresDescartados: false });
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    const d = mockDb.updates()[0].data;
    expect(d["phases.exploracion.m1.aprobacion"]).toMatchObject({ por: "u1", en: "TS", huella: H, categoriasEditadas: 0, total: 6, mapa: mapaM1() });
    expect(d["phases.exploracion.m1.reabiertoEn"]).toBe("__DELETE__");
    expect(d).not.toHaveProperty("phases.exploracion.draftDVS"); // nada que descartar
  });

  it("la copia es independiente del payload (se clona, no es la misma referencia)", async () => {
    await POST(req({}));
    const copia = (mockDb.updates()[0].data["phases.exploracion.m1.aprobacion"] as { mapa: unknown }).mapa;
    expect(copia).toEqual(mapaM1());
  });

  it("cuenta dimensiones con edición vigente: narrativa y clasificación de una dimensión cuentan UNA vez", async () => {
    const doc = docProyectoM1();
    const p = doc.phases.exploracion.linkedSource!.payload!;
    p.P!.narrativa = "x"; p.P!.clasificacion = "AMENAZA" as never; p.S!.narrativa = "y";
    (doc.phases.exploracion as Record<string, unknown>).m1 = {
      ediciones: {
        "P.narrativa": { original: "IA P", editado: "x", por: "u1", en: "t" },
        "P.clasificacion": { original: "NEUTRAL", editado: "AMENAZA", por: "u1", en: "t" },
        "S.narrativa": { original: "IA S", editado: "y", por: "u1", en: "t" },
      },
    };
    sembrar(doc);
    const res = await POST(req({ huellaVista: huellaDe(p) }));
    expect(await res.json()).toMatchObject({ categoriasEditadas: 2, total: 6 });
  });

  it("[idempotencia] misma huella ya aprobada → 200 yaAprobado y NO escribe", async () => {
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1()) } }));
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, yaAprobado: true, huella: H });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("aprobación guardada pero INVÁLIDA (el payload cambió después): se aprueba de nuevo con la huella vigente", async () => {
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1(), { huella: "vieja" }) } }));
    const res = await POST(req({}));
    expect((await res.json()).yaAprobado).toBeUndefined();
    expect(mockDb.updates()).toHaveLength(1);
  });
});

describe("motores: conservación diferida", () => {
  const conMotores = (generacionHuella: string | null) =>
    docProyectoM1({
      draftDVS: draft, motorAprobaciones: { M2: true, M3: true },
      m1: { ...(generacionHuella ? { generacion: { huella: generacionHuella, en: "t" } } : {}), reabiertoEn: "t", reabiertoPor: "u1" },
    });

  it("contenido IDÉNTICO al que generó el borrador → conserva borrador, aprobaciones y generación", async () => {
    sembrar(conMotores(H));
    const res = await POST(req({}));
    expect((await res.json()).motoresDescartados).toBe(false);
    const d = mockDb.updates()[0].data;
    for (const k of ["phases.exploracion.draftDVS", "phases.exploracion.motorAprobaciones", "phases.exploracion.m1.generacion"]) {
      expect(d).not.toHaveProperty(k);
    }
  });

  it("contenido DISTINTO → descarta borrador, aprobaciones y marca de generación en la MISMA escritura", async () => {
    sembrar(conMotores("huella-de-otro-contenido"));
    const res = await POST(req({}));
    expect((await res.json()).motoresDescartados).toBe(true);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0].data["phases.exploracion.draftDVS"]).toBe("__DELETE__");
    expect(u[0].data["phases.exploracion.motorAprobaciones"]).toEqual({});
    expect(u[0].data["phases.exploracion.m1.generacion"]).toBe("__DELETE__");
    expect(u[0].data).toHaveProperty("phases.exploracion.m1.aprobacion");
  });

  it("borrador sin marca de generación (proyecto anterior) → se descarta: no se sabe de qué contenido salió", async () => {
    sembrar(conMotores(null));
    expect((await (await POST(req({}))).json()).motoresDescartados).toBe(true);
  });

  it("el dvs finalizado NUNCA se toca", async () => {
    sembrar({ ...conMotores("otra"), phases: { exploracion: { ...conMotores("otra").phases.exploracion, dvs: draft } } });
    await POST(req({}));
    expect(Object.keys(mockDb.updates()[0].data).join(" ")).not.toMatch(/exploracion\.dvs\b/);
  });
});

describe("409 / 400 / acceso — nada se escribe", () => {
  it("huellaVista distinta de la del servidor (cambió mientras lo revisabas): m1_cambio con la huella vigente", async () => {
    const res = await POST(req({ huellaVista: "lo-que-veia-la-pantalla" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "m1_cambio", huella: H });
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("F2 cerrada: fase_cerrada", async () => {
    sembrar(docProyectoM1({ status: "completed" }));
    const res = await POST(req({}));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("fase_cerrada");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("sin M1: 404 m1_no_encontrado", async () => {
    sembrar(docProyectoM1({ payload: null }));
    const res = await POST(req({}));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("m1_no_encontrado");
  });

  it("Centinela (T22) también se aprueba (mismo botón para ambas vías)", async () => {
    sembrar(docProyectoM1({ kind: "T22" }));
    expect((await POST(req({}))).status).toBe(200);
  });

  it("400 sin huellaVista, sin projectId o con JSON inválido; 401 sin sesión; 404 sin acceso", async () => {
    expect((await POST(req({ huellaVista: "" }))).status).toBe(400);
    expect((await POST(req({ projectId: "" }))).status).toBe(400);
    expect((await POST(new Request("http://local/x", { method: "POST", body: "x" }) as never)).status).toBe(400);
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await POST(req({}))).status).toBe(401);
    vi.mocked(getProject).mockResolvedValueOnce(null as never);
    const r = await POST(req({}));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Proyecto no encontrado" });
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("carreras y atomicidad (simuladas — [local])", () => {
  it("[local] editar↔aprobar: otra pestaña edita en el hueco → la huella ya no coincide: m1_cambio, cero escrituras", async () => {
    vi.mocked(getProject).mockImplementationOnce(async () => {
      const vista = structuredClone(mockDb.snapshot()[DOC]);
      const d = docProyectoM1(); d.phases.exploracion.linkedSource!.payload!.P!.narrativa = "editada en otra pestaña";
      sembrar(d);
      return vista as never;
    });
    const res = await POST(req({}));
    expect((await res.json()).error).toBe("m1_cambio");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[local] la fase se cierra en el hueco → fase_cerrada, cero escrituras", async () => {
    vi.mocked(getProject).mockImplementationOnce(async () => {
      const vista = structuredClone(mockDb.snapshot()[DOC]);
      sembrar(docProyectoM1({ status: "completed" }));
      return vista as never;
    });
    expect((await (await POST(req({}))).json()).error).toBe("fase_cerrada");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("[local] el proyecto va a la papelera en el hueco → 404", async () => {
    vi.mocked(getProject).mockImplementationOnce(async () => {
      const vista = structuredClone(mockDb.snapshot()[DOC]);
      sembrar(docProyectoM1({ deletedAt: "t" }));
      return vista as never;
    });
    expect((await POST(req({}))).status).toBe(404);
  });

  it("[local] si falla la escritura no queda aprobación ni descarte a medias (la excepción sale; un 5xx es ambiguo)", async () => {
    sembrar(docProyectoM1({ draftDVS: draft, motorAprobaciones: { M2: true }, m1: { generacion: { huella: "otra", en: "t" } } }));
    const antes = structuredClone(mockDb.snapshot()[DOC]);
    mockDb.failUpdateOn(DOC);
    await expect(POST(req({}))).rejects.toThrow();
    expect(mockDb.updates()).toHaveLength(0);
    expect(mockDb.snapshot()[DOC]).toEqual(antes);
  });
});
