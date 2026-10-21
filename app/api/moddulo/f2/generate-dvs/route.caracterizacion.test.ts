// CARACTERIZACIÓN (M1, commit 1) de generate-dvs saveas:"draft", camino multi-motor: fija el
// comportamiento ACTUAL antes de que el commit de compuerta lo cambie. Hoy la ruta:
//   · lee el M1 de linkedSource.payload (no hay "aprobación" que exigir),
//   · lo serializa con serializeMapaPESTEL (desde el paso 5 SIN límites: reescrita a propósito la prueba 2),
//   · llama a Claude 4 veces (M2‖M3 → M4 → M5) y escribe draftDVS vaciando motorAprobaciones.

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

describe("generate-dvs draft — comportamiento actual (multi-motor)", () => {
  it("1. hace 4 llamadas a Claude, responde 200 con el dvs y escribe SOLO el borrador: draftDVS + motorAprobaciones vacío + snapshot del XPCTO (no toca dvs ni estado)", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).dvs.hei.tensionCentral).toBe("tensión");
    expect(crear).toHaveBeenCalledTimes(4);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(Object.keys(u[0].data).sort()).toEqual([
      "phases.exploracion.draftDVS", "phases.exploracion.motorAprobaciones",
      "phases.exploracion.xpctoSnapshotAtGeneration", "updatedAt",
    ]);
    expect(u[0].data["phases.exploracion.motorAprobaciones"]).toEqual({});
    expect(u[0].data["phases.exploracion.xpctoSnapshotAtGeneration"]).toBe(JSON.stringify({ hito: "H" }));
    expect(u[0].data).not.toHaveProperty("phases.exploracion.dvs");
  });

  it("2. (paso 5, reescrita a propósito) el M1 que ve Claude sale de linkedSource.payload, serializado SIN límites: descripción íntegra y todas las señales", async () => {
    await POST(req());
    const userM2 = (crear.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
    expect(userM2).toContain("[P] Político — AMENAZA");
    expect(userM2).toContain("Narrativa P.");
    expect(userM2).toContain("a".repeat(300));
    expect(userM2).not.toContain("omitidas");
    for (const i of [1, 2, 3, 4, 5]) expect(userM2).toContain(`adversa ${i}`);
  });

  it("3. NO exige ninguna aprobación del M1: un payload sin ningún registro de aprobación genera igual", async () => {
    // No hay campo `m1` en el proyecto (ni existe aún): hoy cualquier payload dispara la generación.
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(crear).toHaveBeenCalledTimes(4);
  });

  it("4. si M4 falla: 500 con motor «M4» y NO se escribe nada", async () => {
    crear.mockReset();
    crear.mockResolvedValueOnce(texto(M2)).mockResolvedValueOnce(texto(M3)).mockRejectedValueOnce(new Error("boom"));
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect((await res.json()).motor).toBe("M4");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("5. sin payload usa la ruta legada: UNA llamada a Claude (con los datos exploratorios) y también escribe el borrador", async () => {
    proyecto(false);
    crear.mockReset();
    crear.mockResolvedValueOnce(texto({ ...M5, contrasteXPCTO: M2, semaforo: M3, incertidumbres: M4 }));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(crear).toHaveBeenCalledTimes(1);
    const user = (crear.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
    expect(user).toContain("DATOS EXPLORATORIOS");
    expect(mockDb.updates()[0].data).toHaveProperty("phases.exploracion.draftDVS");
  });
});
