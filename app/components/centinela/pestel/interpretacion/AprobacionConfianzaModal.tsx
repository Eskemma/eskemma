"use client";

// app/components/centinela/pestel/interpretacion/AprobacionConfianzaModal.tsx
// Aprobar un análisis con confianza global < 50 exige explicar por qué (20 a 1 000 caracteres). La
// justificación se guarda con el análisis y viaja a F2 como nota. El error del servidor se muestra aquí
// dentro y el modal no se cierra.

import { useState, type RefObject } from "react";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import { JUSTIFICACION_MAX, JUSTIFICACION_MIN } from "@/lib/centinela/pestel/aprobacion";

interface Props {
  confianza: number;
  aprobando: boolean;
  error: string | null;
  onConfirmar: (justificacion: string) => void;
  onCancelar: () => void;
}

export default function AprobacionConfianzaModal({ confianza, aprobando, error, onConfirmar, onCancelar }: Props) {
  const [texto, setTexto] = useState("");
  const containerRef = useFocusTrap(true);
  useEscapeKey(!aprobando, onCancelar);

  const n = texto.trim().length;
  const valido = n >= JUSTIFICACION_MIN && n <= JUSTIFICACION_MAX;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="apr-conf-titulo">
      <div className="absolute inset-0 bg-black-eske/40" aria-hidden="true" onClick={aprobando ? undefined : onCancelar} />
      <div
        ref={containerRef as RefObject<HTMLDivElement>}
        className="relative z-10 bg-white-eske dark:bg-[#18324A] rounded-xl shadow-lg border border-gray-eske-20 dark:border-white/10 w-full max-w-md p-6 flex flex-col gap-4"
      >
        <div>
          <h2 id="apr-conf-titulo" className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">
            Aprobar con confianza baja
          </h2>
          <p className="text-sm text-black-eske-40 dark:text-[#C7D6E0] mt-1">
            La confianza global de este análisis es {confianza}% (menos de 50). Explica por qué lo apruebas de todos modos; la
            nota quedará guardada con tu nombre y la fecha.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="apr-conf-just" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0]">
            Justificación
          </label>
          <textarea
            id="apr-conf-just"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            maxLength={JUSTIFICACION_MAX + 200}
            className="w-full px-3 py-2.5 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm
              bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske resize-none"
            autoFocus
          />
          <p
            className={["text-xs text-right", valido ? "text-green-eske-60 dark:text-green-eske-30" : "text-black-eske-20 dark:text-[#6D8294]"].join(" ")}
            aria-live="polite"
          >
            {n} / entre {JUSTIFICACION_MIN} y 1 000 caracteres
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-eske-60 dark:text-red-eske-10">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={aprobando}
            className="px-4 py-2 border border-gray-eske-30 dark:border-white/10 text-black-eske dark:text-[#C7D6E0] rounded-lg text-sm font-medium
              hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(texto.trim())}
            disabled={!valido || aprobando}
            className="px-5 py-2 bg-orange-eske text-white rounded-lg text-sm font-semibold hover:bg-orange-eske-60 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {aprobando ? "Aprobando…" : "Aprobar"}
          </button>
        </div>
      </div>
    </div>
  );
}
