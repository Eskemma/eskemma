// app/moddulo/components/ModduloChat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { PaperClipIcon, XMarkIcon } from "@heroicons/react/24/outline";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { uploadMedia } from "@/firebase/storageUtils";
import { useAuth } from "@/context/AuthContext";
import type { ChatMessage, PhaseId, ChatAttachment } from "@/types/moddulo.types";

interface ModduloChatProps {
  phaseId: PhaseId;
  projectId: string;
  initialMessages?: ChatMessage[];
  currentFormData?: Record<string, unknown>;
  xpctoContext?: Record<string, unknown>; // XPCTO de F1, disponible para F2+
  onDataExtracted?: (data: Record<string, unknown>) => void;
  onMessagesChange?: (messages: ChatMessage[]) => void;
  className?: string;
  renderAfterWelcome?: React.ReactNode;
}

// Elimina bloques JSON completos e incompletos del texto visible
function filterJsonBlocks(text: string): string {
  // Bloques completos: ```json ... ```
  let filtered = text.replace(/```json[\s\S]*?```/g, "");
  // Bloque incompleto al final (Claude aún escribiendo el JSON)
  filtered = filtered.replace(/```json[\s\S]*$/, "");
  return filtered.trim();
}

export default function ModduloChat({
  phaseId,
  projectId,
  initialMessages = [],
  currentFormData,
  xpctoContext,
  onDataExtracted,
  onMessagesChange,
  className = "",
  renderAfterWelcome,
}: ModduloChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  // Notificar al padre cuando cambian los mensajes
  useEffect(() => {
    onMessagesChange?.(messages);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll interno al contenedor — nunca afecta el documento
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingContent]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: getWelcomeMessage(phaseId),
        timestamp: new Date().toISOString(),
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseId]);

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    const hasText = !!input.trim();
    const hasFiles = pendingFiles.length > 0;
    if ((!hasText && !hasFiles) || isLoading || isUploading) return;

    let attachments: ChatAttachment[] = [];

    if (hasFiles && user) {
      setIsUploading(true);
      try {
        attachments = await Promise.all(
          pendingFiles.map(async (file) => {
            const path = `moddulo/${user.uid}/${projectId}/fases/${phaseId}/attachments/${crypto.randomUUID()}-${file.name}`;
            const url = await uploadMedia(file, path);
            return { nombre: file.name, url, tipo: file.type, storagePath: path };
          })
        );
      } finally {
        setIsUploading(false);
      }
      setPendingFiles([]);
    }

    const displayContent =
      hasText
        ? input.trim() + (attachments.length > 0 ? "\n" + attachments.map((a) => `📎 ${a.nombre}`).join("\n") : "")
        : attachments.map((a) => `📎 ${a.nombre}`).join("\n");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: displayContent,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/moddulo/chat/${phaseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          projectId,
          phaseId,
          currentFormData,
          xpctoContext,
          chatHistory: messages.filter((m) => m.id !== "welcome"),
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      if (!response.ok) throw new Error("Error en la respuesta del servidor");
      if (!response.body) throw new Error("Sin body en la respuesta");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let lastReasoning: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (!data.trim()) continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === "text") {
              fullContent += parsed.content;
              // Filtrar JSON en tiempo real para no mostrar bloques al usuario
              setStreamingContent(filterJsonBlocks(fullContent));
            } else if (parsed.type === "extracted-data" && parsed.extractedData) {
              lastReasoning = parsed.reasoning ?? undefined;
              onDataExtracted?.(parsed.extractedData);
            } else if (parsed.type === "done") {
              const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: filterJsonBlocks(fullContent),
                timestamp: new Date().toISOString(),
                reasoning: lastReasoning,
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setStreamingContent("");
            }
          } catch {
            // línea malformada, ignorar
          }
        }
      }
    } catch (error) {
      console.error("[ModduloChat] Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Lo siento, tuve un problema al procesar tu mensaje. ¿Puedes intentarlo de nuevo?",
          timestamp: new Date().toISOString(),
        },
      ]);
      setStreamingContent("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`flex flex-col bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-eske-20 dark:border-white/10 flex items-center gap-2 bg-bluegreen-eske/5 dark:bg-bluegreen-eske/10">
        <div className="w-2 h-2 rounded-full bg-bluegreen-eske animate-pulse" />
        <span className="text-sm font-semibold text-bluegreen-eske dark:text-[#6BA4C6]">Moddulo</span>
        <span className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] ml-1">Colaborador Estratégico</span>
      </div>

      {/* Messages — scroll interno, sin empujar el layout */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
        {messages.map((msg, index) => (
          <div key={msg.id}>
            <ChatBubble message={msg} />
            {index === 0 && msg.id === "welcome" && renderAfterWelcome}
          </div>
        ))}

        {/* Streaming — solo el texto filtrado */}
        {streamingContent && (
          <ChatBubble
            message={{
              id: "streaming",
              role: "assistant",
              content: streamingContent,
              timestamp: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Indicador de carga */}
        {isLoading && !streamingContent && (
          <div className="flex gap-2 items-start">
            <ModduloAvatar />
            <div className="bg-gray-eske-10 dark:bg-[#112230] rounded-xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-2 h-2 bg-gray-eske-40 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        {/* File chips */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingFiles.map((file, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-bluegreen-eske/10 text-bluegreen-eske rounded-full border border-bluegreen-eske/20"
              >
                <PaperClipIcon className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                <span className="max-w-[140px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`Quitar ${file.name}`}
                  className="ml-0.5 hover:text-red-eske transition-colors"
                >
                  <XMarkIcon className="w-2.5 h-2.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu respuesta aquí..."
            rows={2}
            disabled={isLoading || isUploading}
            className="flex-1 resize-none px-4 py-3 text-sm font-medium border-2 border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-bluegreen-eske/30 focus:border-bluegreen-eske disabled:opacity-50 text-gray-800 dark:text-[#EAF2F8] placeholder:text-gray-400 dark:placeholder-[#6D8294] bg-gray-50 dark:bg-[#112230] transition-colors"
            style={{ maxHeight: "120px" }}
          />
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading}
              aria-label="Adjuntar archivo"
              className="p-3 border-2 border-gray-300 dark:border-white/10 text-gray-500 dark:text-[#9AAEBE] rounded-xl hover:border-bluegreen-eske hover:text-bluegreen-eske transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PaperClipIcon className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && pendingFiles.length === 0) || isLoading || isUploading}
              className="p-3 bg-bluegreen-eske text-white-eske rounded-xl hover:bg-bluegreen-eske/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Enviar mensaje"
            >
              {isUploading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg"
          multiple
          onChange={handleFileAttach}
          style={{ display: "none" }}
          aria-hidden="true"
        />
        <p className="text-xs font-medium text-gray-500 dark:text-[#9AAEBE] mt-2">
          <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-[#112230] border border-gray-300 dark:border-white/10 rounded text-gray-600 dark:text-[#C7D6E0] text-xs">Enter</kbd> para enviar
          {" · "}
          <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-[#112230] border border-gray-300 dark:border-white/10 rounded text-gray-600 dark:text-[#C7D6E0] text-xs">Shift+Enter</kbd> para nueva línea
        </p>
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTES
// ==========================================

function ModduloAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-bluegreen-eske flex items-center justify-center shrink-0 mt-0.5">
      <span className="text-white-eske text-xs font-bold">M</span>
    </div>
  );
}

function ChatBubble({ message, isStreaming = false }: { message: ChatMessage; isStreaming?: boolean }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const isAssistant = message.role === "assistant";

  if (isAssistant) {
    return (
      <div className="flex gap-3 items-start">
        <ModduloAvatar />
        <div className="flex-1 min-w-0">
          <div className="bg-gray-50 dark:bg-[#18324A] border border-gray-200 dark:border-white/10 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-800 dark:text-[#C7D6E0] leading-relaxed">
            <MarkdownContent content={message.content} />
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-bluegreen-eske ml-0.5 animate-pulse rounded-sm align-middle" />
            )}
          </div>

          {/* Trazabilidad */}
          {message.reasoning && !isStreaming && (
            <div className="mt-1.5 ml-1">
              <button
                onClick={() => setReasoningOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-[#9AAEBE] hover:text-bluegreen-eske transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${reasoningOpen ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Ver razonamiento
              </button>
              {reasoningOpen && (
                <div className="mt-1.5 px-3 py-2 bg-bluegreen-eske/5 dark:bg-bluegreen-eske/10 border border-bluegreen-eske/20 rounded-lg text-xs font-medium text-gray-600 dark:text-[#9AAEBE] italic leading-relaxed">
                  {message.reasoning}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start justify-end">
      <div className="max-w-[80%]">
        <div className="bg-bluegreen-eske text-white-eske rounded-2xl rounded-tr-none px-4 py-3 text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-bold text-gray-900 dark:text-[#C7D6E0] mt-3 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold text-gray-800 dark:text-[#C7D6E0] mt-3 mb-1.5 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#9AAEBE] mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-gray-800 dark:text-[#C7D6E0] leading-relaxed mb-2 last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900 dark:text-[#C7D6E0]">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-700 dark:text-[#9AAEBE]">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-5 space-y-1 mb-2 text-sm text-gray-800 dark:text-[#C7D6E0]">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-5 space-y-1 mb-2 text-sm text-gray-800 dark:text-[#C7D6E0]">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        hr: () => <hr className="border-gray-200 dark:border-white/10 my-3" />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-gray-300 dark:border-white/10 px-3 py-1.5 bg-gray-100 dark:bg-[#112230] font-semibold text-gray-700 dark:text-[#C7D6E0] text-left">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 dark:border-white/10 px-3 py-1.5 text-gray-800 dark:text-[#C7D6E0]">{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-bluegreen-eske/40 pl-3 italic text-gray-600 dark:text-[#9AAEBE] my-2">{children}</blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-gray-100 dark:bg-[#112230] px-1.5 py-0.5 rounded text-xs font-mono text-gray-700 dark:text-[#C7D6E0]">{children}</code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ==========================================
// MENSAJES DE BIENVENIDA POR FASE
// ==========================================

function getWelcomeMessage(phaseId: PhaseId): string {
  const welcomes: Record<PhaseId, string> = {
    proposito: "Bienvenido a la **Fase 1 — Propósito**. Aquí vamos a definir el ADN de tu proyecto mediante las variables XPCTO.\n\nEmpecemos por lo más importante: ¿cuál es el **Hito (X)** de este proyecto? Es decir, ¿qué resultado concreto, específico y medible buscas lograr?",
    exploracion: "Estamos en la Fase 2 — Exploración. Aquí realizaremos el escaneo situacional del entorno de tu proyecto para contrastar el contexto real con las variables XPCTO que ya definimos.\n\nTienes dos vías para este análisis:\n\n**Análisis de contexto express** — Yo propongo el escaneo PESTEL directamente aquí en F2, a partir del Propósito que ya definimos. Si tienes documentos, estudios o reportes sobre el entorno —encuestas, notas de campo, análisis previos— puedes adjuntarlos aquí o pegar el texto en el chat para enriquecer el análisis.\n\n**Análisis PESTEL** — Usa la app PESTEL de Centinela: configurarás las variables con pesos, agregarás fuentes de datos y obtendrás interpretación, informes y monitoreo continuo. Si compartes documentos aquí primero, PESTEL los recuperará automáticamente.\n\n¿Con qué información cuentas y cuál vía prefieres?",
    investigacion: "**Fase 3 — Investigación**. Es el momento de trabajar con los datos de campo.\n\n¿Cuáles son los principales hallazgos de la investigación que ya tienes disponible?",
    diagnostico: "Estamos en la **Fase 4 — Diagnóstico**. Transformamos la inteligencia en un dictamen de viabilidad.\n\n¿Cómo caracterizarías el entorno actual del proyecto: de **Continuidad**, **Ruptura**, **Terciopelo** o **Caos**?",
    estrategia: "**Fase 5 — Diseño Estratégico**. La inteligencia se convierte en narrativa.\n\n¿Cuál es la propuesta de valor única que diferencia a este proyecto de sus competidores?",
    tactica: "**Fase 6 — Diseño Táctico**. La estrategia se convierte en planes de acción concretos.\n\n¿Cuál frente debe recibir la mayor atención: **Aire** (medios), **Tierra** (territorial) o **Agua** (digital)?",
    gerencia: "**Fase 7 — Gerencia**. El War Room está activado.\n\n¿Cuál es el estado actual del proyecto? ¿Estamos en ruta, con retrasos o enfrentando alguna crisis?",
    seguimiento: "**Fase 8 — Seguimiento**. Es momento de revisar la ruta crítica y los indicadores.\n\n¿Cuáles son los KPIs que estás midiendo actualmente?",
    evaluacion: "**Fase 9 — Evaluación**. Cerramos el ciclo y construimos legado.\n\n¿El proyecto logró el **Hito (X)** que se planteó en la Fase 1? Cuéntame con franqueza.",
  };
  return welcomes[phaseId];
}
