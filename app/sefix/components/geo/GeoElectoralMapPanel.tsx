"use client";
// app/sefix/components/geo/GeoElectoralMapPanel.tsx
// Sub-tabs: Elecciones Federales 2024 | Elecciones Locales 2024
// Follows the same pattern as LnePanel (Vista Histórica / Vista Semanal).
import { useState } from "react";
import GeoElectoralMapContent from "./GeoElectoralMapContent";
import UnderConstructionPage from "@/app/components/UnderConstructionPage";

type GeoSubView = "federales" | "locales";

const TOOLTIP_CONFIG: Record<GeoSubView, { text: string; bg: string }> = {
  federales: { text: "Mapa coroplético de resultados electorales federales 2024", bg: "#CCE4F7" },
  locales:   { text: "Próximamente: resultados electorales locales 2024", bg: "#FFF2CC" },
};

export default function GeoElectoralMapPanel() {
  const [subView, setSubView] = useState<GeoSubView>("federales");
  const [hoveredView, setHoveredView] = useState<GeoSubView | null>(null);

  return (
    <section
      id="sefix-panel-geo"
      role="tabpanel"
      aria-labelledby="sefix-tab-geo"
      className="w-full"
    >
      {/* Sub-tabs */}
      <div className="border-b border-gray-eske-20 dark:border-white/10 bg-gray-eske-10 dark:bg-[#112230] px-4 sm:px-6 md:px-8">
        <div className="flex items-center gap-0 max-w-7xl mx-auto">
          {(["federales", "locales"] as GeoSubView[]).map((sv) => {
            const label = sv === "federales" ? "Elecciones Federales 2024" : "Elecciones Locales 2024";
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
                    : "border-transparent text-black-eske-60 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#C7D6E0] hover:bg-gray-eske-20 dark:hover:bg-[#112230]",
                ].join(" ")}
                aria-selected={isActive}
                role="tab"
              >
                {label}
              </button>
            );
          })}
          {/* Tooltip desktop — visible on hover */}
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

      {/* Content */}
      {subView === "federales" && <GeoElectoralMapContent />}
      {subView === "locales" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
          <UnderConstructionPage title="Elecciones Locales 2024" />
        </div>
      )}
    </section>
  );
}
