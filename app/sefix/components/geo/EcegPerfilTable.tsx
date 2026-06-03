"use client";
// app/sefix/components/geo/EcegPerfilTable.tsx
// Full-profile ECEG indicator table with collapsible groups and dynamic level columns.
import React, { useState, useEffect, useCallback, useRef } from "react";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { ECEG_GROUPS, ECEG_COLOR_RAMPS, ECEG_DENOMINATORS } from "@/lib/sefix/ecegConstants";
import { DISTRITO_TODOS } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegCommitted } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegPerfilRow, NivelData } from "@/app/api/sefix/eceg-perfil/route";
import type { EcegGroup } from "@/lib/sefix/ecegConstants";

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtTotal(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

function fmtValor(valor: number | null, isIndex: boolean): string {
  if (valor === null) return "—";
  return valor.toLocaleString("es-MX", { maximumFractionDigits: isIndex ? 2 : 0 });
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

// ── Level cell triplet ──────────────────────────────────────────────────────

function LevelCells({ d, isIndex }: { d: NivelData | null; isIndex: boolean }) {
  if (!d) return <><td className={TD}>—</td><td className={TD}>—</td><td className={TD}>—</td></>;
  return (
    <>
      <td className={`${TD} text-black-eske-50 dark:text-[#6D8294]`}>{fmtTotal(d.denominador)}</td>
      <td className={`${TD} font-medium text-black-eske dark:text-[#EAF2F8]`}>{fmtValor(d.valor, isIndex)}</td>
      <td className={`${TD} text-black-eske-60 dark:text-[#9AAEBE]`}>{fmtPct(d.porcentaje)}</td>
    </>
  );
}

const TH  = "px-2.5 py-1.5 text-[10px] font-semibold text-bluegreen-eske dark:text-[#4791B3] uppercase tracking-wide whitespace-nowrap text-right";
const TD  = "px-2.5 py-1.5 text-xs tabular-nums text-right whitespace-nowrap";
const TH2 = "px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap text-center border-b border-gray-eske-20 dark:border-white/10";

// ── Main component ──────────────────────────────────────────────────────────

interface Props {
  committed: EcegCommitted;
  queryVersion: number;
}

export default function EcegPerfilTable({ committed, queryVersion }: Props) {
  const [rows, setRows] = useState<EcegPerfilRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Default: only first group (Demografía) open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(ECEG_GROUPS.map((g, i) => [g.id, i === 0]))
  );
  const abortRef = useRef<AbortController | null>(null);
  const prevKeyRef = useRef("");

  // ── Active levels ─────────────────────────────────────────────────────────
  const showEstado    = !!committed.estado;
  const showMunicipio = committed.filterMode === "municipio" && !!committed.municipioNombre;
  const showDistrito  =
    committed.filterMode === "distrito" &&
    !!committed.cabeceraCve &&
    committed.cabeceraCve !== DISTRITO_TODOS;
  const showSeccion = committed.secciones.length > 0;

  const midLabel = showMunicipio ? "Municipal" : showDistrito ? "Distrital" : null;
  const showMid  = !!(showMunicipio || showDistrito);

  const activeLevelCount =
    1 + // nacional
    (showEstado ? 1 : 0) +
    (showMid    ? 1 : 0) +
    (showSeccion ? 1 : 0);
  const fixedCols  = 2; // Indicador + Unidad
  const totalCols  = fixedCols + activeLevelCount * 3;

  // ── Scope label for panel header ──────────────────────────────────────────
  const scopeLabel: string = (() => {
    if (!committed.estado) return "Nacional";
    if (committed.secciones.length > 0) {
      const n = committed.secciones.length;
      return n === 1
        ? `Sección ${parseInt(committed.secciones[0], 10)}`
        : `${n} secciones`;
    }
    if (showMunicipio) {
      const m = committed.municipioNombre;
      return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    }
    if (showDistrito)
      return committed.cabeceraLabel || `Distrito ${committed.cabeceraCve}`;
    return committed.estado;
  })();

  // ── Data fetch ────────────────────────────────────────────────────────────
  function buildParams(extra?: Record<string, string>) {
    const qs = new URLSearchParams(extra);
    const estadoId = ESTADO_CVE_MAP[committed.estado] ?? "";
    if (estadoId) qs.set("estado_id", estadoId);
    if (committed.filterMode === "municipio" && committed.municipioCve)
      qs.set("municipio_cve", committed.municipioCve);
    if (showDistrito)
      qs.set("distrito_cve", committed.cabeceraCve);
    if (committed.secciones.length > 0)
      qs.set("secciones", committed.secciones.join(","));
    return qs.toString();
  }

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sefix/eceg-perfil?${buildParams()}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRows(json.rows ?? []);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      if (abortRef.current === ctrl) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, queryVersion]);

  useEffect(() => {
    const key = [
      committed.estado, committed.municipioCve,
      committed.cabeceraCve, committed.secciones.join(","), queryVersion,
    ].join("|");
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;
    fetchData();
    return () => { abortRef.current?.abort(); };
  }, [queryVersion, fetchData]);

  function handleDownload() {
    const scopeName = scopeLabel.replace(/\s+/g, "_").slice(0, 40);
    window.location.href = `/api/sefix/eceg-perfil?${buildParams({ download: "true", scope_name: scopeName })}`;
  }

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const mostrarTodos   = () => setOpenGroups(Object.fromEntries(ECEG_GROUPS.map((g) => [g.id, true])));
  const colapsarTodos  = () => setOpenGroups(Object.fromEntries(ECEG_GROUPS.map((g) => [g.id, false])));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Panel header */}
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
            Perfil ECEG 2020
          </h3>
          <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE]">
            {scopeLabel}
            {rows.length > 0 && <> — {rows.length} indicadores</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={mostrarTodos}
            className="text-xs text-blue-eske hover:underline focus-visible:outline-none"
          >
            Mostrar todos
          </button>
          <span className="text-black-eske-30 dark:text-white/20 text-xs">|</span>
          <button
            type="button"
            onClick={colapsarTodos}
            className="text-xs text-blue-eske hover:underline focus-visible:outline-none"
          >
            Colapsar todos
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isLoading || rows.length === 0}
            className="flex items-center gap-1.5 bg-blue-eske text-white-eske rounded px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske transition-opacity"
          >
            <span aria-hidden="true">↓</span> Descargar CSV
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-1 animate-pulse" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-gray-eske-20 dark:bg-white/10" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <p className="text-sm text-red-eske py-4 text-center">{error}</p>
      )}

      {/* Table */}
      {!isLoading && !error && rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-eske-20 dark:border-white/10">
          <table className="w-full text-xs border-collapse" style={{ minWidth: `${320 + activeLevelCount * 240}px` }}>
            <thead className="bg-gray-eske-10 dark:bg-[#112230]">
              {/* Row 1: level group headers */}
              <tr>
                <th className={`${TH} text-left`} rowSpan={2}>Indicador</th>
                <th className={`${TH} text-left`} rowSpan={2}>Unidad</th>
                <th className={`${TH2} text-bluegreen-eske dark:text-[#4791B3]`} colSpan={3}>
                  Nacional
                </th>
                {showEstado && (
                  <th className={`${TH2} text-bluegreen-eske dark:text-[#4791B3] border-l border-gray-eske-20 dark:border-white/10`} colSpan={3}>
                    Estatal
                  </th>
                )}
                {showMid && midLabel && (
                  <th className={`${TH2} text-bluegreen-eske dark:text-[#4791B3] border-l border-gray-eske-20 dark:border-white/10`} colSpan={3}>
                    {midLabel}
                  </th>
                )}
                {showSeccion && (
                  <th className={`${TH2} text-bluegreen-eske dark:text-[#4791B3] border-l border-gray-eske-20 dark:border-white/10`} colSpan={3}>
                    Seccional
                  </th>
                )}
              </tr>
              {/* Row 2: individual column headers */}
              <tr>
                {[
                  true,
                  showEstado,
                  showMid,
                  showSeccion,
                ].flatMap((show, lvlIdx) =>
                  show
                    ? [
                        <th key={`t${lvlIdx}`} className={`${TH} ${lvlIdx > 0 ? "border-l border-gray-eske-20 dark:border-white/10" : ""}`}>Total</th>,
                        <th key={`v${lvlIdx}`} className={TH}>Valor</th>,
                        <th key={`p${lvlIdx}`} className={TH}>%</th>,
                      ]
                    : []
                )}
              </tr>
            </thead>
            <tbody>
              {ECEG_GROUPS.map((grupo) => {
                const groupRows = rows.filter((r) => r.grupo === grupo.id);
                if (groupRows.length === 0) return null;
                const ramp    = ECEG_COLOR_RAMPS[grupo.id as EcegGroup];
                const bgLight = ramp?.low  ?? "#f1f5f9";
                const textCol = ramp?.high ?? "#334155";
                const isOpen  = openGroups[grupo.id] ?? false;

                return (
                  <React.Fragment key={grupo.id}>
                    {/* Group header row */}
                    <tr
                      onClick={() => toggleGroup(grupo.id)}
                      className="cursor-pointer select-none"
                      style={{ backgroundColor: bgLight }}
                    >
                      <td
                        colSpan={totalCols}
                        className="px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wide"
                        style={{ color: textCol }}
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-block mr-1.5 transition-transform duration-150 ${isOpen ? "" : "-rotate-90"}`}
                        >
                          ▾
                        </span>
                        {grupo.label}
                        <span className="ml-2 font-normal normal-case text-[10px] opacity-60">
                          ({groupRows.length} indicadores)
                        </span>
                      </td>
                    </tr>

                    {/* Indicator rows */}
                    {isOpen &&
                      groupRows.map((row, i) => {
                        const isIndex = !ECEG_DENOMINATORS[row.variable];
                        return (
                          <tr
                            key={row.variable}
                            className={[
                              "border-t border-gray-eske-10 dark:border-white/5",
                              i % 2 === 0
                                ? "bg-white-eske dark:bg-transparent"
                                : "bg-gray-eske-10/30 dark:bg-white/[0.02]",
                              "hover:bg-blue-eske/5 dark:hover:bg-blue-eske/10 transition-colors",
                            ].join(" ")}
                          >
                            <td className="px-2.5 py-1.5 text-xs text-black-eske dark:text-[#C7D6E0] min-w-[160px]">
                              <span title={row.variable}>{row.label}</span>
                            </td>
                            <td className="px-2.5 py-1.5 text-xs text-black-eske-50 dark:text-[#6D8294] whitespace-nowrap">
                              {row.unit || "—"}
                            </td>

                            {/* Nacional */}
                            <LevelCells d={row.nacional} isIndex={isIndex} />

                            {/* Estatal */}
                            {showEstado && (
                              <LevelCells d={row.estado} isIndex={isIndex} />
                            )}

                            {/* Municipal o Distrital */}
                            {showMunicipio && (
                              <LevelCells d={row.municipio} isIndex={isIndex} />
                            )}
                            {showDistrito && (
                              <LevelCells d={row.distrito} isIndex={isIndex} />
                            )}

                            {/* Seccional */}
                            {showSeccion && (
                              <LevelCells d={row.seccion} isIndex={isIndex} />
                            )}
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Source note */}
      {!isLoading && rows.length > 0 && (
        <p className="text-[11px] text-black-eske-40 dark:text-[#6D8294] mt-2 leading-relaxed">
          Fuente: INEGI — Estadísticas Censales a Escalas Geoelectorales (ECEG 2020).
          Los valores "—" indican indicadores de tipo índice o promedio sin denominador aplicable.
        </p>
      )}
    </div>
  );
}
