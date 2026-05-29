"use client";
// app/sefix/components/geo/GeoEcegContent.tsx
// Estadísticos Geoelectorales (ECEG 2020) choropleth map.
// Cascade: nacional → municipios del estado → secciones del municipio
//          OR       → distritos del estado  → secciones del distrito
import { useState, useCallback } from "react";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import { GeoVisualizador } from "@/app/components/geo/GeoVisualizador";
import { GeoLegend } from "@/app/components/geo/GeoLegend";
import { useGeoEcegMap } from "@/app/sefix/hooks/useGeoEcegMap";
import { useGeoEcegFilters } from "@/app/sefix/hooks/useGeoEcegFilters";
import GeoEcegFilters from "./GeoEcegFilters";
import {
  ECEG_GROUPS,
  ECEG_INDICATORS,
  ECEG_INDICATOR_MAP,
  DEFAULT_ECEG_VARIABLE,
  type EcegGroup,
} from "@/lib/sefix/ecegConstants";
import { DISTRITO_TODOS } from "@/app/sefix/hooks/useGeoEcegFilters";

const SELECT_PILL_CLS =
  "text-xs border border-gray-eske-30 dark:border-white/10 rounded px-2 py-0.5 " +
  "bg-white-eske dark:bg-[#112230] text-black-eske-60 dark:text-[#9AAEBE] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske cursor-pointer";

export default function GeoEcegContent() {
  const [leftOpen, setLeftOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<EcegGroup>("demografia");
  const [variable, setVariable] = useState(DEFAULT_ECEG_VARIABLE);

  useEscapeKey(leftOpen, useCallback(() => setLeftOpen(false), []));

  const {
    pendingEstado,
    pendingMunicipioNombre,
    pendingMunicipioCve,
    pendingCabeceraCve,
    pendingCabeceraLabel,
    pendingSecciones,
    pendingFilterMode,
    committed,
    municipioOptions,
    distritoOptions,
    seccionOptions,
    municipioLoading,
    distritoLoading,
    seccionLoading,
    setEstado,
    setMunicipio,
    setCabecera,
    setSecciones,
    handleConsultar,
    handleRestablecer,
    queryVersion,
    hasPending,
  } = useGeoEcegFilters();

  const { scope, layers, isLoading, error } = useGeoEcegMap({
    estado: committed.estado,
    municipioNombre: committed.municipioNombre,
    cabeceraCve: committed.cabeceraCve,
    secciones: committed.secciones,
    filterMode: committed.filterMode,
    queryVersion,
    variable,
  });

  const indicator = ECEG_INDICATOR_MAP[variable];
  const colorRamp = layers[0]?.colorRamp;

  // Scope label reflecting the active navigation level
  const nivelLabel: string = (() => {
    if (!committed.estado) return "Nacional";
    if (committed.filterMode === "municipio") {
      if (!committed.municipioNombre) return `Municipios — ${committed.estado}`;
      if (committed.secciones.length > 0) return `Secciones de ${committed.municipioNombre}`;
      return `${committed.municipioNombre} — ${committed.estado}`;
    }
    // distrito mode
    if (!committed.cabeceraCve || committed.cabeceraCve === DISTRITO_TODOS) {
      return `Distritos — ${committed.estado}`;
    }
    if (committed.secciones.length > 0) {
      return `Secciones — Distrito ${committed.cabeceraCve} — ${committed.estado}`;
    }
    return `Distrito ${committed.cabeceraCve} — ${committed.estado}`;
  })();
  const scopeLabel = `ECEG 2020 — ${nivelLabel}`;

  const filterProps = {
    pendingEstado,
    pendingMunicipioNombre,
    pendingMunicipioCve,
    pendingCabeceraCve,
    pendingCabeceraLabel,
    pendingSecciones,
    pendingFilterMode,
    municipioOptions,
    distritoOptions,
    seccionOptions,
    municipioLoading,
    distritoLoading,
    seccionLoading,
    setEstado,
    setMunicipio,
    setCabecera,
    setSecciones,
    onRestablecer: handleRestablecer,
    hasPending,
  };

  const groupIndicators = ECEG_INDICATORS.filter((i) => i.group === activeGroup);
  const defaultIndicators = groupIndicators.filter((i) => i.showByDefault !== false);
  const extraIndicators = groupIndicators.filter((i) => i.showByDefault === false);
  const activeGroupLabel = ECEG_GROUPS.find((g) => g.id === activeGroup)?.label ?? activeGroup;

  function handleGroupChange(groupId: EcegGroup) {
    setActiveGroup(groupId);
    const first = ECEG_INDICATORS.find((i) => i.group === groupId && i.showByDefault !== false);
    if (first) setVariable(first.key);
  }

  const indicatorSelector = (
    <div className="space-y-2">
      {/* Group tabs */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Grupos de indicadores">
        {ECEG_GROUPS.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={activeGroup === g.id}
            onClick={() => handleGroupChange(g.id)}
            className={[
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske",
              activeGroup === g.id
                ? "bg-blue-eske text-white-eske"
                : "bg-white-eske dark:bg-[#112230] text-black-eske-60 dark:text-[#9AAEBE] hover:text-blue-eske border border-gray-eske-20 dark:border-white/10",
            ].join(" ")}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Indicator pills + dropdown for extras */}
      <div className="flex flex-wrap gap-1.5 items-center" role="radiogroup" aria-label="Indicador activo">
        {defaultIndicators.map((ind) => (
          <button
            key={ind.key}
            role="radio"
            aria-checked={variable === ind.key}
            onClick={() => setVariable(ind.key)}
            className={[
              "px-2 py-0.5 rounded text-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske",
              variable === ind.key
                ? "bg-bluegreen-eske text-white-eske font-medium"
                : "text-black-eske-60 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] underline underline-offset-2",
            ].join(" ")}
            title={ind.description}
          >
            {ind.label}
          </button>
        ))}

        {extraIndicators.length > 0 && (
          <select
            value={extraIndicators.some((i) => i.key === variable) ? variable : ""}
            onChange={(e) => { if (e.target.value) setVariable(e.target.value); }}
            className={SELECT_PILL_CLS}
            aria-label={`Más indicadores de ${activeGroupLabel}`}
          >
            <option value="">+ Más {activeGroupLabel}…</option>
            {extraIndicators.map((i) => (
              <option key={i.key} value={i.key}>{i.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );

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
      <div className="hidden sm:block bg-gray-eske-10 dark:bg-[#0D1E2C] rounded-lg border border-gray-eske-20 dark:border-white/10 p-3">
        <GeoEcegFilters
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
        <div className="p-4 space-y-4">
          <GeoEcegFilters
            {...filterProps}
            onConsultar={() => { handleConsultar(); setLeftOpen(false); }}
          />
          <div className="border-t border-gray-eske-20 dark:border-white/10 pt-3">
            <p className="text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE] mb-2">
              Indicador
            </p>
            {indicatorSelector}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 sm:px-6 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8]">
            Estadísticos Geoelectorales
          </h2>
          <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">
            Indicadores censales del ECEG 2020 por demarcación electoral
          </p>
        </div>

        {/* Scope label + error */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE]">
            {scopeLabel}
            {indicator && (
              <> — <span className="text-black-eske dark:text-[#EAF2F8]">{indicator.label}</span></>
            )}
          </p>
          {error && (
            <p className="text-xs text-red-eske">
              Error al cargar datos: {error}
            </p>
          )}
        </div>

        {/* Indicator selector — desktop only */}
        <div className="hidden sm:block bg-gray-eske-10 dark:bg-[#0D1E2C] rounded-lg border border-gray-eske-20 dark:border-white/10 p-3">
          {indicatorSelector}
        </div>

        {/* Map with legend overlay and loading spinner */}
        <div className="relative isolate">
          <GeoVisualizador
            scope={scope}
            layers={layers}
            height="560px"
            queryVersion={queryVersion}
          />

          {colorRamp && !isLoading && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{ background: "rgba(0,0,0,0.06)", zIndex: 300 }}
              aria-hidden="true"
            />
          )}

          {colorRamp && !isLoading && (
            <>
              <div className="sm:hidden">
                <GeoLegend colorRamp={colorRamp} compact />
              </div>
              <div className="hidden sm:block">
                <GeoLegend
                  colorRamp={colorRamp}
                  label={indicator?.label}
                  formatValue={(v) =>
                    v.toLocaleString("es-MX", { maximumFractionDigits: 1 })
                  }
                />
              </div>
            </>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-white-eske/75 dark:bg-[#0B1620]/75 z-[1000] flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-10 h-10 border-4 border-gray-eske-20 border-t-blue-eske rounded-full animate-spin"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-black-eske-60 dark:text-[#9AAEBE]">Cargando…</p>
              </div>
            </div>
          )}
        </div>

        {/* Source */}
        <p className="text-xs text-center text-black-eske-60 dark:text-[#9AAEBE]">
          Fuente: INEGI — Estadísticas Censales a Escalas Geoelectorales (ECEG 2020).
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
