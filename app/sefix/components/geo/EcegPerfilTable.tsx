"use client";
// app/sefix/components/geo/EcegPerfilTable.tsx
// Full-profile ECEG indicator table with CSV download.
// Shows all 81 indicators for the selected territory + comparison with the immediate superior level.
import { useState, useEffect, useCallback, useRef } from "react";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { ECEG_GROUPS, ECEG_COLOR_RAMPS } from "@/lib/sefix/ecegConstants";
import { DISTRITO_TODOS } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegCommitted } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegPerfilRow } from "@/app/api/sefix/eceg-perfil/route";
import type { EcegGroup } from "@/lib/sefix/ecegConstants";

// Badge styled with the same color ramp used for the choropleth map
function GroupBadge({ grupo }: { grupo: string }) {
  const ramp = ECEG_COLOR_RAMPS[grupo as EcegGroup];
  const bg   = ramp?.low  ?? "#f1f5f9";
  const text = ramp?.high ?? "#334155";
  const label = ECEG_GROUPS.find((g) => g.id === grupo)?.label ?? grupo;
  const short = label.length > 8 ? label.slice(0, 7) + "…" : label;
  return (
    <span
      style={{ backgroundColor: bg, color: text }}
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
      title={label}
    >
      {short}
    </span>
  );
}

function fmt(n: number | null, unit: string): string {
  if (n === null) return "—";
  const numStr = n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
  return unit ? `${numStr} ${unit}` : numStr;
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

interface Props {
  committed: EcegCommitted;
  queryVersion: number;
}

export default function EcegPerfilTable({ committed, queryVersion }: Props) {
  const [rows, setRows] = useState<EcegPerfilRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevKeyRef = useRef("");

  // Derive the scope labels for the header and column headers
  const localLabel: string = (() => {
    if (!committed.estado) return "Nacional";
    if (committed.secciones.length > 0) {
      const n = committed.secciones.length;
      return n === 1
        ? `Sección ${parseInt(committed.secciones[0], 10)}`
        : `${n} secciones seleccionadas`;
    }
    if (committed.filterMode === "municipio" && committed.municipioNombre)
      return committed.municipioNombre.charAt(0).toUpperCase() + committed.municipioNombre.slice(1).toLowerCase();
    if (committed.filterMode === "distrito" && committed.cabeceraCve && committed.cabeceraCve !== DISTRITO_TODOS)
      return committed.cabeceraLabel || `Distrito ${committed.cabeceraCve}`;
    return committed.estado;
  })();

  const superiorLabel: string | null = (() => {
    if (!committed.estado) return null; // nacional is already the top
    if (committed.secciones.length > 0) {
      if (committed.filterMode === "municipio" && committed.municipioNombre)
        return committed.municipioNombre.charAt(0).toUpperCase() + committed.municipioNombre.slice(1).toLowerCase();
      if (committed.filterMode === "distrito" && committed.cabeceraCve && committed.cabeceraCve !== DISTRITO_TODOS)
        return committed.cabeceraLabel || `Distrito ${committed.cabeceraCve}`;
      return committed.estado;
    }
    if (committed.filterMode === "municipio" && committed.municipioNombre)
      return committed.estado;
    if (committed.filterMode === "distrito" && committed.cabeceraCve && committed.cabeceraCve !== DISTRITO_TODOS)
      return committed.estado;
    return "Nacional";
  })();

  function buildParams(extra?: Record<string, string>) {
    const qs = new URLSearchParams(extra);
    const estadoId = ESTADO_CVE_MAP[committed.estado] ?? "";
    if (estadoId) qs.set("estado_id", estadoId);
    if (committed.filterMode === "municipio" && committed.municipioCve)
      qs.set("municipio_cve", committed.municipioCve);
    if (
      committed.filterMode === "distrito" &&
      committed.cabeceraCve &&
      committed.cabeceraCve !== DISTRITO_TODOS
    )
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
    const key = [committed.estado, committed.municipioCve, committed.cabeceraCve, committed.secciones.join(","), queryVersion].join("|");
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;
    fetchData();
    return () => { abortRef.current?.abort(); };
  }, [queryVersion, fetchData]);

  function handleDownload() {
    const scopeName = localLabel.replace(/\s+/g, "_").slice(0, 40);
    window.location.href = `/api/sefix/eceg-perfil?${buildParams({ download: "true", scope_name: scopeName })}`;
  }

  const hasSuperior = rows.some((r) => r.superiorValor !== null);

  return (
    <div>
      {/* Panel header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
            Perfil ECEG 2020
          </h3>
          <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE]">
            {localLabel} — {rows.length > 0 ? `${rows.length} indicadores` : "todos los indicadores"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isLoading || rows.length === 0}
          className="flex items-center gap-1.5 bg-blue-eske text-white-eske rounded px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske transition-opacity"
          aria-label="Descargar datos como CSV"
        >
          <span aria-hidden="true">↓</span> Descargar CSV
        </button>
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
          <table className="w-full text-xs border-collapse min-w-[580px]">
            <thead>
              <tr className="bg-gray-eske-10 dark:bg-[#112230] text-left">
                <th className="px-3 py-2 text-bluegreen-eske dark:text-[#4791B3] font-semibold uppercase tracking-wide w-28">
                  Grupo
                </th>
                <th className="px-3 py-2 text-bluegreen-eske dark:text-[#4791B3] font-semibold uppercase tracking-wide">
                  Indicador
                </th>
                <th className="px-3 py-2 text-bluegreen-eske dark:text-[#4791B3] font-semibold uppercase tracking-wide text-right whitespace-nowrap">
                  Valor local
                </th>
                <th className="px-3 py-2 text-bluegreen-eske dark:text-[#4791B3] font-semibold uppercase tracking-wide text-right whitespace-nowrap">
                  % local
                </th>
                {hasSuperior && (
                  <th className="px-3 py-2 text-bluegreen-eske dark:text-[#4791B3] font-semibold uppercase tracking-wide text-right whitespace-nowrap">
                    % en {superiorLabel ?? "superior"}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const elements: React.ReactNode[] = [];
                let lastGrupo = "";
                rows.forEach((row, i) => {
                  if (row.grupoLabel !== lastGrupo) {
                    lastGrupo = row.grupoLabel;
                    elements.push(
                      <tr key={`g-${row.grupo}`} className="bg-gray-eske-10/50 dark:bg-[#0D1E2C]/80">
                        <td
                          colSpan={hasSuperior ? 5 : 4}
                          className="px-3 py-1.5 font-semibold text-[11px] text-bluegreen-eske-60 dark:text-[#6BA4C6] uppercase tracking-wide"
                        >
                          {row.grupoLabel}
                        </td>
                      </tr>
                    );
                  }
                  elements.push(
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
                      <td className="px-3 py-1.5">
                        <GroupBadge grupo={row.grupo} />
                      </td>
                      <td className="px-3 py-1.5 text-black-eske dark:text-[#C7D6E0]">
                        <span title={row.variable} className="cursor-default">
                          {row.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-black-eske dark:text-[#EAF2F8] tabular-nums whitespace-nowrap">
                        {fmt(row.localValor, row.unit)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-black-eske-60 dark:text-[#9AAEBE] tabular-nums whitespace-nowrap">
                        {fmtPct(row.localPorcentaje)}
                      </td>
                      {hasSuperior && (
                        <td className="px-3 py-1.5 text-right text-black-eske-60 dark:text-[#9AAEBE] tabular-nums whitespace-nowrap">
                          {fmtPct(row.superiorPorcentaje)}
                        </td>
                      )}
                    </tr>
                  );
                });
                return elements;
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Source note */}
      {!isLoading && rows.length > 0 && (
        <p className="text-[11px] text-black-eske-40 dark:text-[#6D8294] mt-2 leading-relaxed">
          Fuente: INEGI — Estadísticas Censales a Escalas Geoelectorales (ECEG 2020).
          {hasSuperior && superiorLabel && (
            <> Los porcentajes del nivel superior corresponden a {superiorLabel}.</>
          )}
        </p>
      )}
    </div>
  );
}
