
// app/components/centinela/pestel/informes/ScorecardTable.tsx
// Weighted scorecard table for E7 — shows per-dimension scores and global score.

import InfoTooltip from "@/app/components/ui/InfoTooltip";
import type { Scorecard } from "@/lib/pestel/matrizUtils";
import type { DimensionAnalysis } from "@/types/pestel.types";
import { DIMENSION_META, DIMENSION_ORDER } from "@/types/pestel.types";

interface Props {
  scorecard: Scorecard;
  dimensions: DimensionAnalysis[];
}

const CLASSIFICATION_STYLES: Record<string, string> = {
  OPORTUNIDAD: "bg-green-eske/10 text-green-eske border border-green-eske/30",
  AMENAZA: "bg-red-eske/10 text-red-eske border border-red-eske/30",
  NEUTRAL: "bg-[#FFF2CC] dark:bg-yellow-eske/20 text-[#816000] dark:text-yellow-eske border border-[#C8A800]/20 dark:border-yellow-eske/30",
};

export default function ScorecardTable({ scorecard, dimensions }: Props) {
  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <table className="min-w-[540px] w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-eske-20 dark:border-white/10">
              <th className="text-left py-2 px-3 font-semibold text-black-eske dark:text-[#EAF2F8] min-w-[180px]">
                <span className="inline-flex items-center gap-1">
                  Dimensión — Señal
                  <InfoTooltip
                    content="El hecho o tendencia más relevante identificado en esta dimensión."
                    placement="right"
                  />
                </span>
              </th>
              <th className="text-center py-2 px-3 font-semibold text-black-eske dark:text-[#EAF2F8]">
                <span className="inline-flex items-center justify-center gap-1">
                  Tendencia
                  <InfoTooltip
                    content="Dirección del cambio: ↑ creciente, ↓ decreciente, → estable."
                    placement="right"
                  />
                </span>
              </th>
              <th className="text-center py-2 px-3 font-semibold text-black-eske dark:text-[#EAF2F8]">
                <span className="inline-flex items-center justify-center gap-1">
                  Clasificación
                  <InfoTooltip
                    content="Oportunidad (factor favorable), Amenaza (factor adverso) o Neutro."
                    placement="right"
                  />
                </span>
              </th>
              <th className="text-center py-2 px-3 font-semibold text-black-eske dark:text-[#EAF2F8]">
                <span className="inline-flex items-center justify-center gap-1">
                  Confianza
                  <InfoTooltip
                    content="Certeza del análisis IA para esta dimensión (0-100%), según cantidad y calidad de fuentes."
                    placement="left"
                  />
                </span>
              </th>
              <th className="text-center py-2 px-3 font-semibold text-black-eske dark:text-[#EAF2F8]">
                <span className="inline-flex items-center justify-center gap-1">
                  Peso
                  <InfoTooltip
                    content="Importancia relativa asignada en la configuración de las variables. Dimensiones de mayor peso tienen más influencia en el score global."
                    placement="left"
                  />
                </span>
              </th>
              <th className="text-center py-2 px-3 font-semibold text-black-eske dark:text-[#EAF2F8]">
                <span className="inline-flex items-center justify-center gap-1">
                  Score
                  <InfoTooltip
                    content="Valor ponderado: clasificación × confianza × peso. Positivo = oportunidad, negativo = amenaza."
                    placement="left"
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...scorecard.dimensions]
              .sort((a, b) => DIMENSION_ORDER.indexOf(a.code) - DIMENSION_ORDER.indexOf(b.code))
              .map((ds) => {
              const dim = dimensions.find((d) => d.code === ds.code);
              if (!dim) return null;
              return (
                <tr
                  key={ds.code}
                  className="border-b border-gray-eske-10 dark:border-white/10 hover:bg-gray-eske-10/50 dark:hover:bg-white/5"
                >
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-black-eske dark:text-[#EAF2F8]">
                        <span className="w-6 h-6 rounded-full bg-bluegreen-eske text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {ds.code}
                        </span>
                        {DIMENSION_META[ds.code]?.label ?? ds.code}
                      </span>
                      <p className="text-[11px] text-black-eske-90 dark:text-[#9AAEBE] leading-snug pl-[30px]" title={dim.mainSignal}>
                        {dim.mainSignal}
                      </p>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <TrendBadge trend={dim.trend} />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        CLASSIFICATION_STYLES[dim.classification] ?? ""
                      }`}
                    >
                      {dim.classification}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-black-eske dark:text-[#C7D6E0]">
                    {dim.confidence}%
                  </td>
                  <td className="py-2.5 px-3 text-center text-black-eske dark:text-[#C7D6E0]">
                    {ds.dimWeight}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <ScoreBar score={ds.score} classification={dim.classification} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-eske-30 dark:border-white/10 bg-gray-eske-10 dark:bg-[#112230]">
              <td colSpan={6} className="py-3 px-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end sm:gap-4 gap-1">
                  <span className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] flex items-center gap-1">
                    Score global ponderado
                    <InfoTooltip
                      content="Promedio ponderado de los scores dimensionales. Escala bipolar: -100 (todas amenazas con 100% confianza) a +100 (todas oportunidades con 100% confianza). Neutro = 0."
                      placement="right"
                    />
                  </span>
                  <span
                    className={`text-2xl font-bold ${globalScoreColor(scorecard.globalScore)}`}
                  >
                    {scorecard.globalScore > 0 ? "+" : ""}{scorecard.globalScore}
                    <span className="text-sm font-normal text-black-eske dark:text-[#9AAEBE]">
                      {" "}/ ±100
                    </span>
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Mobile scroll hint */}
      <p className="text-[10px] text-black-eske-90 dark:text-[#C7D6E0] text-right mt-1 pr-1 sm:hidden">
        ← desliza para ver todas las columnas →
      </p>
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const map: Record<string, { label: string; color: string }> = {
    ASCENDENTE: { label: "↑ Asc.", color: "text-orange-eske" },
    DESCENDENTE: { label: "↓ Desc.", color: "text-bluegreen-eske" },
    ESTABLE: { label: "→ Estable", color: "text-black-eske dark:text-[#C7D6E0]" },
  };
  const entry = map[trend] ?? { label: trend, color: "text-black-eske dark:text-[#C7D6E0]" };
  return (
    <span className={`text-xs font-medium ${entry.color}`}>{entry.label}</span>
  );
}

function ScoreBar({
  score,
  classification,
}: {
  score: number;
  classification: string;
}) {
  const color =
    classification === "OPORTUNIDAD"
      ? "bg-green-eske"
      : classification === "AMENAZA"
      ? "bg-red-eske"
      : "bg-gray-eske-40";

  const displayWidth = Math.abs(score);
  const displayLabel = score > 0 ? `+${score}` : `${score}`;

  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-16 h-1.5 bg-gray-eske-20 dark:bg-[#21425E] rounded-full overflow-hidden">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${displayWidth}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-black-eske dark:text-[#C7D6E0] w-8 text-right">
        {displayLabel}
      </span>
    </div>
  );
}

function globalScoreColor(score: number): string {
  if (score >= 20) return "text-green-eske";
  if (score >= 0) return "text-orange-eske";
  return "text-red-eske";
}
