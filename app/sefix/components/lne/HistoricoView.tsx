"use client";

import { useState, useTransition, useCallback } from "react";
import { useLneHistorico } from "@/app/sefix/hooks/useLneHistorico";
import type { Ambito } from "@/lib/sefix/seriesUtils";
import GeoFilter, { type GeoInfo } from "./GeoFilter";
import DynamicTextBlock from "./DynamicTextBlock";
import G1TrendChart from "./charts/G1TrendChart";
import G2BarChart from "./charts/G2BarChart";
import G3SexChart from "./charts/G3SexChart";
import HistoricoDataTable from "./HistoricoDataTable";
import MobileBottomBar from "./MobileBottomBar";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";

// ──────────────────────────────────────────────
// Helpers de UI
// ──────────────────────────────────────────────
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-lg bg-gray-eske-10 dark:bg-[#21425E] animate-pulse"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 text-center">
      <h3 className="text-base font-semibold text-black-eske dark:text-blue-eske-40">{title}</h3>
      {subtitle && (
        <p className="text-xs text-black-eske-40 dark:text-[#C7D6E0] mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center py-24" role="status" aria-live="polite">
      <div className="w-10 h-10 border-4 border-gray-eske-20 dark:border-white/20 border-t-blue-eske rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium text-black-eske-10 dark:text-[#C7D6E0] mb-1">Cargando datos de la consulta</p>
      <p className="text-xs text-black-eske-10 dark:text-[#6D8294] text-center max-w-xs">Por favor, espera.</p>
    </div>
  );
}

// ──────────────────────────────────────────────
// Modal de Metodología de Proyección
// ──────────────────────────────────────────────
function ModalMetodologia({ onClose }: { onClose: () => void }) {
  const modalRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-metodologia-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black-eske/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        className="relative w-full max-w-md bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-eske-20 dark:border-white/10">
          <h2
            id="modal-metodologia-title"
            className="text-base font-semibold text-bluegreen-eske flex items-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Metodología de Proyección
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de metodología"
            className="text-black-eske-20 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 text-sm text-black-eske dark:text-[#C7D6E0] leading-relaxed max-h-[70vh] overflow-y-auto">
          <p>
            La proyección utiliza un{" "}
            <strong>modelo de tasa de crecimiento mensual compuesto</strong>{" "}
            basado en los datos históricos del año en curso.
          </p>

          <div>
            <p className="font-semibold text-bluegreen-eske mb-2">Pasos del cálculo:</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li><strong>Datos base:</strong> Cortes mensuales del año actual.</li>
              <li><strong>Tasa de crecimiento:</strong> Tasa mensual compuesta entre el primer y último mes disponibles.</li>
              <li><strong>Proyección:</strong> Se aplica la tasa hasta diciembre.</li>
              <li><strong>Visualización:</strong> Líneas punteadas = valores proyectados.</li>
            </ol>
          </div>

          <div>
            <p className="font-semibold text-bluegreen-eske mb-2">Fórmula:</p>
            <div className="bg-gray-eske-10 dark:bg-[#112230] rounded-lg p-3 border-l-4 border-bluegreen-eske font-mono text-xs space-y-1">
              <p>Tasa = (Valor_final / Valor_inicial)^(1/(n−1)) − 1</p>
              <p>Proyección(i) = Último_valor × (1 + Tasa)^i</p>
            </div>
          </div>

          <div>
            <p className="font-semibold text-orange-eske mb-2 flex items-center gap-1">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              Consideraciones:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Asume una tasa de crecimiento <strong>constante</strong>.</li>
              <li>Es una <strong>proyección determinística</strong>, no un dato oficial.</li>
              <li>Proyecta hasta <strong>diciembre</strong> del año seleccionado.</li>
              <li>Los datos oficiales del INE prevalecen sobre la proyección.</li>
            </ul>
          </div>

          <p className="text-xs text-black-eske-10 dark:text-[#6D8294] text-center border-t border-gray-eske-20 dark:border-white/10 pt-3">
            Esta es una herramienta de referencia. Los datos oficiales son los publicados por el INE.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-eske-20 dark:border-white/10 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-bluegreen-eske text-white-eske text-sm font-semibold rounded-lg hover:bg-bluegreen-eske-80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-2"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Construir subtítulo de alcance de consulta
// ──────────────────────────────────────────────
function buildSubtitulo(ambito: Ambito, geoInfo: GeoInfo): string {
  const isGeo = geoInfo.entidad !== "Nacional";

  if (ambito === "extranjero") {
    if (isGeo) {
      const parts: string[] = [`Entidad: ${geoInfo.entidad}`];
      if (geoInfo.distrito !== "Todos") parts.push(`Distrito: ${geoInfo.distrito}`);
      if (geoInfo.municipio !== "Todos") parts.push(`Municipio: ${geoInfo.municipio}`);
      if (geoInfo.seccion !== "Todas") {
        const secLabel = (geoInfo.secciones?.length ?? 1) > 1 ? "Secciones" : "Sección";
        parts.push(`${secLabel}: ${geoInfo.seccion}`);
      }
      parts.push("Residentes en el Extranjero");
      return parts.join(" — ");
    }
    return "Ámbito: Nacional — Residentes en el Extranjero";
  }

  const secCount = geoInfo.secciones?.length ?? (geoInfo.seccion !== "Todas" ? 1 : 0);
  const secLabel = secCount > 1 ? "Secciones" : "Sección";

  const parts = [
    `Estado: ${geoInfo.entidad}`,
    `Distrito: ${geoInfo.distrito}`,
    `Municipio: ${geoInfo.municipio}`,
    `${secLabel}: ${geoInfo.seccion}`,
  ];
  return parts.join(" — ");
}

// ──────────────────────────────────────────────
// Vista principal
// ──────────────────────────────────────────────
export default function HistoricoView() {
  // Estado comprometido (committed) — lo que usa el hook
  const [ambito, setAmbito] = useState<Ambito>("nacional");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [geoInfo, setGeoInfo] = useState<GeoInfo>({
    entidad: "Nacional",
    distrito: "Todos",
    municipio: "Todos",
    seccion: "Todas",
  });

  // Spinner al consultar
  const [isPending, startTransition] = useTransition();

  // Modal de metodología (solo G1 con proyección)
  const [showMetodologia, setShowMetodologia] = useState(false);
  const closeMetodologia = useCallback(() => setShowMetodologia(false), []);

  // Estado de drawers mobile
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const closeLeft = useCallback(() => setLeftOpen(false), []);
  const closeRight = useCallback(() => setRightOpen(false), []);
  useEscapeKey(leftOpen, closeLeft);
  useEscapeKey(rightOpen, closeRight);

  const { isLoading, error, availableYears, g1Data, g2Data, g3SexData, nbLatest, nbAnnual, texts } =
    useLneHistorico(ambito, selectedYear, geoInfo);

  const busy = isLoading || isPending;

  // Año efectivo para encabezados
  const displayYear =
    selectedYear ?? availableYears[availableYears.length - 1] ?? new Date().getFullYear();

  const ambitoLabel = ambito === "nacional" ? "Nacional" : "Extranjero";
  const yearRange =
    availableYears.length >= 2
      ? `${availableYears[0]}–${displayYear}`
      : String(displayYear);

  const subtituloGeo = buildSubtitulo(ambito, geoInfo);

  // Subtítulo compartido con fecha del último corte disponible (para todas las gráficas)
  const latestFecha = g1Data?.latestFecha ?? "";
  const subtituloConCorte = busy
    ? "Cargando..."
    : latestFecha
      ? `${subtituloGeo} — Último corte: ${latestFecha}.`
      : subtituloGeo;

  // G1: ¿hay proyección? (año actual con meses incompletos)
  const hasProjection = (g1Data?.projected.length ?? 0) > 0;
  const g1Title = hasProjection
    ? `Proyección ${displayYear} — Padrón y LNE ${ambitoLabel}`
    : `Evolución ${displayYear} — Padrón y LNE ${ambitoLabel}`;
  const g1Subtitle = busy
    ? "Cargando..."
    : latestFecha
      ? `${subtituloGeo} — Último corte: ${latestFecha}${hasProjection ? ". Línea punteada = proyección a diciembre." : "."}`
      : subtituloGeo;

  // ── Callback de GeoFilter ──
  const handleConsultar = (newAmbito: Ambito, newYear: number, newGeoInfo: GeoInfo) => {
    startTransition(() => {
      setAmbito(newAmbito);
      setSelectedYear(newYear);
      setGeoInfo(newGeoInfo);
    });
    setLeftOpen(false);
  };

  // Sin datos después de cargar (filtro demasiado específico o sin cobertura)
  const noData = !isLoading && !isPending && availableYears.length === 0;

  if (noData) {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 pb-14 sm:pb-0">
        {leftOpen && (
          <div
            className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
            aria-hidden="true"
            onClick={closeLeft}
          />
        )}
        <div className={[
          "fixed left-0 top-0 bottom-14 w-[min(85vw,320px)]",
          "bg-white-eske dark:bg-[#18324A] overflow-y-auto z-40 shadow-xl",
          "transition-transform duration-300 ease-in-out",
          leftOpen ? "translate-x-0" : "-translate-x-full",
          "sm:static sm:z-auto sm:w-auto sm:overflow-visible",
          "sm:bg-transparent sm:shadow-none sm:translate-x-0 sm:bottom-auto",
        ].join(" ")}>
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-bluegreen-eske text-white-eske sm:hidden">
            <span className="text-sm font-semibold">Filtros de Consulta</span>
            <button
              type="button"
              onClick={closeLeft}
              aria-label="Cerrar filtros"
              className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-eske rounded"
            >
              ✕
            </button>
          </div>
          <div className="p-4 sm:p-0">
            <GeoFilter
              ambito={ambito}
              selectedYear={displayYear}
              availableYears={availableYears}
              onConsultar={handleConsultar}
            />
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-center" role="status">
          <p className="text-sm font-medium text-black-eske-10 dark:text-[#C7D6E0] mb-1">Sin datos para este filtro</p>
          <p className="text-xs text-black-eske-10 dark:text-[#6D8294] max-w-sm">
            No se encontraron registros históricos para{" "}
            <strong>{geoInfo.municipio !== "Todos" ? geoInfo.municipio : geoInfo.entidad}</strong>.
            Intenta con un filtro menos restrictivo.
          </p>
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" role="alert">
        <div className="w-12 h-12 mb-3 rounded-full bg-red-eske-10 dark:bg-red-eske/20 flex items-center justify-center" aria-hidden="true">
          <svg className="w-6 h-6 text-red-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm text-black-eske-10 dark:text-[#C7D6E0] font-medium">Error al cargar los datos históricos</p>
        <p className="text-xs text-black-eske-10 dark:text-[#6D8294] mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 pb-14 sm:pb-0">

      {/* ── Overlay izquierdo — solo mobile ── */}
      {leftOpen && (
        <div
          className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
          aria-hidden="true"
          onClick={closeLeft}
        />
      )}

      {/* ── Drawer izquierdo (filtros) ── */}
      <div className={[
        "fixed left-0 top-0 bottom-14 w-[min(85vw,320px)]",
        "bg-white-eske dark:bg-[#18324A] overflow-y-auto z-40 shadow-xl",
        "transition-transform duration-300 ease-in-out",
        leftOpen ? "translate-x-0" : "-translate-x-full",
        "sm:static sm:z-auto sm:w-auto sm:overflow-visible",
        "sm:bg-transparent sm:shadow-none sm:translate-x-0 sm:bottom-auto",
      ].join(" ")}>
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-bluegreen-eske text-white-eske sm:hidden">
          <span className="text-sm font-semibold">Filtros de Consulta</span>
          <button
            type="button"
            onClick={closeLeft}
            aria-label="Cerrar filtros"
            className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-eske rounded"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-0">
          <GeoFilter
            ambito={ambito}
            selectedYear={displayYear}
            availableYears={availableYears}
            onConsultar={handleConsultar}
          />
        </div>
      </div>

      {/* Estado de carga: spinner visible durante todo el proceso (isPending + isLoading) */}
      {busy ? (
        <LoadingState />
      ) : (
        /* Contenido: solo se muestra cuando hay datos listos */
        <div className="space-y-4">
          {/* Layout: gráficas + análisis textual */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 lg:gap-8 items-start">

            {/* Columna izquierda: gráficas */}
            <div className="space-y-4 lg:space-y-10">

              {/* G1 — Proyección / Evolución del año */}
              <div>
                <div className="mb-3 text-center">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-black-eske dark:text-blue-eske-40">{g1Title}</h3>
                    {hasProjection && (
                      <button
                        type="button"
                        onClick={() => setShowMetodologia(true)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-bluegreen-eske dark:text-bluegreen-eske-30 border border-bluegreen-eske-30 rounded hover:bg-bluegreen-eske-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Metodología
                      </button>
                    )}
                  </div>
                  {g1Subtitle && (
                    <p className="text-xs text-black-eske-40 dark:text-[#C7D6E0] mt-0.5">{g1Subtitle}</p>
                  )}
                </div>
                {!g1Data ? (
                  <ChartSkeleton height={320} />
                ) : (
                  <G1TrendChart data={g1Data} ambito={ambito} />
                )}
                <p className="text-[11px] text-black-eske-10 dark:text-[#6D8294] mt-2 text-center">
                  Fuente: INE. Estadística de Padrón Electoral y Lista Nominal del Electorado
                </p>
              </div>

              <hr className="border-gray-eske-20 dark:border-white/10 lg:hidden" />

              {/* G2 — Evolución anual */}
              <div>
                <SectionHeader
                  title={`Evolución Anual (${yearRange}) — Padrón y LNE ${ambitoLabel}`}
                  subtitle={subtituloConCorte}
                />
                {g2Data.length === 0 ? (
                  <ChartSkeleton height={300} />
                ) : (
                  <G2BarChart data={g2Data} ambito={ambito} />
                )}
                <p className="text-[11px] text-black-eske-10 dark:text-[#6D8294] mt-2 text-center">
                  Fuente: INE. Estadística de Padrón Electoral y Lista Nominal del Electorado
                </p>
              </div>

              <hr className="border-gray-eske-20 dark:border-white/10 lg:hidden" />

              {/* G3 — Evolución anual por sexo (solo ámbito nacional) */}
              <div>
                <SectionHeader
                  title={`Evolución Anual por Sexo (${yearRange}) — ${ambitoLabel}`}
                  subtitle={subtituloConCorte}
                />
                {g3SexData.length === 0 ? (
                  <ChartSkeleton height={320} />
                ) : (
                  <G3SexChart
                    data={g3SexData}
                    ambito={ambito}
                    nbLatest={nbLatest}
                    nbAnnual={nbAnnual}
                    nbScope={
                      geoInfo.municipio !== "Todos"
                        ? geoInfo.municipio
                        : geoInfo.entidad !== "Nacional"
                          ? geoInfo.entidad
                          : ambito === "extranjero"
                            ? "Extranjero"
                            : "Nacional"
                    }
                  />
                )}
                <p className="text-[11px] text-black-eske-10 dark:text-[#6D8294] mt-2 text-center">
                  Fuente: INE. Estadística de Padrón Electoral y Lista Nominal del Electorado
                </p>
              </div>

            </div>

            {/* Overlay derecho — solo mobile cuando está abierto */}
            {rightOpen && (
              <div
                className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
                aria-hidden="true"
                onClick={closeRight}
              />
            )}

            {/* Drawer derecho / col2 desktop */}
            <div className={[
              "fixed right-0 top-0 bottom-14 w-[min(85vw,320px)]",
              "bg-white-eske dark:bg-[#18324A] overflow-y-auto z-40 shadow-xl",
              "transition-transform duration-300 ease-in-out",
              rightOpen ? "translate-x-0" : "translate-x-full",
              "sm:static sm:z-auto sm:w-auto sm:overflow-visible",
              "sm:bg-transparent sm:shadow-none sm:translate-x-0 sm:bottom-auto",
              "lg:sticky lg:top-24 sm:mt-4 lg:mt-0 sm:pt-4 lg:pt-0 sm:border-t lg:border-t-0 sm:border-gray-eske-20 dark:sm:border-white/10",
            ].join(" ")}>
              <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-bluegreen-eske text-white-eske sm:hidden">
                <span className="text-sm font-semibold">Análisis Textual</span>
                <button
                  type="button"
                  onClick={closeRight}
                  aria-label="Cerrar análisis"
                  className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-eske rounded"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 sm:p-0">
                {!texts ? (
                  <div className="space-y-3">
                    {[24, 80, 120, 100, 90, 80].map((h, i) => (
                      <div key={i} className="rounded-md bg-gray-eske-10 dark:bg-[#21425E] animate-pulse" style={{ height: h }} />
                    ))}
                  </div>
                ) : (
                  <DynamicTextBlock texts={{ ...texts, alcance: subtituloConCorte }} />
                )}
              </div>
            </div>
          </div>

          <hr className="border-gray-eske-20 dark:border-white/10" />

          {/* Tabla de Datos — debajo del grid de gráficas */}
          <HistoricoDataTable
            ambito={ambito}
            geoInfo={geoInfo}
            year={displayYear}
          />
        </div>
      )}

      {/* Modal de metodología — renderizado sobre el layout */}
      {showMetodologia && <ModalMetodologia onClose={closeMetodologia} />}

      {/* ── Barra inferior mobile ── */}
      <MobileBottomBar
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onFiltros={() => { setLeftOpen((v) => !v); setRightOpen(false); }}
        onAnalisis={() => { setRightOpen((v) => !v); setLeftOpen(false); }}
      />
    </div>
  );
}
