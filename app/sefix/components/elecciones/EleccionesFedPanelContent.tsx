"use client";

import { useState, useCallback } from "react";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import {
  useEleccionesFilters,
  useResultadosElecciones,
} from "@/app/sefix/hooks/useEleccionesFilters";
import { useResultadosAllYears } from "@/app/sefix/hooks/useResultados";
import MobileBottomBar from "@/app/sefix/components/lne/MobileBottomBar";
import EleccionesFilters from "./EleccionesFilters";
import ResultadosStatCards from "./ResultadosStatCards";
import PartidosBarChart from "./PartidosBarChart";
import HistoricoComparison from "./HistoricoComparison";
import HistoricoPartidos from "./HistoricoPartidos";
import EleccionesDataTable from "./EleccionesDataTable";
import EleccionesDynamicText from "./EleccionesDynamicText";
import { CARGO_DISPLAY_LABELS } from "@/lib/sefix/eleccionesConstants";

const SOURCE = "Fuente: INE - Sistema de Consulta de la Estadística de las Elecciones Federales";

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="w-full flex flex-col items-center justify-center gap-3 rounded-lg bg-gray-eske-10 dark:bg-white/10"
      style={{ height }}
    >
      <div
        className="w-8 h-8 border-4 border-gray-eske-20 border-t-blue-eske rounded-full animate-spin"
        aria-hidden="true"
      />
      <p className="text-xs text-red-eske dark:text-red-eske">Cargando…</p>
    </div>
  );
}

function SectionHeader({ title, scope, scope2 }: { title: string; scope?: string; scope2?: string }) {
  return (
    <div className="mb-3 text-center">
      <h3 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">{title}</h3>
      {scope && (
        <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">{scope}</p>
      )}
      {scope2 && (
        <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">{scope2}</p>
      )}
    </div>
  );
}

export default function EleccionesFedPanelContent() {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  useEscapeKey(
    leftOpen || rightOpen,
    useCallback(() => { setLeftOpen(false); setRightOpen(false); }, [])
  );

  const {
    pendingAnio, pendingCargo, pendingEstado, pendingPartidos,
    pendingTipo, pendingPrincipio, pendingCabecera, pendingMunicipio, pendingSecciones,
    pendingIncluirExtranjero,
    committed, queryVersion, hasPending,
    setAnio, setCargo, setEstado, setPartidos, setTipo, setPrincipio,
    setCabecera, setMunicipio, setSecciones, setIncluirExtranjero,
    handleConsultar, handleRestablecer,
    cargosDisponibles, partidosDisponibles,
    tiposDisponibles, principiosDisponibles,
    hasExtranjero,
  } = useEleccionesFilters();

  const { data, isLoading, error } = useResultadosElecciones(committed, queryVersion);

  const { data: allYearsData, isLoading: loadingHistorico } = useResultadosAllYears({
    committed,
    queryVersion,
  });

  const cargoLabel = CARGO_DISPLAY_LABELS[committed.cargo] ?? committed.cargo;

  // Scope completo: cargo — geo (año), incluyendo distrito/municipio/sección si aplica
  let geoLabel: string;
  if (committed.estado === "VOTO EN EL EXTRANJERO") {
    geoLabel = "VOTO EN EL EXTRANJERO";
  } else {
    const geoPartes: string[] = [];
    if (committed.estado) geoPartes.push(committed.estado);
    if (committed.cabecera) geoPartes.push(`Dist. ${committed.cabecera}`);
    if (committed.municipio) geoPartes.push(committed.municipio);
    if (committed.secciones.length === 1) geoPartes.push(`Secc. ${committed.secciones[0]}`);
    else if (committed.secciones.length > 1) geoPartes.push(`${committed.secciones.length} secciones`);
    geoLabel = geoPartes.length ? geoPartes.join(" — ") : "Nacional";
  }
  const chartScope = `${cargoLabel} — ${geoLabel} (${committed.anio})`;

  // Year range for historical chart title
  const yearsInData = allYearsData.map((d) => d.anio).sort((a, b) => a - b);
  const historicoScope =
    yearsInData.length >= 2
      ? `Participación ciudadana ${yearsInData[0]} – ${yearsInData[yearsInData.length - 1]}`
      : "Participación histórica";

  return (
    <div className="space-y-6 pb-14 sm:pb-0">
      {/* Overlays — solo mobile */}
      {leftOpen && (
        <div
          className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
          aria-hidden="true"
          onClick={() => setLeftOpen(false)}
        />
      )}
      {rightOpen && (
        <div
          className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
          aria-hidden="true"
          onClick={() => setRightOpen(false)}
        />
      )}

      {/* ── Barra de Filtros desktop (horizontal, encima del contenido) ── */}
      <div className="hidden sm:block">
        <EleccionesFilters
          pendingAnio={pendingAnio}
          pendingCargo={pendingCargo}
          pendingEstado={pendingEstado}
          pendingPartidos={pendingPartidos}
          pendingTipo={pendingTipo}
          pendingPrincipio={pendingPrincipio}
          pendingCabecera={pendingCabecera}
          pendingMunicipio={pendingMunicipio}
          pendingSecciones={pendingSecciones}
          pendingIncluirExtranjero={pendingIncluirExtranjero}
          setAnio={setAnio}
          setCargo={setCargo}
          setEstado={setEstado}
          setPartidos={setPartidos}
          setTipo={setTipo}
          setPrincipio={setPrincipio}
          setCabecera={setCabecera}
          setMunicipio={setMunicipio}
          setSecciones={setSecciones}
          setIncluirExtranjero={setIncluirExtranjero}
          hasPending={hasPending}
          onConsultar={handleConsultar}
          onRestablecer={handleRestablecer}
          cargosDisponibles={cargosDisponibles}
          partidosDisponibles={partidosDisponibles}
          tiposDisponibles={tiposDisponibles}
          principiosDisponibles={principiosDisponibles}
          hasExtranjero={hasExtranjero}
        />
      </div>

      {/* ── Drawer de Filtros mobile (izquierdo) ── */}
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
          <EleccionesFilters
            pendingAnio={pendingAnio}
            pendingCargo={pendingCargo}
            pendingEstado={pendingEstado}
            pendingPartidos={pendingPartidos}
            pendingTipo={pendingTipo}
            pendingPrincipio={pendingPrincipio}
            pendingCabecera={pendingCabecera}
            pendingMunicipio={pendingMunicipio}
            pendingSecciones={pendingSecciones}
            pendingIncluirExtranjero={pendingIncluirExtranjero}
            setAnio={setAnio}
            setCargo={setCargo}
            setEstado={setEstado}
            setPartidos={setPartidos}
            setTipo={setTipo}
            setPrincipio={setPrincipio}
            setCabecera={setCabecera}
            setMunicipio={setMunicipio}
            setSecciones={setSecciones}
            setIncluirExtranjero={setIncluirExtranjero}
            hasPending={hasPending}
            onConsultar={() => { handleConsultar(); setLeftOpen(false); }}
            onRestablecer={handleRestablecer}
            cargosDisponibles={cargosDisponibles}
            partidosDisponibles={partidosDisponibles}
            tiposDisponibles={tiposDisponibles}
            principiosDisponibles={principiosDisponibles}
            hasExtranjero={hasExtranjero}
          />
        </div>
      </div>

      {/* ── Layout 2 columnas: visualizaciones | análisis ── */}
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:items-start">

        {/* ── Col 1: Visualizaciones ── */}
        <div className="space-y-8 min-w-0">
          {error && (
            <p className="text-sm text-red-eske py-8 text-center">{error}</p>
          )}

          {!error && (
            <>
              {/* KPIs */}
              {isLoading || !data ? (
                <div className={`grid gap-3 ${committed.cargo !== "dip" && hasExtranjero ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}>
                  {[...Array(committed.cargo !== "dip" && hasExtranjero ? 5 : 4)].map((_, i) => (
                    <div
                      key={i}
                      className={[
                        "h-24 rounded-lg bg-gray-eske-10 dark:bg-white/10 animate-pulse",
                        committed.cargo !== "dip" && hasExtranjero && i === 2 ? "col-span-2 sm:col-span-1" : "",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              ) : (
                <ResultadosStatCards data={data} committed={committed} />
              )}

              {/* Distribución por partido */}
              <div>
                <SectionHeader
                  title="Distribución de votos por partido"
                  scope={data ? chartScope : undefined}
                />
                {isLoading || !data ? (
                  <ChartSkeleton height={320} />
                ) : (
                  <PartidosBarChart data={data} />
                )}
                <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] mt-2 text-center">{SOURCE}</p>
              </div>

              {/* Participación histórica */}
              <div>
                <SectionHeader
                  title={historicoScope}
                  scope={`${cargoLabel} — ${geoLabel}`}
                  scope2="todos los años disponibles"
                />
                {loadingHistorico || allYearsData.length === 0 ? (
                  <ChartSkeleton height={220} />
                ) : (
                  <HistoricoComparison data={allYearsData} />
                )}
                <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] mt-2 text-center">{SOURCE}</p>
              </div>

              {/* Tabla de datos */}
              <div>
                <SectionHeader title="Tabla de Datos" scope={data ? chartScope : undefined} />
                <EleccionesDataTable committed={committed} queryVersion={queryVersion} />
              </div>

              {/* Histórico por partido */}
              <div className="pt-6">
                <hr className="border-gray-eske-20 dark:border-white/10 mb-8" />
                <HistoricoPartidos committed={committed} queryVersion={queryVersion} />
              </div>
            </>
          )}
        </div>

        {/* ── Col 2: Análisis textual — estático en lg, drawer en mobile ── */}
        <div className={[
          "fixed right-0 top-0 bottom-14 w-[min(85vw,320px)]",
          "bg-white-eske dark:bg-[#112230] overflow-y-auto z-40 shadow-xl",
          "transition-transform duration-300 ease-in-out",
          rightOpen ? "translate-x-0" : "translate-x-full",
          "sm:static sm:z-auto sm:w-auto sm:overflow-visible",
          "sm:bg-transparent sm:shadow-none sm:translate-x-0 sm:bottom-auto",
          "sm:mt-4 lg:mt-0 sm:pt-4 lg:pt-0 sm:border-t lg:border-t-0 sm:border-gray-eske-20 dark:sm:border-white/10",
        ].join(" ")}>
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-bluegreen-eske text-white-eske sm:hidden">
            <span className="text-sm font-semibold">Análisis</span>
            <button
              type="button"
              onClick={() => setRightOpen(false)}
              aria-label="Cerrar análisis"
              className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-eske rounded"
            >
              ✕
            </button>
          </div>
          <div className="p-4 sm:p-0">
            <EleccionesDynamicText
              data={data}
              committed={committed}
              isLoading={isLoading}
              onClose={() => setRightOpen(false)}
            />
          </div>
        </div>
      </div>

      <MobileBottomBar
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onFiltros={() => { setLeftOpen((v) => !v); setRightOpen(false); }}
        onAnalisis={() => { setRightOpen((v) => !v); setLeftOpen(false); }}
      />
    </div>
  );
}
