"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Ambito } from "@/lib/sefix/seriesUtils";
import type { GeoInfo } from "./GeoFilter";
import type { TablaRow } from "@/lib/sefix/storage";

const FMT = new Intl.NumberFormat("es-MX");
const fmt = (v: number) => FMT.format(v);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface Props {
  ambito: Ambito;
  geoInfo: GeoInfo;
  year: number;
}

interface FetchState {
  rows: TablaRow[];
  total: number;
  isLoading: boolean;
  error: string | null;
}

function buildParams(
  ambito: Ambito,
  geoInfo: GeoInfo,
  year: number,
  page: number,
  pageSize: number,
  search: string
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("ambito", ambito);
  p.set("year", String(year));
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  if (search) p.set("search", search);
  if (geoInfo.entidad !== "Nacional") p.set("entidad", geoInfo.entidad);
  if (geoInfo.distrito !== "Todos")   p.set("distrito", geoInfo.distrito);
  if (geoInfo.municipio !== "Todos")  p.set("municipio", geoInfo.municipio);
  if (geoInfo.secciones?.length)      p.set("secciones", geoInfo.secciones.join(","));
  return p;
}

function buildScopeLabel(ambito: Ambito, geoInfo: GeoInfo): string {
  const isGeo = geoInfo.entidad !== "Nacional";
  if (ambito === "extranjero") {
    if (isGeo) {
      const parts = [`Entidad: ${geoInfo.entidad}`, "Residentes en el Extranjero"];
      if (geoInfo.distrito !== "Todos") parts.splice(1, 0, `Distrito: ${geoInfo.distrito}`);
      if (geoInfo.municipio !== "Todos") parts.splice(-1, 0, `Municipio: ${geoInfo.municipio}`);
      if (geoInfo.seccion !== "Todas") {
        const secLabel = (geoInfo.secciones?.length ?? 1) > 1 ? "Secciones" : "Sección";
        parts.splice(-1, 0, `${secLabel}: ${geoInfo.seccion}`);
      }
      return parts.join(" — ");
    }
    return "Ámbito: Residentes en el Extranjero";
  }
  const secCount = geoInfo.secciones?.length ?? (geoInfo.seccion !== "Todas" ? 1 : 0);
  const secLabel = secCount > 1 ? "Secciones" : "Sección";
  return [
    `Estado: ${geoInfo.entidad}`,
    `Distrito: ${geoInfo.distrito}`,
    `Municipio: ${geoInfo.municipio}`,
    `${secLabel}: ${geoInfo.seccion}`,
  ].join(" — ");
}

/** Genera el array de páginas a mostrar en la paginación (números + "...") */
function buildPagesArray(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (page > 4) pages.push("...");
  for (let p = Math.max(2, page - 2); p <= Math.min(totalPages - 1, page + 2); p++) {
    pages.push(p);
  }
  if (page < totalPages - 3) pages.push("...");
  pages.push(totalPages);
  return pages;
}

export default function HistoricoDataTable({ ambito, geoInfo, year }: Props) {
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]       = useState("");
  const [state, setState]         = useState<FetchState>({ rows: [], total: 0, isLoading: true, error: null });
  const [isDownloading, setIsDownloading] = useState(false);

  // Stable key para detectar cambios de scope
  const scopeKey = `${ambito}|${geoInfo.entidad}|${geoInfo.cveDistrito ?? ""}|${geoInfo.cveMunicipio ?? ""}|${(geoInfo.secciones ?? []).sort().join(",")}|${year}`;
  const prevScopeKey = useRef(scopeKey);

  // Cuando el scope cambia: resetear paginación y búsqueda
  useEffect(() => {
    if (prevScopeKey.current !== scopeKey) {
      prevScopeKey.current = scopeKey;
      setPage(1);
      setSearchInput("");
      setSearch("");
      setState({ rows: [], total: 0, isLoading: true, error: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // Debounce search input → commit to search state + reset page
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch data
  useEffect(() => {
    const params = buildParams(ambito, geoInfo, year, page, pageSize, search);
    const controller = new AbortController();
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    fetch(`/api/sefix/historico-tabla?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then(({ rows, total }) => {
        setState({ rows: rows ?? [], total: total ?? 0, isLoading: false, error: null });
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setState((prev) => ({ ...prev, isLoading: false, error: e.message }));
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, page, pageSize, search]);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const params = buildParams(ambito, geoInfo, year, 1, 9_999_999, search);
      params.set("download", "true");
      const res  = await fetch(`/api/sefix/historico-tabla?${params}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `sefix_historico_${ambito}_${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }, [ambito, geoInfo, year, search]);

  const totalPages = Math.max(1, Math.ceil(state.total / pageSize));
  const firstRow   = state.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const lastRow    = Math.min(page * pageSize, state.total);

  const ambitoLabel = ambito === "nacional" ? "Nacional" : "Extranjero";
  const padronLabel = ambito === "nacional" ? "Padrón Nacional" : "Padrón Extranjero";
  const listaLabel  = ambito === "nacional" ? "Lista Nacional"  : "Lista Extranjero";
  const scopeLabel  = buildScopeLabel(ambito, geoInfo);
  const pagesArray  = buildPagesArray(page, totalPages);

  return (
    <div className="mt-12 border border-gray-eske-20 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="bg-gray-eske-10 dark:bg-[#21425E] border-b border-gray-eske-20 dark:border-white/10 px-6 py-4 text-center">
        <h3 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">Tabla de Datos</h3>
        <p className="text-sm font-medium text-bluegreen-eske dark:text-[#6BA4C6] mt-0.5">
          Ámbito:{" "}
          <span className="font-semibold">{ambitoLabel}</span>
        </p>
        <p className="text-xs text-black-eske-10 dark:text-[#6D8294] mt-0.5">{scopeLabel}</p>
      </div>

      {/* ── Controles ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        {/* Mostrar N registros */}
        <div className="flex items-center gap-2 text-sm text-black-eske-20 dark:text-[#9AAEBE]">
          <label htmlFor="htabla-pagesize" className="whitespace-nowrap">Mostrar</label>
          <select
            id="htabla-pagesize"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border border-gray-eske-20 dark:border-white/10 rounded px-2 py-1 text-sm text-black-eske dark:text-[#EAF2F8] bg-white-eske dark:bg-[#112230] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="whitespace-nowrap">registros</span>
        </div>

        {/* Buscar */}
        <div className="flex items-center gap-2 text-sm text-black-eske-20 dark:text-[#9AAEBE]">
          <label htmlFor="htabla-search">Buscar:</label>
          <input
            id="htabla-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="border border-gray-eske-20 dark:border-white/10 rounded px-3 py-1 text-sm text-black-eske dark:text-[#EAF2F8] bg-white-eske dark:bg-[#112230] w-44 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
            placeholder=""
            aria-label="Buscar en la tabla"
          />
        </div>
      </div>

      {/* ── Tabla con scroll horizontal ────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-bluegreen-eske text-white-eske">
              {[
                { label: "Año",               align: "left"  },
                { label: "Entidad",           align: "left"  },
                { label: "Cabecera Distrital",align: "left"  },
                { label: "Municipio",         align: "left"  },
                { label: "Sección",           align: "center"},
                { label: padronLabel,         align: "right" },
                { label: "Padrón H",          align: "right" },
                { label: "Padrón M",          align: "right" },
                { label: "Padrón NB",         align: "right" },
                { label: listaLabel,          align: "right" },
                { label: "Lista H",           align: "right" },
                { label: "Lista M",           align: "right" },
                { label: "Lista NB",          align: "right" },
              ].map((col, i, arr) => (
                <th
                  key={col.label}
                  className={[
                    "px-3 py-2 font-semibold whitespace-nowrap select-none",
                    col.align === "right"  ? "text-right"  :
                    col.align === "center" ? "text-center" : "text-left",
                    i < arr.length - 1 ? "border-r border-bluegreen-eske-80" : "",
                  ].join(" ")}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.isLoading ? (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-sm text-black-eske-10 dark:text-[#6D8294]">
                  <div className="flex items-center justify-center gap-2">
                    <div
                      className="w-4 h-4 border-2 border-gray-eske-20 dark:border-white/20 border-t-blue-eske rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    Cargando datos…
                  </div>
                </td>
              </tr>
            ) : state.error ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-red-eske">
                  {state.error}
                </td>
              </tr>
            ) : state.rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-black-eske-10 dark:text-[#6D8294]">
                  Sin resultados para esta consulta.
                </td>
              </tr>
            ) : (
              state.rows.map((r, i) => (
                <tr
                  key={`${r.entidad}-${r.seccion}-${i}`}
                  className={i % 2 === 0 ? "bg-white-eske dark:bg-[#18324A]" : "bg-gray-eske-10 dark:bg-[#21425E]"}
                >
                  <td className="px-3 py-1.5 text-black-eske-10 dark:text-[#6D8294] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{r.year}</td>
                  <td className="px-3 py-1.5 text-black-eske dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{r.entidad}</td>
                  <td className="px-3 py-1.5 text-black-eske dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{r.cabecera}</td>
                  <td className="px-3 py-1.5 text-black-eske dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{r.municipio}</td>
                  <td className="px-3 py-1.5 text-black-eske-10 dark:text-[#6D8294] text-center whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{r.seccion}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{fmt(r.padron)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{fmt(r.padronH)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{fmt(r.padronM)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{fmt(r.padronNB)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{fmt(r.lista)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{fmt(r.listaH)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums dark:text-[#C7D6E0] whitespace-nowrap border-r border-gray-eske-20 dark:border-white/10">{fmt(r.listaM)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums dark:text-[#C7D6E0] whitespace-nowrap">{fmt(r.listaNB)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Indicador de scroll horizontal */}
      <p className="text-[11px] text-black-eske-10 dark:text-[#6D8294] text-center sm:hidden py-1">
        ← Desliza horizontalmente para ver todas las columnas →
      </p>

      {/* ── Pie: info + paginación ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 border-t border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A] text-xs text-black-eske-10 dark:text-[#6D8294]">
        <span>
          {state.total === 0
            ? "Sin resultados"
            : `Mostrando ${fmt(firstRow)} a ${fmt(lastRow)} de ${fmt(state.total)} registros`}
        </span>

        {/* Paginación */}
        <nav aria-label="Paginación de la tabla" className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || state.isLoading}
            aria-label="Página anterior"
            className="px-2.5 py-1 rounded border border-gray-eske-20 dark:border-white/10 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            ‹
          </button>

          {pagesArray.map((p, idx) =>
            p === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-1 select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(Number(p))}
                disabled={state.isLoading}
                aria-current={Number(p) === page ? "page" : undefined}
                className={[
                  "px-2.5 py-1 rounded border text-xs",
                  Number(p) === page
                    ? "bg-bluegreen-eske text-white-eske border-bluegreen-eske font-semibold"
                    : "border-gray-eske-20 dark:border-white/10 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5",
                ].join(" ")}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || state.isLoading}
            aria-label="Página siguiente"
            className="px-2.5 py-1 rounded border border-gray-eske-20 dark:border-white/10 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            ›
          </button>
        </nav>
      </div>

      {/* ── Descarga CSV ───────────────────────────────────────────── */}
      <div className="flex justify-center py-4 border-t border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        <button
          onClick={handleDownload}
          disabled={isDownloading || state.total === 0 || state.isLoading}
          className="flex items-center gap-2 px-5 py-2 bg-bluegreen-eske text-white-eske text-sm font-semibold rounded-lg hover:bg-bluegreen-eske-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-2"
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {isDownloading ? "Descargando…" : "Descargar CSV"}
        </button>
      </div>
    </div>
  );
}
