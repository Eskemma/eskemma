"use client";

// app/components/shared/chat/useSpeechDictation.ts
// Dictado de voz sobre la Web Speech API nativa del navegador
// (SpeechRecognition / webkitSpeechRecognition). No hay librería de por
// medio ni audio que salga del navegador salvo lo que el propio motor de
// reconocimiento del navegador envíe a su backend. Primer uso de voz en el
// ecosistema — ver docs/ecosistema/patrones-compartidos/agente-conversacional.md.
//
// El permiso de micrófono está bloqueado site-wide por
// `Permissions-Policy: microphone=()` en next.config.ts; solo la ruta
// /centinela/fontana lo relaja a `microphone=(self)`.

import { useCallback, useEffect, useRef, useState } from "react";

// --- Tipos mínimos de la Web Speech API (no están en lib.dom estándar) ---
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MENSAJE_ERROR: Record<string, string> = {
  "not-allowed": "Permiso de micrófono denegado. Actívalo en el navegador para dictar.",
  "service-not-allowed": "Permiso de micrófono denegado. Actívalo en el navegador para dictar.",
  "audio-capture": "No se detectó ningún micrófono.",
  network: "El reconocimiento de voz no está disponible sin conexión.",
};

interface Opciones {
  lang?: string;
  // Recibe el texto reconocido. `final` = el motor ya lo dio por definitivo.
  onResult: (texto: string, final: boolean) => void;
}

interface Estado {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useSpeechDictation({ lang = "es-MX", onResult }: Opciones): Estado {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    setSupported(getCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (listening) return;
    const Ctor = getCtor();
    if (!Ctor) {
      setError("El dictado por voz no está disponible en este navegador.");
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) onResultRef.current(final, true);
      else if (interim) onResultRef.current(interim, false);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") {
        setListening(false);
        return;
      }
      setError(MENSAJE_ERROR[e.error] ?? "No se pudo usar el dictado por voz.");
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("No se pudo iniciar el dictado por voz.");
      setListening(false);
    }
  }, [lang, listening]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  return { supported, listening, error, start, stop };
}
