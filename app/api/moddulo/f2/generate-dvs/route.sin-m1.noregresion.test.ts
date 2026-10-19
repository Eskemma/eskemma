// NO REGRESIÓN (paso 4): sin `m1` —o con `m1` pero sin payload— generate-dvs hace lo de siempre. Escrita
// ANTES de la compuerta y verde contra el código anterior; si alguien aplica la compuerta sin condición,
// estas pruebas fallan.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return { ...real, getProject: vi.fn() };
});
vi.mock("@/lib/ai/claude", () => ({ anthropic: { messages: { create: vi.fn() } }, CLAUDE_MODEL: "modelo-de-prueba" }));
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
import { exploracionGate, type EstadoGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const P = "moddulo_projects/p1";
const texto = (o: unknown) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(o) }] }) as never;
const M2 = [{ dimension: "X", veredicto: "coherente", argumentacion: "arg", senalesPESTEL: ["s"] }];
const M3 = [{ nombre: "Actor", tipo: "partido", nivelRiesgo: "rojo", capacidadVeto: "alta", motivacion: "m", requiereInvestigacion: true }];
const M4 = [{ descripcion: "inc", urgencia: "alta", resolucion: "media", destino: "F3" }];
const M5 = {
  hei: { tensionCentral: "t", contexto: "c", condicionesFavorables: ["a"], condicionesAdversas: ["b"], premisaEstrategica: "p" },
  pip: [{ numero: 1, pregunta: "¿q?", metodo: "m", vinculoHito: "h", orden: 1, profundidad: "exploratoria" }],
};
function sembrar(estado: EstadoGate) {
  const exploracion = exploracionGate(estado);
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
  mockDb.reset({ [P]: { phases: { exploracion } } });
}
const req = (saveas: string) => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", saveas }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of ["error", "log", "warn"] as const) vi.spyOn(console, m).mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  crear.mockReset();
});

describe("generate-dvs — sin m1 / sin payload: comportamiento de siempre", () => {
  it("sin m1, draft: 200 y el update tiene EXACTAMENTE las claves de siempre (sin m1.generacion)", async () => {
    sembrar("sin_m1");
    crear.mockResolvedValueOnce(texto(M2)).mockResolvedValueOnce(texto(M3)).mockResolvedValueOnce(texto(M4)).mockResolvedValueOnce(texto(M5));
    const res = await POST(req("draft"));
    expect(res.status).toBe(200);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(Object.keys(u[0].data).sort()).toEqual([
      "phases.exploracion.draftDVS", "phases.exploracion.motorAprobaciones", "phases.exploracion.xpctoSnapshotAtGeneration", "updatedAt",
    ]);
  });
  it("sin m1, final: 200 y escribe el dvs", async () => {
    sembrar("sin_m1");
    crear.mockResolvedValueOnce(texto(M2)).mockResolvedValueOnce(texto(M3)).mockResolvedValueOnce(texto(M4)).mockResolvedValueOnce(texto(M5));
    expect((await POST(req("final"))).status).toBe(200);
    expect(mockDb.updates().some((x) => "phases.exploracion.dvs" in x.data)).toBe(true);
  });
  it("m1 sin payload (ruta legada): 200, sin m1.generacion", async () => {
    sembrar("sin_payload");
    crear.mockResolvedValueOnce(texto({ ...M5, contrasteXPCTO: M2, semaforo: M3, incertidumbres: M4 }));
    const res = await POST(req("draft"));
    expect(res.status).toBe(200);
    expect(mockDb.updates()[0].data).not.toHaveProperty("phases.exploracion.m1.generacion");
  });
  it("la compuerta NO toca m1.generacion en ningún otro caso (F diferido al Bloque 4): borrador no escribe nada", async () => {
    sembrar("borrador");
    expect((await POST(req("draft"))).status).toBe(409);
    expect(mockDb.updates()).toEqual([]);
  });
});
