"use client";

import { useState, useCallback } from "react";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import { useEleccionesLocalesFilters } from "@/app/sefix/hooks/useEleccionesLocalesFilters";
import { useResultadosLocales, useResultadosLocalesAllYears } from "@/app/sefix/hooks/useResultadosLocales";
import { CARGO_DISPLAY_LABELS_LOC } from "@/lib/sefix/eleccionesLocalesConstants";
import type { ResultadosEleccionesData, ResultadosChartData } from "@/types/sefix.types";
import MobileBottomBar from "@/app/sefix/components/lne/MobileBottomBar";
import EleccionesLocalesFilters from "./EleccionesLocalesFilters";
import ResultadosLocalesStatCards from "./ResultadosLocalesStatCards";
import PartidosBarChartLoc from "./PartidosBarChartLoc";
import HistoricoPartidosLoc from "./HistoricoPartidosLoc";
import EleccionesLocalesDataTable from "./EleccionesLocalesDataTable";
import HistoricoComparison from "@/app/sefix/components/elecciones/HistoricoComparison";
import EleccionesLocalesDynamicText from "./EleccionesLocalesDynamicText";

const SOURCE = "Fuente: INE — Sistema de Consulta de la Estadística de las Elecciones Locales";

function toChartData(d: ResultadosEleccionesData): ResultadosChartData {
  return { ...d, coaliconesIncluidas: [] };
}

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
      <p className="text-xs text-red-eske">Cargando…</p>
    </div>
  );
}

function SectionHeader({ title, scope, scope2 }: { title: string; scope?: string; scope2?: string }) {
  return (
    <div className="mb-3 text-center">
      <h3 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">{title}</h3>
      {scope && <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">{scope}</p>}
      {scope2 && <p className="text-xs text-black-eske-60 dark:text-[#9AAEBE] mt-0.5">{scope2}</p>}
    </div>
  );
}

export default function EleccionesLocalesPanelContent() {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  useEscapeKey(
    leftOpen || rightOpen,
    useCallback(() => { setLeftOpen(false); setRightOpen(false); }, [])
  );

  const {
    pendingEstado, pendingAnio, pendingCargo, pendingPartidos,
    pendingTipo, pendingPrincipio, pendingCabecera, pendingMunicipio, pendingSecciones,
    committed, queryVersion, hasPending,
    setEstado, setAnio, setCargo, setPartidos, setTipo, setPrincipio,
    setCabecera, setMunicipio, setSecciones,
    handleConsultar, handleRestablecer,
    availableYears, loadingYears,
    cargosDisponibles, loadingCargos,
    partidosDisponibles, loadingPartidos, tiposDisponibles, principiosDisponibles,
  } = useEleccionesLocalesFilters();

  const { data, isLoading, error } = useResultadosLocales(committed, queryVersion);

  const { data: allYearsData, isLoading: loadingHistorico } = useResultadosLocalesAllYears({
    committed,
    queryVersion,
  });

  const cargoLabel = CARGO_DISPLAY_LABELS_LOC[committed.cargo] ?? committed.cargo;

  const geoPartes: string[] = [committed.estado];
  if (committed.cabecera) geoPartes.push(`Dist. ${committed.cabecera}`);
  if (committed.municipio) geoPartes.push(committed.municipio);
  if (committed.secciones.length === 1) geoPartes.push(`Secc. ${committed.secciones[0]}`);
  else if (committed.secciones.length > 1) geoPartes.push(`${committed.secciones.length} secciones`);
  const geoLabel = geoPartes.join(" — ");
  const chartScope = `${cargoLabel} — ${geoLabel} (${committed.anio})`;

  const yearsInData = allYearsData.map((d) => d.anio).sort((a, b) => a - b);
  const historicoScope =
    yearsInData.length >= 2
      ? `Participación ciudadana ${yearsInData[0]} – ${yearsInData[yearsInData.length - 1]}`
      : "Participación histórica";

  const chartDataHistorico: ResultadosChartData[] = allYearsData.map(toChartData);

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
        <EleccionesLocalesFilters
          pendingEstado={pendingEstado}
          pendingAnio={pendingAnio}
          pendingCargo={pendingCargo}
          pendingPartidos={pendingPartidos}
          pendingTipo={pendingTipo}
          pendingPrincipio={pendingPrincipio}
          pendingCabecera={pendingCabecera}
          pendingMunicipio={pendingMunicipio}
          pendingSecciones={pendingSecciones}
          setEstado={setEstado}
          setAnio={setAnio}
          setCargo={setCargo}
          setPartidos={setPartidos}
          setTipo={setTipo}
          setPrincipio={setPrincipio}
          setCabecera={setCabecera}
          setMunicipio={setMunicipio}
          setSecciones={setSecciones}
          hasPending={hasPending}
          onConsultar={handleConsultar}
          onRestablecer={handleRestablecer}
          availableYears={availableYears}
          loadingYears={loadingYears}
          cargosDisponibles={cargosDisponibles}
          loadingCargos={loadingCargos}
          partidosDisponibles={partidosDisponibles}
          loadingPartidos={loadingPartidos}
          tiposDisponibles={tiposDisponibles}
          principiosDisponibles={principiosDisponibles}
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
          <EleccionesLocalesFilters
            pendingEstado={pendingEstado}
            pendingAnio={pendingAnio}
            pendingCargo={pendingCargo}
            pendingPartidos={pendingPartidos}
            pendingTipo={pendingTipo}
            pendingPrincipio={pendingPrincipio}
            pendingCabecera={pendingCabecera}
            pendingMunicipio={pendingMunicipio}
            pendingSecciones={pendingSecciones}
            setEstado={setEstado}
            setAnio={setAnio}
            setCargo={setCargo}
            setPartidos={setPartidos}
            setTipo={setTipo}
            setPrincipio={setPrincipio}
            setCabecera={setCabecera}
            setMunicipio={setMunicipio}
            setSecciones={setSecciones}
            hasPending={hasPending}
            onConsultar={() => { handleConsultar(); setLeftOpen(false); }}
            onRestablecer={handleRestablecer}
            availableYears={availableYears}
            loadingYears={loadingYears}
            cargosDisponibles={cargosDisponibles}
            loadingCargos={loadingCargos}
            partidosDisponibles={partidosDisponibles}
            loadingPartidos={loadingPartidos}
            tiposDisponibles={tiposDisponibles}
            principiosDisponibles={principiosDisponibles}
          />
        </div>
      </div>

      {/* Grid de 2 columnas en lg: visualizaciones | sidebar análisis */}
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:items-start">

        {/* Columna principal */}
        <div className="space-y-8 min-w-0">
          {error && (
            <p className="text-sm text-red-eske py-8 text-center">{error}</p>
          )}

          {!error && (
            <>
              {/* KPIs */}
              {isLoading || !data ? (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-24 rounded-lg bg-gray-eske-10 dark:bg-white/10 animate-pulse"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              ) : (
                <ResultadosLocalesStatCards data={data} />
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
                  <PartidosBarChartLoc data={data} />
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
                {loadingHistorico || chartDataHistorico.length === 0 ? (
                  <ChartSkeleton height={220} />
                ) : (
                  <HistoricoComparison data={chartDataHistorico} />
                )}
                <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] mt-2 text-center">{SOURCE}</p>
              </div>

              {/* Tabla de datos */}
              <div>
                <SectionHeader title="Tabla de Datos" scope={data ? chartScope : undefined} />
                <EleccionesLocalesDataTable committed={committed} queryVersion={queryVersion} />
              </div>

              {/* Histórico por partido */}
              <div className="pt-6">
                <hr className="border-gray-eske-20 dark:border-white/10 mb-8" />
                <HistoricoPartidosLoc
                  committed={committed}
                  queryVersion={queryVersion}
                  cargosDisponibles={cargosDisponibles}
                  availableYears={availableYears}
                />
              </div>
            </>
          )}
        </div>

        {/* Sidebar derecho — desktop: estático; mobile: drawer desde la derecha */}
        <aside
          className={[
            // Mobile: drawer fijo sobre el contenido
            "fixed right-0 top-0 bottom-14 w-[min(85vw,320px)]",
            "bg-white-eske dark:bg-[#112230] shadow-xl z-40",
            "overflow-y-auto p-4 pt-6 transition-transform duration-300",
            rightOpen ? "translate-x-0" : "translate-x-full",
            // Desktop: columna estática sin drawer
            "sm:static sm:z-auto sm:overflow-visible sm:bg-transparent sm:shadow-none",
            "sm:translate-x-0 sm:w-auto sm:p-0 sm:pt-0",
            "lg:sticky lg:top-4",
          ].join(" ")}
          aria-label="Panel de análisis"
        >
          <EleccionesLocalesDynamicText
            data={data}
            committed={committed}
            isLoading={isLoading}
            onClose={() => setRightOpen(false)}
          />
        </aside>
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
