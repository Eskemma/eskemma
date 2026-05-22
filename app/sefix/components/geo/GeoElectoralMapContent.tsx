"use client";
// app/sefix/components/geo/GeoElectoralMapContent.tsx
// Main content for the Geo Electoral Map tab. Layout mirrors EleccionesFedPanelContent:
// desktop → horizontal filter bar above full-width map; mobile → left drawer.
import { useState, useRef, useCallback } from "react";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import { GeoVisualizador } from "@/app/components/geo/GeoVisualizador";
import { useGeoElectoralMap } from "@/app/sefix/hooks/useGeoElectoralMap";
import GeoElectoralFilters from "./GeoElectoralFilters";

const GEO_DEFAULTS = {
  cargo: "dip",
  anio: 2024,
  estado: "",
  cabecera: "",
  secciones: [] as string[],
};

function scopeLabel(estado: string, cabecera: string, cargo: string): string {
  const cargoLabels: Record<string, string> = {
    dip: "Diputación Federal",
    sen: "Senaduría",
    pdte: "Presidencia",
  };
  const parts: string[] = [cargoLabels[cargo] ?? cargo];
  if (!estado) parts.push("Nacional");
  else {
    parts.push(estado);
    if (cabecera) parts.push(`Distrito ${cabecera}`);
  }
  return parts.join(" — ");
}

export default function GeoElectoralMapContent() {
  const [leftOpen, setLeftOpen] = useState(false);

  useEscapeKey(leftOpen, useCallback(() => setLeftOpen(false), []));

  const [pendingCargo, setPendingCargo] = useState(GEO_DEFAULTS.cargo);
  const [pendingAnio, setPendingAnio] = useState(GEO_DEFAULTS.anio);
  const [pendingEstado, setPendingEstado] = useState(GEO_DEFAULTS.estado);
  const [pendingCabecera, setPendingCabecera] = useState(GEO_DEFAULTS.cabecera);
  const [pendingSecciones, setPendingSecciones] = useState<string[]>(GEO_DEFAULTS.secciones);

  const [committed, setCommitted] = useState({ ...GEO_DEFAULTS });
  const committedRef = useRef({ ...GEO_DEFAULTS });
  const [queryVersion, setQueryVersion] = useState(0);

  const hasPending =
    pendingCargo !== committedRef.current.cargo ||
    pendingAnio !== committedRef.current.anio ||
    pendingEstado !== committedRef.current.estado ||
    pendingCabecera !== committedRef.current.cabecera ||
    JSON.stringify(pendingSecciones) !== JSON.stringify(committedRef.current.secciones);

  const handleConsultar = useCallback(() => {
    const next = {
      cargo: pendingCargo,
      anio: pendingAnio,
      estado: pendingEstado,
      cabecera: pendingCabecera,
      secciones: [...pendingSecciones],
    };
    committedRef.current = next;
    setCommitted(next);
    setQueryVersion((v) => v + 1);
  }, [pendingCargo, pendingAnio, pendingEstado, pendingCabecera, pendingSecciones]);

  const handleRestablecer = useCallback(() => {
    setPendingCargo(GEO_DEFAULTS.cargo);
    setPendingAnio(GEO_DEFAULTS.anio);
    setPendingEstado(GEO_DEFAULTS.estado);
    setPendingCabecera(GEO_DEFAULTS.cabecera);
    setPendingSecciones(GEO_DEFAULTS.secciones);
    const def = { ...GEO_DEFAULTS };
    committedRef.current = def;
    setCommitted(def);
    setQueryVersion((v) => v + 1);
  }, []);

  const setEstado = useCallback((v: string) => {
    setPendingEstado(v);
    setPendingCabecera("");
    setPendingSecciones([]);
  }, []);

  const setCabecera = useCallback((v: string) => {
    setPendingCabecera(v);
    setPendingSecciones([]);
  }, []);

  const { scope, layers, isLoading: loadingGanadores, error, partidosVisibles } =
    useGeoElectoralMap({
      cargo: committed.cargo,
      anio: committed.anio,
      estado: committed.estado,
      cabecera: committed.cabecera,
      secciones: committed.secciones,
      queryVersion,
    });

  const currentScope = scopeLabel(committed.estado, committed.cabecera, committed.cargo);

  const filterProps = {
    pendingCargo,
    pendingAnio,
    pendingEstado,
    pendingCabecera,
    pendingSecciones,
    setCargo: setPendingCargo,
    setAnio: setPendingAnio,
    setEstado,
    setCabecera,
    setSecciones: setPendingSecciones,
    hasPending,
    onRestablecer: handleRestablecer,
  };

  return (
    <div className="space-y-4 pb-14 sm:pb-0">
      {/* Overlay mobile */}
      {leftOpen && (
        <div
          className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
          aria-hidden="true"
          onClick={() => setLeftOpen(false)}
        />
      )}

      {/* Desktop filter bar */}
      <div className="hidden sm:block px-4 sm:px-6 pt-4">
        <GeoElectoralFilters
          {...filterProps}
          onConsultar={handleConsultar}
        />
      </div>

      {/* Mobile left drawer */}
      <div
        className={[
          "fixed left-0 top-0 bottom-14 w-[min(85vw,320px)]",
          "bg-white-eske dark:bg-[#112230] overflow-y-auto z-40 shadow-xl",
          "transition-transform duration-300 ease-in-out sm:hidden",
          leftOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-bluegreen-eske text-white-eske">
          <span className="text-sm font-semibold">Filtros de Consulta</span>
          <button
            type="button"
            onClick={() => setLeftOpen(false)}
            aria-label="Cerrar filtros"
            className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-eske rounded"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          <GeoElectoralFilters
            {...filterProps}
            onConsultar={() => { handleConsultar(); setLeftOpen(false); }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 sm:px-6 space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8]">
            Visualización Geográfica
          </h2>
          <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">
            Resultados electorales federales por demarcación territorial
          </p>
        </div>

        {/* Scope + loading state */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE]">
            {currentScope} ({committed.anio})
          </p>
          {loadingGanadores && (
            <span className="text-xs text-blue-eske animate-pulse">
              Cargando datos electorales…
            </span>
          )}
          {error && (
            <span className="text-xs text-red-eske">
              Error al cargar datos: {error}
            </span>
          )}
        </div>

        {/* Map */}
        <GeoVisualizador
          scope={scope}
          layers={layers}
          height="560px"
          queryVersion={queryVersion}
        />

        {/* Party legend */}
        {partidosVisibles.length > 0 && (
          <div className="bg-white-eske dark:bg-[#112230] border border-gray-eske-20 dark:border-white/10 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-black-eske-60 dark:text-[#9AAEBE] uppercase tracking-wide mb-3">
              Leyenda
            </h4>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {partidosVisibles
                .sort((a, b) => a.label.localeCompare(b.label))
                .map(({ partido, color, label }) => (
                  <li key={partido} className="flex items-center gap-1.5">
                    <span
                      className="flex-shrink-0 w-3 h-3 rounded-sm"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="text-xs text-black-eske dark:text-[#EAF2F8]">
                      {label}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Methodological note */}
        <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE]">
          Fuente: INE — Sistema de Consulta de la Estadística de las Elecciones Federales.
          Elección ordinaria, principio de mayoría relativa. El color refleja el partido o
          coalición con mayor número de votos en la demarcación.
        </p>
      </div>

      {/* Mobile bottom bar — Filtros only */}
      <div
        className="fixed bottom-0 left-0 right-0 h-14 z-50 bg-bluegreen-eske flex sm:hidden shadow-[0_-2px_12px_rgba(0,0,0,0.22)] items-center px-3"
        role="toolbar"
        aria-label="Navegación de paneles"
      >
        <button
          type="button"
          onClick={() => setLeftOpen((v) => !v)}
          aria-expanded={leftOpen}
          aria-label={leftOpen ? "Cerrar filtros" : "Abrir filtros de consulta"}
          className={[
            "flex-1 flex items-center justify-center rounded-xl py-1.5 transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-eske focus-visible:ring-offset-1 focus-visible:ring-offset-bluegreen-eske",
            "active:scale-95 border",
            leftOpen
              ? "bg-white-eske/25 border-white-eske shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]"
              : "bg-white-eske/10 border-white-eske/40 hover:bg-white-eske/20 hover:border-white-eske/70",
          ].join(" ")}
        >
          <span className="flex flex-col items-center gap-0.5">
            <svg
              className="w-5 h-5 text-white-eske"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            <span className="text-[10px] font-bold tracking-wider text-white-eske leading-none">
              FILTROS
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
