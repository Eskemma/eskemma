// H75 — POST generate-report: el motivo de parada del modelo (stop_reason, leído del evento message_delta)
// se guarda y, si fue por longitud, el informe queda marcado `truncado: true` y el stream lo avisa con una marca.
// El stream termina SIEMPRE con la marca de fin: su ausencia en el cliente significa «interrumpido».

import { beforeEach, describe, expect, it, vi } from "vitest";

const eventos = vi.hoisted(() => ({ fuente: null as null | (() => AsyncGenerator<unknown>), fallaGuardado: null as null | Error }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream: () => eventos.fuente!() };
  },
}));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: (...items: unknown[]) => {
      if (eventos.fallaGuardado) throw eventos.fallaGuardado;
      return { __arrayUnion: items };
    },
  },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/pestel/reportPrompts", () => ({
  buildReportPrompt: () => ({ systemPrompt: "s", userPrompt: "u", maxTokens: 100 }),
}));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { POST } from "./route";
import {
  MARCA_INFORME_CORTADO,
  MARCA_INFORME_FIN,
  MARCA_INFORME_NO_GUARDADO,
  extraerEstadoInforme,
} from "@/lib/pestel/informesSync";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidA";
const delta = (text: string) => ({ type: "content_block_delta", delta: { type: "text_delta", text } });
const parada = (stop_reason: string | null, output_tokens = 6000) => ({ type: "message_delta", delta: { stop_reason }, usage: { output_tokens } });
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

function informes(): Record<string, unknown>[] {
  const doc = db.snapshot()["pestel_analyses/an1"] as { informes?: { __arrayUnion: Record<string, unknown>[] } };
  return doc.informes?.__arrayUnion ?? [];
}
function llamar() {
  const req = new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ format: "technical" }) }) as unknown as Parameters<typeof POST>[0];
  return POST(req, { params: Promise.resolve({ analysisId: "an1" }) });
}

describe("POST generate-report — corte por longitud (H75)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    eventos.fallaGuardado = null;
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    db.reset({
      "pestel_projects/p1": { userId: UID, nombre: "P", tipo: "electoral" },
      "pestel_analyses/an1": { projectId: "p1", dimensions: [] },
    });
  });

  it("max_tokens: guarda truncado: true + stopReason, el stream avisa CORTADO y termina con FIN; el texto se conserva", async () => {
    eventos.fuente = async function* () {
      yield delta("Texto que se cor");
      yield parada("max_tokens");
    };
    const texto = await (await llamar()).text();
    expect(texto).toBe("Texto que se cor" + MARCA_INFORME_CORTADO + MARCA_INFORME_FIN);
    expect(informes()).toHaveLength(1);
    expect(informes()[0]).toMatchObject({ contenidoTexto: "Texto que se cor", stopReason: "max_tokens", truncado: true });
  });

  it("registra el corte con el vocabulario de generate-m1-express (respuesta_truncada)", async () => {
    eventos.fuente = async function* () {
      yield delta("x");
      yield parada("max_tokens", 6000);
    };
    await (await llamar()).text();
    const avisos = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]));
    expect(avisos.some((m) => m.includes("stop_reason=max_tokens") && m.includes("output_tokens=6000") && m.includes("codigo=respuesta_truncada"))).toBe(true);
  });

  it("model_context_window_exceeded también cuenta como corte por longitud", async () => {
    eventos.fuente = async function* () {
      yield delta("x");
      yield parada("model_context_window_exceeded");
    };
    const texto = await (await llamar()).text();
    expect(texto).toContain(MARCA_INFORME_CORTADO);
    expect(informes()[0]).toMatchObject({ truncado: true, stopReason: "model_context_window_exceeded" });
  });

  it("end_turn: guarda stopReason pero NO truncado, y solo la marca de fin", async () => {
    eventos.fuente = async function* () {
      yield delta("Completo");
      yield parada("end_turn", 800);
    };
    const texto = await (await llamar()).text();
    expect(texto).toBe("Completo" + MARCA_INFORME_FIN);
    expect(informes()[0]).toMatchObject({ stopReason: "end_turn" });
    expect("truncado" in informes()[0]).toBe(false);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("refusal: guarda el motivo, no afirma corte y no agrega CORTADO", async () => {
    eventos.fuente = async function* () {
      yield delta("No puedo");
      yield parada("refusal", 10);
    };
    const texto = await (await llamar()).text();
    expect(texto).toBe("No puedo" + MARCA_INFORME_FIN);
    expect(informes()[0]).toMatchObject({ stopReason: "refusal" });
    expect("truncado" in informes()[0]).toBe(false);
  });

  it("sin evento message_delta: motivo desconocido, ningún campo nuevo y sin CORTADO", async () => {
    eventos.fuente = async function* () {
      yield delta("Sin motivo");
    };
    const texto = await (await llamar()).text();
    expect(texto).toBe("Sin motivo" + MARCA_INFORME_FIN);
    expect("stopReason" in informes()[0]).toBe(false);
    expect("truncado" in informes()[0]).toBe(false);
  });

  it("stop_reason null en message_delta: se trata como desconocido", async () => {
    eventos.fuente = async function* () {
      yield delta("x");
      yield parada(null);
    };
    await (await llamar()).text();
    expect("stopReason" in informes()[0]).toBe(false);
  });

  it("refusal SIN texto: no se guarda ningún informe y el cuerpo NO trae marca de fin (el cliente lo ve como interrumpido)", async () => {
    eventos.fuente = async function* () {
      yield { type: "message_start" };
      yield parada("refusal", 0);
    };
    const texto = await (await llamar()).text();
    expect(texto).toBe("");
    expect(texto).not.toContain("INFORME_FIN");
    expect(informes()).toHaveLength(0);
  });

  it("combinadas: cortado Y no guardado en el mismo stream (CORTADO, NO_GUARDADO, FIN) y no se guarda nada", async () => {
    eventos.fuente = async function* () {
      yield delta("Cortado y sin guardar");
      yield parada("max_tokens");
    };
    eventos.fallaGuardado = new Error("Firestore caído");
    const texto = await (await llamar()).text();
    expect(texto).toBe("Cortado y sin guardar" + MARCA_INFORME_CORTADO + MARCA_INFORME_NO_GUARDADO + MARCA_INFORME_FIN);
    expect(extraerEstadoInforme(texto)).toEqual({ texto: "Cortado y sin guardar", guardado: false, cortado: true, finalizado: true });
    expect(informes()).toHaveLength(0);
  });

  it("un error a mitad del stream: no se guarda y NO llega la marca de fin (el cliente ve el stream romperse)", async () => {
    eventos.fuente = async function* () {
      yield delta("parcial");
      yield parada("max_tokens");
      throw new Error("API caída");
    };
    const res = await llamar();
    let recibido = "";
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    await expect(
      (async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          recibido += dec.decode(value);
        }
      })()
    ).rejects.toThrow();
    expect(recibido).not.toContain("INFORME_FIN");
    expect(informes()).toHaveLength(0);
  });

  it("el cliente leyendo chunk a chunk reconstruye el mismo estado que el texto completo", async () => {
    eventos.fuente = async function* () {
      yield delta("Uno ");
      yield delta("dos");
      yield parada("max_tokens");
    };
    const res = await llamar();
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let acumulado = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      acumulado += dec.decode(value, { stream: true });
      expect(extraerEstadoInforme(acumulado).texto).not.toContain("\u001E");
    }
    expect(extraerEstadoInforme(acumulado)).toEqual({ texto: "Uno dos", guardado: true, cortado: true, finalizado: true });
  });

  it("si el cliente se desconecta, el corte igual se guarda como truncado", async () => {
    eventos.fuente = async function* () {
      yield delta("uno ");
      await pausa(30);
      yield delta("dos");
      yield parada("max_tokens");
    };
    const res = await llamar();
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    for (let i = 0; i < 40 && informes().length === 0; i++) await pausa(10);
    expect(informes()[0]).toMatchObject({ contenidoTexto: "uno dos", truncado: true });
  });
});
