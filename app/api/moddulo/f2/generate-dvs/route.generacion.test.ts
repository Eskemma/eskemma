// generate-dvs draft: escribe m1.generacion {huella, en} (el discriminador «motores del M1 actual») solo si el
// proyecto tiene un M1 con aprobación; sin m1 la escritura es la de siempre. Y el registro por llamada.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return { ...real, getProject: vi.fn() };
});
vi.mock("@/lib/ai/claude", () => ({
  anthropic: { messages: { create: vi.fn() } },
  CLAUDE_MODEL: "modelo-de-prueba",
}));
vi.mock("@/lib/moddulo/knowledge-injector", () => ({ buildPhaseContext: vi.fn(async () => "") }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { anthropic } from "@/lib/ai/claude";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { aplicarUpdateFirestore } from "@/lib/moddulo/__tests__/fixtures/semanticaUpdate";
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";
import { resumenM1ParaCliente } from "@/lib/moddulo/m1Servidor";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const P = "moddulo_projects/p1";

const texto = (o: unknown) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(o) }] }) as never;
const M2 = [{ dimension: "X", veredicto: "coherente", argumentacion: "arg", senalesPESTEL: ["s"] }];
const M3 = [{ nombre: "Actor", tipo: "partido", nivelRiesgo: "rojo", capacidadVeto: "alta", motivacion: "m", requiereInvestigacion: true }];
const M4 = [{ descripcion: "inc", urgencia: "alta", resolucion: "media", destino: "F3" }];
const M5 = {
  hei: { tensionCentral: "tensión", contexto: "ctx", condicionesFavorables: ["a"], condicionesAdversas: ["b"], premisaEstrategica: "prem" },
  pip: [{ numero: 1, pregunta: "¿q?", metodo: "m", vinculoHito: "h", orden: 1, profundidad: "exploratoria" }],
};
/** Order of the calls: M2 and M3 (parallel, in that order), then M4, then M5. */
function claudeCuatroMotores() {
  crear.mockReset();
  crear.mockResolvedValueOnce(texto(M2)).mockResolvedValueOnce(texto(M3)).mockResolvedValueOnce(texto(M4)).mockResolvedValueOnce(texto(M5));
}

const senal = (descripcion: string) => ({ descripcion, fuente: "INEGI, 2020", fechaCorte: "2020-01", nivelConfianza: "medio", origenInternacional: false });
const payload = {
  P: { code: "P", label: "Político", clasificacion: "AMENAZA", confidence: 80, narrativa: "Narrativa P.",
    senalesFavorables: [senal("a".repeat(300))], senalesAdversas: [1, 2, 3, 4, 5].map((i) => senal(`adversa ${i}`)), senalesInciertas: [] },
};
function proyecto(conPayload: boolean) {
  vi.mocked(getProject).mockResolvedValue({
    id: "p1", type: "electoral", xpcto: { hito: "H" },
    phases: { exploracion: { ...(conPayload ? { linkedSource: { kind: "express", componente: "moddulo", sourceId: "p1", payload } } : {}), data: { pestl: { x: 1 } } } },
  } as never);
}
const req = (body: Record<string, unknown> = {}) =>
  new Request("http://local/api/moddulo/f2/generate-dvs", { method: "POST", body: JSON.stringify({ projectId: "p1", saveas: "draft", ...body }) }) as never;

// Paso 4: the gate needs a REAL approval (fingerprint of the payload + frozen copy). The project is
// served by getProject AND seeded in the mock database, because the draft is written in a transaction
// that re-reads the document.
const huellaPayload = () => huellaMapaPESTEL(payload as never);
const conM1 = (aprobada: boolean, payloadOk = true) => {
  const exploracion = {
    ...(payloadOk ? { linkedSource: { kind: "express", componente: "moddulo", sourceId: "p1", payload } } : {}),
    m1: { creadoEn: "t", ...(aprobada ? { aprobacion: { huella: huellaPayload(), por: "u", en: "t", categoriasEditadas: 0, total: 1, mapa: payload } } : {}) },
  };
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
  mockDb.reset({ [P]: { phases: { exploracion } } });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  mockDb.reset({ [P]: { phases: { exploracion: {} } } });
  proyecto(true);
  claudeCuatroMotores();
});

const lineas = () => vi.mocked(console.log).mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[generate-dvs]"));

describe("generate-dvs draft — m1.generacion", () => {
  it("con M1 aprobado escribe generacion {huella de la aprobación, en} en el MISMO update, junto al borrador", async () => {
    conM1(true);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0].data["phases.exploracion.m1.generacion"]).toEqual({ huella: huellaPayload(), en: "SERVER_TIMESTAMP" });
    expect(u[0].data).toHaveProperty("phases.exploracion.draftDVS");
  });
  it("sin m1 NO escribe generacion (comportamiento de siempre)", async () => {
    await POST(req());
    expect(mockDb.updates()[0].data).not.toHaveProperty("phases.exploracion.m1.generacion");
  });
  it("con m1 pero sin aprobación: paso 4 → 409 m1_no_aprobado, sin llamar al modelo y sin escribir (antes: escribía el borrador sin generacion)", async () => {
    conM1(false);
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("m1_no_aprobado");
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toEqual([]);
  });
  it("la ruta legada (m1 SIN payload) no está bajo la compuerta: no escribe generacion (paso 4: sin payload = sin_m1)", async () => {
    conM1(true, false);
    crear.mockReset();
    crear.mockResolvedValueOnce(texto({ ...M5, contrasteXPCTO: M2, semaforo: M3, incertidumbres: M4 }));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockDb.updates()[0].data).not.toHaveProperty("phases.exploracion.m1.generacion");
  });
  it("saveas final no escribe generacion (no hay compuerta ni conservación todavía)", async () => {
    conM1(true);
    await POST(req({ saveas: "final" }));
    for (const x of mockDb.updates()) expect(x.data).not.toHaveProperty("phases.exploracion.m1.generacion");
  });
});

describe("generate-dvs — registro por llamada", () => {
  it("una línea por motor con stop_reason, tokens y tiempos, y una línea total; solo cifras", async () => {
    crear.mockReset();
    const conUso = (o: unknown) => ({ ...(texto(o) as object), usage: { input_tokens: 111, output_tokens: 222 } }) as never;
    crear.mockResolvedValueOnce(conUso(M2)).mockResolvedValueOnce(conUso(M3)).mockResolvedValueOnce(conUso(M4)).mockResolvedValueOnce(conUso(M5));
    await POST(req());
    const l = lineas();
    for (const motor of ["M2", "M3", "M4", "M5"]) {
      const linea = l.find((x) => x.includes(`motor=${motor} `))!;
      expect(linea).toMatch(/intento=1 stop_reason=end_turn input_tokens=111 output_tokens=222 duracion_ms=\d+ desde_inicio_ms=\d+$/);
    }
    expect(l.some((x) => /total resultado=ok duracion_ms=\d+$/.test(x))).toBe(true);
    expect(l.join("\n")).not.toMatch(/tensión|Narrativa|INEGI|Actor/);
  });
  it("un fallo del modelo se registra con codigo fallo_modelo y la respuesta lo lleva", async () => {
    crear.mockReset();
    crear.mockResolvedValueOnce(texto(M2)).mockResolvedValueOnce(texto(M3)).mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 529 }));
    const res = await POST(req());
    expect((await res.json())).toMatchObject({ motor: "M4", codigo: "fallo_modelo" });
    expect(vi.mocked(console.error).mock.calls.map((c) => String(c[0])).some((x) => x.includes("motor=M4") && x.includes("codigo=fallo_modelo") && x.includes("status=529"))).toBe(true);
    expect(lineas().some((x) => x.includes("total resultado=http_500"))).toBe(true);
  });
  it("respuesta cortada por max_tokens que no parsea: codigo respuesta_truncada; si solo es inválida: respuesta_invalida", async () => {
    crear.mockReset();
    crear.mockResolvedValueOnce({ stop_reason: "max_tokens", content: [{ type: "text", text: "[{\"dimension\":" }] } as never).mockResolvedValueOnce(texto(M3));
    expect((await (await POST(req())).json())).toMatchObject({ motor: "M2", codigo: "respuesta_truncada" });
    crear.mockReset();
    crear.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "no es json" }] } as never).mockResolvedValueOnce(texto(M3));
    expect((await (await POST(req())).json())).toMatchObject({ motor: "M2", codigo: "respuesta_invalida" });
  });
  it("los textos que ve el usuario no nombran a Claude", async () => {
    crear.mockReset();
    crear.mockResolvedValueOnce(texto(M2)).mockResolvedValueOnce(texto(M3)).mockResolvedValueOnce(texto(M4)).mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "x" }] } as never);
    const r = await (await POST(req())).json();
    expect(r.error).not.toMatch(/claude/i);
  });
});

describe("generate-dvs — ida y vuelta con la semántica REAL de rutas con puntos de Firestore", () => {
  const huella = () => huellaMapaPESTEL(payload as never);
  const inicial = () => ({
    phases: { exploracion: {
      status: "in-progress", data: { pestl: { a: 1 } },
      linkedSource: { kind: "express", componente: "moddulo", sourceId: "p1", payload },
      m1: { creadoEn: "t", ediciones: {}, aprobacion: { huella: huella(), por: "u", en: "t", categoriasEditadas: 0, total: 1 } },
      dvs: { viejo: true },
    } },
  });
  const sinGenerar = (doc: Record<string, unknown>) =>
    resumenM1ParaCliente((doc.phases as { exploracion: never }).exploracion);

  it("lo que escribe el update, aplicado como Firestore, hace que la LECTURA diga motoresSinGenerar=false y fusiona m1 (no lo reemplaza)", async () => {
    let doc = inicial() as Record<string, unknown>;
    expect(sinGenerar(doc).motoresSinGenerar).toBe(true); // antes: dvs de otro análisis, sin generacion
    conM1(true);
    await POST(req());
    doc = aplicarUpdateFirestore(doc, mockDb.updates()[0].data);
    const e = (doc.phases as { exploracion: Record<string, unknown> }).exploracion;
    expect(e.m1).toMatchObject({ creadoEn: "t", ediciones: {}, aprobacion: { huella: huella() }, generacion: { huella: huella() } });
    expect(e.draftDVS).toBeTruthy();
    const r = sinGenerar(doc);
    expect(r.estado).toBe("aprobado");
    expect(r.motoresSinGenerar).toBe(false);
    return;
  });

  it("después de un autoguardado intermedio (PATCH de data) sigue en false", async () => {
    conM1(true);
    await POST(req());
    let doc = aplicarUpdateFirestore(inicial() as Record<string, unknown>, mockDb.updates()[0].data);
    doc = aplicarUpdateFirestore(doc, { "phases.exploracion.data.pestl": { a: 2 }, updatedAt: "TS2" });
    expect(sinGenerar(doc).motoresSinGenerar).toBe(false);
  });

  it("y después de aprobar y finalizar los motores (finalize-dvs: borra borrador y aprobaciones, escribe el dvs) sigue en false: M1 aprobado, sin borrador, con dvs de ESTE M1", async () => {
    conM1(true);
    await POST(req());
    let doc = aplicarUpdateFirestore(inicial() as Record<string, unknown>, mockDb.updates()[0].data);
    doc = aplicarUpdateFirestore(doc, { "phases.exploracion.motorAprobaciones": { M2: true, M3: true, M4: true } });
    doc = aplicarUpdateFirestore(doc, {
      "phases.exploracion.dvs": { nuevo: true }, "phases.exploracion.estado": "lista",
      "phases.exploracion.draftDVS": "FIELD_DELETE", "phases.exploracion.motorAprobaciones": "FIELD_DELETE",
    });
    const e = (doc.phases as { exploracion: Record<string, unknown> }).exploracion;
    expect(e.draftDVS).toBeUndefined();
    expect(e.motorAprobaciones).toBeUndefined();
    const r = sinGenerar(doc);
    expect(r.estado).toBe("aprobado");
    expect(r.motoresSinGenerar).toBe(false);
  });

  it("negativo: si la generación no escribiera generacion (o la huella fuera otra), la lectura diría «sin generar»", () => {
    const doc = aplicarUpdateFirestore(inicial() as Record<string, unknown>, { "phases.exploracion.draftDVS": { x: 1 } });
    expect(sinGenerar(doc).motoresSinGenerar).toBe(true);
    const otra = aplicarUpdateFirestore(doc, { "phases.exploracion.m1.generacion": { huella: "otra", en: "t" } });
    expect(sinGenerar(otra).motoresSinGenerar).toBe(true);
  });
});
