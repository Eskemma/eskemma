"use client";

// app/components/centinela/pestel/interpretacion/VoicesPanelE6.tsx
// Shows manual data sources (field evidence) loaded in E4, grouped by dimension.
// Helps analysts ground the interpretation in qualitative data.

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DimensionCode, ReliabilityLevel } from "@/types/pestel.types";
import { DIMENSION_META, DIMENSION_ORDER } from "@/types/pestel.types";

const RELIABILITY_LABELS: Record<ReliabilityLevel, { label: string; color: string }> = {
  HIGH: { label: "Alta", color: "text-green-eske bg-green-eske/10" },
  MEDIUM: { label: "Media", color: "text-purple-700 dark:text-yellow-eske-60 bg-purple-100 dark:bg-yellow-eske/10" },
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

function extractFirstParagraph(content: string): string {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) =>
      l.length > 0 &&
      !l.startsWith("#") &&
      !l.startsWith("---") &&
      !l.startsWith("|") &&
      !/^[-=\s]+$/.test(l)
    );
  return lines.slice(0, 3).join(" ").trim();
}

export default function VoicesPanelE6({ sources }: Props) {
  const [openDimension, setOpenDimension] = useState<DimensionCode | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  if (sources.length === 0) {
    return (
      <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] text-center py-4">
        No hay fuentes manuales cargadas para este proyecto.
      </p>
    );
  }

  const grouped = DIMENSION_ORDER.reduce<
    Partial<Record<DimensionCode, DataSourceItem[]>>
  >(
    (acc, code) => {
      acc[code] = sources.filter((s) => s.dimensionCode === code);
      return acc;
    },
    {}
  ) as Record<DimensionCode, DataSourceItem[]>;

  function toggleSource(id: string) {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {DIMENSION_ORDER.map((code) => {
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
                {DIMENSION_META[code].label}
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
                bg-white-eske dark:bg-[#18324A] flex flex-col gap-4">
                {items.map((item) => {
                  const rel = RELIABILITY_LABELS[item.reliabilityLevel];
                  const quote = extractFirstParagraph(item.content);
                  const isExpanded = expandedSources.has(item.id);

                  return (
                    <blockquote
                      key={item.id}
                      className="border-l-2 border-bluegreen-eske/30 pl-3 flex flex-col gap-2"
                    >
                      <p className="text-xs text-black-eske dark:text-[#C7D6E0] leading-relaxed italic">
                        "{quote}"
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
                      {item.content.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleSource(item.id)}
                            className="text-xs text-bluegreen-eske hover:underline"
                          >
                            {isExpanded ? "Ocultar fuente completa ▴" : "Ver fuente completa ▾"}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 text-xs text-black-eske dark:text-[#C7D6E0]
                              leading-relaxed prose prose-sm max-w-none
                              dark:prose-invert prose-headings:text-sm
                              prose-headings:font-semibold prose-headings:mt-3
                              prose-p:my-1 prose-li:my-0.5
                              overflow-x-auto
                              [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
                              [&_th]:border [&_th]:border-gray-eske-20 [&_th]:dark:border-white/20 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:bg-gray-eske-10 [&_th]:dark:bg-white/5 [&_th]:font-semibold [&_th]:whitespace-nowrap
                              [&_td]:border [&_td]:border-gray-eske-20 [&_td]:dark:border-white/10 [&_td]:px-4 [&_td]:py-2 [&_td]:align-top">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      )}
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
