"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { Ambito, G1Data } from "@/lib/sefix/seriesUtils";
import { useDarkMode } from "@/app/hooks/useDarkMode";

const FMT = new Intl.NumberFormat("es-MX");
const fmt = (v: number) => FMT.format(v);
const fmtM = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : FMT.format(v);

const MESES_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

// Nacional: azul oscuro / rojo oscuro (R Shiny original)
const COLORS_NACIONAL = {
  padron:      { light: "#00304A", dark: "#4791B3" },
  lista:       { light: "#8B0000", dark: "#D16B6B" },
  padronName:  "Padrón Nacional",
  listaNombre: "Lista Nacional",
};
// Extranjero: morado / azul (R Shiny original)
const COLORS_EXTRANJERO = {
  padron:      { light: "#7206b4", dark: "#B05DD6" },
  lista:       { light: "#0163a4", dark: "#4791B3" },
  padronName:  "Padrón Extranjero",
  listaNombre: "Lista Extranjero",
};

interface Props {
  data: G1Data;
  ambito?: Ambito;
}


export default function G1TrendChart({ data, ambito = "nacional" }: Props) {
  const isDark = useDarkMode();
  const { actual, projected } = data;
  const palette = ambito === "extranjero" ? COLORS_EXTRANJERO : COLORS_NACIONAL;
  const padronColor = isDark ? palette.padron.dark : palette.padron.light;
  const listaColor  = isDark ? palette.lista.dark  : palette.lista.light;

  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill   = isDark ? "#C7D6E0" : "var(--color-black-eske-10)";

  // Mes actual para la línea de referencia "Hoy"
  const now = new Date();
  const mesHoyLabel = `${MESES_ES[now.getMonth()]} ${now.getFullYear()}`;

  // Dataset: datos reales + proyecciones sin repetir el último punto real.
  const merged: Record<string, string | number>[] = [];

  for (const p of actual) {
    merged.push({ name: p.label, lista: p.lista, padron: p.padron });
  }

  for (const p of projected) {
    merged.push({
      name: p.label,
      listaProyectada: p.lista,
      padronProyectado: p.padron,
    });
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={merged} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: tickFill }}
        />
        <YAxis
          tickFormatter={fmtM}
          tick={{ fontSize: 11, fill: tickFill }}
          width={56}
          domain={([dataMin, dataMax]: readonly [number, number]) => {
            const pad = (dataMax - dataMin) * 0.15;
            return [Math.round(dataMin - pad), Math.round(dataMax + pad * 0.3)] as [number, number];
          }}
        />
        <Tooltip
          content={({ payload, label }) => {
            if (!payload?.length) return null;
            const items = payload
              .filter((p) => p.value != null && Number(p.value) > 0)
              .sort((a, b) => Number(b.value) - Number(a.value));
            if (!items.length) return null;
            return (
              <div style={{
                fontSize: 12, background: "#fff", border: "1px solid var(--color-gray-eske-20)",
                borderRadius: 6, padding: "8px 12px",
              }}>
                <p style={{ fontSize: 11, color: "#2b2b2b", marginBottom: 4 }}>
                  {label}
                </p>
                {items.map((p) => (
                  <p key={String(p.dataKey)} style={{ color: p.color, margin: "2px 0" }}>
                    {String(p.name)}: <strong>{fmt(Number(p.value))}</strong>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: isDark ? "#4791B3" : undefined }}
        />

        {/* Línea vertical: mes actual */}
        <ReferenceLine
          x={mesHoyLabel}
          stroke="var(--color-black-eske-40)"
          strokeDasharray="4 2"
          label={{ value: "Hoy", position: "top", fontSize: 10, fill: isDark ? "#C7D6E0" : "var(--color-black-eske-20)" }}
        />

        {/* Datos reales */}
        <Line
          type="linear"
          dataKey="padron"
          name={palette.padronName}
          stroke={padronColor}
          strokeWidth={2}
          dot={{ r: 3, fill: padronColor }}
          activeDot={{ r: 4 }}
          connectNulls
        />
        <Line
          type="linear"
          dataKey="lista"
          name={palette.listaNombre}
          stroke={listaColor}
          strokeWidth={2}
          dot={{ r: 3, fill: listaColor }}
          activeDot={{ r: 4 }}
          connectNulls
        />

        {/* Proyecciones (punteadas) */}
        <Line
          type="linear"
          dataKey="padronProyectado"
          name="Proyección Padrón"
          stroke={padronColor}
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          connectNulls
        />
        <Line
          type="linear"
          dataKey="listaProyectada"
          name="Proyección Lista"
          stroke={listaColor}
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
