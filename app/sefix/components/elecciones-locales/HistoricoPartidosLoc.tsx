"use client";
import { Fragment, useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  PARTY_COLORS_LOC,
  PARTY_COLORS_DARK_LOC,
  CARGO_DISPLAY_LABELS_LOC,
  getPartidoLabelLoc,
} from "@/lib/sefix/eleccionesLocalesConstants";
import { useLocalesAvailablePartidos } from "@/app/sefix/hooks/useEleccionesLocalesFilters";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import type { EleccionesLocalesFilterParams, ResultadosEleccionesData } from "@/types/sefix.types";

const DEFAULT_PARTIDOS = ["PAN", "PRI", "PRD", "MORENA", "MC", "PVEM", "PT", "vot_nul"];
const SOURCE = "Fuente: INE — Sistema de Consulta de la Estadística de las Elecciones Locales";
const FMT_PCT = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LABEL_CLS = "text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE]";
const SELECT_CLS =
  "text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 " +
  "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske w-full sm:w-auto";
const BTN_NEUTRAL_CLS =
  "text-xs text-black-eske dark:text-[#EAF2F8] hover:text-black-eske-60 dark:hover:text-white/70 " +
  "underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black-eske rounded";
const BTN_RESET_CLS =
  "text-xs text-orange-eske hover:text-orange-eske-60 underline " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-eske rounded";

function getColor(pid: string, dark: boolean): string {
  const palette = dark ? PARTY_COLORS_DARK_LOC : PARTY_COLORS_LOC;
  return palette[pid] ?? palette["DEFAULT"] ?? "#90A4AE";
}

interface LocalConfig { anio: number; cargo: string; partidos: string[] }

function buildDefault(committed: EleccionesLocalesFilterParams): LocalConfig {
  return {
    anio: committed.anio,
    cargo: committed.cargo,
    partidos: DEFAULT_PARTIDOS.slice(0, 5),
  };
}

function buildGeoLabel(c: EleccionesLocalesFilterParams): string {
  const parts: string[] = [c.estado];
  if (c.cabecera) parts.push(`Dist. ${c.cabecera}`);
  if (c.municipio) parts.push(c.municipio);
  if (c.secciones.length === 1) parts.push(`Secc. ${c.secciones[0]}`);
  else if (c.secciones.length > 1) parts.push(`${c.secciones.length} secciones`);
  return parts.join(" — ");
}

function useHistoricoLocData(
  committed: EleccionesLocalesFilterParams,
  localCargo: string,
  localMaxAnio: number,
  version: number
): { data: ResultadosEleccionesData[]; isLoading: boolean } {
  const [data, setData] = useState<ResultadosEleccionesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    setIsLoading(true);
    const sp = new URLSearchParams({
      estado: committed.estado,
      cargo: localCargo,
      all_years: "true",
      tipo: "ORDINARIA",
    });
    if (committed.cabecera) sp.set("cabecera", committed.cabecera);
    if (committed.municipio) sp.set("municipio", committed.municipio);
    if (committed.secciones.length) sp.set("secciones", committed.secciones.join(","));

    fetch(`/api/sefix/elecciones-locales-resultados?${sp}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelRef.current) {
          const filtered = ((d.resultados ?? []) as ResultadosEleccionesData[])
            .filter((r) => r.anio <= localMaxAnio)
            .filter((r) => r.partidos?.some((p) => p.votos > 0))
            .sort((a, b) => a.anio - b.anio);
          setData(filtered);
          setIsLoading(false);
        }
      })
      .catch(() => { if (!cancelRef.current) { setData([]); setIsLoading(false); } });
    return () => { cancelRef.current = true; };
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading };
}

interface Props {
  committed: EleccionesLocalesFilterParams;
  queryVersion: number;
  cargosDisponibles: string[];
  availableYears: number[];
}

export default function HistoricoPartidosLoc({
  committed, queryVersion, cargosDisponibles, availableYears,
}: Props) {
  const isDark = useDarkMode();
  const [pending, setPending] = useState<LocalConfig>(() => buildDefault(committed));
  const [local, setLocal] = useState<LocalConfig>(() => buildDefault(committed));
  const [version, setVersion] = useState(1);

  useEffect(() => {
    if (queryVersion === 0) return;
    const next = buildDefault(committed);
    setPending(next); setLocal(next);
    setVersion((v) => v + 1);
  }, [queryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync "Hasta el año" to max available when availableYears grows
  useEffect(() => {
    if (availableYears.length === 0) return;
    const maxYear = availableYears[availableYears.length - 1];
    setLocal((prev) => {
      if (maxYear <= prev.anio) return prev;
      return { ...prev, anio: maxYear };
    });
    setPending((prev) => {
      if (maxYear <= prev.anio) return prev;
      return { ...prev, anio: maxYear };
    });
    setVersion((v) => v + 1);
  }, [availableYears]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: allData, isLoading } = useHistoricoLocData(committed, local.cargo, local.anio, version);

  // Available parties keyed by pending year+cargo — updates immediately when user changes config.
  const { partidos: rawPartidos } = useLocalesAvailablePartidos(
    pending.anio, pending.cargo, committed.estado
  );
  const availablePartidos = useMemo(() => [
    ...DEFAULT_PARTIDOS.filter((p) => rawPartidos.includes(p)),
    ...rawPartidos.filter((p) => !DEFAULT_PARTIDOS.includes(p)),
  ], [rawPartidos]);

  // When available parties change, keep valid selections or reset to defaults.
  useEffect(() => {
    if (availablePartidos.length === 0) return;
    setPending((prev) => {
      const valid = prev.partidos.filter((p) => availablePartidos.includes(p));
      if (valid.length > 0) return { ...prev, partidos: valid };
      const defaults = DEFAULT_PARTIDOS.filter((p) => availablePartidos.includes(p));
      return { ...prev, partidos: defaults.length > 0 ? defaults : availablePartidos.slice(0, 8) };
    });
  }, [availablePartidos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-adjust cargo if current cargo not available for the pending year
  useEffect(() => {
    if (cargosDisponibles.length === 0) return;
    if (cargosDisponibles.includes(pending.cargo)) return;
    setPending((prev) => ({ ...prev, cargo: cargosDisponibles[0] }));
  }, [pending.anio, cargosDisponibles]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPending = useMemo(() => {
    const sortP = [...pending.partidos].sort().join(",");
    const sortL = [...local.partidos].sort().join(",");
    return pending.anio !== local.anio || pending.cargo !== local.cargo || sortP !== sortL;
  }, [pending, local]);

  const handleConsultar = useCallback(() => {
    setLocal({ ...pending }); setVersion((v) => v + 1);
  }, [pending]);

  const handleRestablecer = useCallback(() => {
    const next = buildDefault(committed);
    setPending(next); setLocal(next); setVersion((v) => v + 1);
  }, [committed]);

  const togglePartido = useCallback((pid: string) => {
    setPending((prev) => ({
      ...prev,
      partidos: prev.partidos.includes(pid)
        ? prev.partidos.filter((p) => p !== pid)
        : [...prev.partidos, pid],
    }));
  }, []);

  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (allData.length > 0) setExpandedYears(new Set([allData[allData.length - 1].anio]));
  }, [allData]);
  const toggleYear = useCallback((anio: number) => {
    setExpandedYears((prev) => { const n = new Set(prev); n.has(anio) ? n.delete(anio) : n.add(anio); return n; });
  }, []);

  const chartData = useMemo(() => allData.map((d) => {
    const point: Record<string, number | null> = { anio: d.anio };
    for (const pid of local.partidos) {
      const match = d.partidos.find((p) => p.partido === pid);
      point[pid] = match != null ? match.porcentaje : null;
    }
    return point;
  }), [allData, local.partidos]);

  const scopeSubtitle = useMemo(() => {
    const anios = allData.length >= 2
      ? `${allData[0].anio} – ${allData[allData.length - 1].anio}`
      : allData.length === 1 ? String(allData[0].anio) : "";
    return `${CARGO_DISPLAY_LABELS_LOC[local.cargo] ?? local.cargo} — ${buildGeoLabel(committed)}${anios ? ` (${anios})` : ""}`;
  }, [committed, local.cargo, allData]);

  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill = isDark ? "#C7D6E0" : "var(--color-black-eske-60)";
  const tooltipBorder = isDark ? "#2a4255" : "var(--color-gray-eske-20)";

  const handleDownloadCsv = useCallback(() => {
    const rows = ["Año,Clave,Partido / Candidatura,% Votos"];
    [...allData].reverse().forEach((d) => {
      [...d.partidos].sort((a, b) => b.porcentaje - a.porcentaje).forEach((p) => {
        rows.push(`${d.anio},${p.partido},"${getPartidoLabelLoc(p.partido)}",${FMT_PCT.format(p.porcentaje)}`);
      });
    });
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "historico-partidos-local.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [allData]);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-center text-black-eske-60 dark:text-[#9AAEBE]">
        Histórico de votación
      </h2>

      {/* Controls */}
      <div className="p-3 bg-gray-eske-10 dark:bg-[#0D1E2C] rounded-lg border border-gray-eske-20 dark:border-white/10 space-y-3">
        <div className="flex flex-wrap gap-3 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="hpl-anio" className={LABEL_CLS}>Hasta el año</label>
              <select
                id="hpl-anio"
                value={pending.anio}
                onChange={(e) => setPending((prev) => ({ ...prev, anio: parseInt(e.target.value) }))}
                className={SELECT_CLS}
              >
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="hpl-cargo" className={LABEL_CLS}>Cargo</label>
              <select
                id="hpl-cargo"
                value={pending.cargo}
                onChange={(e) => setPending((prev) => ({ ...prev, cargo: e.target.value }))}
                className={SELECT_CLS}
              >
                {cargosDisponibles.map((c) => (
                  <option key={c} value={c}>{CARGO_DISPLAY_LABELS_LOC[c] ?? c}</option>
                ))}
              </select>
            </div>
            {hasPending && (
              <button
                type="button"
                onClick={handleConsultar}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-eske text-white-eske hover:bg-blue-eske-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske self-end"
              >
                Consultar
              </button>
            )}
          </div>
          <div className="flex gap-3 items-end flex-wrap">
            <button type="button" onClick={() => setPending((prev) => ({ ...prev, partidos: [...availablePartidos] }))} className={BTN_NEUTRAL_CLS}>
              Seleccionar todos
            </button>
            <button type="button" onClick={() => setPending((prev) => ({ ...prev, partidos: [] }))} className={BTN_NEUTRAL_CLS}>
              Borrar todos
            </button>
            <button type="button" onClick={handleRestablecer} className={BTN_RESET_CLS}>
              Restablecer
            </button>
          </div>
        </div>

        {/* Partido checkboxes — only shown after data loads to avoid flashing 80+ items */}
        {!isLoading && availablePartidos.length > 0 && (
          <div>
            <p className={LABEL_CLS + " mb-1.5"}>Partidos, candidaturas y coaliciones</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-1.5">
              {availablePartidos.map((pid) => {
                const checked = pending.partidos.includes(pid);
                const color = getColor(pid, isDark);
                return (
                  <label key={pid} className={`flex items-center gap-1.5 text-xs cursor-pointer select-none ${checked ? "text-black-eske dark:text-[#EAF2F8]" : "text-black-eske-60/60 dark:text-[#6D8294]"}`}>
                    <input type="checkbox" checked={checked} onChange={() => togglePartido(pid)} className="shrink-0 accent-blue-eske" />
                    <span className="shrink-0 w-2.5 h-2.5 rounded-sm border border-black/10 dark:border-white/10" style={{ backgroundColor: color }} aria-hidden="true" />
                    <span className="truncate">{getPartidoLabelLoc(pid)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div>
        <div className="mb-3 text-center">
          <h3 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">
            Histórico de votación por partido, candidatura o coalición
          </h3>
          {scopeSubtitle && <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">{scopeSubtitle}</p>}
        </div>
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center gap-3 rounded-lg bg-gray-eske-10 dark:bg-white/10" style={{ height: 320 }}>
            <div className="w-8 h-8 border-4 border-gray-eske-20 border-t-blue-eske rounded-full animate-spin" aria-hidden="true" />
            <p className="text-xs text-red-eske">Cargando…</p>
          </div>
        ) : chartData.length === 0 || local.partidos.length === 0 ? (
          <p className="text-sm text-black-eske-60 dark:text-[#6D8294] text-center py-8">
            {local.partidos.length === 0 ? "Selecciona al menos un partido para visualizar la gráfica." : "Sin datos para la configuración seleccionada."}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 8, right: 20, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="anio" tick={{ fontSize: 11, fill: tickFill }} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: tickFill }} tickLine={false} axisLine={false} width={44} domain={[0, "auto"]} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const sorted = [...payload].filter((p) => p.value != null).sort((a, b) => Number(b.value) - Number(a.value));
                if (!sorted.length) return null;
                return (
                  <div style={{ fontSize: 12, borderRadius: 6, border: `1px solid ${tooltipBorder}`, backgroundColor: isDark ? "#112230" : "#ffffff", color: isDark ? "#EAF2F8" : "#2b2b2b", padding: "8px 10px", maxWidth: 220 }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>Año {String(label ?? "")}</p>
                    {sorted.map((p) => (
                      <div key={String(p.dataKey)} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: p.color, flexShrink: 0 }} />
                        <span>{getPartidoLabelLoc(String(p.dataKey ?? ""))}: {FMT_PCT.format(Number(p.value))}%</span>
                      </div>
                    ))}
                  </div>
                );
              }} />
              <Legend formatter={(name) => getPartidoLabelLoc(name as string)} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {local.partidos.map((pid) => (
                <Line key={pid} type="monotone" dataKey={pid} name={pid} stroke={getColor(pid, isDark)} strokeWidth={2} dot={{ r: 3, fill: getColor(pid, isDark) }} activeDot={{ r: 5 }} connectNulls={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] mt-2 text-center">{SOURCE}</p>
      </div>

      {/* Collapsible data table */}
      {!isLoading && allData.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-center">
            <h3 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">
              Tabla de Datos de Histórico de Votación por partido, candidatura o coalición
            </h3>
            {scopeSubtitle && <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">{scopeSubtitle}</p>}
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
                      <tr onClick={() => toggleYear(yearData.anio)} className="cursor-pointer select-none" aria-expanded={isExpanded}>
                        <td colSpan={3} className="px-3 py-2 font-semibold text-white-eske bg-bluegreen-eske/70 dark:bg-bluegreen-eske/50 hover:bg-bluegreen-eske/90 dark:hover:bg-bluegreen-eske/70 transition-colors">
                          <span aria-hidden="true" className="mr-2 text-[10px]">{isExpanded ? "▾" : "▸"}</span>
                          {yearData.anio}
                        </td>
                      </tr>
                      {isExpanded && [...yearData.partidos].sort((a, b) => b.porcentaje - a.porcentaje).map((p, i) => (
                        <tr key={`${yearData.anio}-${p.partido}`} className={`border-t border-gray-eske-10 dark:border-white/5 ${i % 2 === 0 ? "bg-white-eske dark:bg-[#18324A]" : "bg-gray-eske-10 dark:bg-[#21425E]"} hover:bg-blue-eske-10 dark:hover:bg-white/5`}>
                          <td className="px-3 py-1.5 whitespace-nowrap font-mono text-black-eske-60 dark:text-[#9AAEBE]">{p.partido}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-black-eske dark:text-[#C7D6E0]">
                            <span className="inline-block w-2 h-2 rounded-sm mr-1.5 border border-black/10 dark:border-white/10 shrink-0 align-middle" style={{ backgroundColor: getColor(p.partido, isDark) }} aria-hidden="true" />
                            {getPartidoLabelLoc(p.partido)}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-right text-black-eske dark:text-[#C7D6E0]">{FMT_PCT.format(p.porcentaje)}%</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-center gap-2 pt-1">
            <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] text-center">{SOURCE}</p>
            <button type="button" onClick={handleDownloadCsv} disabled={allData.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-bluegreen-eske text-white-eske hover:bg-bluegreen-eske-40 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske">
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
