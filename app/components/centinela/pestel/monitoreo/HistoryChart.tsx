// app/components/centinela/pestel/monitoreo/HistoryChart.tsx
// SVG line chart showing globalConfidence trend across analysis versions.

interface HistoryEntry {
  id: string;
  version: number;
  globalConfidence: number;
  analyzedAt: string;
}

interface Props {
  history: HistoryEntry[];
}

const CHART_WIDTH = 600; // viewBox units
const CHART_HEIGHT = 100;
const PADDING = { top: 12, right: 20, bottom: 24, left: 36 };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export default function HistoryChart({ history }: Props) {
  if (!history || history.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-black-eske dark:text-[#9AAEBE] text-center px-4">
        Se necesitan al menos 2 análisis para mostrar la tendencia de confianza.
      </div>
    );
  }

  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const values = history.map((h) => h.globalConfidence);
  const minVal = Math.max(0, Math.min(...values) - 10);
  const maxVal = Math.min(100, Math.max(...values) + 10);
  const range = maxVal - minVal || 1;

  function toX(i: number): number {
    return PADDING.left + (i / (history.length - 1)) * innerW;
  }

  function toY(val: number): number {
    return PADDING.top + innerH - ((val - minVal) / range) * innerH;
  }

  const points = history.map((h, i) => ({ x: toX(i), y: toY(h.globalConfidence), ...h }));
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Y axis reference lines at minVal, midpoint, maxVal
  const yLabels = [
    { val: maxVal, y: PADDING.top },
    { val: Math.round((minVal + maxVal) / 2), y: PADDING.top + innerH / 2 },
    { val: minVal, y: PADDING.top + innerH },
  ];

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full"
      style={{ height: 120 }}
      aria-label="Tendencia de confianza global"
      role="img"
    >
      {/* Y axis grid lines */}
      {yLabels.map(({ val, y }) => (
        <g key={val}>
          <line
            x1={PADDING.left}
            y1={y}
            x2={CHART_WIDTH - PADDING.right}
            y2={y}
            className="stroke-gray-eske-20 dark:stroke-white/10"
            strokeWidth={0.5}
          />
          <text
            x={PADDING.left - 4}
            y={y}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={9}
            className="fill-black-eske dark:fill-[#9AAEBE]"
          >
            {val}
          </text>
        </g>
      ))}

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#0D9488"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Points */}
      {points.map((p) => (
        <g key={p.id}>
          <circle
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#0D9488"
            className="stroke-white dark:stroke-[#18324A]"
            strokeWidth={1.5}
          />
          <title>
            v{p.version}: {p.globalConfidence}% — {formatDate(p.analyzedAt)}
          </title>
        </g>
      ))}

      {/* X axis version labels (show first, last, and one in middle) */}
      {[0, Math.floor((history.length - 1) / 2), history.length - 1]
        .filter((i, idx, arr) => arr.indexOf(i) === idx)
        .map((i) => (
          <text
            key={i}
            x={toX(i)}
            y={CHART_HEIGHT - 4}
            textAnchor="middle"
            fontSize={9}
            className="fill-black-eske dark:fill-[#9AAEBE]"
          >
            v{history[i].version}
          </text>
        ))}
    </svg>
  );
}
