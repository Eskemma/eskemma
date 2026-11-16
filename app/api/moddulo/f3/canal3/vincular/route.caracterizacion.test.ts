// 7b-7 — CARACTERIZACIÓN de canal3/vincular escrita ANTES de tocar la ruta: forma exacta de lo escrito,
// borrado del marcador de Fontana, códigos y orden de las respuestas. Debe pasar contra el código
// anterior y SIN editarse contra el refactor transaccional. evaluarCompatibilidad y
// extraerTerritorioEscalar se mockean (como en route.test.ts): la compatibilidad real se prueba en
// route.atomicidad.test.ts. Límite: el mock por defecto acepta `undefined` (ver route.undefined.test.ts).

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EvaluacionCompatibilidad } from "@/types/shared.types";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb(), adminStorage: createMockAdminStorage() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/moddulo/attachments", () => ({ extractTextPerFile: vi.fn() }));
vi.mock("@/lib/moddulo/canal3Evaluation", () => ({ evaluarCompatibilidad: vi.fn() }));
vi.mock("@/lib/territorio/staleness", () => ({ extraerTerritorioEscalar: vi.fn() }));

import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { evaluarCompatibilidad } from "@/lib/moddulo/canal3Evaluation";
import { extraerTerritorioEscalar } from "@/lib/territorio/staleness";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb, createMockAdminStorage } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { UID, PROJECT_ID, OWN_PATH, SESION_FONTANA, rutaProyecto, rutaResultado, proyectoDoc, bodyValido, comoProject } from "./siembraVincular";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const storage = adminStorage as unknown as ReturnType<typeof createMockAdminStorage>;

const compatible: EvaluacionCompatibilidad = {
  pertinencia: { cumple: true, detalle: "ok" },
  vigencia: { cumple: true, detalle: "ok" },
  compatibilidadMetodologica: { cumple: true, detalle: "ok" },
};
const peticion = (extra: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/moddulo/f3/canal3/vincular", {
    method: "POST",
    body: JSON.stringify({ ...bodyValido, ...extra }),
  }) as unknown as Parameters<typeof POST>[0];

function sembrar(proyecto: Record<string, unknown> = proyectoDoc()) {
  db.reset({ [rutaProyecto]: proyecto });
  storage.reset([OWN_PATH]);
  vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
}

describe("canal3/vincular — caracterización (comportamiento actual)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
    vi.mocked(evaluarCompatibilidad).mockReturnValue(compatible);
    vi.mocked(extraerTerritorioEscalar).mockReturnValue({ nivel: "estatal" } as ReturnType<typeof extraerTerritorioEscalar>);
  });

  it("camino feliz: escribe el resultado con su forma exacta y responde {resultadoId, resultado}", async () => {
    sembrar();
    const res = await POST(peticion());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.resultadoId).toBe("res1");
    const esperado = {
      moduloPIP: "¿Pregunta?",
      origen: { sourceKind: "external", componente: "external", analisisId: "res1", fechaEntrega: expect.any(String) },
      cobertura: { completa: true },
      payload: { archivoUrl: OWN_PATH, extractoTexto: "texto extraído" },
      metadatosFuente: bodyValido.metadatosFuente,
      compatibilidad: compatible,
      proyectoTerritorioSnapshotAtVinculacion: JSON.stringify({ nivel: "estatal" }),
    };
    expect(json.resultado).toEqual(esperado);
    expect(db.snapshot()[rutaResultado]).toEqual({ ...esperado, createdAt: "SERVER_TIMESTAMP" });
  });

  it("con reporteStoragePath: el payload lleva reporteInterpretativoUrl", async () => {
    sembrar();
    const reporte = `moddulo/${UID}/${PROJECT_ID}/f3/res1/reporte.md`;
    const res = await POST(peticion({ reporteStoragePath: reporte }));
    expect((await res.json()).resultado.payload.reporteInterpretativoUrl).toBe(reporte);
  });

  it("marcador de Fontana que coincide con fontanaSesionId: se borra", async () => {
    sembrar();
    await POST(peticion({ fontanaSesionId: SESION_FONTANA }));
    const upd = db.updates().filter((u) => u.path === rutaProyecto);
    expect(upd).toHaveLength(1);
    expect(upd[0].data).toMatchObject({ "phases.investigacion.fontanaPendiente": "FIELD_DELETE", updatedAt: "SERVER_TIMESTAMP" });
  });

  it("marcador que NO coincide, o sin fontanaSesionId: el único update del proyecto es el puntero del historial (sin marcador ni updatedAt)", async () => {
    // C3a-2: ANTES las dos peticiones seguidas dejaban `toHaveLength(0)` updates del proyecto. AHORA cada una
    // escribe el puntero (el mock no expande las claves con puntos, así que se resiembra entre peticiones).
    for (const extra of [{ fontanaSesionId: "otra" }, {}]) {
      sembrar();
      await POST(peticion(extra));
      expect(db.updates().filter((u) => u.path === rutaProyecto).map((u) => Object.keys(u.data))).toEqual([["phases.investigacion.revision"]]);
    }
  });

  it("proyecto SIN territorio (mock permisivo): 200 y el resultado queda sin snapshot de territorio", async () => {
    sembrar(proyectoDoc({ territorio: undefined }));
    const res = await POST(peticion());
    expect(res.status).toBe(200);
    expect((db.snapshot()[rutaResultado] as Record<string, unknown>).proyectoTerritorioSnapshotAtVinculacion).toBeUndefined();
  });

  it("422: pertinencia (sin bypass), territorio y vigencia (con su propio flag); nada se escribe", async () => {
    sembrar();
    vi.mocked(evaluarCompatibilidad).mockReturnValue({ ...compatible, pertinencia: { cumple: false, detalle: "tipo" } });
    const p = await POST(peticion({ confirmarPeseATerritorio: true, confirmarPeseAVigencia: true }));
    expect(p.status).toBe(422);
    expect((await p.json()).error).toBe("pertinencia_rechazada");

    vi.mocked(evaluarCompatibilidad).mockReturnValue({
      ...compatible,
      pertinencia: { cumple: true, detalle: "ok", territorioRequiereConfirmacion: true, territorioDetalle: "terr" },
    });
    const t = await POST(peticion());
    expect(t.status).toBe(422);
    expect((await t.json()).error).toBe("territorio_requiere_confirmacion");
    expect((await POST(peticion({ confirmarPeseATerritorio: true }))).status).toBe(200);

    vi.mocked(evaluarCompatibilidad).mockReturnValue({ ...compatible, vigencia: { cumple: false, detalle: "vence" } });
    const v = await POST(peticion());
    expect(v.status).toBe(422);
    expect((await v.json()).error).toBe("vigencia_rechazada");
  });

  it("404 file_not_found si el archivo no está en Storage (después de los 422); 404 si el proyecto no existe; 403 y 400 como siempre", async () => {
    sembrar();
    storage.reset([]);
    const f = await POST(peticion());
    expect(f.status).toBe(404);
    expect((await f.json()).error).toBe("file_not_found");

    vi.mocked(getProject).mockResolvedValue(null);
    expect((await POST(peticion())).status).toBe(404);
    expect((await POST(peticion({ storagePath: `moddulo/otro/${PROJECT_ID}/x.pdf` }))).status).toBe(403);
    expect((await POST(peticion({ nombre: undefined }))).status).toBe(400);
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/f3Resultados/"))).toHaveLength(0);
  });
});
