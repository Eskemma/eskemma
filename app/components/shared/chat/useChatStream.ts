"use client";

// app/components/shared/chat/useChatStream.ts
// Hook del panel de chat: mantiene los mensajes, abre el SSE de
// POST /api/fontana/chat, lee el ReadableStream y despacha los eventos
// (text / tool_call / nav / canvas_item / done / error) a callbacks.
// Duplica el loop de lectura SSE de ModduloChat/AdvisorPanel a propósito
// (ver deuda técnica en CLAUDE.md — esos dos no se migran esta ronda).

import { useCallback, useState } from "react";
import type {
  FamiliaFontanaId,
  FontanaCanvasItem,
  FontanaChatMessage,
  FontanaToolCall,
} from "@/types/fontana.types";

interface Options {
  sesionId: string;
  onNav?: (pestana: "fontana" | "indicadores", familiaId?: FamiliaFontanaId) => void;
  onCanvasItem?: (item: FontanaCanvasItem) => void;
}

const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;

export function useChatStream({ sesionId, onNav, onCanvasItem }: Options) {
  const [messages, setMessages] = useState<FontanaChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [liveToolCalls, setLiveToolCalls] = useState<FontanaToolCall[]>([]);

  const send = useCallback(
    async (text: string, adjuntoIds?: string[]) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: FontanaChatMessage = {
        id: uuid(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
        ...(adjuntoIds && adjuntoIds.length > 0 ? { adjuntoIds } : {}),
      };
      const history = messages;
      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);
      setStreamingText("");
      setLiveToolCalls([]);

      let buffer = "";
      const toolCalls: FontanaToolCall[] = [];

      try {
        const res = await fetch("/api/fontana/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sesionId,
            message: trimmed,
            history,
            ...(adjuntoIds && adjuntoIds.length > 0 ? { adjuntoIds } : {}),
          }),
        });
        if (!res.ok || !res.body) throw new Error("Sin respuesta del servidor");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            let ev: Record<string, unknown>;
            try {
              ev = JSON.parse(raw);
            } catch {
              continue;
            }

            if (ev.type === "text") {
              buffer += String(ev.content ?? "");
              setStreamingText(buffer);
            } else if (ev.type === "tool_call") {
              const tc: FontanaToolCall = {
                tool: ev.tool as FontanaToolCall["tool"],
                input: (ev.input ?? {}) as Record<string, unknown>,
                resultSummary: "",
                ok: true,
              };
              toolCalls.push(tc);
              setLiveToolCalls([...toolCalls]);
            } else if (ev.type === "nav") {
              onNav?.(ev.pestana as "fontana" | "indicadores", ev.familiaId as FamiliaFontanaId | undefined);
            } else if (ev.type === "canvas_item") {
              onCanvasItem?.(ev.item as FontanaCanvasItem);
            } else if (ev.type === "done") {
              const assistantMsg: FontanaChatMessage = {
                id: String(ev.mensajeId ?? uuid()),
                role: "assistant",
                content: buffer,
                timestamp: new Date().toISOString(),
                ...(toolCalls.length > 0 ? { toolCalls } : {}),
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingText("");
              setLiveToolCalls([]);
            } else if (ev.type === "error") {
              const detalle = typeof ev.detalle === "string" ? `\n\n_${ev.detalle}_` : "";
              setMessages((prev) => [
                ...prev,
                {
                  id: uuid(),
                  role: "assistant",
                  content: String(ev.message ?? "Hubo un problema. Intenta de nuevo.") + detalle,
                  timestamp: new Date().toISOString(),
                  // Conserva la traza de lo que se intentó antes del fallo.
                  ...(toolCalls.length > 0 ? { toolCalls: [...toolCalls] } : {}),
                },
              ]);
              setStreamingText("");
              setLiveToolCalls([]);
            }
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: uuid(),
            role: "assistant",
            content: "Lo siento, tuve un problema al procesar tu mensaje. ¿Puedes intentarlo de nuevo?",
            timestamp: new Date().toISOString(),
          },
        ]);
        setStreamingText("");
        setLiveToolCalls([]);
      } finally {
        setStreaming(false);
      }
    },
    [messages, sesionId, streaming, onNav, onCanvasItem]
  );

  return { messages, setMessages, streaming, streamingText, liveToolCalls, send };
}
