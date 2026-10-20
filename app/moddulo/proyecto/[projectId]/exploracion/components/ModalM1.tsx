"use client";

// Confirmation modal of the M1 actions (Nuevo análisis, Editar narrativas, Vincular, Desvincular).
// It renders what lib/moddulo/textosModalM1.ts returns and nothing else: the lines come from the
// same source as the server. Escape and focus trap (useEscapeKey / useFocusTrap); the first
// focusable element is "Cancelar" (safe default for a destructive action). Contrast: body
// black-eske-10 6.38:1 light / #C7D6E0 on #18324A dark; error red-eske-60 / red-eske-10 (≥ 5.4:1).

import { useRef } from "react";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import type { TextoModalM1 } from "@/lib/moddulo/textosModalM1";

interface Props {
  texto: TextoModalM1;
  /** Shown above the text (e.g. the state changed: confirm again). */
  aviso?: string | null;
  /** Failure of the last attempt; the modal stays open while it is shown. */
  error?: string | null;
  ocupado?: boolean;
  /** Hide the «if it fails, X is kept» sentence (the last attempt's result is unknown, so it cannot be promised). */
  ocultarCierre?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ModalM1({ texto, aviso, error, ocupado = false, ocultarCierre = false, onConfirmar, onCancelar }: Props) {
  const containerRef = useFocusTrap(true) as React.RefObject<HTMLDivElement>;
  const cancelarSiLibre = () => {
    if (!ocupado) onCancelar();
  };
  useEscapeKey(true, cancelarSiLibre);
  const idTitulo = useRef(`modal-m1-titulo-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-eske/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) cancelarSiLibre();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-eske/20 dark:bg-orange-eske/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-orange-eske-60 dark:text-orange-eske-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 id={idTitulo} className="font-bold text-black-eske dark:text-[#EAF2F8]">{texto.titulo}</h2>
            {aviso && (
              <p role="status" className="mt-2 text-sm rounded-lg px-3 py-2 bg-yellow-eske/10 border border-yellow-eske/30 text-brown-eske-60 dark:text-yellow-eske">
                {aviso}
              </p>
            )}
            {texto.intro.map((p, i) => (
              <p key={i} className="text-sm text-black-eske-10 dark:text-[#C7D6E0] mt-1">{p}</p>
            ))}
            {texto.lineas.length > 0 && (
              <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-black-eske-10 dark:text-[#C7D6E0]">
                {texto.lineas.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            )}
            {texto.cierre && !ocultarCierre && <p className="text-sm text-black-eske-10 dark:text-[#C7D6E0] mt-2">{texto.cierre}</p>}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-eske-60 dark:text-red-eske-10 mb-4 leading-relaxed">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={ocupado}
            className="flex-1 py-2.5 bg-gray-eske-20 dark:bg-white/10 text-black-eske dark:text-[#EAF2F8] rounded-lg text-sm font-medium hover:bg-gray-eske-30 dark:hover:bg-white/15 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2"
          >
            {texto.cancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={ocupado}
            className="flex-1 py-2.5 bg-orange-eske-60 text-white-eske rounded-lg text-sm font-medium hover:bg-orange-eske-70 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2"
          >
            {ocupado && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
            {texto.confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
