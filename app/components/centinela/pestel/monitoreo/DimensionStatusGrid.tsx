// app/components/centinela/pestel/monitoreo/DimensionStatusGrid.tsx
// Grid of PEST-L dimension cards showing current status from the latest analysis.

import type { DimensionAnalysis } from "@/types/pestel.types";
import { DIMENSION_META, DIMENSION_ORDER } from "@/types/pestel.types";

interface Props {
  dimensions: DimensionAnalysis[];
}

const CLASSIFICATION_STYLES: Record<
  string,
  { bg: string; text: string; badge: string }
> = {
  OPORTUNIDAD: {
    bg: "bg-green-eske/5 border-green-eske/20",
    text: "text-green-eske",
    badge: "bg-green-eske/10 text-green-eske border border-green-eske/30",
  },
  AMENAZA: {
    bg: "bg-red-eske/5 border-red-eske/20",
    text: "text-red-eske",
    badge: "bg-red-eske/10 text-red-eske border border-red-eske/30",
  },
  NEUTRAL: {
    bg: "bg-[#FFF2CC]/50 dark:bg-yellow-eske/10 border-[#C8A800]/20 dark:border-yellow-eske/20",
    text: "text-[#816000] dark:text-yellow-eske",
    badge: "bg-[#FFF2CC] dark:bg-yellow-eske/20 text-[#816000] dark:text-yellow-eske border border-[#C8A800]/20 dark:border-yellow-eske/30",
  },
};

const TREND_ICONS: Record<string, string> = {
  ASCENDENTE: "↑",
  DESCENDENTE: "↓",
  ESTABLE: "→",
};

const INTENSITY_LABELS: Record<string, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

export default function DimensionStatusGrid({ dimensions }: Props) {
  if (!dimensions || dimensions.length === 0) {
    return (
      <p className="text-sm text-black-eske dark:text-[#9AAEBE]">
        No hay datos de dimensiones disponibles.
      </p>
    );
  }

  const sorted = [...dimensions].sort(
    (a, b) => DIMENSION_ORDER.indexOf(a.code) - DIMENSION_ORDER.indexOf(b.code)
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {sorted.map((dim) => {
        const styles =
          CLASSIFICATION_STYLES[dim.classification] ??
          CLASSIFICATION_STYLES.NEUTRAL;
        return (
          <div
            key={dim.code}
            className={`rounded-lg border p-3 flex flex-col gap-2 ${styles.bg}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-1">
              <span
                className="w-7 h-7 rounded-full bg-bluegreen-eske text-white
                  text-xs font-bold flex items-center justify-center shrink-0"
              >
                {dim.code}
              </span>
              <span
                className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium
                  ${styles.badge}`}
              >
                {dim.classification}
              </span>
            </div>

            {/* Dimension name */}
            <p className="text-xs font-semibold text-black-eske dark:text-[#EAF2F8] leading-tight">
              {DIMENSION_META[dim.code]?.label ?? dim.code}
            </p>

            {/* Signal */}
            <p
              className="text-xs text-black-eske dark:text-[#C7D6E0] leading-snug line-clamp-2"
              title={dim.mainSignal}
            >
              {dim.mainSignal}
            </p>

            {/* Confidence bar */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-black-eske dark:text-[#9AAEBE]">Confianza</span>
                <span className={`text-xs font-semibold ${styles.text}`}>
                  {dim.confidence}%
                </span>
              </div>
              <div className="h-1 bg-gray-eske-20 dark:bg-[#112230] rounded-full overflow-hidden">
                <div
                  className={`h-1 rounded-full ${
                    dim.classification === "OPORTUNIDAD"
                      ? "bg-green-eske"
                      : dim.classification === "AMENAZA"
                      ? "bg-red-eske"
                      : "bg-[#816000] dark:bg-gray-eske-40"
                  }`}
                  style={{ width: `${dim.confidence}%` }}
                />
              </div>
            </div>

            {/* Trend + Intensity */}
            <div className="flex items-center justify-between text-xs text-black-eske dark:text-[#9AAEBE] pt-0.5">
              <span>
                <span className={styles.text}>
                  {TREND_ICONS[dim.trend] ?? "→"}
                </span>{" "}
                {dim.trend.charAt(0) + dim.trend.slice(1).toLowerCase()}
              </span>
              <span>{INTENSITY_LABELS[dim.intensity]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
