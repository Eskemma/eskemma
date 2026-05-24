"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ResultadosChartData } from "@/types/sefix.types";
import { useDarkMode } from "@/app/hooks/useDarkMode";

const FMT_PCT = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface HistoricoComparisonProps {
  data: ResultadosChartData[];
}

export default function HistoricoComparison({ data }: HistoricoComparisonProps) {
  const isDark = useDarkMode();
  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill   = isDark ? "#C7D6E0" : "var(--color-black-eske-10)";

  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    anio: d.anio,
    participacion: d.participacion,
    totalVotos: d.totalVotos,
    distritoRedistritado: d.distritoRedistritado,
    redistritadoScope: d.redistritadoScope,
  }));

  const validData = chartData.filter((d) => d.participacion > 0);
  const avg =
    validData.length > 0
      ? validData.reduce((s, d) => s + d.participacion, 0) / validData.length
      : 0;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 20, left: 8, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridStroke}
        />
        <XAxis
          dataKey="anio"
          tick={{ fontSize: 11, fill: tickFill }}
        />
        <YAxis
          tickFormatter={(v) => `${FMT_PCT.format(v)}%`}
          tick={{ fontSize: 10, fill: tickFill }}
          domain={["auto", "auto"]}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const pt = payload[0];
            const pct = Number(pt.value);
            const { distritoRedistritado: redistritado, redistritadoScope: scope } =
              pt.payload as { distritoRedistritado?: string; redistritadoScope?: string };
            const borderColor = isDark ? "#2a4255" : "var(--color-gray-eske-20)";
            return (
              <div style={{
                fontSize: 12, borderRadius: 6, padding: "8px 10px",
                border: `1px solid ${borderColor}`,
                backgroundColor: isDark ? "#112230" : "#ffffff",
                color: isDark ? "#EAF2F8" : "#2b2b2b",
                maxWidth: 260,
              }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Año {String(label ?? "")}</p>
                <p>Participación: {FMT_PCT.format(pct)}%</p>
                {redistritado && (
                  <p style={{
                    marginTop: 6, fontSize: 11,
                    color: isDark ? "#F4A636" : "var(--color-orange-eske)",
                    borderTop: `1px solid ${borderColor}`,
                    paddingTop: 5,
                  }}>
                    ⚠ En {String(label)},{" "}
                    {scope === "secciones"
                      ? "las secciones seleccionadas pertenecieron"
                      : "este municipio perteneció"}{" "}
                    al Dist. {redistritado}
                  </p>
                )}
              </div>
            );
          }}
        />
        <ReferenceLine
          y={avg}
          stroke="var(--color-orange-eske)"
          strokeDasharray="4 3"
          label={{
            value: `Prom. ${FMT_PCT.format(avg)}%`,
            position: "insideTopRight",
            fontSize: 10,
            fill: "var(--color-orange-eske)",
          }}
        />
        <Line
          type="monotone"
          dataKey="participacion"
          stroke="var(--color-blue-eske)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-blue-eske)" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
