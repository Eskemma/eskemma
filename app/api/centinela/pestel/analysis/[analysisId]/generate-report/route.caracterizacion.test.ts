// Caracterización de POST generate-report ANTES de H75 (marca de corte por longitud).
// Fija lo que NO debe cambiar: los rechazos previos al modelo, que los eventos que no son texto
// (message_start, message_delta…) no alteran el texto guardado, el header X-Informe-Id y que un guardado fallido
// avisa. Verdes contra el código anterior y sin editar después de H75.

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
import { MARCA_INFORME_NO_GUARDADO } from "@/lib/pestel/informesSync";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidA";
const delta = (text: string) => ({ type: "content_block_delta", delta: { type: "text_delta", text } });

function informes(): Record<string, unknown>[] {
  const doc = db.snapshot()["pestel_analyses/an1"] as { informes?: { __arrayUnion: Record<string, unknown>[] } };
  return doc.informes?.__arrayUnion ?? [];
}
function llamar(body: unknown = { format: "technical" }, id = "an1") {
  const req = new Request("http://localhost/x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }) as unknown as Parameters<typeof POST>[0];
  return POST(req, { params: Promise.resolve({ analysisId: id }) });
}

describe("POST generate-report — caracterización", () => {
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

  it("401 sin sesión, 400 con formato inválido o JSON roto, 404 sin análisis, 403 con proyecto ajeno", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await llamar()).status).toBe(401);
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    expect((await llamar({ format: "otro" })).status).toBe(400);
    expect((await llamar("{no")).status).toBe(400);
    expect((await llamar({ format: "technical" }, "no-existe")).status).toBe(404);
    db.reset({
      "pestel_projects/p1": { userId: "otro", nombre: "P", tipo: "electoral" },
      "pestel_analyses/an1": { projectId: "p1", dimensions: [] },
    });
    expect((await llamar()).status).toBe(403);
  });

  it("los eventos que no son texto no alteran el texto guardado ni el id del header", async () => {
    eventos.fuente = async function* () {
      yield { type: "message_start" };
      yield delta("Uno ");
      yield { type: "content_block_stop" };
      yield delta("dos");
      yield { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 3 } };
      yield { type: "message_stop" };
    };
    const res = await llamar();
    const id = res.headers.get("X-Informe-Id");
    expect(res.headers.get("X-Report-Format")).toBe("technical");
    const texto = await res.text();
    expect(texto.startsWith("Uno dos")).toBe(true);
    expect(informes()).toHaveLength(1);
    expect(informes()[0]).toMatchObject({ id, formato: "tecnico", contenidoTexto: "Uno dos" });
  });

  it("un guardado fallido avisa con la marca de «no guardado» y no guarda", async () => {
    eventos.fuente = async function* () {
      yield delta("Texto");
    };
    eventos.fallaGuardado = new Error("Firestore caído");
    const texto = await (await llamar()).text();
    expect(texto).toContain("Texto" + MARCA_INFORME_NO_GUARDADO);
    expect(informes()).toHaveLength(0);
  });

  it("un stream sin texto no guarda nada", async () => {
    eventos.fuente = async function* () {
      yield { type: "message_start" };
    };
    await (await llamar()).text();
    expect(informes()).toHaveLength(0);
  });
});
