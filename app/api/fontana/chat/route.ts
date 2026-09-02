// app/api/fontana/chat/route.ts
// POST — chat SSE del agente conversacional "Fontana" (T10). Tool use
// real del SDK de Anthropic (consultar_indicador / generar_visualizacion
// / navegar_pestana). Streaming manual vía ReadableStream, mismo patrón
// que app/api/moddulo/chat/[phaseId]/route.ts.
//
// El agente SOLO responde con datos que devuelve una herramienta — el
// system prompt (lib/fontana/agente/systemPrompt.ts) lo obliga. Las
// herramientas consumen los endpoints ya existentes de Fontana, nunca
// una fuente paralela (ver lib/fontana/agente/tools.ts).
//
// Persistencia: mensajes en la subcolección append-only
// fontana_sesiones/{sesionId}/mensajes; los items de Canvas los escribe
// el propio ejecutor de la herramienta en fontana_sesiones/{id}.canvasItems.

import { type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { construirSystemPromptFontana } from "@/lib/fontana/agente/systemPrompt";
import { FONTANA_TOOLS, ejecutarHerramienta, type ToolContext } from "@/lib/fontana/agente/tools";
import { limpiarUndefined } from "@/lib/fontana/agente/canvasBuilder";
import { construirBloqueAdjuntos } from "@/lib/fontana/agente/adjuntosContexto";
import { adminDb } from "@/lib/firebase-admin";
import type { FontanaChatMessage, FontanaToolCall } from "@/types/fontana.types";
import type Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const MAX_ITERACIONES = 5;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

interface ChatBody {
  sesionId?: string;
  message?: string;
  history?: FontanaChatMessage[];
  adjuntoIds?: string[];
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const { sesionId, message } = body;
  if (!sesionId || typeof message !== "string" || !message.trim()) {
    return new Response(JSON.stringify({ error: "sesionId y message son requeridos" }), { status: 400 });
  }
  const adjuntoIds = Array.isArray(body.adjuntoIds)
    ? body.adjuntoIds.filter((x): x is string => typeof x === "string")
    : [];

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return new Response(JSON.stringify({ error: "Sesión no encontrada" }), { status: 404 });
  }
  const { sesion } = cargada;

  const systemPrompt = construirSystemPromptFontana(sesion.territorio, sesion.tipoProyecto);
  const ctx: ToolContext = {
    sesionId,
    uid: session.uid,
    cookie: request.headers.get("cookie") ?? "",
    baseUrl: request.nextUrl.origin,
    territorio: sesion.territorio,
    tipoProyecto: sesion.tipoProyecto,
  };

  const historial: Anthropic.MessageParam[] = (body.history ?? [])
    .filter((m) => m.id !== "welcome" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: m.content }));

  // Texto de los archivos que el usuario adjuntó a la sesión — contexto
  // crudo, no una herramienta. Se antepone al turno del usuario. Ver
  // lib/fontana/agente/adjuntosContexto.ts y el bloque "## Archivos
  // adjuntos por el usuario" del system prompt.
  const bloqueAdjuntos = await construirBloqueAdjuntos(sesionId, adjuntoIds);
  const contenidoTurno = bloqueAdjuntos
    ? `${bloqueAdjuntos}\n\n---\n\n${message}`
    : message;

  const mensajes: Anthropic.MessageParam[] = [
    ...historial,
    { role: "user", content: contenidoTurno },
  ];

  const nowIso = () => new Date().toISOString();
  const userMessage: FontanaChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: message,
    timestamp: nowIso(),
    ...(adjuntoIds.length > 0 ? { adjuntoIds } : {}),
  };
  const assistantMessageId = crypto.randomUUID();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const toolCallsAcum: FontanaToolCall[] = [];
      const canvasItemIds: string[] = [];
      let fullText = "";

      try {
        for (let i = 0; i < MAX_ITERACIONES; i++) {
          const llmStream = anthropic.messages.stream({
            model: CLAUDE_MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            messages: mensajes,
            tools: FONTANA_TOOLS,
          });

          for await (const ev of llmStream) {
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              fullText += ev.delta.text;
              send({ type: "text", content: ev.delta.text });
            }
          }

          const finalMsg = await llmStream.finalMessage();
          mensajes.push({ role: "assistant", content: finalMsg.content });

          if (finalMsg.stop_reason !== "tool_use") break;

          const toolUses = finalMsg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const tu of toolUses) {
            send({ type: "tool_call", tool: tu.name, input: tu.input });
            const r = await ejecutarHerramienta(
              tu.name,
              (tu.input ?? {}) as Record<string, unknown>,
              ctx,
              assistantMessageId
            );
            toolCallsAcum.push(r.toolCall);
            if (r.navEvent) send({ type: "nav", ...r.navEvent });
            if (r.canvasItem) {
              canvasItemIds.push(r.canvasItem.id);
              send({ type: "canvas_item", item: r.canvasItem });
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(r.resultForModel),
            });
          }

          mensajes.push({ role: "user", content: toolResults });

          if (i === MAX_ITERACIONES - 1) {
            const aviso =
              "\n\n(Alcancé el límite de pasos para esta consulta. Si necesitas más detalle, hazme una pregunta más específica.)";
            fullText += aviso;
            send({ type: "text", content: aviso });
          }
        }

        const assistantMessage: FontanaChatMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: fullText,
          timestamp: nowIso(),
          ...(toolCallsAcum.length > 0 ? { toolCalls: toolCallsAcum } : {}),
          ...(canvasItemIds.length > 0 ? { canvasItemIds } : {}),
        };

        const col = adminDb.collection("fontana_sesiones").doc(sesionId).collection("mensajes");
        // limpiarUndefined por defensa en profundidad: FontanaToolCall.input
        // viene JSON-parseado del SDK (sin undefined), pero está tipado
        // Record<string, unknown> y pasa por varias capas — mismo criterio
        // que canvasItems (Firestore Admin rechaza undefined).
        await Promise.all([
          col.doc(userMessage.id).set(limpiarUndefined(userMessage)),
          col.doc(assistantMessage.id).set(limpiarUndefined(assistantMessage)),
        ]);

        send({ type: "done", mensajeId: assistantMessage.id });
      } catch (err) {
        const detalle = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error("[fontana/chat] Error:", detalle, err instanceof Error ? err.stack : "");
        send({
          type: "error",
          message: "Hubo un problema al procesar tu mensaje. Intenta de nuevo.",
          ...(process.env.NODE_ENV === "development" ? { detalle } : {}),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
