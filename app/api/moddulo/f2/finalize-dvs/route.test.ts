// finalize-dvs:
//  - al reemplazar un dvs ya finalizado se conserva el anterior en dvsVersiones dentro de la
//    MISMA transacción; la primera finalización no copia; si la copia falla no se aplica nada;
//  - H15 / M8, commit 3 — candado por DIFF REAL de ids: solo se pide confirmación cuando el dvs
//    nuevo ELIMINA ids de preguntas/actores que la Fase 3 usa; con ids conservados no hay candado.
//    El candado se revalida dentro de la transacción contra la huella que el usuario confirmó y
//    recalculando el diff contra el dvs leído ahí.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return { ...real, getProject: vi.fn() };
});
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";

const pipI = (id: string, pregunta: string, numero: number) => ({ pipItemId: id, numero, pregunta });
const actorI = (id: string, nombre: string) => ({ actorId: id, nombre });
const dvsA = {
  hei: { tensionCentral: "A" }, contrasteXPCTO: [], incertidumbres: [],
  semaforo: [actorI("act-1", "Gobernador"), actorI("act-2", "Cámara")],
  pip: [pipI("x", "¿Quién vota?", 1), pipI("y", "¿Cuánto cuesta?", 2)],
};
const dvsB = { ...dvsA, hei: { tensionCentral: "B" } }; // mismos ids, otro texto
const sinY = { ...dvsA, pip: [dvsA.pip[0]] }; // elimina la pregunta "y"
const sinActor2 = { ...dvsA, semaforo: [dvsA.semaforo[0]] }; // elimina "act-2"

const asig = (over = {}) => ({ asignacionId: "a", tipo: "primaria", canal: "canal2", justificacion: "", estado: "pendiente", activada: true, ...over });
function docProyecto(extra: { dvs?: unknown; tareas?: unknown[]; die?: unknown; sintesis?: unknown; veredicto?: unknown } = {}) {
  return {
    phases: {
      exploracion: { dvs: "dvs" in extra ? extra.dvs : dvsA },
      investigacion: {
        f3TareasPIP: extra.tareas ?? [],
        ...(extra.sintesis ? { f3Sintesis: extra.sintesis } : {}),
        ...(extra.veredicto ? { f3Veredicto: extra.veredicto } : {}),
        ...(extra.die ? { f3DIE: extra.die } : {}),
      },
    },
  };
}
const conAvance = [{ pipItemId: "y", asignaciones: [asig({ estado: "en_curso" })] }, { pipItemId: "x", asignaciones: [asig()] }];
function sembrar(extra = {}, resultados: Record<string, unknown> = {}) {
  mockAdminDb.reset({
    [P]: docProyecto(extra),
    ...Object.fromEntries(Object.entries(resultados).map(([id, d]) => [`${P}/f3Resultados/${id}`, d])),
  });
}
function req(body: unknown) {
  return new Request("http://local/api/moddulo/f2/finalize-dvs", { method: "POST", body: JSON.stringify(body) }) as never;
}
const versiones = () => Object.entries(mockAdminDb.snapshot()).filter(([p]) => p.startsWith(`${P}/dvsVersiones/`));
const proyectoSimple = () => vi.mocked(getProject).mockResolvedValue({ phases: { exploracion: {} } } as never);

async function pedirHuella(draft: unknown) {
  const r = await POST(req({ projectId: "p1", draftDVS: draft }));
  expect(r.status).toBe(409);
  const b = await r.json();
  expect(b.error).toBe("reemplazo_requiere_confirmacion");
  return b as { huella: string; lineas: string[]; eliminados: { totalPreguntas: number; totalActores: number; preguntas: string[]; actores: string[] } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  proyectoSimple();
});

describe("POST finalize-dvs — copia de versiones (commit 1)", () => {
  it("primera finalización (sin dvs previo): 200, sin copia, sin candado", async () => {
    mockAdminDb.reset({ [P]: { phases: { exploracion: {} } } });
    const res = await POST(req({ projectId: "p1", draftDVS: dvsA }));
    expect(res.status).toBe(200);
    expect(versiones()).toHaveLength(0);
    expect(mockAdminDb.updates()[0].data["phases.exploracion.estado"]).toBe("lista");
  });

  it("reemplazo de un dvs distinto que conserva todos los ids: 200 y deja una copia del anterior con uid y origen", async () => {
    sembrar({ tareas: conAvance });
    const res = await POST(req({ projectId: "p1", draftDVS: dvsB }));
    expect(res.status).toBe(200);
    const v = versiones();
    expect(v).toHaveLength(1);
    expect(v[0][1]).toMatchObject({ dvs: dvsA, reemplazadoPor: "uOwner", origen: "finalize-dvs" });
  });

  it("«Guardar cambios» sin cambios (mismo contenido): 200 y NO crea otra copia", async () => {
    sembrar();
    const res = await POST(req({ projectId: "p1", draftDVS: structuredClone(dvsA) }));
    expect(res.status).toBe(200);
    expect(versiones()).toHaveLength(0);
  });

  it("sigue exigiendo sesión y proyecto", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await POST(req({ projectId: "p1", draftDVS: dvsA }))).status).toBe(401);
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await POST(req({ projectId: "p1", draftDVS: dvsA }))).status).toBe(404);
  });
});

describe("POST finalize-dvs — errores: solo se afirma «sigue vigente» donde está demostrado", () => {
  it("la transacción falla (resultado incierto): 500 reemplazo_escritura_incierta, SIN «se conserva sin cambios», y no se aplicó ninguna escritura", async () => {
    sembrar();
    mockAdminDb.runTransaction.mockRejectedValueOnce(new Error("copia falló"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ projectId: "p1", draftDVS: dvsB }));
    expect(res.status).toBe(500);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_escritura_incierta");
    expect(b.mensaje).toContain("Recarga la página para verificar el estado");
    expect(JSON.stringify(b)).not.toContain("conserva");
    expect(mockAdminDb.updates()).toHaveLength(0);
  });

  it("error ANTES de la transacción (lectura del estado): 500 finalize_fallo_previo con «sigue vigente», sin escrituras", async () => {
    sembrar();
    mockAdminDb.collection.mockImplementationOnce(() => { throw new Error("lectura falló"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ projectId: "p1", draftDVS: dvsB }));
    expect(res.status).toBe(500);
    const b = await res.json();
    expect(b.error).toBe("finalize_fallo_previo");
    expect(b.mensaje).toContain("El análisis anterior sigue vigente");
    expect(mockAdminDb.updates()).toHaveLength(0);
    expect(versiones()).toHaveLength(0);
  });
});

describe("POST finalize-dvs — candado por diff de ids (H15, commit 3)", () => {
  it("quitar una pregunta con tarea con avance, sin confirmar: 409 con líneas, huella y lo eliminado; cero escrituras", async () => {
    sembrar({ tareas: conAvance });
    const b = await pedirHuella(sinY);
    expect(b.huella).toBeTruthy();
    expect(b.eliminados).toMatchObject({ totalPreguntas: 1, totalActores: 0, preguntas: ["¿Cuánto cuesta?"] });
    expect(b.lineas[0]).toContain("1 tarea de «M1 · Tablero de tareas» (1 con avance)");
    expect(b.lineas[0]).toContain("junto con sus asignaciones y su avance");
    expect(mockAdminDb.updates()).toHaveLength(0);
    expect(versiones()).toHaveLength(0);
  });

  it("quitar una pregunta SIN nada colgado en F3 (otra tarea sí existe): 200 sin confirmación", async () => {
    sembrar({ tareas: [{ pipItemId: "x", asignaciones: [asig({ estado: "en_curso" })] }] });
    const res = await POST(req({ projectId: "p1", draftDVS: sinY }));
    expect(res.status).toBe(200);
    expect(versiones()).toHaveLength(1);
  });

  it("ids conservados con un Reporte F3 ya generado: 200 (familia H-M3, no se toca): no se bloquea", async () => {
    sembrar({ tareas: conAvance, die: { x: 1 }, veredicto: { v: 1 } }, { r1: { aprobado: true } });
    const res = await POST(req({ projectId: "p1", draftDVS: dvsB }));
    expect(res.status).toBe(200);
  });

  it("solo se elimina un actor que la síntesis usa: pide confirmación (criterio vigente)", async () => {
    sembrar({ sintesis: { fodaAdversariosInsumo: { "act-2": { nombreActor: "Cámara" } } } });
    const r = await POST(req({ projectId: "p1", draftDVS: sinActor2 }));
    expect(r.status).toBe(409);
    const b = await r.json();
    expect(b.eliminados).toMatchObject({ totalPreguntas: 0, totalActores: 1, actores: ["Cámara"] });
    expect(b.lineas.join(" ")).toContain("«(ya no está en el Semáforo vigente)»");
  });

  it("confirmación válida (huella del pre-chequeo): 200, copia en dvsVersiones con origen finalize-dvs", async () => {
    sembrar({ tareas: conAvance });
    const { huella } = await pedirHuella(sinY);
    const res = await POST(req({ projectId: "p1", draftDVS: sinY, confirmar: true, huella }));
    expect(res.status).toBe(200);
    const v = versiones();
    expect(v).toHaveLength(1);
    expect(v[0][1]).toMatchObject({ dvs: dvsA, origen: "finalize-dvs", reemplazadoPor: "uOwner" });
  });

  it("huella equivocada o confirmar sin huella: 409 huella vencida / requiere confirmación; cero escrituras", async () => {
    sembrar({ tareas: conAvance });
    const mala = await POST(req({ projectId: "p1", draftDVS: sinY, confirmar: true, huella: "no-es-esa" }));
    expect(mala.status).toBe(409);
    expect((await mala.json()).error).toBe("reemplazo_huella_vencida");
    const sin = await POST(req({ projectId: "p1", draftDVS: sinY, confirmar: true }));
    expect((await sin.json()).error).toBe("reemplazo_requiere_confirmacion");
    expect(mockAdminDb.updates()).toHaveLength(0);
  });

  it("B — una confirmación para quitar la pregunta «y» NO sirve para quitar la «x»", async () => {
    sembrar({ tareas: [{ pipItemId: "y", asignaciones: [asig({ estado: "en_curso" })] }, { pipItemId: "x", asignaciones: [asig({ estado: "en_curso" })] }] });
    const { huella } = await pedirHuella(sinY);
    const sinX = { ...dvsA, pip: [dvsA.pip[1]] };
    const res = await POST(req({ projectId: "p1", draftDVS: sinX, confirmar: true, huella }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("reemplazo_huella_vencida");
    expect(mockAdminDb.updates()).toHaveLength(0);
  });

  it("Reporte F3 ya generado + la edición elimina una pregunta con impacto: 409 bloqueado, cero escrituras", async () => {
    sembrar({ tareas: conAvance, die: { x: 1 } });
    const res = await POST(req({ projectId: "p1", draftDVS: sinY }));
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_bloqueado");
    expect(b.mensaje).toContain("«M4 · Veredicto HEI»");
    expect(b.mensaje).not.toMatch(/\bDIE\b/);
    expect(mockAdminDb.updates()).toHaveLength(0);
  });

  it("aparece un resultado aprobado entre el pre-chequeo y la transacción: 409 huella vencida y NO se escribe nada", async () => {
    sembrar({ tareas: [{ pipItemId: "y", asignaciones: [asig({ estado: "recibido", resultadoId: "r1" })] }] }, { r1: { aprobado: false } });
    const { huella } = await pedirHuella(sinY);
    const real = mockAdminDb.runTransaction.getMockImplementation()!;
    mockAdminDb.runTransaction.mockImplementationOnce(((fn: never) => {
      // Otro colaborador aprueba el resultado justo antes de que corra la transacción.
      mockAdminDb.reset({
        [P]: docProyecto({ tareas: [{ pipItemId: "y", asignaciones: [asig({ estado: "recibido", resultadoId: "r1" })] }] }),
        [`${P}/f3Resultados/r1`]: { aprobado: true },
      });
      return real(fn);
    }) as never);
    const res = await POST(req({ projectId: "p1", draftDVS: sinY, confirmar: true, huella }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("reemplazo_huella_vencida");
    expect(mockAdminDb.updates()).toHaveLength(0);
    expect(versiones()).toHaveLength(0);
  });

  it("C — el dvs vigente cambia entre el pre-chequeo y la transacción (otra pestaña guardó): rechaza y NO escribe", async () => {
    sembrar({ tareas: conAvance });
    const { huella } = await pedirHuella(sinY);
    const real = mockAdminDb.runTransaction.getMockImplementation()!;
    mockAdminDb.runTransaction.mockImplementationOnce(((fn: never) => {
      // Otra pestaña guardó una edición (mismos ids, otro texto) después de nuestro pre-chequeo.
      mockAdminDb.reset({ [P]: docProyecto({ dvs: { ...dvsA, hei: { tensionCentral: "OTRA PESTAÑA" } }, tareas: conAvance }) });
      return real(fn);
    }) as never);
    const res = await POST(req({ projectId: "p1", draftDVS: sinY, confirmar: true, huella }));
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_huella_vencida");
    expect(b.eliminados.totalPreguntas).toBe(1); // el diff se recalculó contra el dvs leído en la transacción
    expect(mockAdminDb.updates()).toHaveLength(0);
    expect(versiones()).toHaveLength(0);
  });

  it("aparece un Reporte F3 entre el pre-chequeo y la transacción: 409 bloqueado y NO se escribe nada", async () => {
    sembrar({ tareas: conAvance });
    const { huella } = await pedirHuella(sinY);
    const real = mockAdminDb.runTransaction.getMockImplementation()!;
    mockAdminDb.runTransaction.mockImplementationOnce(((fn: never) => {
      mockAdminDb.reset({ [P]: docProyecto({ tareas: conAvance, die: { x: 1 } }) });
      return real(fn);
    }) as never);
    const res = await POST(req({ projectId: "p1", draftDVS: sinY, confirmar: true, huella }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("reemplazo_bloqueado");
    expect(mockAdminDb.updates()).toHaveLength(0);
  });

  it("segunda confirmación con la misma huella tras la primera: no duplica nada (el dvs vigente ya no tiene ese id, no hay qué quitar)", async () => {
    sembrar({ tareas: conAvance });
    const { huella } = await pedirHuella(sinY);
    expect((await POST(req({ projectId: "p1", draftDVS: sinY, confirmar: true, huella }))).status).toBe(200);
    // El mock aplica el update con la clave literal: se siembra el estado que dejó la primera escritura.
    mockAdminDb.reset({ [P]: docProyecto({ dvs: sinY, tareas: conAvance }) });
    const segunda = await POST(req({ projectId: "p1", draftDVS: sinY, confirmar: true, huella }));
    // Con el dvs ya sin "y" la segunda no elimina nada: no hay nada que confirmar ni que duplicar.
    expect(segunda.status).toBe(200);
    expect(versiones()).toHaveLength(0);
  });

  it("I — proyecto legado sin ids: ambos lados se normalizan igual y no hay eliminados falsos; la pregunta realmente quitada sí se detecta", async () => {
    const legado = {
      hei: { tensionCentral: "L" }, contrasteXPCTO: [], incertidumbres: [],
      semaforo: [{ nombre: "Alcalde" }],
      pip: [{ numero: 1, pregunta: "p1" }, { numero: 2, pregunta: "p2" }],
    };
    // El tablero legado apunta a `legacy-2` (la normalización de getProject).
    sembrar({ dvs: legado, tareas: [{ numero: 2, canalAsignado: "canal2", estado: "en_curso" }] });
    // Mismo dvs en el borrador (sin ids): nada eliminado → guarda sin confirmación.
    expect((await POST(req({ projectId: "p1", draftDVS: structuredClone(legado) }))).status).toBe(200);
    // Quitar la pregunta 2: el servidor la reconoce como `legacy-2` y encuentra su tarea.
    sembrar({ dvs: legado, tareas: [{ numero: 2, canalAsignado: "canal2", estado: "en_curso" }] });
    const sin2 = { ...legado, pip: [legado.pip[0]] };
    const r = await POST(req({ projectId: "p1", draftDVS: sin2 }));
    expect(r.status).toBe(409);
    const b = await r.json();
    expect(b.eliminados.preguntas).toEqual(["p2"]);
    expect(b.lineas[0]).toContain("1 tarea");
  });
});

describe("negativo — la ruta anterior (sin candado) no pide confirmación al quitar ids que F3 usa", () => {
  it("el comportamiento anterior respondía siempre 200 y reemplazaba; el actual responde 409", async () => {
    sembrar({ tareas: conAvance, die: { x: 1 } });
    const antes = { status: 200 }; // finalize-dvs de HEAD: reemplazarDVSConVersion sin guardia
    const ahora = await POST(req({ projectId: "p1", draftDVS: sinY }));
    expect(ahora.status).not.toBe(antes.status);
  });
});
