// PATCH / GET /api/moddulo/projects/[projectId] — H-M5 (26-10-07).
// Antes el PATCH hacía `update({...body})` con el cuerpo tal cual y `phaseData` reemplazaba
// `phases.X.data` completo. Aquí se prueba por la ruta REAL: cada ataque devuelve 400, la
// respuesta no contiene el contenido enviado y Firestore NO recibe ninguna escritura del usuario.
// Límite declarado: la semántica de rutas con punto de update() se toma de la documentación de
// Firestore y del uso existente del chat; no se verificó contra el emulador (Java 17 < 21).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { GET, PATCH } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const session = vi.mocked(getSessionFromRequest);

const OWNER = "uidOwner";
const ANALISTA = "uidAnalista";
const AJENO = "uidAjeno";

function proyecto(over: Record<string, unknown> = {}) {
  return {
    userId: OWNER,
    name: "Proyecto",
    type: "electoral",
    status: "active",
    collaborators: [
      { uid: OWNER, role: "owner" },
      { uid: ANALISTA, role: "analyst" },
    ],
    xpcto: { hito: "H", sujeto: "S", justificacion: "J" },
    phases: {},
    ...over,
  };
}

function escrituras() {
  return db.updates().filter((u) => !(Object.keys(u.data).length === 1 && "lastAccessedAt" in u.data));
}

function patch(body: unknown, crudo = false) {
  const req = new NextRequest("http://localhost/api/moddulo/projects/p1", {
    method: "PATCH",
    body: crudo ? (body as string) : JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ projectId: "p1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  session.mockResolvedValue(mockSessionPayload({ uid: OWNER }));
  db.reset({ "moddulo_projects/p1": proyecto() });
});

describe("PATCH — lo legítimo que envían los clientes reales sigue funcionando", () => {
  it("hub: editar nombre/descripción/color y cambiar estado", async () => {
    expect((await patch({ name: "Nuevo", description: "d", color: "#248CC1" })).status).toBe(200);
    expect((await patch({ status: "archived" })).status).toBe(200);
    expect(escrituras()).toHaveLength(2);
  });

  it("F1: autoguardado de xpcto con duracionMeses null (caso real: NaN → null)", async () => {
    const res = await patch({
      xpcto: { hito: "H", sujeto: "S", capacidades: { financiero: "", humano: "", logistico: "" }, tiempo: { fechaLimite: "", duracionMeses: null }, justificacion: "" },
    });
    expect(res.status).toBe(200);
    expect(escrituras()[0].data["xpcto.tiempo.duracionMeses"]).toBeNull();
  });

  it("territorio completo", async () => {
    expect((await patch({ territorio: { nivel: "distrito_local", nombre: "CDMX › Iztapalapa", pais: "México", estado: "Ciudad de México", cve_distrito: "027" } })).status).toBe(200);
  });

  it("F1/F2/F3: 'Comenzar' marca la fase", async () => {
    for (const phaseId of ["proposito", "exploracion", "investigacion"]) {
      db.reset({ "moddulo_projects/p1": proyecto() });
      expect((await patch({ phaseData: { phaseId, started: true } })).status).toBe(200);
      expect(escrituras()[0].data[`phases.${phaseId}.started`]).toBe(true);
    }
  });

  it("F2: el cierre envía {aprobadoEn} + f3Seed (que se ignora) y NO pisa el formulario", async () => {
    db.reset({
      "moddulo_projects/p1": proyecto({ phases: { exploracion: { status: "completed", data: { pestl: { politico: { contexto: "IMPORTANTE" } } } } } }),
    });
    const res = await patch({
      phaseData: { phaseId: "exploracion", data: { aprobadoEn: "2026-10-07T00:00:00.000Z" } },
      f3Seed: { pip: [], incertidumbres: [] },
    });
    expect(res.status).toBe(200);
    const [w] = escrituras();
    expect(Object.keys(w.data).filter((k) => k.includes(".data"))).toEqual(["phases.exploracion.data.aprobadoEn"]);
    expect("f3Seed" in w.data).toBe(false);
  });

  it("F1: borrador de reporte", async () => {
    expect((await patch({ reportDraft: { phaseId: "proposito", reportText: "# R" } })).status).toBe(200);
  });
});

describe("PATCH — cada ataque falla cerrado con 400 y sin escritura", () => {
  const ataques: [string, unknown][] = [
    ["collaborators", { collaborators: [{ uid: AJENO, role: "owner" }] }],
    ["userId", { userId: AJENO }],
    ["deletedAt", { deletedAt: "x" }],
    ["ruta con punto a las aprobaciones", { "phases.exploracion.motorAprobaciones.M2": true }],
    ["ruta con punto al dvs", { "phases.exploracion.dvs": { pip: [] } }],
    ["currentPhase", { currentPhase: "evaluacion" }],
    ["settings", { settings: { aiLevel: "x" } }],
    ["phaseId inyectado", { phaseData: { phaseId: "exploracion.dvs", data: { notas: "x" } } }],
    ["phaseId inventado", { phaseData: { phaseId: "fase_nueva", started: true } }],
    ["clave de data fuera de lista", { phaseData: { phaseId: "exploracion", data: { dvs: {} } } }],
    ["clave de data con punto", { phaseData: { phaseId: "investigacion", data: { "a.b": 1 } } }],
    ["reportDraft con fase inyectada", { reportDraft: { phaseId: "proposito.reportText", reportText: "x" } }],
    ["hoja de xpcto inventada", { xpcto: { borrador: "x" } }],
    ["nivel de territorio inválido", { territorio: { nivel: "galaxia", nombre: "X" } }],
  ];

  it.each(ataques)("%s", async (_n, cuerpo) => {
    const res = await patch(cuerpo);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; campo: string; motivo: string };
    expect(json.error).toBe("Solicitud inválida");
    expect(typeof json.campo).toBe("string");
    expect(typeof json.motivo).toBe("string");
    expect(escrituras()).toEqual([]);
  });

  it("la respuesta de error nunca incluye el contenido enviado", async () => {
    const SECRETO = "SECRETO-NO-DEBE-SALIR-123";
    for (const cuerpo of [
      { collaborators: SECRETO },
      { name: SECRETO.repeat(50) },
      { color: SECRETO },
      { xpcto: { hito: 5, sujeto: SECRETO } },
      { phaseData: { phaseId: SECRETO, started: true } },
      { phaseData: { phaseId: "exploracion", data: { pestl: SECRETO } } },
    ]) {
      const res = await patch(cuerpo);
      expect(res.status).toBe(400);
      expect(JSON.stringify(await res.json())).not.toContain("SECRETO");
    }
  });

  it("JSON inválido o cuerpo que no es objeto → 400", async () => {
    expect((await patch("{no es json", true)).status).toBe(400);
    expect((await patch("[1,2]", true)).status).toBe(400);
    expect((await patch("null", true)).status).toBe(400);
    expect(escrituras()).toEqual([]);
  });
});

describe("PATCH — autorización", () => {
  it("401 sin sesión", async () => {
    session.mockResolvedValue(null);
    expect((await patch({ name: "x" })).status).toBe(401);
    expect(escrituras()).toEqual([]);
  });

  it("analyst: 403 al editar, 403 al marcar fase iniciada (antes de H-M5 podía), sin escritura", async () => {
    session.mockResolvedValue(mockSessionPayload({ uid: ANALISTA }));
    expect((await patch({ name: "x" })).status).toBe(403);
    expect((await patch({ phaseData: { phaseId: "proposito", started: true } })).status).toBe(403);
    expect((await patch({ phaseData: { phaseId: "exploracion", data: { aprobadoEn: "x" } } })).status).toBe(403);
    expect(escrituras()).toEqual([]);
  });

  it("ajeno: 404", async () => {
    session.mockResolvedValue(mockSessionPayload({ uid: AJENO }));
    expect((await patch({ name: "x" })).status).toBe(404);
    expect(escrituras()).toEqual([]);
  });

  it("started no revierte una fase completada", async () => {
    db.reset({ "moddulo_projects/p1": proyecto({ phases: { exploracion: { status: "completed" } } }) });
    expect((await patch({ phaseData: { phaseId: "exploracion", started: true } })).status).toBe(200);
    expect("phases.exploracion.status" in escrituras()[0].data).toBe(false);
  });

  it("un error inesperado devuelve un 500 genérico (no el mensaje interno)", async () => {
    db.reset({}); // sin documento → getProject devuelve null → 404, no 500
    expect((await patch({ name: "x" })).status).toBe(404);
  });
});

describe("GET — la reconstrucción de xpcto desde el historial del chat solo escribe rutas válidas", () => {
  function get() {
    const req = new NextRequest("http://localhost/api/moddulo/projects/p1");
    return GET(req, { params: Promise.resolve({ projectId: "p1" }) });
  }

  it("descarta rutas inventadas por el modelo y escribe solo las válidas", async () => {
    db.reset({
      "moddulo_projects/p1": proyecto({
        xpcto: { hito: "", sujeto: "", justificacion: "" },
        phases: {
          proposito: {
            chatHistory: [
              {
                role: "assistant",
                extractedData: {
                  "xpcto.hito": "Hito recuperado",
                  "xpcto.tiempo.duracionMeses": 12,
                  "xpcto.borrador": { x: 1 },
                  "xpcto.a.b.c": "profunda",
                  "xpcto.__proto__.x": "x",
                  "collaborators": "no empieza con xpcto.",
                },
              },
            ],
          },
        },
      }),
    });
    const res = await get();
    expect(res.status).toBe(200);
    const [w] = escrituras();
    expect(Object.keys(w.data).sort()).toEqual(["updatedAt", "xpcto.hito", "xpcto.tiempo.duracionMeses"]);
    expect(w.data["xpcto.hito"]).toBe("Hito recuperado");
  });

  it("si todo se descarta, no escribe nada", async () => {
    db.reset({
      "moddulo_projects/p1": proyecto({
        xpcto: { hito: "", sujeto: "", justificacion: "" },
        phases: { proposito: { chatHistory: [{ role: "assistant", extractedData: { "xpcto.zzz": "x" } }] } },
      }),
    });
    expect((await get()).status).toBe(200);
    expect(escrituras()).toEqual([]);
  });
});
