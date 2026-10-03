// POST /api/fontana/chat — persistencia del turno cuando el stream se interrumpe.
// Antes (26-10-03): pregunta y respuesta se escribían juntas al final del bucle,
// así que una desconexión del cliente o un error de la API a mitad de turno
// perdía el turno completo (y los canvasItems ya escritos por las herramientas
// quedaban sin mensaje). Aquí se fija: la pregunta se guarda ANTES de llamar al
// modelo; si el cliente se va, el turno termina y se guarda; si la API falla
// después de que las herramientas dejaron rastro, se guarda un mensaje marcado
// como interrumpido que referencia esos canvasItems.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ctl = vi.hoisted(() => ({
  // una "iteración" por llamada a messages.stream
  iteraciones: [] as Array<{
    eventos: unknown[];
    final: unknown;
    falla?: Error;
    pausaMs?: number;
  }>,
  llamadasStream: 0,
  alLlamarStream: null as null | (() => void),
}));

vi.mock("@/lib/ai/claude", () => ({
  CLAUDE_MODEL: "test-model",
  anthropic: {
    messages: {
      stream: () => {
        ctl.alLlamarStream?.();
        const it = ctl.iteraciones[ctl.llamadasStream++];
        return {
          async *[Symbol.asyncIterator]() {
            for (const ev of it.eventos) {
              if (it.pausaMs) await new Promise((r) => setTimeout(r, it.pausaMs));
              yield ev;
            }
            if (it.falla) throw it.falla;
          },
          finalMessage: async () => it.final,
        };
      },
    },
  },
}));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/fontana/sesionTerritorio", () => ({
  cargarSesionConTerritorioActual: vi.fn(async () => ({
    sesion: { territorio: { nivel: "estatal", nombre: "Yucatán" }, tipoProyecto: "electoral" },
  })),
}));
vi.mock("@/lib/fontana/agente/systemPrompt", () => ({
  construirSystemPromptFontana: () => "system",
}));
vi.mock("@/lib/fontana/agente/adjuntosContexto", () => ({
  construirBloqueAdjuntos: async () => "",
}));
vi.mock("@/lib/fontana/agente/tools", () => ({
  FONTANA_TOOLS: [],
  ejecutarHerramienta: vi.fn(async () => ({
    toolCall: { tool: "generar_visualizacion", input: { indicadorId: "F1-1" } },
    resultForModel: { ok: true },
    canvasItem: { id: "canvas-1" },
  })),
}));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const RUTA = "fontana_sesiones/s1/mensajes";

const texto = (t: string) => ({
  type: "content_block_delta",
  delta: { type: "text_delta", text: t },
});
const finalTexto = (t: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }] });
const finalHerramienta = {
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "tu1", name: "generar_visualizacion", input: {} }],
};

function mensajesGuardados(): Record<string, Record<string, unknown>> {
  const snap = db.snapshot();
  return Object.fromEntries(
    Object.entries(snap)
      .filter(([k]) => k.startsWith(`${RUTA}/`))
      .map(([k, v]) => [k.slice(RUTA.length + 1), v as Record<string, unknown>])
  );
}
const porRol = (rol: string) =>
  Object.values(mensajesGuardados()).filter((m) => m.role === rol);

function llamar() {
  const req = new NextRequest("http://localhost/api/fontana/chat", {
    method: "POST",
    body: JSON.stringify({ sesionId: "s1", message: "¿Población de Yucatán?" }),
  });
  return POST(req);
}

async function leerEventos(res: Response): Promise<Array<Record<string, unknown>>> {
  const crudo = await res.text();
  return crudo
    .split("\n\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)));
}

describe("POST /api/fontana/chat — persistencia del turno", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: "uidA" }));
    ctl.iteraciones = [];
    ctl.llamadasStream = 0;
    ctl.alLlamarStream = null;
    db.reset();
  });

  it("turno normal: guarda pregunta y respuesta", async () => {
    ctl.iteraciones = [{ eventos: [texto("2.3 millones")], final: finalTexto("2.3 millones") }];
    const res = await llamar();
    const eventos = await leerEventos(res);
    expect(eventos.at(-1)?.type).toBe("done");
    expect(porRol("user")).toHaveLength(1);
    expect(porRol("assistant")).toMatchObject([{ content: "2.3 millones" }]);
    expect(porRol("assistant")[0].interrumpido).toBeUndefined();
  });

  it("la pregunta ya está guardada cuando se llama al modelo", async () => {
    let usuariosAlLlamar = -1;
    ctl.alLlamarStream = () => {
      usuariosAlLlamar = porRol("user").length;
    };
    ctl.iteraciones = [{ eventos: [texto("ok")], final: finalTexto("ok") }];
    await (await llamar()).text();
    expect(usuariosAlLlamar).toBe(1);
  });

  it("si el cliente se desconecta a mitad, el turno termina y la respuesta se guarda", async () => {
    ctl.iteraciones = [
      {
        eventos: [texto("uno "), texto("dos "), texto("tres")],
        final: finalTexto("uno dos tres"),
        pausaMs: 25,
      },
    ];
    const res = await llamar();
    const reader = res.body!.getReader();
    await reader.read(); // llega algo
    await reader.cancel(); // el cliente se va

    for (let i = 0; i < 50 && porRol("assistant").length === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(porRol("user")).toHaveLength(1);
    expect(porRol("assistant")).toMatchObject([{ content: "uno dos tres" }]);
  });

  it("error de la API tras una herramienta: guarda un mensaje interrumpido con sus canvasItems", async () => {
    ctl.iteraciones = [
      { eventos: [], final: finalHerramienta },
      { eventos: [texto("empiezo")], final: finalTexto("x"), falla: new Error("API caída") },
    ];
    const res = await llamar();
    const eventos = await leerEventos(res);
    expect(eventos.some((e) => e.type === "error")).toBe(true);
    expect(eventos.some((e) => e.type === "done")).toBe(false);

    expect(porRol("user")).toHaveLength(1);
    const asistente = porRol("assistant");
    expect(asistente).toHaveLength(1);
    expect(asistente[0]).toMatchObject({ interrumpido: true, canvasItemIds: ["canvas-1"] });
  });

  it("error de la API sin rastro de herramientas: guarda solo la pregunta", async () => {
    ctl.iteraciones = [
      { eventos: [texto("hola")], final: finalTexto("x"), falla: new Error("API caída") },
    ];
    const res = await llamar();
    const eventos = await leerEventos(res);
    expect(eventos.some((e) => e.type === "error")).toBe(true);
    expect(porRol("user")).toHaveLength(1);
    expect(porRol("assistant")).toHaveLength(0);
  });

  it("401 sin sesión", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await llamar()).status).toBe(401);
    expect(mensajesGuardados()).toEqual({});
  });
});
