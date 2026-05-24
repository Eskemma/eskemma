"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { PARTY_COLORS_LOC, getPartidoLabelLoc } from "@/lib/sefix/eleccionesLocalesConstants";
import type { ResultadosEleccionesData } from "@/types/sefix.types";
import { useDarkMode } from "@/app/hooks/useDarkMode";

const FMT = new Intl.NumberFormat("es-MX");
const FMT_PCT = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function isLightColor(hex: string): boolean {
  if (!hex.startsWith("#") || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

interface ChartRow { key: string; name: string; votos: number; porcentaje: number }

interface TooltipEntry {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}

function PartidoTooltip({
  active, payload, getColor,
}: TooltipEntry & { getColor: (k: string) => string }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  const bg = getColor(entry.key);
  const textColor = isLightColor(bg) ? "#2b2b2b" : "#ffffff";
  return (
    <div style={{ background: bg, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: textColor }}>
      <p style={{ fontWeight: 600 }}>{entry.name}</p>
      <p>{FMT.format(entry.votos)} votos ({FMT_PCT.format(entry.porcentaje)}%)</p>
    </div>
  );
}

export default function PartidosBarChartLoc({ data }: { data: ResultadosEleccionesData }) {
  const isDark = useDarkMode();
  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill = isDark ? "#C7D6E0" : "var(--color-black-eske-10)";

  function getColor(partido: string) {
    return PARTY_COLORS_LOC[partido] ?? PARTY_COLORS_LOC["DEFAULT"] ?? "#90A4AE";
  }

  const chartData: ChartRow[] = data.partidos.map((p) => ({
    key: p.partido,
    name: getPartidoLabelLoc(p.partido),
    votos: p.votos,
    porcentaje: p.porcentaje,
  }));

  const maxLabelLen = Math.max(...chartData.map((d) => d.name.length));
  const yAxisWidth = Math.max(60, Math.min(maxLabelLen * 6.5, 140));
  const height = Math.max(300, chartData.length * 28 + 60);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 72, left: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) =>
            v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
            : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
            : String(v)
          }
          tick={{ fontSize: 10, fill: tickFill }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={yAxisWidth}
          tick={{ fontSize: 10, fill: tickFill }}
        />
        <Tooltip
          cursor={false}
          content={(props) => (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <PartidoTooltip {...(props as any)} getColor={getColor} />
          )}
        />
        <Bar
          dataKey="votos"
          radius={[0, 4, 4, 0]}
          cursor="default"
          label={{
            position: "right",
            fontSize: 10,
            fill: tickFill,
            formatter: (v: unknown) =>
              `${FMT_PCT.format(chartData.find((d) => d.votos === Number(v))?.porcentaje ?? 0)}%`,
          }}
        >
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={getColor(entry.key)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
