"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import HistoricoView from "./lne/HistoricoView";
import SemanalView from "./lne/SemanalView";
import MobileFirstVisitHint from "./lne/MobileFirstVisitHint";

type LneSubView = "historico" | "semanal";

const TOOLTIP_CONFIG: Record<LneSubView, { text: string; bg: string }> = {
  historico: { text: "Evolución anual y mensual del Padrón y LNE", bg: "#FFF2CC" },
  semanal:   { text: "Datos semanales detallados del año en curso",  bg: "#CCE4B1" },
};

const TAB_HINT_KEY = "sefix:tab_hint_count:v1";
const TAB_HINT_MAX = 6;

export default function LnePanel() {
  const [subView, setSubView] = useState<LneSubView>("historico");
  const [hoveredView, setHoveredView] = useState<LneSubView | null>(null);

  // Banner mobile de descripción de tab
  const [tabHintVisible, setTabHintVisible] = useState(false);
  const [tabHintFading, setTabHintFading] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissTabHint = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setTabHintFading(true);
    hideTimerRef.current = setTimeout(() => {
      setTabHintVisible(false);
      setTabHintFading(false);
    }, 400);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const count = parseInt(localStorage.getItem(TAB_HINT_KEY) ?? "0", 10);
    if (count >= TAB_HINT_MAX) return;
    localStorage.setItem(TAB_HINT_KEY, String(count + 1));

    // Reset timers
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    setTabHintFading(false);
    setTabHintVisible(true);

    // Iniciar fade-out a los 4.5s, ocultar a los 5s
    fadeTimerRef.current = setTimeout(() => setTabHintFading(true), 4500);
    hideTimerRef.current = setTimeout(() => {
      setTabHintVisible(false);
      setTabHintFading(false);
    }, 5000);

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subView]);

  return (
    <section
      id="sefix-panel-lne"
      role="tabpanel"
      aria-labelledby="sefix-tab-lne"
      className="w-full"
    >
      {/* Sub-tabs Histórico / Semanal */}
      <div className="border-b border-gray-eske-20 dark:border-white/10 bg-gray-eske-10 dark:bg-[#112230] px-4 sm:px-6 md:px-8">
        <div className="flex items-center gap-0 max-w-7xl mx-auto">
          {(["historico", "semanal"] as LneSubView[]).map((sv) => {
            const label = sv === "historico" ? "Vista Histórica" : "Vista Semanal";
            const isActive = subView === sv;
            return (
              <button
                key={sv}
                onClick={() => setSubView(sv)}
                onMouseEnter={() => setHoveredView(sv)}
                onMouseLeave={() => setHoveredView(null)}
                className={[
                  "px-5 py-2.5 text-sm font-medium transition-colors border-b-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske",
                  isActive
                    ? "border-orange-eske text-orange-eske bg-white-eske dark:bg-[#18324A]"
                    : "border-transparent text-black-eske-20 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#C7D6E0] hover:bg-gray-eske-20 dark:hover:bg-[#112230]",
                ].join(" ")}
                aria-selected={isActive}
                role="tab"
              >
                {label}
              </button>
            );
          })}
          {/* Tooltip desktop — solo visible en sm+ con hover */}
          {hoveredView && (
            <div
              role="tooltip"
              className="hidden sm:flex items-center ml-4 whitespace-nowrap rounded px-2.5 py-1 text-xs text-black-eske shadow-sm border border-gray-eske-20 dark:border-white/10 pointer-events-none"
              style={{ backgroundColor: TOOLTIP_CONFIG[hoveredView].bg }}
            >
              {TOOLTIP_CONFIG[hoveredView].text}
            </div>
          )}
        </div>
      </div>

      {/* Banner mobile de descripción de tab — auto-descartable */}
      {tabHintVisible && (
        <div
          className={[
            "sm:hidden px-4 py-2 text-xs text-black-eske flex items-center justify-between gap-2",
            "transition-opacity duration-500",
            tabHintFading ? "opacity-0" : "opacity-100",
          ].join(" ")}
          style={{ backgroundColor: TOOLTIP_CONFIG[subView].bg }}
          role="status"
          aria-live="polite"
        >
          <span>{TOOLTIP_CONFIG[subView].text}</span>
          <button
            type="button"
            onClick={dismissTabHint}
            aria-label="Cerrar descripción"
            className="shrink-0 text-black-eske-40 dark:text-[#6D8294] hover:text-black-eske dark:hover:text-[#C7D6E0] focus-visible:outline-none rounded"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
        {subView === "historico" && <HistoricoView />}
        {subView === "semanal" && <SemanalView />}
      </div>

      {/* Alerta de primera visita — solo mobile, solo una vez */}
      <MobileFirstVisitHint />
    </section>
  );
}
