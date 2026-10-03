// POST generate-report — persistencia del informe generado (E7).
// Antes (26-10-03): `controller.close()` iba antes de persistir en el finally,
// así que tras un error del stream o una desconexión del cliente el informe
// no se guardaba (close() lanzaba sobre un stream ya en error), y el id del
// informe no llegaba al cliente. Aquí se fija: el informe se guarda ANTES de
// cerrar el stream, con el id del header X-Informe-Id; un informe interrumpido
// no se guarda; si el cliente se desconecta, la generación se completa y se guarda.

import { beforeEach, describe, expect, it, vi } from "vitest";

const eventos = vi.hoisted(() => ({
  fuente: null as null | (() => AsyncGenerator<unknown>),
  // simula que Firestore rechaza la escritura (p. ej. documento lleno)
  fallaGuardado: null as null | Error,
}));

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
import { MARCA_INFORME_NO_GUARDADO } from "@/lib/pestel/informesSync";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidA";

const delta = (text: string) => ({
  type: "content_block_delta",
  delta: { type: "text_delta", text },
});
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

function informesGuardados(): Record<string, unknown>[] {
  const doc = db.snapshot()["pestel_analyses/an1"] as {
    informes?: { __arrayUnion: Record<string, unknown>[] };
  };
  return doc.informes?.__arrayUnion ?? [];
}

function llamar() {
  const req = new Request("http://localhost/x", {
    method: "POST",
    body: JSON.stringify({ format: "executive" }),
  }) as unknown as Parameters<typeof POST>[0];
  return POST(req, { params: Promise.resolve({ analysisId: "an1" }) });
}

describe("POST generate-report — persistencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    eventos.fallaGuardado = null;
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    db.reset({
      "pestel_projects/p1": { userId: UID, nombre: "P", tipo: "electoral" },
      "pestel_analyses/an1": { projectId: "p1", dimensions: [] },
    });
  });

  it("guarda el informe completo ANTES de cerrar el stream, con el id del header", async () => {
    eventos.fuente = async function* () {
      yield delta("Hola ");
      yield delta("mundo");
    };
    const res = await llamar();
    const id = res.headers.get("X-Informe-Id");
    expect(id).toBeTruthy();

    const texto = await res.text(); // el stream terminó: ya debe estar guardado
    expect(texto).toBe("Hola mundo");
    const guardados = informesGuardados();
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatchObject({
      id,
      formato: "ejecutivo",
      contenidoTexto: "Hola mundo",
    });
  });

  it("un error a mitad del stream no guarda un informe parcial", async () => {
    eventos.fuente = async function* () {
      yield delta("texto parcial");
      throw new Error("API caída");
    };
    const res = await llamar();
    await expect(res.text()).rejects.toThrow();
    expect(informesGuardados()).toHaveLength(0);
  });

  it("si el cliente se desconecta, la generación termina y se guarda", async () => {
    eventos.fuente = async function* () {
      yield delta("uno ");
      await pausa(30);
      yield delta("dos ");
      await pausa(30);
      yield delta("tres");
    };
    const res = await llamar();
    const reader = res.body!.getReader();
    await reader.read(); // llega el primer fragmento
    await reader.cancel(); // el cliente se va

    for (let i = 0; i < 40 && informesGuardados().length === 0; i++) await pausa(10);
    const guardados = informesGuardados();
    expect(guardados).toHaveLength(1);
    expect(guardados[0].contenidoTexto).toBe("uno dos tres");
  });

  it("si el guardado falla, el stream termina con la marca de 'no guardado'", async () => {
    eventos.fuente = async function* () {
      yield delta("Texto del informe");
    };
    eventos.fallaGuardado = new Error("Firestore caído");
    const res = await llamar();
    const texto = await res.text();
    expect(texto).toBe("Texto del informe" + MARCA_INFORME_NO_GUARDADO);
    expect(informesGuardados()).toHaveLength(0);
  });

  it("documento lleno: marca de 'no guardado' y rastro específico en los logs", async () => {
    eventos.fuente = async function* () {
      yield delta("x");
    };
    eventos.fallaGuardado = new Error("3 INVALID_ARGUMENT: Document exceeds the maximum size");
    const res = await llamar();
    expect(await res.text()).toContain(MARCA_INFORME_NO_GUARDADO);
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes("documento lleno"))).toBe(true);
  });

  it("guardado normal: sin marca", async () => {
    eventos.fuente = async function* () {
      yield delta("ok");
    };
    expect(await (await llamar()).text()).toBe("ok");
  });

  describe("alerta de tamaño del documento", () => {
    const relleno = (kb: number) => ({
      id: "viejo",
      formato: "tecnico",
      contenidoTexto: "x".repeat(kb * 1024),
      datosEstructurados: { scorecard: [], mapaPESTEL: {} },
      generadoEn: "2026-10-01T10:00:00.000Z",
    });
    const sembrar = (kb: number) =>
      db.reset({
        "pestel_projects/p1": { userId: UID, nombre: "P", tipo: "electoral" },
        "pestel_analyses/an1": { projectId: "p1", dimensions: [], informes: [relleno(kb)] },
      });
    beforeEach(() => {
      eventos.fuente = async function* () {
        yield delta("nuevo");
      };
    });

    it("documento chico: sin alertas", async () => {
      await (await llamar()).text();
      expect(console.warn).not.toHaveBeenCalled();
      expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes("limite-1MB"))).toBe(false);
    });

    it("pasa el 60 %: aviso temprano (console.warn) y el informe se guarda", async () => {
      sembrar(650); // ~63 %
      await (await llamar()).text();
      const avisos = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]));
      expect(avisos.some((m) => m.includes("[informes][limite-1MB]") && m.includes("aviso temprano"))).toBe(true);
      expect(informesGuardados()).toHaveLength(1);
    });

    it("pasa el 80 %: prioridad alta (console.error)", async () => {
      sembrar(850); // ~83 %
      await (await llamar()).text();
      const errores = vi.mocked(console.error).mock.calls.map((c) => String(c[0]));
      expect(errores.some((m) => m.includes("PRIORIDAD ALTA"))).toBe(true);
    });
  });
});
