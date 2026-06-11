"use client";
// app/sefix/components/geo/GeoElectoralMapContentLoc.tsx
// Visualización geográfica de elecciones locales 2024.
import { useState, useCallback } from "react";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import { GeoVisualizador } from "@/app/components/geo/GeoVisualizador";
import { useGeoElectoralMapLoc } from "@/app/sefix/hooks/useGeoElectoralMapLoc";
import { useEleccionesLocalesFilters, useLocalesSeccionesForGeo } from "@/app/sefix/hooks/useEleccionesLocalesFilters";
import EleccionesLocalesFilters from "../elecciones-locales/EleccionesLocalesFilters";
import { CARGO_DISPLAY_LABELS_LOC } from "@/lib/sefix/eleccionesLocalesConstants";

const ANIO_GEO_LOC = 2024;

export default function GeoElectoralMapContentLoc() {
  const [leftOpen, setLeftOpen] = useState(false);
  useEscapeKey(leftOpen, useCallback(() => setLeftOpen(false), []));

  const {
    pendingEstado, pendingAnio: _pendingAnio, pendingCargo, pendingPartidos,
    pendingTipo, pendingPrincipio, pendingCabecera, pendingMunicipio, pendingSecciones,
    committed, queryVersion, hasPending,
    setEstado, setAnio: _setAnio, setCargo, setPartidos, setTipo, setPrincipio,
    setCabecera, setMunicipio, setSecciones,
    handleConsultar, handleRestablecer,
    availableYears, loadingYears,
    cargosDisponibles, loadingCargos,
    partidosDisponibles, loadingPartidos, tiposDisponibles, principiosDisponibles,
  } = useEleccionesLocalesFilters();

  // Auto-compute secciones for scope/zoom when a district or municipio is selected
  const { secciones: autoSecciones } = useLocalesSeccionesForGeo(
    ANIO_GEO_LOC,
    committed.cargo,
    committed.estado,
    committed.cabecera,
    committed.municipio,
  );
  // User-selected secciones take priority; auto-computed as fallback for zoom
  const effectiveSecciones = committed.secciones.length > 0
    ? committed.secciones
    : autoSecciones;

  const { scope, layers, isLoading: loadingGanadores, error, partidosVisibles } =
    useGeoElectoralMapLoc({
      cargo: committed.cargo,
      anio: ANIO_GEO_LOC,
      estado: committed.estado,
      cabecera: committed.cabecera,
      municipio: committed.municipio,
      secciones: effectiveSecciones,
      queryVersion,
    });

  const cargoLabel = CARGO_DISPLAY_LABELS_LOC[committed.cargo] ?? committed.cargo;
  const geoPartes: string[] = [];
  if (committed.estado) geoPartes.push(committed.estado);
  if (committed.cabecera) geoPartes.push(`Dist. ${committed.cabecera}`);
  if (committed.municipio) geoPartes.push(committed.municipio);
  const geoLabel = geoPartes.length ? geoPartes.join(" — ") : "Sin selección";
  const currentScope = `${cargoLabel} — ${geoLabel} (${ANIO_GEO_LOC})`;

  const filterProps = {
    pendingEstado,
    pendingAnio: ANIO_GEO_LOC,
    pendingCargo,
    pendingPartidos,
    pendingTipo,
    pendingPrincipio,
    pendingCabecera,
    pendingMunicipio,
    pendingSecciones,
    setEstado,
    setAnio: () => {},
    setCargo,
    setPartidos,
    setTipo,
    setPrincipio,
    setCabecera,
    setMunicipio,
    setSecciones,
    hasPending,
    onRestablecer: handleRestablecer,
    availableYears,
    loadingYears,
    cargosDisponibles,
    loadingCargos,
    partidosDisponibles,
    loadingPartidos,
    tiposDisponibles,
    principiosDisponibles,
    hidePartidos: true,
    fixedAnio: true,
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
      <div className="hidden sm:block">
        <EleccionesLocalesFilters
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
          <EleccionesLocalesFilters
            {...filterProps}
            onConsultar={() => { handleConsultar(); setLeftOpen(false); }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 sm:px-6 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8]">
            Visualización Geográfica
          </h2>
          <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">
            Resultados electorales locales por demarcación territorial (2024)
          </p>
        </div>

        {/* Scope + error */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE]">
            {currentScope}
          </p>
          {error && (
            <p className="text-xs text-red-eske">
              Error al cargar datos: {error}
            </p>
          )}
        </div>

        {/* Map with loading spinner overlay */}
        <div className="relative">
          <GeoVisualizador
            scope={scope}
            layers={layers}
            height="560px"
            queryVersion={queryVersion}
          />
          {loadingGanadores && (
            <div className="absolute inset-0 bg-white-eske/75 dark:bg-[#0B1620]/75 z-[1000] flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-10 h-10 border-4 border-gray-eske-20 border-t-blue-eske rounded-full animate-spin"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-red-eske">Cargando…</p>
              </div>
            </div>
          )}
        </div>

        {/* Party legend */}
        {partidosVisibles.length > 0 && !loadingGanadores && (
          <div className="bg-white-eske dark:bg-[#112230] border border-gray-eske-20 dark:border-white/10 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold text-black-eske-60 dark:text-[#9AAEBE] uppercase tracking-wide">
              Leyenda
            </h4>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
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
              <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] sm:text-right sm:flex-shrink-0 sm:max-w-[260px]">
                El color refleja el partido o coalición con mayor número de votos en la demarcación.
              </p>
            </div>
          </div>
        )}

        {/* Source */}
        <p className="text-xs text-center text-black-eske-60 dark:text-[#9AAEBE]">
          Fuente: INE — Sistema de Consulta de la Estadística de las Elecciones Locales.
        </p>
      </div>

      {/* Mobile bottom bar */}
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
