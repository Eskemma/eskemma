"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

interface AdvisorPanelProps {
  projectId: string;
  motor: string;
  campo: string;
  onClose: () => void;
}

export default function AdvisorPanel({ projectId, motor, campo, onClose }: AdvisorPanelProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-open with initial analysis on mount
  useEffect(() => {
    if (!autoOpened) {
      setAutoOpened(true);
      callAdvisor([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function callAdvisor(history: Mensaje[]) {
    setIsStreaming(true);
    const assistantMsg: Mensaje = { role: "assistant", content: "" };
    setMensajes((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/moddulo/f2/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, motor, campo, mensajes: history }),
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const { text } = JSON.parse(payload) as { text: string };
            setMensajes((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: updated[updated.length - 1].content + text,
              };
              return updated;
            });
          } catch { /* ignore parse errors */ }
        }
      }
    } catch { /* silencioso */ } finally {
      setIsStreaming(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    const userMsg: Mensaje = { role: "user", content: text };
    const newHistory = [...mensajes, userMsg];
    setMensajes(newHistory);
    setInput("");
    await callAdvisor(newHistory);
  }

  return (
    <div className="flex flex-col h-full border-t border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/50 dark:bg-[#112230]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-eske-20 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold text-black-eske dark:text-white">
            Advisor — {motor}
          </p>
          <p className="text-xs text-gray-eske-50 dark:text-[#6D8294]">{campo}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar advisor"
          className="text-gray-eske-40 hover:text-gray-eske-70 dark:hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm">
        {mensajes.length === 0 && isStreaming && (
          <div className="flex items-center gap-2 text-gray-eske-50 dark:text-[#6D8294]">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-bluegreen-eske animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-xs">Analizando impacto…</span>
          </div>
        )}
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-bluegreen-eske text-white"
                  : "bg-white-eske dark:bg-[#1A3347] text-black-eske dark:text-[#C5D8E8] border border-gray-eske-20 dark:border-white/10"
              }`}
            >
              {m.role === "user" ? (
                <span className="whitespace-pre-wrap">{m.content}</span>
              ) : (
                <div className="prose prose-xs dark:prose-invert max-w-none
                  [&_p]:mb-1.5 [&_p:last-child]:mb-0
                  [&_ul]:mb-1.5 [&_ul]:pl-3 [&_li]:mb-0.5
                  [&_ol]:mb-1.5 [&_ol]:pl-3
                  [&_strong]:font-semibold
                  [&_em]:italic
                  [&_code]:bg-gray-eske-10 [&_code]:dark:bg-white/10 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5
                  [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-semibold
                  text-black-eske dark:text-[#C5D8E8]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              )}
              {m.role === "assistant" && isStreaming && i === mensajes.length - 1 && (
                <span className="inline-block w-1 h-3 bg-bluegreen-eske ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 py-2 border-t border-gray-eske-20 dark:border-white/10 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Pregunta sobre el impacto…"
          disabled={isStreaming}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#1A3347] text-black-eske dark:text-white placeholder:text-gray-eske-40 focus:outline-none focus:ring-1 focus:ring-bluegreen-eske disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          aria-label="Enviar"
          className="px-3 py-1.5 bg-bluegreen-eske text-white rounded-lg text-xs font-semibold hover:bg-bluegreen-eske/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          →
        </button>
      </div>
    </div>
  );
}
