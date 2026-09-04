"use client";

// app/components/shared/chat/ChatPanel.tsx
// Panel completo del chat: header + lista de mensajes + burbuja de
// streaming + indicador de progreso GENÉRICO (sin nombres de herramienta) +
// chips de sugerencias + composer (textarea autoexpandible, adjuntar
// archivo, dictado de voz, botón enviar con ícono, botón cerrar). Sin
// useAuth ni Firebase cliente: las cookies de sesión viajan solas en el
// fetch same-origin de useChatStream / de la subida de adjuntos.

import { useEffect, useRef, useState } from "react";
import type { FontanaChatMessage, FontanaToolCall } from "@/types/fontana.types";
import ChatBubble from "./ChatBubble";
import { useSpeechDictation } from "./useSpeechDictation";

export interface AdjuntoChip {
  key: string; // clave estable en el cliente
  nombre: string;
  estado: "subiendo" | "listo" | "error";
  adjuntoId?: string; // presente sii estado === "listo"
  mensajeError?: string;
}

const FORMATOS_ACEPTADOS = ".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls";

interface Props {
  titulo: string;
  subtitulo?: string;
  messages: FontanaChatMessage[];
  streaming: boolean;
  streamingText: string;
  liveToolCalls: FontanaToolCall[];
  suggestions?: string[];
  onSend: (text: string, adjuntoIds?: string[]) => void;
  onClose: () => void;
  onVerCanvas?: () => void;
  // Adjuntos — opcional: si no se pasan, no se muestra el botón de adjuntar.
  adjuntos?: AdjuntoChip[];
  onSubirArchivo?: (file: File) => void;
  onQuitarAdjunto?: (key: string) => void;
}

export default function ChatPanel({
  titulo,
  subtitulo,
  messages,
  streaming,
  streamingText,
  liveToolCalls,
  suggestions = [],
  onSend,
  onClose,
  onVerCanvas,
  adjuntos,
  onSubirArchivo,
  onQuitarAdjunto,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dictadoBaseRef = useRef("");

  const adjuntosSoportados = !!onSubirArchivo;
  const listaAdjuntos = adjuntos ?? [];
  const subiendoAlguno = listaAdjuntos.some((a) => a.estado === "subiendo");
  const idsListos = listaAdjuntos
    .filter((a) => a.estado === "listo" && a.adjuntoId)
    .map((a) => a.adjuntoId as string);

  const resize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  const { supported: vozSoportada, listening, error: vozError, start, stop } =
    useSpeechDictation({
      onResult: (texto, final) => {
        const base = dictadoBaseRef.current;
        const nuevo = base ? `${base} ${texto}` : texto;
        setValue(nuevo);
        if (final) dictadoBaseRef.current = nuevo;
        requestAnimationFrame(resize);
      },
    });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingText]);

  const handleSend = () => {
    if (streaming || subiendoAlguno) return;
    if (listening) stop();
    const texto = value.trim() || (idsListos.length > 0 ? "Revisa el archivo que adjunté." : "");
    if (!texto) return;
    onSend(texto, idsListos.length > 0 ? idsListos : undefined);
    setValue("");
    dictadoBaseRef.current = "";
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    dictadoBaseRef.current = e.target.value.trim();
    resize();
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => onSubirArchivo?.(f));
    e.target.value = ""; // permite readjuntar el mismo archivo
  };

  const toggleDictado = () => {
    if (listening) {
      stop();
      return;
    }
    dictadoBaseRef.current = value.trim();
    start();
  };

  const streamingMsg: FontanaChatMessage | null = streamingText
    ? { id: "streaming", role: "assistant", content: streamingText, timestamp: "" }
    : null;

  const enviarDeshabilitado =
    streaming || subiendoAlguno || (!value.trim() && idsListos.length === 0);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white-eske shrink-0"
        style={{ background: "linear-gradient(135deg, #248cc1, #026988)" }}
      >
        <div>
          <p className="text-sm font-semibold leading-none">{titulo}</p>
          {subtitulo && <p className="text-[11px] text-white/70 leading-none mt-1">{subtitulo}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar chat"
          className="text-white/80 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-eske-10/50 dark:bg-[#0B1620] min-h-0">
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} onVerCanvas={onVerCanvas} />
        ))}

        {streamingMsg && <ChatBubble message={streamingMsg} isStreaming />}

        {/* Indicador de progreso GENÉRICO mientras el asistente trabaja — sin
            nombres de herramienta ni argumentos. `liveToolCalls` solo se usa
            como señal (hay herramientas corriendo → texto "Consultando
            datos…"); nunca se renderiza su contenido. */}
        {streaming && !streamingText && (
          <div className="flex gap-2 items-center px-2 text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
            <span className="flex gap-1 items-center">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="w-2 h-2 bg-gray-eske-40 rounded-full animate-bounce motion-reduce:animate-none"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </span>
            {liveToolCalls.length > 0 && <span className="text-red-eske">Consultando datos…</span>}
          </div>
        )}
      </div>

      {/* Sugerencias */}
      {suggestions.length > 0 && messages.length <= 1 && (
        <div className="px-3 pt-2 flex gap-1.5 flex-wrap shrink-0 bg-white-eske dark:bg-[#0F2233] border-t border-gray-eske-20 dark:border-white/10">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => !streaming && onSend(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-gray-eske-20 dark:border-white/10 text-gray-eske-60 dark:text-[#9AAEBE] hover:border-gray-eske-40 whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#0F2233] p-3 shrink-0">
        {/* Chips de adjuntos */}
        {listaAdjuntos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {listaAdjuntos.map((a) => (
              <span
                key={a.key}
                className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border ${
                  a.estado === "error"
                    ? "border-red-eske-40 text-red-eske-60 dark:text-red-eske-40"
                    : "border-gray-eske-20 dark:border-white/15 text-gray-eske-60 dark:text-[#9AAEBE]"
                }`}
                title={a.estado === "error" ? a.mensajeError : a.nombre}
              >
                {a.estado === "subiendo" && (
                  <span className="w-2 h-2 rounded-full bg-blue-eske animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                )}
                {a.estado === "listo" && <span aria-hidden="true">📄</span>}
                {a.estado === "error" && <span aria-hidden="true">⚠️</span>}
                <span className="max-w-[160px] truncate">{a.nombre}</span>
                {a.estado === "error" && a.mensajeError && (
                  <span className="sr-only">{a.mensajeError}</span>
                )}
                {onQuitarAdjunto && (
                  <button
                    type="button"
                    onClick={() => onQuitarAdjunto(a.key)}
                    aria-label={`Quitar ${a.nombre}`}
                    className="hover:text-black-eske dark:hover:text-white"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* 2 niveles (26-09-05): arriba el campo de texto a todo el ancho;
            abajo adjuntar+dictado a la izquierda, espacio vacío al centro.
            Enviar queda fuera de la columna, self-stretch, ocupando la
            altura combinada de ambos niveles (items-stretch en el padre). */}
        <div className="flex items-stretch gap-2 border border-gray-eske-20 dark:border-white/10 rounded-2xl px-2.5 py-1.5 focus-within:border-gray-eske-40">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder={listening ? "Escuchando…" : "Escribe tu pregunta…"}
              className="w-full text-sm resize-none bg-transparent text-black-eske dark:text-[#EAF2F8] placeholder:text-gray-eske-40 focus:outline-none py-1.5 max-h-[120px] leading-snug disabled:opacity-50"
            />

            <div className="flex items-center gap-1">
              {/* Adjuntar archivo */}
              {adjuntosSoportados && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={FORMATOS_ACEPTADOS}
                    multiple
                    onChange={handleFilePick}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={streaming}
                    aria-label="Adjuntar archivo"
                    title="Adjuntar archivo (PDF, Word, Excel, texto)"
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-eske-60 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-white hover:bg-gray-eske-10 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                </>
              )}

              {/* Dictado por voz */}
              <button
                type="button"
                onClick={toggleDictado}
                disabled={!vozSoportada || streaming}
                aria-label={
                  vozSoportada
                    ? listening
                      ? "Detener dictado"
                      : "Dictar por voz"
                    : "El dictado por voz no está disponible en este navegador"
                }
                aria-pressed={listening}
                title={
                  vozSoportada
                    ? listening
                      ? "Detener dictado"
                      : "Dictar por voz"
                    : "El dictado por voz no está disponible en este navegador"
                }
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  listening
                    ? "bg-red-eske text-white-eske animate-pulse motion-reduce:animate-none"
                    : "text-gray-eske-60 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-white hover:bg-gray-eske-10 dark:hover:bg-white/5"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                </svg>
              </button>
              {/* Espacio vacío al centro — deliberado, sin flex-1 forzando nada. */}
            </div>
          </div>

          {/* Enviar — ícono real (avión de papel), siempre visible; deshabilitado
              (sin texto ni adjuntos listos, o streaming, o subiendo) baja opacidad.
              self-stretch: ocupa la altura combinada de las 2 filas de la izquierda. */}
          <button
            type="button"
            onClick={handleSend}
            disabled={enviarDeshabilitado}
            aria-label="Enviar"
            title="Enviar"
            className="shrink-0 self-stretch w-11 rounded-2xl flex items-center justify-center bg-blue-eske text-white-eske hover:bg-blue-eske-60 disabled:bg-blue-eske/50 disabled:cursor-not-allowed transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4Z" />
            </svg>
          </button>
          {/* El cierre del panel vive en la × del header (más Escape y, en
              mobile, tap en el backdrop). No se duplica en el composer para
              dejarle todo el ancho al campo de texto. */}
        </div>

        {vozError ? (
          <p className="text-[10px] text-red-eske-60 dark:text-red-eske-40 mt-1 px-1">{vozError}</p>
        ) : !vozSoportada ? (
          <p className="text-[10px] text-gray-eske-40 mt-1 px-1">
            Enter para enviar · Shift+Enter para salto de línea · El dictado por voz no está disponible en este navegador
          </p>
        ) : (
          <p className="text-[10px] text-gray-eske-40 mt-1 px-1">Enter para enviar · Shift+Enter para salto de línea</p>
        )}
      </div>
    </div>
  );
}
