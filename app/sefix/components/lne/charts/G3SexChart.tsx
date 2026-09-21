"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Ambito, G3SexPoint } from "@/lib/sefix/seriesUtils";
import { useDarkMode } from "@/app/hooks/useDarkMode";

const FMT = new Intl.NumberFormat("es-MX");
const fmtM = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : FMT.format(v);

// Colores fidelizados al Shiny original — Nacional
const COLORS_NACIONAL = {
  padronMujeres: { light: "#C0306A", dark: "#E05585" },
  listaMujeres:  { light: "#8B1A3D", dark: "#C45070" },
  padronHombres: { light: "#003F8A", dark: "#4791B3" },
  listaHombres:  { light: "#001A5E", dark: "#6BA4C6" },
};
// Colores fidelizados al Shiny original — Extranjero
const COLORS_EXTRANJERO = {
  padronMujeres: { light: "#7206b4", dark: "#B05DD6" },
  listaMujeres:  { light: "#7f24f7", dark: "#B38EFA" },
  padronHombres: { light: "#0163a4", dark: "#4791B3" },
  listaHombres:  { light: "#1d7fe9", dark: "#6BA4C6" },
};

const LEGEND_LABELS: Record<string, string> = {
  padronMujeres: "Padrón Mujeres",
  listaMujeres:  "Lista Mujeres",
  padronHombres: "Padrón Hombres",
  listaHombres:  "Lista Hombres",
};

interface Props {
  data: G3SexPoint[];
  ambito?: Ambito;
  /** Dato NB del último corte semanal — fallback si historico no tiene NB */
  nbLatest?: { padron: number; lista: number } | null;
  /**
   * Serie NB anual completa desde el endpoint /api/sefix/nb-anual.
   * Cuando está presente, se usa como fuente principal de la tabla de desglose
   * (reemplaza los valores de padronNoBinario del raw que pueden ser 0 para
   * años sin columnas NB en serie_historico.csv).
   */
  nbAnnual?: { year: number; padron: number; lista: number }[] | null;
  /** Etiqueta de alcance para la card NB (ej. "JALISCO", "COLOTLAN", "Nacional") */
  nbScope?: string;
}

export default function G3SexChart({ data, ambito = "nacional", nbLatest, nbAnnual, nbScope = "Nacional" }: Props) {
  const isDark = useDarkMode();
  const palette = ambito === "extranjero" ? COLORS_EXTRANJERO : COLORS_NACIONAL;

  const C = {
    padronMujeres: isDark ? palette.padronMujeres.dark : palette.padronMujeres.light,
    listaMujeres:  isDark ? palette.listaMujeres.dark  : palette.listaMujeres.light,
    padronHombres: isDark ? palette.padronHombres.dark : palette.padronHombres.light,
    listaHombres:  isDark ? palette.listaHombres.dark  : palette.listaHombres.light,
  };

  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill   = isDark ? "#C7D6E0" : "var(--color-black-eske-10)";

  // latestYear = último año en la gráfica (refleja el selectedYear del usuario)
  const latestYear = data[data.length - 1]?.year ?? null;

  // Año más reciente en nbAnnual (sin filtrar por selectedYear).
  const nbAnnualMaxYear =
    nbAnnual && nbAnnual.length > 0 ? Math.max(...nbAnnual.map((r) => r.year)) : null;

  // Tabla de desglose — fuente preferida: nbAnnual del endpoint dedicado.
  const nbTableRows = (() => {
    let rows: { year: number; padron: number; lista: number }[];
    if (nbAnnual && nbAnnual.length > 0) {
      rows = nbAnnual
        .filter((r) => latestYear == null || r.year <= latestYear)
        .map((r) => ({ year: r.year, padron: r.padron, lista: r.lista }));
    } else {
      rows = data
        .filter((d) => d.padronNoBinario > 0)
        .map((d) => ({ year: d.year, padron: d.padronNoBinario, lista: d.listaNoBinario }));
    }

    const currentCalendarYear = new Date().getFullYear();
    const isAtFrontier = nbAnnualMaxYear != null
      ? latestYear != null && latestYear >= nbAnnualMaxYear
      : latestYear != null && latestYear >= currentCalendarYear;

    if (nbLatest && nbLatest.padron > 0 && latestYear && isAtFrontier) {
      if (!rows.some((r) => r.year === latestYear)) {
        rows.push({ year: latestYear, padron: nbLatest.padron, lista: nbLatest.lista });
      }
    }

    return rows.sort((a, b) => b.year - a.year);
  })();

  const hasNb = nbTableRows.length > 0;
  const nbDisplay = nbTableRows[0] ?? null;
  const [nbHovered, setNbHovered] = useState(false);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: tickFill }}
          />
          <YAxis
            tickFormatter={fmtM}
            tick={{ fontSize: 11, fill: tickFill }}
            width={56}
            domain={([dataMin, dataMax]: readonly [number, number]) => {
              const pad = (dataMax - dataMin) * 0.1;
              return [Math.round(dataMin - pad), Math.round(dataMax + pad * 0.3)] as [number, number];
            }}
          />
          {/* z-index alto para que el tooltip quede sobre la card NB */}
          <Tooltip
            formatter={(value, name) => [
              FMT.format(Number(value)),
              LEGEND_LABELS[String(name)] ?? String(name),
            ]}
            itemSorter={(item) => -(item.value as number)}
            labelStyle={{ color: "#2b2b2b" }}
            contentStyle={{
              fontSize: 12,
              borderColor: "var(--color-gray-eske-20)",
              borderRadius: 6,
            }}
            wrapperStyle={{ zIndex: 30 }}
          />
          <Legend
            formatter={(v) => LEGEND_LABELS[v] ?? v}
            wrapperStyle={{ fontSize: 12, color: isDark ? "#4791B3" : undefined }}
          />

          {/* Mujeres */}
          <Line
            type="linear"
            dataKey="padronMujeres"
            stroke={C.padronMujeres}
            strokeWidth={2}
            dot={{ r: 3, fill: C.padronMujeres }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="linear"
            dataKey="listaMujeres"
            stroke={C.listaMujeres}
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4 }}
          />

          {/* Hombres */}
          <Line
            type="linear"
            dataKey="padronHombres"
            stroke={C.padronHombres}
            strokeWidth={2}
            dot={{ r: 3, fill: C.padronHombres }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="linear"
            dataKey="listaHombres"
            stroke={C.listaHombres}
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Card No Binario — z-index bajo para que el tooltip Recharts quede encima */}
      {hasNb && nbDisplay && (
        <div
          className="absolute top-2 left-16"
          style={{ zIndex: 10 }}
          onMouseEnter={() => setNbHovered(true)}
          onMouseLeave={() => setNbHovered(false)}
        >
          {/* Card principal */}
          <div
            className="bg-white-eske dark:bg-[#18324A] border border-purple-300 dark:border-purple-800/50 rounded-md px-3 py-2 text-xs shadow-sm cursor-default"
            aria-label="Datos No Binario"
          >
            <p className="font-semibold text-purple-700 mb-0.5">⚧ No Binario</p>
            {nbDisplay && (
              <p className="text-black-eske-20 dark:text-[#9AAEBE] font-medium">{nbDisplay.year}</p>
            )}
            <p className="text-black-eske-20 dark:text-[#9AAEBE]">
              Padrón:{" "}
              <span className="font-medium text-black-eske dark:text-[#EAF2F8]">{FMT.format(nbDisplay.padron)}</span>
            </p>
            <p className="text-black-eske-20 dark:text-[#9AAEBE]">
              Lista:{" "}
              <span className="font-medium text-black-eske dark:text-[#EAF2F8]">{FMT.format(nbDisplay.lista)}</span>
            </p>
            {nbTableRows.length > 0 && (
              <p className="text-black-eske-40 dark:text-[#6D8294] mt-1 italic">(Ver desglose)</p>
            )}
          </div>

          {/* Popover de detalle — muestra evolución anual cuando hay datos históricos */}
          {nbHovered && nbTableRows.length > 0 && (
            <div
              className="absolute top-full left-0 mt-1 w-56 bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 rounded-md shadow-lg p-3 text-xs"
              style={{ zIndex: 40 }}
            >
              <p className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-2 border-b border-gray-eske-20 dark:border-white/10 pb-1">
                No Binario — {nbScope}
              </p>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-black-eske-20 dark:text-[#9AAEBE]">
                    <th className="pr-2 font-medium pb-1">Año</th>
                    <th className="pr-2 font-medium pb-1">Padrón</th>
                    <th className="font-medium pb-1">Lista</th>
                  </tr>
                </thead>
                <tbody>
                  {nbTableRows.map((r) => (
                    <tr key={r.year}>
                      <td className="pr-2 text-black-eske-20 dark:text-[#9AAEBE]">{r.year}</td>
                      <td className="pr-2 text-black-eske dark:text-[#C7D6E0]">{FMT.format(r.padron)}</td>
                      <td className="text-black-eske dark:text-[#C7D6E0]">{FMT.format(r.lista)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-black-eske-40 dark:text-[#6D8294] mt-2 italic leading-relaxed">
                Último corte de cada año disponible.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
