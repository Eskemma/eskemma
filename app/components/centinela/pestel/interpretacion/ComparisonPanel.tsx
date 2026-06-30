"use client";

// app/components/centinela/pestel/interpretacion/ComparisonPanel.tsx
// Shows changes between the current analysis and the previous version,
// highlighting classification changes, new factors, and stable signals.

import type { DimensionAnalysis, DimensionCode, Classification } from "@/types/pestel.types";
import { DIMENSION_META } from "@/types/pestel.types";

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  OPORTUNIDAD: "Oportunidad",
  AMENAZA: "Amenaza",
  NEUTRAL: "Neutral",
};

const CLASSIFICATION_COLORS: Record<Classification, string> = {
  OPORTUNIDAD: "text-green-eske bg-green-eske/10",
  AMENAZA: "text-red-eske bg-red-eske/10",
  NEUTRAL: "text-gray-eske-70 dark:text-[#9AAEBE] bg-gray-eske-20 dark:bg-[#21425E]",
};

interface Props {
  currentDimensions: DimensionAnalysis[];
  previousDimensions: DimensionAnalysis[];
}

type ChangeType = "changed" | "stable" | "new";

interface DimensionChange {
  code: DimensionCode;
  type: ChangeType;
  previous?: Classification;
  current: Classification;
}

export default function ComparisonPanel({
  currentDimensions,
  previousDimensions,
}: Props) {
  const changes: DimensionChange[] = currentDimensions.map((curr) => {
    const prev = previousDimensions.find((p) => p.code === curr.code);
    if (!prev) {
      return { code: curr.code, type: "new", current: curr.classification };
    }
    if (prev.classification !== curr.classification) {
      return {
        code: curr.code,
        type: "changed",
        previous: prev.classification,
        current: curr.classification,
      };
    }
    return { code: curr.code, type: "stable", current: curr.classification };
  });

  const changed = changes.filter((c) => c.type === "changed");
  const stable = changes.filter((c) => c.type === "stable");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
        Comparativa con el análisis anterior. Los cambios de clasificación
        deben tenerse en cuenta al interpretar la matriz.
      </p>

      {changed.length === 0 && (
        <div className="px-3 py-2.5 bg-green-eske/5 border border-green-eske/20
          rounded-lg text-xs text-green-eske">
          Ninguna dimensión cambió de clasificación respecto al análisis anterior.
        </div>
      )}

      {changed.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-orange-eske uppercase tracking-wide">
            Dimensiones que cambiaron
          </h4>
          {changed.map((c) => (
            <div
              key={c.code}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg
                bg-orange-eske/5 border border-orange-eske/20"
            >
              <span
                className="w-6 h-6 rounded-full bg-bluegreen-eske/10
                  text-bluegreen-eske text-xs font-bold flex items-center
                  justify-center shrink-0"
              >
                {c.code}
              </span>
              <span className="text-sm text-black-eske dark:text-[#C7D6E0] flex-1 min-w-0">
                {DIMENSION_META[c.code].label}
              </span>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <span
                  className={[
                    "px-2 py-0.5 rounded font-medium",
                    CLASSIFICATION_COLORS[c.previous!],
                  ].join(" ")}
                >
                  {CLASSIFICATION_LABELS[c.previous!]}
                </span>
                <span className="text-gray-eske-40 dark:text-[#6D8294]" aria-hidden="true">
                  →
                </span>
                <span
                  className={[
                    "px-2 py-0.5 rounded font-medium",
                    CLASSIFICATION_COLORS[c.current],
                  ].join(" ")}
                >
                  {CLASSIFICATION_LABELS[c.current]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {stable.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-gray-eske-60 dark:text-[#6D8294] uppercase tracking-wide">
            Dimensiones estables
          </h4>
          <div className="flex flex-wrap gap-2">
            {stable.map((c) => (
              <div
                key={c.code}
                className="flex items-center gap-1.5 px-3 py-1.5
                  bg-gray-eske-10 dark:bg-[#21425E] border border-gray-eske-20 dark:border-white/10 rounded-lg"
              >
                <span className="text-xs font-bold text-bluegreen-eske">
                  {c.code}
                </span>
                <span className="text-xs text-gray-eske-70 dark:text-[#9AAEBE]">
                  {DIMENSION_META[c.code].label}
                </span>
                <span
                  className={[
                    "text-xs px-1.5 py-0.5 rounded font-medium",
                    CLASSIFICATION_COLORS[c.current],
                  ].join(" ")}
                >
                  {CLASSIFICATION_LABELS[c.current]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
