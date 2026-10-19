// Paso 4 — generate-dvs bajo la compuerta del M1: 409 m1_no_aprobado antes de llamar al modelo; usa la copia
// congelada; la huella aprobada se CAPTURA al inicio y la escritura final la compara con ESA huella.

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
import { exploracionGate, huellaGate, otroMapaGate, type EstadoGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
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
const cuatroMotores = (alUltimo?: () => void) => {
  crear.mockReset();
  crear.mockResolvedValueOnce(texto(M2)).mockResolvedValueOnce(texto(M3)).mockResolvedValueOnce(texto(M4));
  crear.mockImplementationOnce(async () => { alUltimo?.(); return texto(M5); });
};
/** getProject and the stored document describe the same state. */
function sembrar(estado: EstadoGate, extra: Record<string, unknown> = {}, mapa?: object) {
  const exploracion = exploracionGate(estado, extra, mapa);
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
  mockDb.reset({ [P]: { phases: { exploracion } } });
}
const req = (body: Record<string, unknown> = {}) =>
  new Request("http://local/api/moddulo/f2/generate-dvs", { method: "POST", body: JSON.stringify({ projectId: "p1", saveas: "draft", ...body }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  cuatroMotores();
});

describe("generate-dvs — compuerta del M1", () => {
  it.each(["borrador", "reabierto"] as const)("M1 %s → 409 m1_no_aprobado, sin llamar al modelo y sin escribir (draft y final)", async (estado) => {
    for (const saveas of ["draft", "final"]) {
      sembrar(estado);
      const res = await POST(req({ saveas }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "m1_no_aprobado" });
    }
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toEqual([]);
  });

  it("copia aprobada inconsistente → 409 y un log estructural con ese motivo", async () => {
    sembrar("copia_alterada");
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(crear).not.toHaveBeenCalled();
    expect(vi.mocked(console.warn).mock.calls.map((c) => String(c[0])).some((l) => l.includes("copia aprobada inconsistente"))).toBe(true);
  });

  it("aprobado → 200, el prompt sale de la copia congelada y generacion lleva la huella CAPTURADA", async () => {
    sembrar("aprobado");
    const res = await POST(req());
    expect(res.status).toBe(200);
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(u[0].data["phases.exploracion.m1.generacion"]).toEqual({ huella: huellaGate(), en: "SERVER_TIMESTAMP" });
    expect(JSON.stringify(crear.mock.calls[0][0])).toContain("Político");
  });

  it("[carrera] el M1 se edita y se vuelve a aprobar con OTRO contenido mientras el modelo genera → 409 y CERO escrituras (draft)", async () => {
    sembrar("aprobado");
    cuatroMotores(() => mockDb.reset({ [P]: { phases: { exploracion: exploracionGate("aprobado", {}, otroMapaGate) } } }));
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("m1_no_aprobado");
    expect(crear).toHaveBeenCalledTimes(4);
    expect(mockDb.updates()).toEqual([]);
  });

  it("[carrera] se reabre el M1 mientras genera → 409 y cero escrituras (draft)", async () => {
    sembrar("aprobado");
    cuatroMotores(() => mockDb.reset({ [P]: { phases: { exploracion: exploracionGate("reabierto") } } }));
    expect((await POST(req())).status).toBe(409);
    expect(mockDb.updates()).toEqual([]);
  });

  it("[carrera] reabierto y aprobado otra vez con el MISMO contenido: misma huella, escribe", async () => {
    sembrar("aprobado");
    cuatroMotores(() => mockDb.reset({ [P]: { phases: { exploracion: exploracionGate("aprobado", { otro: 1 }) } } }));
    expect((await POST(req())).status).toBe(200);
    expect(mockDb.updates()[0].data["phases.exploracion.m1.generacion"]).toMatchObject({ huella: huellaGate() });
  });

  it("[carrera] ruta final: el M1 se reabre mientras genera → 409 y cero escrituras (ni dvs ni copia)", async () => {
    sembrar("aprobado");
    cuatroMotores(() => mockDb.reset({ [P]: { phases: { exploracion: exploracionGate("reabierto") } } }));
    const res = await POST(req({ saveas: "final" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("m1_no_aprobado");
    expect(mockDb.updates()).toEqual([]);
  });

  it("ruta final con el M1 aprobado: escribe el dvs", async () => {
    sembrar("aprobado");
    const res = await POST(req({ saveas: "final" }));
    expect(res.status).toBe(200);
    expect(mockDb.updates().some((x) => "phases.exploracion.dvs" in x.data)).toBe(true);
  });
});
