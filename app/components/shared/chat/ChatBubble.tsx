"use client";

// app/components/shared/chat/ChatBubble.tsx
// Burbuja de un mensaje del chat. Assistant: markdown + enlace "Ver en
// Canvas". User: texto plano alineado a la derecha.
//
// Las líneas de trazabilidad de herramientas (`message.toolCalls`) NO se
// renderizan al usuario final — el progreso se muestra con un indicador
// genérico en ChatPanel. El campo `toolCalls` se sigue persistiendo con
// el mensaje para trazabilidad interna / soporte.

import type { FontanaChatMessage } from "@/types/fontana.types";
import MarkdownContent from "./MarkdownContent";

interface Props {
  message: FontanaChatMessage;
  isStreaming?: boolean;
  onVerCanvas?: () => void;
}

export default function ChatBubble({ message, isStreaming = false, onVerCanvas }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-blue-eske px-3.5 py-2.5 text-sm text-white-eske whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="max-w-[92%] rounded-2xl rounded-tl-none bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 px-3.5 py-3 text-sm text-black-eske dark:text-[#C7D6E0]">
        <MarkdownContent content={message.content} />
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-bluegreen-eske ml-0.5 animate-pulse rounded-sm align-middle" />
        )}
        {!isStreaming && message.canvasItemIds && message.canvasItemIds.length > 0 && onVerCanvas && (
          <button
            type="button"
            onClick={onVerCanvas}
            className="block mt-2 text-xs font-medium text-bluegreen-eske dark:text-blue-eske-20 hover:underline"
          >
            Ver en Canvas →
          </button>
        )}
      </div>
    </div>
  );
}
