"use client";

import { Fragment, useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import {
  PARTIDOS_MAPPING,
  PARTIDO_LABELS,
  PARTY_COLORS,
  PARTY_COLORS_DARK,
  AVAILABLE_YEARS,
  CARGO_CSV_LABELS,
  CARGO_DISPLAY_LABELS,
  VALID_COMBINATIONS,
} from "@/lib/sefix/eleccionesConstants";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import type { EleccionesFilterParams, ResultadosChartData } from "@/types/sefix.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PARTIDOS = ["PAN", "PRI", "PRD", "PT", "PVEM", "MORENA", "MC", "vot_nul"];
const SOURCE = "Fuente: INE - Sistema de Consulta de la Estadística de las Elecciones Federales";
const FMT_PCT = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const LABEL_CLS = "text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE]";
const SELECT_CLS =
  "text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 " +
  "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske " +
  "w-full sm:w-auto";

// "Seleccionar todos" / "Borrar todos": neutral black/white
const BTN_NEUTRAL_CLS =
  "text-xs text-black-eske dark:text-[#EAF2F8] hover:text-black-eske-60 dark:hover:text-white/70 " +
  "underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black-eske rounded";

// "Restablecer": orange/red
const BTN_RESET_CLS =
  "text-xs text-orange-eske hover:text-orange-eske-60 underline " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-eske rounded";

// "Voto Extranjero" toggle — active (filled blue) / inactive (outlined blue in light, dim in dark)
const BTN_EXTRANJERO_ACTIVE =
  "text-xs rounded px-2 py-0.5 border transition-colors " +
  "bg-blue-eske text-white-eske border-blue-eske " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske";
// Light mode inactive: blue border + text (not filled); hover: fill blue.
// Dark mode inactive: dim text + subtle border; hover: blue border + text (no fill).
const BTN_EXTRANJERO_INACTIVE =
  "text-xs rounded px-2 py-0.5 border transition-colors " +
  "bg-transparent text-blue-eske border-blue-eske " +
  "hover:bg-blue-eske hover:text-white-eske hover:border-blue-eske " +
  "dark:bg-transparent dark:text-[#9AAEBE] dark:border-white/20 " +
  "dark:hover:bg-transparent dark:hover:border-blue-eske dark:hover:text-blue-eske " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske";

// Years that have ordinary elections (2023 only had extraordinary SEN)
const ORDINARIA_YEARS = AVAILABLE_YEARS.filter((y) => y !== 2023);

// Valid cargos for ordinary elections per year
// 2021/SEN was extraordinary only (Nayarit), so only DIP counts for ordinaria
const ORDINARIA_CARGOS: Record<string, string[]> = {
  ...VALID_COMBINATIONS,
  "2021": ["dip"],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalConfig {
  anio: number;
  cargo: string;
  partidos: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getColor(pid: string, dark: boolean): string {
  const palette = dark ? PARTY_COLORS_DARK : PARTY_COLORS;
  return (palette as Record<string, string>)[pid] ?? palette.DEFAULT;
}

function getPLabel(pid: string): string {
  return PARTIDO_LABELS[pid] ?? pid;
}

function buildDefault(committed: EleccionesFilterParams): LocalConfig {
  const available = PARTIDOS_MAPPING[`${committed.anio}_${committed.cargo}`] ?? [];
  const partidos = DEFAULT_PARTIDOS.filter((p) => available.includes(p));
  // Use ordinary-safe cargo (e.g. if committed is 2021/sen, fallback to dip)
  const validCargo = (ORDINARIA_CARGOS[String(committed.anio)] ?? []).includes(committed.cargo)
    ? committed.cargo
    : (ORDINARIA_CARGOS[String(committed.anio)] ?? [])[0] ?? committed.cargo;
  return {
    anio: committed.anio,
    cargo: validCargo,
    partidos: partidos.length ? partidos : DEFAULT_PARTIDOS,
  };
}

function buildGeoLabel(committed: EleccionesFilterParams): string {
  if (committed.estado === "VOTO EN EL EXTRANJERO") return "VOTO EN EL EXTRANJERO";
  const parts: string[] = [];
  if (committed.estado) parts.push(committed.estado);
  if (committed.cabecera) parts.push(`Dist. ${committed.cabecera}`);
  if (committed.municipio) parts.push(committed.municipio);
  if (committed.secciones.length === 1) parts.push(`Secc. ${committed.secciones[0]}`);
  else if (committed.secciones.length > 1) parts.push(`${committed.secciones.length} secciones`);
  return parts.length ? parts.join(" — ") : "Nacional";
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useHistoricoPartidosData(
  committed: EleccionesFilterParams,
  localCargo: string,
  localMaxAnio: number,
  version: number,
  showExtranjero: boolean
): { data: ResultadosChartData[]; isLoading: boolean } {
  const [data, setData] = useState<ResultadosChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    setIsLoading(true);

    const sp = new URLSearchParams({ cargo: localCargo, all_years: "true", tipo: "ORDINARIA" });
    if (showExtranjero) {
      sp.set("estado", "VOTO EN EL EXTRANJERO");
    } else {
      if (committed.estado) sp.set("estado", committed.estado);
      if (committed.cabecera) sp.set("cabecera", committed.cabecera);
      if (committed.municipio) sp.set("municipio", committed.municipio);
      if (committed.secciones.length) sp.set("secciones", committed.secciones.join(","));
      if (!committed.incluirExtranjero) sp.set("incluirExtranjero", "false");
    }

    fetch(`/api/sefix/resultados?${sp}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelRef.current) {
          const filtered = ((d.resultados ?? []) as ResultadosChartData[])
            .filter((r) => r.anio <= localMaxAnio)
            .filter((r) => r.partidos && r.partidos.some((p) => p.votos > 0))
            .sort((a, b) => a.anio - b.anio);
          setData(filtered);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelRef.current) {
          setData([]);
          setIsLoading(false);
        }
      });

    return () => {
      cancelRef.current = true;
    };
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  committed: EleccionesFilterParams;
  queryVersion: number;
}

export default function HistoricoPartidos({ committed, queryVersion }: Props) {
  const isDark = useDarkMode();

  const [pending, setPending] = useState<LocalConfig>(() => buildDefault(committed));
  const [local, setLocal] = useState<LocalConfig>(() => buildDefault(committed));
  const [version, setVersion] = useState(1);
  const [showExtranjero, setShowExtranjero] = useState(false);

  // Re-initialize when the parent committed state changes
  useEffect(() => {
    if (queryVersion === 0) return;
    const next = buildDefault(committed);
    setPending(next);
    setLocal(next);
    setShowExtranjero(false);
    setVersion((v) => v + 1);
  }, [queryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-adjust cargo when year changes and current cargo has no ordinary election
  useEffect(() => {
    const validCargos = ORDINARIA_CARGOS[String(pending.anio)] ?? [];
    if (!validCargos.includes(pending.cargo) && validCargos.length > 0) {
      setPending((prev) => ({ ...prev, cargo: validCargos[0] }));
    }
  }, [pending.anio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset extranjero toggle when cargo changes to "dip" (extranjero not applicable for DIP)
  useEffect(() => {
    if (pending.cargo === "dip") setShowExtranjero(false);
  }, [pending.cargo]);

  // Available parties for the pending year + cargo
  const availablePartidos = useMemo(
    () => PARTIDOS_MAPPING[`${pending.anio}_${pending.cargo}`] ?? [],
    [pending.anio, pending.cargo]
  );

  // When year or cargo changes, keep only parties that still exist
  useEffect(() => {
    setPending((prev) => ({
      ...prev,
      partidos: prev.partidos.filter((p) => availablePartidos.includes(p)),
    }));
  }, [availablePartidos]);

  const hasPending = useMemo(() => {
    const sortP = [...pending.partidos].sort().join(",");
    const sortL = [...local.partidos].sort().join(",");
    return pending.anio !== local.anio || pending.cargo !== local.cargo || sortP !== sortL;
  }, [pending, local]);

  const handleConsultar = useCallback(() => {
    setLocal({ ...pending });
    setVersion((v) => v + 1);
  }, [pending]);

  const handleRestablecer = useCallback(() => {
    const next = buildDefault(committed);
    setPending(next);
    setLocal(next);
    setVersion((v) => v + 1);
  }, [committed]);

  const togglePartido = useCallback((pid: string) => {
    setPending((prev) => ({
      ...prev,
      partidos: prev.partidos.includes(pid)
        ? prev.partidos.filter((p) => p !== pid)
        : [...prev.partidos, pid],
    }));
  }, []);

  const handleSelectAll = useCallback(() => {
    setPending((prev) => ({ ...prev, partidos: [...availablePartidos] }));
  }, [availablePartidos]);

  const handleClearAll = useCallback(() => {
    setPending((prev) => ({ ...prev, partidos: [] }));
  }, []);

  // Fetch all-years data for the local (committed) config
  const { data: allData, isLoading } = useHistoricoPartidosData(
    committed,
    local.cargo,
    local.anio,
    version,
    showExtranjero
  );

  // Collapsible table: expanded years set; default = only most recent year open
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (allData.length > 0) {
      setExpandedYears(new Set([allData[allData.length - 1].anio]));
    }
  }, [allData]);

  const toggleYear = useCallback((anio: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(anio)) next.delete(anio);
      else next.add(anio);
      return next;
    });
  }, []);

  // Build chart points: one row per year, one key per selected partido (null = no data that year)
  const chartData = useMemo(() => {
    return allData.map((d) => {
      const point: Record<string, number | null> = { anio: d.anio };
      for (const pid of local.partidos) {
        const match = d.partidos.find((p) => p.partido === pid);
        point[pid] = match != null ? match.porcentaje : null;
      }
      return point;
    });
  }, [allData, local.partidos]);

  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill = isDark ? "#C7D6E0" : "var(--color-black-eske-60)";
  const tooltipBorder = isDark ? "#2a4255" : "var(--color-gray-eske-20)";

  const scopeAnios =
    allData.length >= 2
      ? `${allData[0].anio} – ${allData[allData.length - 1].anio}`
      : allData.length === 1
        ? String(allData[0].anio)
        : "";

  const scopeSubtitle = useMemo(() => {
    const cargoLabel = CARGO_DISPLAY_LABELS[local.cargo] ?? local.cargo;
    const geo = showExtranjero ? "VOTO EN EL EXTRANJERO" : buildGeoLabel(committed);
    return `${cargoLabel} — ${geo}${scopeAnios ? ` (${scopeAnios})` : ""}`;
  }, [committed, local.cargo, scopeAnios, showExtranjero]);

  // Valid cargos for ordinary elections in the pending year
  const validCargos = useMemo(
    () => ORDINARIA_CARGOS[String(pending.anio)] ?? [],
    [pending.anio]
  );

  // CSV download — all data regardless of collapsed state
  const handleDownloadCsv = useCallback(() => {
    const rows: string[] = ["Año,Clave,Partido / Candidatura,% Votos"];
    [...allData].reverse().forEach((d) => {
      [...d.partidos]
        .sort((a, b) => b.porcentaje - a.porcentaje)
        .forEach((p) => {
          rows.push(`${d.anio},${p.partido},"${getPLabel(p.partido)}",${FMT_PCT.format(p.porcentaje)}`);
        });
    });
    const csv = rows.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico-partidos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [allData]);

  return (
    <div className="space-y-4">

      {/* ── Section heading ── */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-center text-black-eske-60 dark:text-[#9AAEBE]">
        Histórico de votación
      </h2>

      {/* ── Controls ── */}
      <div className="p-3 bg-gray-eske-10 dark:bg-[#0D1E2C] rounded-lg border border-gray-eske-20 dark:border-white/10 space-y-3">

        {/* Row 1: Selectors + Consultar (left) — Seleccionar/Borrar/Restablecer (right) */}
        <div className="flex flex-wrap gap-3 items-end justify-between">

          {/* Left: Hasta el año + Cargo + Consultar */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="hp-anio" className={LABEL_CLS}>Hasta el año</label>
              <select
                id="hp-anio"
                value={pending.anio}
                onChange={(e) => setPending((prev) => ({ ...prev, anio: parseInt(e.target.value) }))}
                className={SELECT_CLS}
              >
                {ORDINARIA_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="hp-cargo" className={LABEL_CLS}>Cargo</label>
              <select
                id="hp-cargo"
                value={pending.cargo}
                onChange={(e) => setPending((prev) => ({ ...prev, cargo: e.target.value }))}
                className={SELECT_CLS}
              >
                {Object.entries(CARGO_CSV_LABELS)
                  .filter(([key]) => validCargos.includes(key))
                  .map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
              </select>
            </div>

            {hasPending && (
              <button
                type="button"
                onClick={handleConsultar}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-eske text-white-eske hover:bg-blue-eske-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske self-end"
                aria-label="Aplicar configuración de la gráfica"
              >
                Consultar
              </button>
            )}
          </div>

          {/* Right: Seleccionar todos + Borrar todos + Restablecer + Voto Extranjero */}
          <div className="flex gap-3 items-end flex-wrap">
            <button
              type="button"
              onClick={handleSelectAll}
              className={BTN_NEUTRAL_CLS}
              aria-label="Seleccionar todos los partidos"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className={BTN_NEUTRAL_CLS}
              aria-label="Deseleccionar todos los partidos"
            >
              Borrar todos
            </button>
            <button
              type="button"
              onClick={handleRestablecer}
              className={BTN_RESET_CLS}
              aria-label="Restablecer configuración por defecto"
            >
              Restablecer
            </button>
            {pending.cargo !== "dip" && (
              <button
                type="button"
                onClick={() => { setShowExtranjero((v) => !v); setVersion((v) => v + 1); }}
                aria-pressed={showExtranjero}
                aria-label="Ver histórico de Voto en el Extranjero"
                className={showExtranjero ? BTN_EXTRANJERO_ACTIVE : BTN_EXTRANJERO_INACTIVE}
              >
                Voto Extranjero
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Partido checkboxes */}
        {availablePartidos.length > 0 && (
          <div>
            <p className={LABEL_CLS + " mb-1.5"}>Partidos, candidaturas y coaliciones</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-1.5">
              {availablePartidos.map((pid) => {
                const checked = pending.partidos.includes(pid);
                const color = getColor(pid, isDark);
                return (
                  <label
                    key={pid}
                    className={`flex items-center gap-1.5 text-xs cursor-pointer select-none ${
                      checked
                        ? "text-black-eske dark:text-[#EAF2F8]"
                        : "text-black-eske-60/60 dark:text-[#6D8294]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePartido(pid)}
                      className="shrink-0 accent-blue-eske"
                      aria-label={`Incluir ${getPLabel(pid)} en la gráfica`}
                    />
                    <span
                      className="shrink-0 w-2.5 h-2.5 rounded-sm border border-black/10 dark:border-white/10"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{getPLabel(pid)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      <div>
        <div className="mb-3 text-center">
          <h3 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">
            Histórico de votación por partido, candidatura o coalición
          </h3>
          {scopeSubtitle && (
            <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">{scopeSubtitle}</p>
          )}
        </div>

        {isLoading ? (
          <div
            className="w-full flex flex-col items-center justify-center gap-3 rounded-lg bg-gray-eske-10 dark:bg-white/10"
            style={{ height: 320 }}
          >
            <div
              className="w-8 h-8 border-4 border-gray-eske-20 border-t-blue-eske rounded-full animate-spin"
              aria-hidden="true"
            />
            <p className="text-xs text-black-eske-60 dark:text-[#6D8294]">Cargando…</p>
          </div>
        ) : chartData.length === 0 || local.partidos.length === 0 ? (
          <p className="text-sm text-black-eske-60 dark:text-[#6D8294] text-center py-8">
            {local.partidos.length === 0
              ? "Selecciona al menos un partido para visualizar la gráfica."
              : "Sin datos para la configuración seleccionada."}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 8, right: 20, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="anio"
                tick={{ fontSize: 11, fill: tickFill }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 10, fill: tickFill }}
                tickLine={false}
                axisLine={false}
                width={44}
                domain={[0, "auto"]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const sorted = [...payload]
                    .filter((p) => p.value != null)
                    .sort((a, b) => Number(b.value) - Number(a.value));
                  if (!sorted.length) return null;
                  return (
                    <div
                      style={{
                        fontSize: 12,
                        borderRadius: 6,
                        border: `1px solid ${tooltipBorder}`,
                        backgroundColor: isDark ? "#112230" : "#ffffff",
                        color: isDark ? "#EAF2F8" : "#2b2b2b",
                        padding: "8px 10px",
                        maxWidth: 220,
                      }}
                    >
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>Año {String(label ?? "")}</p>
                      {sorted.map((p) => (
                        <div
                          key={String(p.dataKey)}
                          style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              backgroundColor: p.color,
                              flexShrink: 0,
                            }}
                          />
                          <span>
                            {getPLabel(String(p.dataKey ?? ""))}: {FMT_PCT.format(Number(p.value))}%
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(name) => getPLabel(name as string)}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              {local.partidos.map((pid) => (
                <Line
                  key={pid}
                  type="monotone"
                  dataKey={pid}
                  name={pid}
                  stroke={getColor(pid, isDark)}
                  strokeWidth={2}
                  dot={{ r: 3, fill: getColor(pid, isDark) }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] mt-2 text-center">
          {SOURCE}
        </p>
      </div>

      {/* ── Inline data table — collapsible year sections ── */}
      {!isLoading && allData.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-center">
            <h3 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">
              Tabla de Datos de Histórico de Votación por partido, candidatura o coalición
            </h3>
            {scopeSubtitle && (
              <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">{scopeSubtitle}</p>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-eske-20 dark:border-white/10">
            <table className="w-full text-xs min-w-max">
              <thead className="bg-bluegreen-eske text-white-eske">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Clave</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Partido / Candidatura</th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">% Votos</th>
                </tr>
              </thead>
              <tbody>
                {[...allData].reverse().map((yearData) => {
                  const isExpanded = expandedYears.has(yearData.anio);
                  return (
                    <Fragment key={yearData.anio}>
                      {/* Year section header — clickable */}
                      <tr
                        onClick={() => toggleYear(yearData.anio)}
                        className="cursor-pointer select-none"
                        aria-expanded={isExpanded}
                      >
                        <td
                          colSpan={3}
                          className="px-3 py-2 font-semibold text-white-eske bg-bluegreen-eske/70 dark:bg-bluegreen-eske/50 hover:bg-bluegreen-eske/90 dark:hover:bg-bluegreen-eske/70 transition-colors"
                        >
                          <span aria-hidden="true" className="mr-2 text-[10px]">
                            {isExpanded ? "▾" : "▸"}
                          </span>
                          {yearData.anio}
                        </td>
                      </tr>
                      {/* Party rows — only shown when expanded */}
                      {isExpanded &&
                        [...yearData.partidos]
                          .sort((a, b) => b.porcentaje - a.porcentaje)
                          .map((p, i) => {
                            const rowBg = i % 2 === 0
                              ? "bg-white-eske dark:bg-[#18324A]"
                              : "bg-gray-eske-10 dark:bg-[#21425E]";
                            return (
                              <tr
                                key={`${yearData.anio}-${p.partido}`}
                                className={`border-t border-gray-eske-10 dark:border-white/5 ${rowBg} hover:bg-blue-eske-10 dark:hover:bg-white/5`}
                              >
                                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-black-eske-60 dark:text-[#9AAEBE]">
                                  {p.partido}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-black-eske dark:text-[#C7D6E0]">
                                  <span
                                    className="inline-block w-2 h-2 rounded-sm mr-1.5 border border-black/10 dark:border-white/10 shrink-0 align-middle"
                                    style={{ backgroundColor: getColor(p.partido, isDark) }}
                                    aria-hidden="true"
                                  />
                                  {getPLabel(p.partido)}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-right text-black-eske dark:text-[#C7D6E0]">
                                  {FMT_PCT.format(p.porcentaje)}%
                                </td>
                              </tr>
                            );
                          })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center gap-2 pt-1">
            <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] text-center">{SOURCE}</p>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={allData.length === 0}
              aria-label="Descargar datos históricos por partido en formato CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                         bg-bluegreen-eske text-white-eske hover:bg-bluegreen-eske-40
                         disabled:opacity-40 disabled:cursor-not-allowed
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
            >
              <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
