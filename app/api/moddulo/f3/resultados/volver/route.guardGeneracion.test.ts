// C4b-1b — punta a punta: un «volver» que ocurre MIENTRAS se genera la síntesis o el veredicto hace que la generación
// responda 409 f3_estado_cambio y no escriba nada (guard H-V48 de C4b-0). «Volver» sube `revision.n` por `aplicarVersion`.
// LÍMITE (H-V89): el guard solo ve escritores que suben `revision.n`; `confirm`, `tareas/*` y `revisar-territorio` no.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/claude", () => ({ anthropic: { messages: { create: vi.fn() } }, CLAUDE_MODEL: "modelo-de-prueba" }));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb(), adminStorage: createMockAdminStorage([]) };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => {
  const orig = await importOriginal<typeof import("firebase-admin/firestore")>();
  return { ...orig, FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => orig.Timestamp.fromDate(new Date(Date.UTC(2026, 10, 25, 9, 0, 0))) } };
});

import { adminDb } from "@/lib/firebase-admin";
import { anthropic } from "@/lib/ai/claude";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { consolidarSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";
import { SIEMBRA_SINTESIS } from "@/lib/moddulo/__tests__/fixtures/siembraF3";
import { PID, PROYECTO, RID, V1, asig, sembrarVolver } from "@/lib/moddulo/__tests__/fixtures/siembraVolver";
import { POST as VOLVER } from "./route";
import { POST as SINTESIS } from "../../sintesis/generar/route";
import { POST as VEREDICTO } from "../../veredicto/generar/route";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const req = (b: unknown) => new Request("http://local/x", { method: "POST", body: JSON.stringify(b) }) as never;
const base = { projectId: PID, resultadoId: RID, versionId: V1 };

/** Mientras el modelo «genera», otra pestaña hace un «volver» confirmado completo. */
function volverMientrasGenera(respuesta: unknown) {
  crear.mockImplementationOnce(async () => {
    const p = await (await VOLVER(req(base))).json();
    const r = await VOLVER(req({ ...base, confirmarReemplazo: true, huella: p.huella }));
    expect(r.status).toBe(200);
    consolidarSemilla(db, PROYECTO); // el mock guarda el puntero con puntos literales: se expande como Firestore real
    return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(respuesta) }] } as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  crear.mockReset();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("«volver» durante una generación", () => {
  it("síntesis: 409 f3_estado_cambio, cero escrituras de la síntesis y el modelo se llamó UNA vez", async () => {
    await sembrarVolver(db, { inv: {} });
    volverMientrasGenera(SIEMBRA_SINTESIS);
    const r = await SINTESIS(req({ projectId: PID }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("f3_estado_cambio");
    expect(crear).toHaveBeenCalledTimes(1);
    const inv = (((db.snapshot()[PROYECTO] as Record<string, unknown>).phases as Record<string, unknown>).investigacion as Record<string, unknown>);
    expect(inv.f3Sintesis).toBeUndefined();
  });
  it("veredicto: 409 f3_estado_cambio y nada guardado", async () => {
    await sembrarVolver(db, { inv: { f3Sintesis: SIEMBRA_SINTESIS }, asignaciones: [asig("t1_canal1_primaria_T10"), asig("2-0", { resultadoId: "otro" })] });
    // el veredicto exige tareas cubiertas y HEI: se siembra lo mínimo
    const p = db.snapshot()[PROYECTO] as Record<string, unknown>;
    const fases = p.phases as Record<string, unknown>;
    db.seed(PROYECTO, { ...p, phases: { ...fases, exploracion: { dvs: { pip: [{ pipItemId: "t1", numero: 1, pregunta: "p" }, { pipItemId: "t2", numero: 2, pregunta: "q" }], semaforo: [], hei: { h: 1 } } } } });
    consolidarSemilla(db, PROYECTO);
    volverMientrasGenera({ resultado: "ajustada", contraste: "c", argumentacion: "a", premisaResultante: "p" });
    const r = await VEREDICTO(req({ projectId: PID }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("f3_estado_cambio");
    expect(crear).toHaveBeenCalledTimes(1);
    const inv = (((db.snapshot()[PROYECTO] as Record<string, unknown>).phases as Record<string, unknown>).investigacion as Record<string, unknown>);
    expect(inv.f3Veredicto).toBeUndefined();
  });
  it("control: sin «volver» durante la generación, la síntesis SÍ se guarda (el 409 es del cambio, no de la ruta)", async () => {
    await sembrarVolver(db);
    crear.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(SIEMBRA_SINTESIS) }] } as never);
    const r = await SINTESIS(req({ projectId: PID }));
    expect(r.status).toBe(200);
  });
});
