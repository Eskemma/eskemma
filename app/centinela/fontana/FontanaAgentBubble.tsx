"use client";

// app/centinela/fontana/FontanaAgentBubble.tsx
// Burbuja flotante persistente + panel de chat del agente "Fontana"
// (T10). Panel en ResponsivePanel (sidebar derecho en desktop / bottom
// sheet en mobile). Rehidrata el historial desde
// GET /api/fontana/sesion/[id]/mensajes al montar. Maneja el estado local
// de los archivos adjuntos del composer (se suben a
// POST /api/fontana/sesion/[id]/adjunto — solo texto extraído, nunca el
// binario).

import { useCallback, useEffect, useState } from "react";
import type { FamiliaFontanaId, FontanaCanvasItem, FontanaChatMessage } from "@/types/fontana.types";
import ResponsivePanel from "@/app/components/shared/ResponsivePanel";
import ChatPanel, { type AdjuntoChip } from "@/app/components/shared/chat/ChatPanel";
import { useChatStream } from "@/app/components/shared/chat/useChatStream";

const SUGERENCIAS = [
  "Resúmeme los indicadores socioeconómicos",
  "¿Cuál es la pobreza extrema?",
  "Gráfica de percepción de inseguridad",
];

const BIENVENIDA: FontanaChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hola, soy **Fontana**. Consulto indicadores de datos abiertos para el territorio de tu proyecto. Puedo darte un valor puntual, armar una gráfica o resumen en el Canvas, o llevarte a una familia de indicadores. ¿En qué te ayudo?",
  timestamp: "",
};

interface Props {
  sesionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNav: (pestana: "fontana" | "indicadores", familiaId?: FamiliaFontanaId) => void;
  onCanvasItem: (item: FontanaCanvasItem) => void;
  onVerCanvas: () => void;
}

export default function FontanaAgentBubble({ sesionId, open, onOpenChange, onNav, onCanvasItem, onVerCanvas }: Props) {
  const { messages, setMessages, streaming, streamingText, liveToolCalls, send } = useChatStream({
    sesionId,
    onNav,
    onCanvasItem,
  });

  const [adjuntos, setAdjuntos] = useState<AdjuntoChip[]>([]);

  // Rehidratar historial (o sembrar bienvenida) una sola vez.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/fontana/sesion/${sesionId}/mensajes`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { mensajes: FontanaChatMessage[] };
        if (cancelado) return;
        setMessages(data.mensajes.length > 0 ? data.mensajes : [BIENVENIDA]);
      } catch {
        if (!cancelado) setMessages([BIENVENIDA]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [sesionId, setMessages]);

  const subirArchivo = useCallback(
    async (file: File) => {
      const key =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `k-${Date.now()}-${Math.random()}`;
      setAdjuntos((prev) => [...prev, { key, nombre: file.name, estado: "subiendo" }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/fontana/sesion/${sesionId}/adjunto`, {
          method: "POST",
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as { adjuntoId?: string; error?: string };
        if (!res.ok || !data.adjuntoId) {
          setAdjuntos((prev) =>
            prev.map((a) =>
              a.key === key
                ? { ...a, estado: "error", mensajeError: data.error ?? "No se pudo adjuntar el archivo." }
                : a
            )
          );
          return;
        }
        setAdjuntos((prev) =>
          prev.map((a) => (a.key === key ? { ...a, estado: "listo", adjuntoId: data.adjuntoId } : a))
        );
      } catch {
        setAdjuntos((prev) =>
          prev.map((a) =>
            a.key === key
              ? { ...a, estado: "error", mensajeError: "No se pudo adjuntar el archivo." }
              : a
          )
        );
      }
    },
    [sesionId]
  );

  const quitarAdjunto = useCallback((key: string) => {
    setAdjuntos((prev) => prev.filter((a) => a.key !== key));
  }, []);

  const enviar = useCallback(
    (text: string, adjuntoIds?: string[]) => {
      send(text, adjuntoIds);
      setAdjuntos([]); // los adjuntos ya quedaron persistidos en la sesión
    },
    [send]
  );

  return (
    <>
      <ResponsivePanel open={open} onClose={() => onOpenChange(false)} aria-label="Chat con Fontana" widthDesktop={400}>
        <ChatPanel
          titulo="Fontana"
          subtitulo="Asistente de datos abiertos"
          messages={messages}
          streaming={streaming}
          streamingText={streamingText}
          liveToolCalls={liveToolCalls}
          suggestions={SUGERENCIAS}
          onSend={enviar}
          onClose={() => onOpenChange(false)}
          onVerCanvas={() => {
            onVerCanvas();
            onOpenChange(false);
          }}
          adjuntos={adjuntos}
          onSubirArchivo={subirArchivo}
          onQuitarAdjunto={quitarAdjunto}
        />
      </ResponsivePanel>

      {/* Burbuja flotante — SOLO cuando el chat está cerrado. Con el panel
          abierto, cerrar se hace con la × del header (más Escape y el
          backdrop en mobile); nunca dos controles compitiendo por el
          mismo espacio. */}
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="Abrir chat de Fontana"
          className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-xl"
          style={{ background: "linear-gradient(135deg, #248cc1, #026988)" }}
        >
          ✦
        </button>
      )}
    </>
  );
}
