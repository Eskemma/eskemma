"use client";

import { useState, useEffect } from "react";

const HINT_KEY = "sefix:lne_hint_v1";

export default function MobileFirstVisitHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(HINT_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(HINT_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center pb-20 sm:hidden"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Sugerencia de inicio"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black-eske/60" aria-hidden="true" />

      {/* Card */}
      <div
        className="relative z-10 mx-4 w-full max-w-sm bg-white-eske dark:bg-[#18324A] rounded-xl shadow-2xl border border-gray-eske-20 dark:border-white/10 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar sugerencia"
          className="absolute top-3 right-3 text-black-eske-40 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-bluegreen-eske-10 flex items-center justify-center mt-0.5">
            <svg className="w-4 h-4 text-bluegreen-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-black-eske dark:text-[#C7D6E0] leading-relaxed">
            Configura tu consulta con el botón{" "}
            <strong className="text-bluegreen-eske">FILTROS</strong>{" "}
            y conoce el análisis dinámico de cada consulta con el botón{" "}
            <strong className="text-bluegreen-eske">ANÁLISIS</strong>,
            ubicados en la parte inferior.
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full py-2 text-xs font-medium text-black-eske-20 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] text-center border border-gray-eske-20 dark:border-white/10 rounded-lg hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
