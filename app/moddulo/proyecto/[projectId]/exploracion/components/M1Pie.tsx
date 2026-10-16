"use client";

// Fixed footer of the «Análisis PESTEL» side panel (M1). A sibling of the scrollable area
// (shrink-0): it never pushes the content. Everything it shows comes from pieM1()
// (lib/moddulo/pantallaM1.ts); this component only renders it. Contrast: state text black-eske-20
// 7.45:1 light / #9AAEBE 5.75:1 dark; errors red-eske-60 / red-eske-10.

import type { PieM1 } from "@/lib/moddulo/pantallaM1";

interface Props {
  pie: PieM1;
  /** Failure of the last approval (role="alert"). */
  errorAprobar?: string | null;
  /** Neutral notice (e.g. approved, but the screen could not refresh). */
  aviso?: string | null;
  /** Failure of the last "Reabrir análisis" attempt (Centinela footer link). */
  errorReabrir?: string | null;
  reabriendo?: boolean;
  onAprobar: () => void;
  onReintentarGeneracion: () => void;
  onReabrir: () => void;
}

export default function M1Pie({ pie, errorAprobar, aviso, errorReabrir, reabriendo = false, onAprobar, onReintentarGeneracion, onReabrir }: Props) {
  if (pie.tipo === "oculto") return null;
  const btn =
    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2";
  return (
    <div className="shrink-0 border-t border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A] px-3 py-2.5 space-y-1.5" data-m1-pie={pie.tipo}>
      {pie.texto && <p className="text-xs font-medium text-black-eske-20 dark:text-[#C7D6E0]">{pie.texto}</p>}
      {pie.lineaGeneracion && <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE]" role="status">{pie.lineaGeneracion}</p>}

      {pie.aprobar.visible && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={onAprobar}
            disabled={pie.aprobar.deshabilitado}
            aria-describedby={pie.aprobar.motivo ? "m1-pie-motivo" : undefined}
            className={`${btn} w-full bg-bluegreen-eske-60 text-white-eske hover:bg-bluegreen-eske-70`}
          >
            {pie.aprobar.etiqueta}
          </button>
          {pie.aprobar.motivo && (
            <p id="m1-pie-motivo" className="text-xs text-brown-eske-60 dark:text-yellow-eske">{pie.aprobar.motivo}</p>
          )}
        </div>
      )}

      {pie.reintentarGeneracion.visible && (
        <button
          type="button"
          onClick={onReintentarGeneracion}
          disabled={pie.reintentarGeneracion.deshabilitado}
          className={`${btn} w-full border border-bluegreen-eske-60 dark:border-blue-eske-20 text-bluegreen-eske-60 dark:text-blue-eske-20 hover:bg-bluegreen-eske/5`}
        >
          Reintentar generación
        </button>
      )}

      {pie.reabrirCentinela && (
        <button
          type="button"
          onClick={onReabrir}
          disabled={reabriendo}
          className="text-xs text-bluegreen-eske-60 dark:text-blue-eske-20 underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2"
        >
          {reabriendo ? "Verificando…" : "Reabrir análisis"}
        </button>
      )}

      {errorAprobar && <p role="alert" className="text-xs text-red-eske-60 dark:text-red-eske-10 leading-relaxed">{errorAprobar}</p>}
      {errorReabrir && <p role="alert" className="text-xs text-red-eske-60 dark:text-red-eske-10 leading-relaxed">{errorReabrir}</p>}
      {aviso && <p role="status" className="text-xs text-black-eske-20 dark:text-[#9AAEBE] leading-relaxed">{aviso}</p>}
    </div>
  );
}
