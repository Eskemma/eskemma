"use client";
// DataTable paginada con descarga CSV para Elecciones Federales.
// Patrón idéntico a SemanalDataTable.tsx (LNE).
import { useState, useEffect, useRef } from "react";
import { EleccionesFilterParams } from "@/types/sefix.types";
import { TABLA_COLUMN_LABELS, PARTIDO_LABELS } from "@/lib/sefix/eleccionesConstants";

interface TableRow {
  anio: number;
  cargo: string;
  estado: string;
  cabecera: string;
  municipio: string;
  seccion: string;
  tipo: string;
  principio: string;
  total_votos: number;
  lne: number;
  part_ciud: number;
  [key: string]: string | number;
}

interface Props {
  committed: EleccionesFilterParams;
  queryVersion: number;
}

const PAGE_SIZES = [15, 25, 50, 100];

function fmtNum(n: number): string {
  return n.toLocaleString("es-MX");
}

export default function EleccionesDataTable({ committed, queryVersion }: Props) {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);
  const lastVersion = useRef(-1);

  function buildParams(extra?: Record<string, string>) {
    const sp = new URLSearchParams({
      anio: String(committed.anio),
      cargo: committed.cargo,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (committed.estado) sp.set("estado", committed.estado);
    if (committed.tipo && committed.tipo !== "AMBAS") sp.set("tipo", committed.tipo);
    if (committed.principio) sp.set("principio", committed.principio);
    if (committed.cabecera) sp.set("cabecera", committed.cabecera);
    if (committed.municipio) sp.set("municipio", committed.municipio);
    if (committed.secciones.length) sp.set("secciones", committed.secciones.join(","));
    if (!committed.partidos.includes("Todos") && committed.partidos.length) {
      sp.set("partidos", committed.partidos.join(","));
    }
    if (extra) Object.entries(extra).forEach(([k, v]) => sp.set(k, v));
    return sp;
  }

  useEffect(() => {
    if (queryVersion === 0) return;
    if (queryVersion !== lastVersion.current) {
      lastVersion.current = queryVersion;
      setPage(1);
      setSearch("");
    }
    cancelRef.current = false;
    setIsLoading(true);
    const sp = buildParams({ page: String(queryVersion !== lastVersion.current ? 1 : page) });
    fetch(`/api/sefix/elecciones-tabla?${sp}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelRef.current) {
          setRows(d.rows ?? []);
          setTotal(d.total ?? 0);
          setIsLoading(false);
        }
      })
      .catch(() => { if (!cancelRef.current) setIsLoading(false); });
    return () => { cancelRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryVersion, page, pageSize]);

  function handleDownload() {
    const sp = buildParams({ download: "true" });
    window.location.href = `/api/sefix/elecciones-tabla?${sp}`;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Columnas a mostrar
  const fixedCols = ["anio", "cargo", "tipo", "principio", "estado", "cabecera", "municipio", "seccion"];
  const partidoCols = rows.length > 0
    ? Object.keys(rows[0]).filter((k) => !fixedCols.includes(k) && !["total_votos", "lne", "part_ciud"].includes(k))
    : [];
  const metaCols = ["total_votos", "lne", "part_ciud"];
  const allCols = [...fixedCols, ...partidoCols, ...metaCols];

  function colLabel(c: string) {
    if (TABLA_COLUMN_LABELS[c]) return TABLA_COLUMN_LABELS[c];
    if (PARTIDO_LABELS[c]) return PARTIDO_LABELS[c];
    return c;
  }

  // Filtro de búsqueda cliente
  const filtered = search
    ? rows.filter((row) =>
        allCols.some((c) =>
          String(row[c] ?? "").toLowerCase().includes(search.toLowerCase())
        )
      )
    : rows;

  return (
    <div className="space-y-3">
      {/* Controles superiores */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="ef-tabla-pagesize" className="text-black-eske-60 dark:text-[#9AAEBE]">
            Mostrar
          </label>
          <select
            id="ef-tabla-pagesize"
            value={pageSize}
            onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }}
            className="border border-gray-eske-30 dark:border-white/10 rounded px-1.5 py-1 text-sm bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-black-eske-60 dark:text-[#9AAEBE]">registros</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="ef-tabla-search" className="text-black-eske-60 dark:text-[#9AAEBE]">Buscar:</label>
          <input
            id="ef-tabla-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-eske-30 dark:border-white/10 rounded px-2 py-1 text-sm bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske w-36"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-gray-eske-20 dark:border-white/10">
        <table className="w-full text-xs min-w-max">
          <thead className="bg-bluegreen-eske text-white-eske">
            <tr>
              {allCols.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  {colLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={allCols.length} className="py-10">
                  <span className="block pl-4 sm:pl-48 text-red-eske dark:text-red-eske-30 text-xs font-medium">
                    Cargando…
                  </span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={allCols.length} className="px-3 py-8 text-center text-black-eske-60 dark:text-[#6D8294]">
                  Sin datos para esta consulta
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr
                  key={i}
                  className={[
                    "border-t border-gray-eske-10 dark:border-white/5",
                    i % 2 === 0
                      ? "bg-white-eske dark:bg-[#18324A]"
                      : "bg-gray-eske-10 dark:bg-[#21425E]",
                    "hover:bg-blue-eske-10 dark:hover:bg-white/5",
                  ].join(" ")}
                >
                  {allCols.map((c) => (
                    <td key={c} className="px-3 py-1.5 whitespace-nowrap text-black-eske dark:text-[#C7D6E0]">
                      {c === "part_ciud"
                        ? `${Number(row[c] ?? 0).toFixed(2)}%`
                        : typeof row[c] === "number" && !["anio"].includes(c)
                          ? fmtNum(row[c] as number)
                          : String(row[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación y descarga */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE]">
          {total > 0 ? `${total.toLocaleString("es-MX")} registros en total` : ""}
        </p>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            aria-label="Página anterior"
            className="px-2 py-1 rounded border border-gray-eske-20 dark:border-white/10 disabled:opacity-40 hover:bg-gray-eske-10 dark:hover:bg-white/5 text-black-eske dark:text-[#C7D6E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
          >
            ‹
          </button>
          <span className="text-xs text-black-eske-60 dark:text-[#9AAEBE]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            aria-label="Página siguiente"
            className="px-2 py-1 rounded border border-gray-eske-20 dark:border-white/10 disabled:opacity-40 hover:bg-gray-eske-10 dark:hover:bg-white/5 text-black-eske dark:text-[#C7D6E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
          >
            ›
          </button>
        </div>
      </div>

      {/* Fuente + botón descarga — centrados */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] text-center">
          Fuente: INE — Sistema de Consulta de la Estadística de las Elecciones Federales
        </p>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isLoading || total === 0}
          aria-label="Descargar datos en formato CSV"
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
  );
}
