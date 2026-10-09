"use client";

// Confirmation (or block) for "Reemplazar análisis finalizado…" (H15 / M8).
// The impact lines are built by the SERVER with real figures (lineasDeImpacto);
// this component only presents them. Pattern: the "Regenerar" modal of the
// PESTEL reports. First focusable element is "Cancelar" (safe default for a
// destructive action). Contrast (WCAG): body black-eske-20 7.45:1 light /
// #9AAEBE 5.75:1 dark on #18324A; title 13.5:1 / 8.86:1; confirm white-eske on
// red-eske-60 7.04:1; notice brown-eske-60 5.37:1 / yellow-eske 7.24:1 on tint.

import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";

export type ModoReemplazo = "confirmar" | "bloqueado";

interface Props {
  modo: ModoReemplazo;
  /** Impact lines from the server; empty when F3 is not affected. */
  lineas: string[];
  /** Server-written reason (blocked mode). */
  motivoBloqueo?: string | null;
  /** Shown above the text when the user must confirm again. */
  aviso?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ReemplazarAnalisisModal({
  modo,
  lineas,
  motivoBloqueo,
  aviso,
  onConfirmar,
  onCancelar,
}: Props) {
  const containerRef = useFocusTrap(true) as React.RefObject<HTMLDivElement>;
  useEscapeKey(true, onCancelar);
  const bloqueado = modo === "bloqueado";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancelar();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reemplazar-analisis-titulo"
        aria-describedby="reemplazar-analisis-texto"
        className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4"
      >
        <h3
          id="reemplazar-analisis-titulo"
          className="font-semibold text-black-eske dark:text-[#C7D6E0] text-base"
        >
          {bloqueado ? "No se puede reemplazar el análisis finalizado" : "¿Reemplazar el análisis finalizado?"}
        </h3>

        {aviso && !bloqueado && (
          <p
            role="status"
            className="text-sm rounded-lg px-3 py-2 bg-yellow-eske/10 border border-yellow-eske/30 text-brown-eske-60 dark:text-yellow-eske"
          >
            {aviso}
          </p>
        )}

        <div
          id="reemplazar-analisis-texto"
          className="flex flex-col gap-3 text-sm text-black-eske-20 dark:text-[#9AAEBE] leading-relaxed"
        >
          {bloqueado ? (
            <p>{motivoBloqueo}</p>
          ) : (
            <>
              <p>
                Se generará un análisis nuevo desde cero. Reemplazará al que finalizaste y se perderán las
                ediciones y aprobaciones que hiciste en él.
              </p>
              {lineas.length > 0 && (
                <>
                  <p>
                    Además, las preguntas y los actores del análisis nuevo serán distintos a los actuales, por lo
                    que en la Fase 3:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    {lineas.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </>
              )}
              <p>
                El análisis actual se conserva en el sistema, pero por ahora no hay forma de consultarlo ni de
                restaurarlo desde la pantalla. Esta acción no se puede deshacer desde aquí.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          {bloqueado ? (
            <button
              type="button"
              onClick={onCancelar}
              className="px-4 py-2 text-sm font-medium bg-bluegreen-eske-60 text-white-eske rounded-lg hover:bg-bluegreen-eske-70 transition-colors focus-visible:outline focus-visible:outline-2"
            >
              Entendido
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancelar}
                className="px-4 py-2 text-sm font-medium text-black-eske-20 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#C7D6E0] transition-colors focus-visible:outline focus-visible:outline-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirmar}
                className="px-4 py-2 text-sm font-medium bg-red-eske-60 text-white-eske rounded-lg hover:bg-red-eske-60/90 transition-colors focus-visible:outline focus-visible:outline-2"
              >
                Reemplazar análisis
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
