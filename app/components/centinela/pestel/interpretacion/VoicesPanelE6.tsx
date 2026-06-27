"use client";

// app/components/centinela/pestel/interpretacion/VoicesPanelE6.tsx
// Shows manual data sources (field evidence) loaded in E4, grouped by dimension.
// Helps analysts ground the interpretation in qualitative data.

import { useState } from "react";
import type { DimensionCode, ReliabilityLevel } from "@/types/pestel.types";

const DIMENSION_LABELS: Record<DimensionCode, string> = {
  P: "Político",
  E: "Económico",
  S: "Social",
  T: "Tecnológico",
  L: "Legal / Ambiental",
};

const RELIABILITY_LABELS: Record<ReliabilityLevel, { label: string; color: string }> = {
  HIGH: { label: "Alta", color: "text-green-eske bg-green-eske/10" },
  MEDIUM: { label: "Media", color: "text-yellow-eske bg-yellow-eske/10" },
  LOW: { label: "Baja", color: "text-red-eske bg-red-eske/10" },
};

export interface DataSourceItem {
  id: string;
  content: string;
  dimensionCode: DimensionCode;
  source: string;
  reliabilityLevel: ReliabilityLevel;
}

interface Props {
  sources: DataSourceItem[];
}

export default function VoicesPanelE6({ sources }: Props) {
  const [openDimension, setOpenDimension] = useState<DimensionCode | null>(
    null
  );

  if (sources.length === 0) {
    return (
      <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] text-center py-4">
        No hay fuentes manuales cargadas para este proyecto.
      </p>
    );
  }

  // Group by dimension
  const grouped = (["P", "E", "S", "T", "L"] as DimensionCode[]).reduce<
    Record<DimensionCode, DataSourceItem[]>
  >(
    (acc, code) => {
      acc[code] = sources.filter((s) => s.dimensionCode === code);
      return acc;
    },
    { P: [], E: [], S: [], T: [], L: [] }
  );

  return (
    <div className="flex flex-col gap-2">
      {(["P", "E", "S", "T", "L"] as DimensionCode[]).map((code) => {
        const items = grouped[code];
        if (items.length === 0) return null;
        const isOpen = openDimension === code;

        return (
          <div
            key={code}
            className="border border-gray-eske-20 dark:border-white/10 rounded-xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenDimension(isOpen ? null : code)}
              className="flex items-center gap-3 w-full px-4 py-3
                bg-white-eske dark:bg-[#18324A] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors text-left"
              aria-expanded={isOpen}
            >
              <span
                className="w-6 h-6 rounded-full bg-bluegreen-eske/10
                  text-bluegreen-eske text-xs font-bold flex items-center
                  justify-center shrink-0"
              >
                {code}
              </span>
              <span className="text-sm font-medium text-black-eske dark:text-[#EAF2F8] flex-1">
                {DIMENSION_LABELS[code]}
              </span>
              <span className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
                {items.length} fuente{items.length !== 1 ? "s" : ""}
              </span>
              <span
                className="text-gray-eske-60 dark:text-[#9AAEBE] transition-transform"
                style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-eske-10 dark:border-white/10
                bg-white-eske dark:bg-[#18324A] flex flex-col gap-3">
                {items.map((item) => {
                  const rel = RELIABILITY_LABELS[item.reliabilityLevel];
                  // Show a preview — first 300 chars
                  const preview =
                    item.content.length > 300
                      ? item.content.slice(0, 300) + "…"
                      : item.content;

                  return (
                    <blockquote
                      key={item.id}
                      className="border-l-2 border-bluegreen-eske/30 pl-3
                        flex flex-col gap-1"
                    >
                      <p className="text-xs text-black-eske dark:text-[#C7D6E0] leading-relaxed italic">
                        "{preview}"
                      </p>
                      <footer className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] not-italic">
                          — {item.source}
                        </span>
                        <span
                          className={[
                            "text-xs px-1.5 py-0.5 rounded font-medium",
                            rel.color,
                          ].join(" ")}
                        >
                          Confiabilidad {rel.label}
                        </span>
                      </footer>
                    </blockquote>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
