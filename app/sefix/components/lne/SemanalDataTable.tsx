"use client";

import { useState, useEffect, useCallback } from "react";
import type { SemanalTipo } from "@/lib/sefix/storage";
import type { Ambito } from "@/lib/sefix/seriesUtils";

interface SemanalDataTableProps {
  tipo: SemanalTipo;
  ambito: Ambito;
  scopeLabel?: string;
  corte?: string;
  entidad?: string;
  cveDistrito?: string;
  cveMunicipio?: string;
  secciones?: string[];
}

type TablaRow = Record<string, string | number>;

const FMT = new Intl.NumberFormat("es-MX");

function fmtNum(v: string | number): string {
  const n = Number(v);
  return isNaN(n) ? String(v) : FMT.format(Math.round(n));
}

// Columnas según tipo de desglose
function getColumns(tipo: SemanalTipo): { key: string; label: string; numeric?: boolean; mobileHide?: boolean }[] {
  if (tipo === "edad") {
    return [
      { key: "rango",  label: "Rango de Edad" },
      { key: "padron", label: "Padrón Electoral", numeric: true },
      { key: "lista",  label: "Lista Nominal",    numeric: true },
      { key: "tasa",   label: "Tasa de Inclusión", numeric: true },
    ];
  }
  if (tipo === "sexo") {
    return [
      { key: "rango",       label: "Rango de Edad" },
      { key: "padron_h",    label: "Padrón H",         numeric: true },
      { key: "padron_m",    label: "Padrón M",         numeric: true },
      { key: "padron_nb",   label: "Padrón NB",        numeric: true },
      { key: "lne_hombres", label: "LNE H",            numeric: true },
      { key: "lne_mujeres", label: "LNE M",            numeric: true },
      { key: "lne_nb",      label: "LNE NB",           numeric: true },
      { key: "tasa_h",      label: "Tasa H",           mobileHide: true },
      { key: "tasa_m",      label: "Tasa M",           mobileHide: true },
      { key: "tasa_nb",     label: "Tasa NB",          mobileHide: true },
    ];
  }
  // origen
  return [
    { key: "origen",    label: "Entidad de Origen" },
    { key: "lne",       label: "Lista Nominal",     numeric: true },
    { key: "padron",    label: "Padrón Electoral",  numeric: true },
    { key: "diferencia",label: "Padrón − LNE",      numeric: true },
  ];
}

const PAGE_SIZES = [10, 15, 25, 50, 100];

export default function SemanalDataTable({
  tipo,
  ambito,
  scopeLabel,
  corte,
  entidad,
  cveDistrito,
  cveMunicipio,
  secciones,
}: SemanalDataTableProps) {
  const [rows, setRows]           = useState<TablaRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(15);
  const [search, setSearch]       = useState("");
  const [fecha, setFecha]         = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const cols = getColumns(tipo);

  const load = useCallback(async (p: number, q: string, ps: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tipo,
        ambito,
        page: String(p),
        pageSize: String(ps),
      });
      if (corte)            params.set("corte",    corte);
      if (entidad)          params.set("entidad",  entidad);
      if (cveDistrito)      params.set("cvd",      cveDistrito);
      if (cveMunicipio)     params.set("cvm",      cveMunicipio);
      if (secciones?.length) params.set("secciones", secciones.join(","));
      if (q)                params.set("search",   q);

      const res = await fetch(`/api/sefix/semanal-tabla?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { rows: TablaRow[]; total: number; fecha: string };
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
      setFecha(json.fecha ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar tabla");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ambito, corte, entidad, cveDistrito, cveMunicipio, secciones?.join(",")]);

  useEffect(() => {
    setPage(1);
    load(1, search, pageSize);
  }, [tipo, ambito, corte, entidad, load]);

  function handleSearch(q: string) {
    setSearch(q);
    setPage(1);
    load(1, q, pageSize);
  }

  function handlePageSize(ps: number) {
    setPageSize(ps);
    setPage(1);
    load(1, search, ps);
  }

  function handlePage(p: number) {
    setPage(p);
    load(p, search, pageSize);
  }

  function handleDownload() {
    const params = new URLSearchParams({ tipo, ambito, download: "true" });
    if (corte)             params.set("corte",    corte);
    if (entidad)           params.set("entidad",  entidad);
    if (cveDistrito)       params.set("cvd",      cveDistrito);
    if (cveMunicipio)      params.set("cvm",      cveMunicipio);
    if (secciones?.length) params.set("secciones", secciones.join(","));
    window.location.href = `/api/sefix/semanal-tabla?${params}`;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const ambitoLabel = ambito === "nacional" ? "Nacional" : "Extranjero";

  return (
    <div className="space-y-3">
      {/* Encabezado */}
      <div className="text-center space-y-1">
        <h3 className="text-base font-bold text-black-eske dark:text-[#EAF2F8]">Tabla de Datos</h3>
        <p className="text-xs font-semibold text-bluegreen-eske">
          Ámbito:{" "}
          <span className="font-bold">{ambitoLabel}</span>
          {fecha && (
            <span className="text-black-eske-10 dark:text-[#6D8294] font-normal ml-2">
              — Corte: {fecha}
            </span>
          )}
        </p>
        {scopeLabel && (
          <p className="text-xs text-black-eske-10 dark:text-[#6D8294]">{scopeLabel}</p>
        )}
      </div>

      {/* Controles: Mostrar + Buscar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label
            htmlFor="semanal-tabla-pagesize"
            className="text-xs text-black-eske-20 dark:text-[#9AAEBE] whitespace-nowrap"
          >
            Mostrar
          </label>
          <select
            id="semanal-tabla-pagesize"
            value={pageSize}
            onChange={(e) => handlePageSize(parseInt(e.target.value, 10))}
            className="text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">entradas</span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="semanal-tabla-search" className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
            Buscar:
          </label>
          <input
            id="semanal-tabla-search"
            type="search"
            placeholder="Filtrar..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske min-w-[140px]"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-gray-eske-20 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-bluegreen-eske text-white-eske">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2 font-semibold text-xs ${c.numeric ? "text-right" : "text-left"} ${c.mobileHide ? "hidden sm:table-cell" : ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                <tr key={i} className="border-t border-gray-eske-10 dark:border-white/5">
                  {cols.map((c) => (
                    <td key={c.key} className={`px-3 py-2 ${c.mobileHide ? "hidden sm:table-cell" : ""}`}>
                      <div className="h-3 w-full rounded bg-gray-eske-10 dark:bg-[#21425E] animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={cols.length} className="px-3 py-6 text-center text-sm text-red-eske">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-3 py-6 text-center text-sm text-black-eske-10 dark:text-[#6D8294]">
                  Sin datos para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-t border-gray-eske-10 dark:border-white/5 ${idx % 2 === 0 ? "bg-white-eske dark:bg-[#18324A]" : "bg-gray-eske-10 dark:bg-[#21425E]"} hover:bg-blue-eske-10 dark:hover:bg-white/5 transition-colors`}
                >
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-1.5 text-xs text-black-eske dark:text-[#C7D6E0] ${c.numeric ? "text-right tabular-nums" : ""} ${c.mobileHide ? "hidden sm:table-cell" : ""}`}
                    >
                      {c.numeric ? fmtNum(row[c.key] ?? 0) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Indicador de scroll horizontal */}
      <p className="text-[11px] text-black-eske-10 dark:text-[#6D8294] text-center sm:hidden">
        ← Desliza horizontalmente para ver todas las columnas →
      </p>

      {/* Paginación */}
      {!isLoading && (
        <div className="flex items-center justify-between text-xs text-black-eske-10 dark:text-[#6D8294]">
          <span>
            {total === 0
              ? "Sin resultados"
              : `Mostrando ${(page - 1) * pageSize + 1} a ${Math.min(page * pageSize, total)} de ${FMT.format(total)} entradas`}
          </span>
          {total > pageSize && (
            <div className="flex gap-1">
              <button
                onClick={() => handlePage(page - 1)}
                disabled={page <= 1}
                className="px-2 py-1 rounded border border-gray-eske-30 dark:border-white/10 dark:text-[#C7D6E0] disabled:opacity-40 hover:border-blue-eske"
                aria-label="Página anterior"
              >
                ‹
              </button>
              <span className="px-2 py-1">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => handlePage(page + 1)}
                disabled={page >= totalPages}
                className="px-2 py-1 rounded border border-gray-eske-30 dark:border-white/10 dark:text-[#C7D6E0] disabled:opacity-40 hover:border-blue-eske"
                aria-label="Página siguiente"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}

      {/* Descargar CSV — al pie */}
      <div className="flex justify-center py-4 border-t border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        <button
          onClick={handleDownload}
          disabled={isLoading || rows.length === 0}
          className="flex items-center gap-2 px-5 py-2 bg-bluegreen-eske text-white-eske text-sm font-semibold rounded-lg hover:bg-bluegreen-eske-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-2"
          aria-label="Descargar CSV"
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
          Descargar CSV
        </button>
      </div>
    </div>
  );
}
