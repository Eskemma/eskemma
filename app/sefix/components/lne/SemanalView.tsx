"use client";

import {
  useState,
  useEffect,
  useCallback,
  useReducer,
  useRef,
  useMemo,
} from "react";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import MobileBottomBar from "./MobileBottomBar";
import { useLneSemanal, useGeoTerritorios } from "@/app/sefix/hooks/useLneSemanal";
import { useLneSemanalesSerie } from "@/app/sefix/hooks/useLneSemanalesSerie";
import { useLneOrigenMatriz } from "@/app/sefix/hooks/useLneOrigenMatriz";
import { ESTADOS_LIST } from "@/lib/sefix/constants";
import { claveEstadoSnake } from "@/lib/geo/estados";
import type { Ambito } from "@/lib/sefix/seriesUtils";
import type { GeoFilterState, GeoFilterAction } from "@/types/sefix.types";
import type { GeoInfo } from "./GeoFilter";

import {
  E1SerieChart,
  E2GroupBarsChart,
  E3GruposSerieChart,
  E4RangeChart,
} from "./charts/EdadCharts";
import {
  S1PyramidChart,
  S2AgeSexChart,
  S3SexoSerieChart,
  S4ParticipacionChart,
} from "./charts/SexoCharts";
import {
  O1HeatmapChart,
  O2PadronLneChart,
  O3OrigenSerieChart,
} from "./charts/OrigenCharts";
import SemanalDataTable from "./SemanalDataTable";
import SemanalTextBlock from "./SemanalTextBlock";

type SemanalDesglose = "edad" | "sexo" | "origen";

// ──────────────────────────────────────────────
// Constantes de UI
// ──────────────────────────────────────────────
const DESGLOSES: { id: SemanalDesglose; label: string }[] = [
  { id: "edad", label: "Rango de Edad" },
  { id: "sexo", label: "Distribución por Sexo" },
  { id: "origen", label: "Entidad de Origen" },
];

const RANGOS_EDAD = [
  "18", "19", "20_24", "25_29", "30_34", "35_39",
  "40_44", "45_49", "50_54", "55_59", "60_64", "65_y_mas",
];

const FUENTE = "Fuente: INE. Estadística de Padrón Electoral y Lista Nominal del Electorado.";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function fmtFechaLarga(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const meses = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10)]} ${y}`;
}

// ESTADO_MAP values are ASCII uppercase (e.g., "HIDALGO", "CIUDAD DE MEXICO")
// porEntidad keys are lowercase+underscore (e.g., "hidalgo", "ciudad_de_mexico")
function normalizeEntidadKey(nombre: string): string {
  return claveEstadoSnake(nombre);
}

function allSexValuesZero(data: Record<string, number>, rangos: string[]): boolean {
  return rangos.every(
    (r) => (data[`lista_${r}_hombres`] ?? 0) === 0 && (data[`lista_${r}_mujeres`] ?? 0) === 0,
  );
}

// ──────────────────────────────────────────────
// GeoReducer (mismo que GeoFilter.tsx)
// ──────────────────────────────────────────────
function geoReducer(state: GeoFilterState, action: GeoFilterAction): GeoFilterState {
  switch (action.type) {
    case "SELECT_ENTIDAD":
      return { status: "entidad_selected", entidad: action.entidad, cveEntidad: action.cveEntidad };
    case "SELECT_DISTRITO":
      if (
        state.status !== "entidad_selected" &&
        state.status !== "distrito_selected" &&
        state.status !== "municipio_selected" &&
        state.status !== "seccion_selected"
      ) return state;
      return { ...state, status: "distrito_selected", distrito: action.distrito };
    case "SELECT_MUNICIPIO":
      if (
        state.status !== "distrito_selected" &&
        state.status !== "municipio_selected" &&
        state.status !== "seccion_selected"
      ) return state;
      return { ...state, status: "municipio_selected", municipio: action.municipio };
    case "SELECT_SECCION":
      if (state.status !== "municipio_selected" && state.status !== "seccion_selected") return state;
      if (action.seccion.length === 0) return { ...state, status: "municipio_selected" };
      return { ...state, status: "seccion_selected", seccion: action.seccion };
    case "RESET":
      return { status: "idle" };
    default:
      return state;
  }
}

function buildGeoInfo(
  geoState: GeoFilterState,
  distritos: { cve: string; nombre: string }[],
  municipios: { cve: string; nombre: string }[],
): GeoInfo {
  const entidad = geoState.status !== "idle" ? geoState.entidad : "Nacional";

  let distrito = "Todos";
  if (
    geoState.status === "distrito_selected" ||
    geoState.status === "municipio_selected" ||
    geoState.status === "seccion_selected"
  ) {
    const found = distritos.find((d) => d.cve === geoState.distrito);
    distrito = found?.nombre ?? geoState.distrito;
  }

  let municipio = "Todos";
  if (geoState.status === "municipio_selected" || geoState.status === "seccion_selected") {
    const found = municipios.find((m) => m.cve === geoState.municipio);
    municipio = found?.nombre ?? geoState.municipio;
  }

  const seccionRaw =
    geoState.status === "seccion_selected" ? geoState.seccion : undefined;
  const seccion = seccionRaw ? seccionRaw.join(", ") : "Todas";

  return {
    entidad,
    distrito,
    municipio,
    seccion,
    cveDistrito:
      geoState.status === "distrito_selected" ||
        geoState.status === "municipio_selected" ||
        geoState.status === "seccion_selected"
        ? geoState.distrito
        : undefined,
    cveMunicipio:
      geoState.status === "municipio_selected" || geoState.status === "seccion_selected"
        ? geoState.municipio
        : undefined,
    secciones: seccionRaw,
  };
}

function geoInfoToScopeLabel(info: GeoInfo): string {
  return `Estado: ${info.entidad} — Distrito: ${info.distrito} — Municipio: ${info.municipio} — Sección: ${info.seccion}`;
}

// ──────────────────────────────────────────────
// Componentes de UI reutilizables
// ──────────────────────────────────────────────
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="w-full flex flex-col items-center justify-center gap-3"
      style={{ minHeight: height }}
      role="status"
      aria-live="polite"
    >
      <div className="w-10 h-10 border-4 border-gray-eske-20 border-t-blue-eske rounded-full animate-spin" aria-hidden="true" />
      <p className="text-sm font-medium text-black-eske-10">Procesando datos…</p>
    </div>
  );
}

interface ChartCardProps {
  titulo: string;
  scopeLabel?: string;
  children: React.ReactNode;
}

function ChartCard({ titulo, scopeLabel, children }: ChartCardProps) {
  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-lg border border-gray-eske-20 dark:border-white/10 px-2 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3">
      <h3 className="text-sm font-bold text-black-eske dark:text-[#C7D6E0] text-center leading-snug">{titulo}</h3>
      {scopeLabel && <p className="text-[11px] text-black-eske-20 dark:text-[#9AAEBE] text-center mt-0.5">{scopeLabel}</p>}
      <div className="mt-3">{children}</div>
      <p className="text-[10px] text-black-eske-20 dark:text-[#9AAEBE] text-center mt-3 pt-2 border-t border-gray-eske-10 dark:border-white/10">
        {FUENTE}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────
// Props comunes de paneles
// ──────────────────────────────────────────────
interface PanelProps {
  ambito: Ambito;
  entidad?: string;
  cveDistrito?: string;
  cveMunicipio?: string;
  secciones?: string[];
  scopeLabel: string;
  queryVersion: number;
  rightOpen: boolean;
  onCloseRight: () => void;
}

// ──────────────────────────────────────────────
// Sub-panel Edad
// ──────────────────────────────────────────────
function EdadPanel({ ambito, entidad, cveDistrito, cveMunicipio, secciones, scopeLabel, queryVersion, rightOpen, onCloseRight }: PanelProps) {
  const { isLoading, error, data, fecha } =
    useLneSemanal("edad", ambito, undefined, entidad ?? null, queryVersion, cveDistrito, cveMunicipio, secciones);
  const { serie, isLoading: serieLoading } = useLneSemanalesSerie("edad", ambito, entidad, queryVersion, cveDistrito, cveMunicipio, secciones);

  if (error) return <p className="text-sm text-red-eske py-8 text-center">{error}</p>;

  const tituloBase = (nombre: string) =>
    `${nombre} — ${fmtFechaLarga(fecha)} — ${capitalize(ambito)}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:gap-6">
        <div className="space-y-4 lg:space-y-8 min-w-0">

          {/* E1 — Serie temporal por rango */}
          <ChartCard
            titulo={tituloBase("Evolución y Proyección Semanal del Padrón y LNE")}
            scopeLabel={scopeLabel}
          >
            {serieLoading ? <ChartSkeleton height={380} /> : <E1SerieChart serie={serie} ambito={ambito} />}
          </ChartCard>

          <hr className="border-gray-eske-20 lg:hidden" />

          {/* E2 — LNE por grupos */}
          <ChartCard
            titulo={tituloBase("Lista Nominal Electoral por Grupo Etario")}
            scopeLabel={scopeLabel}
          >
            {isLoading || !data ? <ChartSkeleton height={210} /> : <E2GroupBarsChart data={data} ambito={ambito} />}
          </ChartCard>

          <hr className="border-gray-eske-20 lg:hidden" />

          {/* E3 — Proyección por grupo */}
          <ChartCard
            titulo={tituloBase("Evolución y Proyección Semanal por Grupo Etario")}
            scopeLabel={scopeLabel}
          >
            {serieLoading ? <ChartSkeleton height={360} /> : <E3GruposSerieChart serie={serie} ambito={ambito} />}
          </ChartCard>

          <hr className="border-gray-eske-20 lg:hidden" />

          {/* E4 — Barras por rango individual */}
          <ChartCard
            titulo={tituloBase("Padrón y LNE por Rango de Edad")}
            scopeLabel={scopeLabel}
          >
            {isLoading || !data ? (
              <ChartSkeleton height={300} />
            ) : (
              <E4RangeChart data={data} ambito={ambito} />
            )}
          </ChartCard>
        </div>

        {/* Overlay derecho — solo mobile cuando está abierto */}
        {rightOpen && (
          <div
            className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
            aria-hidden="true"
            onClick={onCloseRight}
          />
        )}

        {/* Drawer derecho / col2 desktop */}
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
            <span className="text-sm font-semibold">Análisis Textual</span>
            <button
              type="button"
              onClick={onCloseRight}
              aria-label="Cerrar análisis"
              className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-eske rounded"
            >
              ✕
            </button>
          </div>
          <div className="p-4 sm:p-0">
            <SemanalTextBlock
              tipo="edad"
              ambito={ambito}
              fecha={fecha}
              data={data ?? {}}
              serie={serie}
              isLoading={isLoading}
              scopeLabel={scopeLabel}
            />
          </div>
        </div>
      </div>

      <hr className="border-gray-eske-20" />

      {/* DataTable — fuera del grid, siempre ancho completo */}
      <SemanalDataTable
        tipo="edad"
        ambito={ambito}
        scopeLabel={scopeLabel}
        entidad={entidad}
        cveDistrito={cveDistrito}
        cveMunicipio={cveMunicipio}
        secciones={secciones}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-panel Sexo
// ──────────────────────────────────────────────
function SexoPanel({ ambito, entidad, cveDistrito, cveMunicipio, secciones, scopeLabel, queryVersion, rightOpen, onCloseRight }: PanelProps) {
  const {
    isLoading: loadingEdad,
    error: errorEdad,
    data: dataEdad,
    fecha,
  } = useLneSemanal("edad", ambito, undefined, entidad ?? null, queryVersion, cveDistrito, cveMunicipio, secciones, true);

  const { isLoading: loadingSexo, data: dataSexo } =
    useLneSemanal("sexo", ambito, undefined, entidad ?? null, queryVersion, cveDistrito, cveMunicipio, secciones);

  const { serie: serieSexo, isLoading: serieLoading } =
    useLneSemanalesSerie("sexo", ambito, entidad, queryVersion, cveDistrito, cveMunicipio, secciones);

  if (errorEdad) return <p className="text-sm text-red-eske py-8 text-center">{errorEdad}</p>;

  const tituloBase = (nombre: string) =>
    `${nombre} — ${fmtFechaLarga(fecha)} — ${capitalize(ambito)}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:gap-6">
        <div className="space-y-4 lg:space-y-8 min-w-0">

          {/* S1 — Pirámide */}
          <ChartCard titulo={tituloBase("Pirámide de LNE por Rango de Edad y Sexo")} scopeLabel={scopeLabel}>
            {loadingEdad || !dataEdad ? (
              <ChartSkeleton height={360} />
            ) : (
              <S1PyramidChart data={dataEdad} ambito={ambito} />
            )}
          </ChartCard>

          <hr className="border-gray-eske-20 lg:hidden" />

          {/* S2 — LNE por grupo etario × sexo */}
          <ChartCard titulo={tituloBase("LNE por Grupo Etario y Sexo")} scopeLabel={scopeLabel}>
            {loadingEdad || !dataEdad ? (
              <ChartSkeleton height={280} />
            ) : (
              <S2AgeSexChart data={dataEdad} ambito={ambito} />
            )}
          </ChartCard>

          <hr className="border-gray-eske-20 lg:hidden" />

          {/* S3 — Serie temporal por sexo */}
          <ChartCard
            titulo={tituloBase("Evolución y Proyección Semanal por Sexo")}
            scopeLabel={scopeLabel}
          >
            {serieLoading ? (
              <ChartSkeleton height={320} />
            ) : (
              <S3SexoSerieChart serie={serieSexo} ambito={ambito} dataSexo={dataSexo ?? {}} />
            )}
          </ChartCard>

          <hr className="border-gray-eske-20 lg:hidden" />

          {/* S4 — Padrón vs LNE por sexo */}
          <ChartCard
            titulo={tituloBase("Padrón Electoral vs Lista Nominal por Sexo")}
            scopeLabel={scopeLabel}
          >
            {loadingSexo || !dataSexo ? <ChartSkeleton height={280} /> : <S4ParticipacionChart data={dataSexo} ambito={ambito} />}
          </ChartCard>
        </div>

        {/* Overlay derecho — solo mobile cuando está abierto */}
        {rightOpen && (
          <div
            className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
            aria-hidden="true"
            onClick={onCloseRight}
          />
        )}

        {/* Drawer derecho / col2 desktop */}
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
            <span className="text-sm font-semibold">Análisis Textual</span>
            <button
              type="button"
              onClick={onCloseRight}
              aria-label="Cerrar análisis"
              className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-eske rounded"
            >
              ✕
            </button>
          </div>
          <div className="p-4 sm:p-0">
            <SemanalTextBlock
              tipo="sexo"
              ambito={ambito}
              fecha={fecha}
              data={dataSexo ?? {}}
              dataEdad={dataEdad}
              isLoading={loadingSexo}
              scopeLabel={scopeLabel}
            />
          </div>
        </div>
      </div>

      <hr className="border-gray-eske-20" />

      {/* DataTable — fuera del grid, siempre ancho completo */}
      <SemanalDataTable
        tipo="sexo"
        ambito={ambito}
        scopeLabel={scopeLabel}
        entidad={entidad}
        cveDistrito={cveDistrito}
        cveMunicipio={cveMunicipio}
        secciones={secciones}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-panel Origen
// ──────────────────────────────────────────────
function OrigenPanel({ ambito, entidad, cveDistrito, cveMunicipio, secciones, scopeLabel, queryVersion, rightOpen, onCloseRight }: PanelProps) {
  const [topN, setTopN] = useState(5);

  // Matriz completa por_entidad para O1/O2
  const { data: matrizData, isLoading: matrizLoading } = useLneOrigenMatriz();

  // Agregado ámbito (data, fecha) para SemanalTextBlock y DataTable
  const { isLoading, error, data, fecha } =
    useLneSemanal("origen", ambito, undefined, entidad ?? null, queryVersion, cveDistrito, cveMunicipio, secciones);

  if (error) return <p className="text-sm text-red-eske py-8 text-center">{error}</p>;

  const hasSubGeo = !!(cveDistrito || cveMunicipio || secciones?.length);

  // When sub-state geo filters are active, build synthetic porEntidad from useLneSemanal
  // so O1/O2 heatmap values match the text analysis (both use the same geo-filtered data).
  const porEntidad = useMemo(() => {
    const full = matrizData?.por_entidad ?? {};
    if (!entidad) return full;
    const key = normalizeEntidadKey(entidad);

    if (hasSubGeo && data && Object.keys(data).length > 0) {
      return {
        [key]: {
          nacional: ambito === "nacional" ? (data as Record<string, number>) : {},
          extranjero: ambito === "extranjero" ? (data as Record<string, number>) : {},
        },
      };
    }

    return key in full ? { [key]: full[key] } : full;
  }, [matrizData, entidad, ambito, data, hasSubGeo]);

  const tituloBase = (nombre: string) =>
    `${nombre} — ${fmtFechaLarga(fecha)} — ${capitalize(ambito)}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:gap-6">
        <div className="space-y-4 lg:space-y-8 min-w-0">

          {/* Top-N selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="topn-select" className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">Mostrar:</label>
            <select
              id="topn-select"
              value={topN}
              onChange={(e) => setTopN(parseInt(e.target.value))}
              className="text-xs border border-gray-eske-30 dark:border-white/10 rounded px-2 py-1 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-eske"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={0}>Todos (34)</option>
            </select>
          </div>

          {/* O1 — Heatmap LNE Origen × Receptor */}
          <ChartCard titulo={tituloBase("Lista Nominal por Entidad de Origen y Receptora")} scopeLabel={scopeLabel}>
            {matrizLoading ? (
              <ChartSkeleton height={topN * 22 + 80} />
            ) : (
              <O1HeatmapChart porEntidad={porEntidad} topN={topN} ambito={ambito} />
            )}
          </ChartCard>

          <hr className="border-gray-eske-20 lg:hidden" />

          {/* O2 — Heatmap Padrón / LNE / Diferencial */}
          <ChartCard titulo={tituloBase("Diferencial del Padrón Electoral y LNE por Entidad de Origen y Receptora")} scopeLabel={scopeLabel}>
            {matrizLoading ? (
              <ChartSkeleton height={topN * 22 + 80} />
            ) : (
              <O2PadronLneChart porEntidad={porEntidad} topN={topN} ambito={ambito} />
            )}
          </ChartCard>
        </div>

        {/* Overlay derecho — solo mobile cuando está abierto */}
        {rightOpen && (
          <div
            className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
            aria-hidden="true"
            onClick={onCloseRight}
          />
        )}

        {/* Drawer derecho / col2 desktop */}
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
            <span className="text-sm font-semibold">Análisis Textual</span>
            <button
              type="button"
              onClick={onCloseRight}
              aria-label="Cerrar análisis"
              className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-eske rounded"
            >
              ✕
            </button>
          </div>
          <div className="p-4 sm:p-0">
            <SemanalTextBlock
              tipo="origen"
              ambito={ambito}
              fecha={fecha}
              data={isLoading ? {} : (data ?? {})}
              isLoading={isLoading}
              scopeLabel={scopeLabel}
            />
          </div>
        </div>
      </div>

      <hr className="border-gray-eske-20" />

      {/* DataTable — fuera del grid, siempre ancho completo */}
      <SemanalDataTable
        tipo="origen"
        ambito={ambito}
        scopeLabel={scopeLabel}
        entidad={entidad}
        cveDistrito={cveDistrito}
        cveMunicipio={cveMunicipio}
        secciones={secciones}
      />

      <hr className="border-gray-eske-20" />

      {/* O3 — fuera del grid, siempre ancho completo */}
      <ChartCard titulo={tituloBase("Evolución Semanal por Entidad de Origen y Entidad Receptora")}>
        <O3OrigenSerieChart ambito={ambito} />
      </ChartCard>
    </div>
  );
}

// ──────────────────────────────────────────────
// Panel de filtros geográficos (cascade + Consultar)
// ──────────────────────────────────────────────
interface FilterPanelProps {
  committedAmbito: Ambito;
  onConsultar: (params: { ambito: Ambito; geoInfo: GeoInfo }) => void;
}

function SemanalFilterPanel({
  committedAmbito,
  onConsultar,
}: FilterPanelProps) {
  const [pendingAmbito, setPendingAmbito] = useState<Ambito>(committedAmbito);
  const [geoState, dispatch] = useReducer(geoReducer, { status: "idle" });
  const committedGeoRef = useRef<GeoFilterState>({ status: "idle" });

  // Estado del popover de secciones
  const [seccionSearch, setSeccionSearch] = useState("");
  const [seccionOpen, setSeccionOpen] = useState(false);
  const seccionInputRef = useRef<HTMLInputElement>(null);
  const seccionContainerRef = useRef<HTMLDivElement>(null);

  // Claves de la cascada
  const entidadNombre = geoState.status !== "idle" ? geoState.entidad : undefined;
  const cveDistrito =
    geoState.status === "distrito_selected" ||
      geoState.status === "municipio_selected" ||
      geoState.status === "seccion_selected"
      ? geoState.distrito
      : undefined;
  const cveMunicipio =
    geoState.status === "municipio_selected" || geoState.status === "seccion_selected"
      ? geoState.municipio
      : undefined;

  const { opciones: distritos, isLoading: loadingDistritos } = useGeoTerritorios("distrito", entidadNombre, undefined, undefined, undefined, "semanal");
  const { opciones: municipios, isLoading: loadingMunicipios } = useGeoTerritorios("municipio", entidadNombre, cveDistrito, undefined, undefined, "semanal");
  const { opciones: secciones, isLoading: loadingSecciones } = useGeoTerritorios("seccion", entidadNombre, undefined, cveMunicipio, undefined, "semanal");

  const seccionesSeleccionadas =
    geoState.status === "seccion_selected" ? geoState.seccion : [];

  const availableSecciones = secciones.filter(
    (s) =>
      !seccionesSeleccionadas.includes(s.cve) &&
      (seccionSearch === "" || s.cve.includes(seccionSearch)),
  );

  // Detectar cambios pendientes
  const hasPending =
    pendingAmbito !== committedAmbito ||
    JSON.stringify(geoState) !== JSON.stringify(committedGeoRef.current);

  // Cerrar popover secciones al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (seccionContainerRef.current && !seccionContainerRef.current.contains(e.target as Node)) {
        setSeccionOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Limpiar búsqueda de sección cuando cambia el municipio
  useEffect(() => { setSeccionSearch(""); setSeccionOpen(false); }, [cveMunicipio]);

  // Resetear cascada profunda cuando se cambia a extranjero
  useEffect(() => {
    if (
      pendingAmbito === "extranjero" &&
      (geoState.status === "distrito_selected" ||
        geoState.status === "municipio_selected" ||
        geoState.status === "seccion_selected")
    ) {
      dispatch({ type: "SELECT_ENTIDAD", entidad: geoState.entidad, cveEntidad: geoState.cveEntidad });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAmbito]);

  // Handlers
  function handleEntidadChange(nombre: string) {
    if (nombre === "") {
      dispatch({ type: "RESET" });
    } else {
      const cve = ESTADOS_LIST.find((e) => e.nombre === nombre)?.key ?? "";
      dispatch({ type: "SELECT_ENTIDAD", entidad: nombre, cveEntidad: cve });
    }
  }

  const addSeccion = useCallback(
    (cve: string) => {
      dispatch({ type: "SELECT_SECCION", seccion: [...seccionesSeleccionadas, cve] });
      setSeccionSearch("");
      seccionInputRef.current?.focus();
    },
    [seccionesSeleccionadas],
  );

  const removeSeccion = useCallback(
    (cve: string) => {
      dispatch({ type: "SELECT_SECCION", seccion: seccionesSeleccionadas.filter((c) => c !== cve) });
    },
    [seccionesSeleccionadas],
  );

  function handleConsultar() {
    committedGeoRef.current = { ...geoState };
    onConsultar({
      ambito: pendingAmbito,
      geoInfo: buildGeoInfo(geoState, distritos, municipios),
    });
  }

  // Label de geo status
  const distritoLabel = cveDistrito
    ? (distritos.find((d) => d.cve === cveDistrito)?.nombre ?? cveDistrito) : "";
  const municipioLabel = cveMunicipio
    ? (municipios.find((m) => m.cve === cveMunicipio)?.nombre ?? cveMunicipio) : "";
  const secLabel =
    geoState.status === "seccion_selected"
      ? `Sec. ${geoState.seccion.join(", ")}`
      : "";

  const geoLabel =
    geoState.status === "idle" ? "Nacional"
      : geoState.status === "entidad_selected" ? geoState.entidad
        : geoState.status === "distrito_selected" ? `${geoState.entidad} / ${distritoLabel}`
          : geoState.status === "municipio_selected" ? `${geoState.entidad} / ${municipioLabel}`
            : `${geoState.entidad} / ${secLabel}`;

  return (
    <div className="p-4 bg-gray-eske-10 dark:bg-[#112230] rounded-lg border border-gray-eske-20 dark:border-white/10 space-y-3">

      {/* Fila 1: Ámbito + Indicador geo */}
      <div className="flex flex-wrap items-start sm:items-center gap-3 sm:gap-4">

        {/* Ámbito */}
        <fieldset>
          <legend className="sr-only">Ámbito de datos</legend>
          <div className="flex gap-3">
            {(["nacional", "extranjero"] as Ambito[]).map((a) => (
              <label key={a} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="semanal-ambito"
                  value={a}
                  checked={pendingAmbito === a}
                  onChange={() => setPendingAmbito(a)}
                  className="accent-blue-eske"
                />
                <span className="text-sm text-black-eske dark:text-[#C7D6E0] capitalize">{a}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Indicador de alcance */}
        <div className="flex items-center gap-1.5 ml-auto">
          <svg className="w-3.5 h-3.5 text-bluegreen-eske shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs text-black-eske-20 dark:text-[#9AAEBE] font-medium">{geoLabel}</span>
          {geoState.status !== "idle" && (
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="ml-1 text-xs text-orange-eske hover:text-orange-eske-60 underline focus-visible:outline-none"
              aria-label="Restablecer filtro geográfico"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* Fila 2: Cascade geográfica + Consultar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">

        {/* Estado */}
        <div className="flex flex-col gap-1">
          <label htmlFor="semanal-entidad" className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">Estado</label>
          <select
            id="semanal-entidad"
            value={entidadNombre ?? ""}
            onChange={(e) => handleEntidadChange(e.target.value)}
            className="text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 bg-white-eske dark:bg-[#112230] dark:text-[#EAF2F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske w-full sm:w-auto sm:min-w-[160px]"
          >
            <option value="">Nacional</option>
            {ESTADOS_LIST.map((e) => (
              <option key={e.key} value={e.nombre}>{e.nombre}</option>
            ))}
          </select>
        </div>

        {/* Distrito (solo nacional con entidad) */}
        {pendingAmbito === "nacional" && geoState.status !== "idle" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="semanal-distrito" className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
              Distrito{" "}
              {loadingDistritos && <span className="text-red-eske">(cargando…)</span>}
            </label>
            <select
              id="semanal-distrito"
              value={cveDistrito ?? ""}
              onChange={(e) => dispatch({ type: "SELECT_DISTRITO", distrito: e.target.value })}
              disabled={loadingDistritos || distritos.length === 0}
              className="text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 bg-white-eske dark:bg-[#112230] dark:text-[#EAF2F8] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske w-full sm:w-auto sm:min-w-[200px]"
            >
              <option value="">Todos</option>
              {distritos
                .filter((d) => !d.nombre.toUpperCase().includes("RESIDENTES"))
                .map((d) => (
                  <option key={d.cve} value={d.cve}>{d.nombre}</option>
                ))}
            </select>
          </div>
        )}

        {/* Badge "Residentes Extranjero" en modo extranjero + entidad */}
        {pendingAmbito === "extranjero" && geoState.status !== "idle" && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">Distrito</span>
            <div className="text-sm border border-gray-eske-20 dark:border-white/10 rounded-md px-2 py-1.5 bg-gray-eske-10 dark:bg-[#112230] text-black-eske-20 dark:text-[#9AAEBE] w-full sm:w-auto sm:min-w-[220px] select-none">
              RESIDENTES EXTRANJERO
            </div>
          </div>
        )}

        {/* Municipio (solo nacional con distrito) */}
        {pendingAmbito === "nacional" && cveDistrito && (
          <div className="flex flex-col gap-1">
            <label htmlFor="semanal-municipio" className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
              Municipio{" "}
              {loadingMunicipios && <span className="text-red-eske">(cargando…)</span>}
            </label>
            <select
              id="semanal-municipio"
              value={cveMunicipio ?? ""}
              onChange={(e) => dispatch({ type: "SELECT_MUNICIPIO", municipio: e.target.value })}
              disabled={loadingMunicipios || municipios.length === 0}
              className="text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 bg-white-eske dark:bg-[#112230] dark:text-[#EAF2F8] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske w-full sm:w-auto sm:min-w-[180px]"
            >
              <option value="">Todos</option>
              {municipios.map((m) => (
                <option key={m.cve} value={m.cve}>{m.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sección — tags + popover (solo nacional con municipio) */}
        {pendingAmbito === "nacional" && cveMunicipio && (
          <div ref={seccionContainerRef} className="relative flex flex-col gap-1">
            <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
              Sección{" "}
              {loadingSecciones && <span className="text-red-eske">(cargando…)</span>}
              {seccionesSeleccionadas.length > 0 && (
                <span className="ml-1 text-blue-eske font-medium">
                  ({seccionesSeleccionadas.length} sel.)
                </span>
              )}
            </p>
            <div
              role="group"
              aria-label="Secciones seleccionadas"
              onClick={() => { setSeccionOpen(true); seccionInputRef.current?.focus(); }}
              className="border border-gray-eske-30 dark:border-white/10 rounded-md bg-white-eske dark:bg-[#112230] min-h-[34px] px-2 py-1 flex flex-wrap gap-1 items-center cursor-text w-full sm:w-auto sm:min-w-[180px]"
            >
              {seccionesSeleccionadas.map((cve) => (
                <span key={cve} className="flex items-center gap-0.5 bg-blue-eske text-white-eske text-xs px-1.5 py-0.5 rounded">
                  {cve}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeSeccion(cve); }}
                    className="opacity-80 hover:opacity-100 ml-0.5 text-sm leading-none"
                    aria-label={`Quitar sección ${cve}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={seccionInputRef}
                type="text"
                value={seccionSearch}
                onChange={(e) => { setSeccionSearch(e.target.value); setSeccionOpen(true); }}
                onFocus={() => setSeccionOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && seccionSearch === "" && seccionesSeleccionadas.length > 0) {
                    removeSeccion(seccionesSeleccionadas[seccionesSeleccionadas.length - 1]);
                  }
                  if (e.key === "Escape") setSeccionOpen(false);
                }}
                className="outline-none text-xs min-w-[36px] flex-1 bg-transparent"
                placeholder={seccionesSeleccionadas.length === 0 ? "Todas" : ""}
                aria-label="Buscar sección electoral"
                aria-expanded={seccionOpen}
                aria-haspopup="listbox"
              />
            </div>
            {seccionOpen && !loadingSecciones && (
              <div
                role="listbox"
                aria-label="Secciones disponibles"
                className="absolute top-full left-0 z-50 mt-1 w-full max-w-[calc(100vw-2rem)] sm:max-w-none border border-gray-eske-30 dark:border-white/10 rounded-md bg-white-eske dark:bg-[#112230] shadow-lg overflow-y-auto max-h-[140px]"
              >
                {seccionesSeleccionadas.length > 0 && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => { dispatch({ type: "SELECT_SECCION", seccion: [] }); setSeccionSearch(""); setSeccionOpen(false); }}
                    className="w-full text-left px-2 py-1 text-xs text-black-eske-20 dark:text-[#9AAEBE] italic hover:bg-gray-eske-10 dark:hover:bg-[#21425E] border-b border-gray-eske-10 dark:border-white/10"
                  >
                    Todas (limpiar selección)
                  </button>
                )}
                {availableSecciones.length === 0 ? (
                  <p className="text-xs text-black-eske-40 dark:text-[#6D8294] px-2 py-1 italic">
                    {seccionesSeleccionadas.length === 0 ? "Sin secciones" : "Todas seleccionadas"}
                  </p>
                ) : (
                  availableSecciones.map((s) => (
                    <button
                      key={s.cve}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => addSeccion(s.cve)}
                      className="w-full text-left px-2 py-0.5 text-xs text-black-eske dark:text-[#C7D6E0] hover:bg-blue-eske/10 dark:hover:bg-[#21425E] hover:text-blue-eske"
                    >
                      {s.nombre}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Botón Consultar — siempre visible; estilo primario cuando hay cambios pendientes */}
        <button
          onClick={handleConsultar}
          className={[
            "flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors w-full sm:w-auto sm:self-end",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske",
            hasPending
              ? "bg-blue-eske text-white-eske hover:bg-blue-eske-60"
              : "border border-blue-eske text-blue-eske bg-white-eske dark:bg-[#112230] hover:bg-blue-eske-10",
          ].join(" ")}
        >
          Consultar
        </button>

        {/* Aviso Extranjero */}
        {pendingAmbito === "extranjero" && (
          <div
            className="sm:ml-auto rounded-md px-3 py-2 text-xs text-black-eske sm:self-end"
            style={{ backgroundColor: "#bcd1e3" }}
          >
            Los datos de Residentes en el Extranjero sólo están disponibles a nivel nacional y estatal.
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Vista principal Semanal
// ──────────────────────────────────────────────
const DEFAULT_GEO_INFO: GeoInfo = {
  entidad: "Nacional",
  distrito: "Todos",
  municipio: "Todos",
  seccion: "Todas",
};

export default function SemanalView() {
  const [desglose, setDesglose] = useState<SemanalDesglose>("edad");

  // Estado comprometido (lo que los paneles usan)
  const [ambito, setAmbito] = useState<Ambito>("nacional");
  const [geoInfo, setGeoInfo] = useState<GeoInfo>(DEFAULT_GEO_INFO);
  const [queryVersion, setQueryVersion] = useState(0);

  // Estado de drawers mobile
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  useEscapeKey(leftOpen, useCallback(() => setLeftOpen(false), []));
  useEscapeKey(rightOpen, useCallback(() => setRightOpen(false), []));

  const handleConsultar = useCallback(
    ({ ambito: a, geoInfo: g }: { ambito: Ambito; geoInfo: GeoInfo }) => {
      setAmbito(a);
      setGeoInfo(g);
      setQueryVersion((v) => v + 1);
      setLeftOpen(false);
    },
    [],
  );

  const scopeLabel = geoInfoToScopeLabel(geoInfo);
  const onCloseRight = useCallback(() => setRightOpen(false), []);

  const panelProps: PanelProps = {
    ambito,
    entidad: geoInfo.entidad !== "Nacional" ? geoInfo.entidad : undefined,
    cveDistrito: geoInfo.cveDistrito,
    cveMunicipio: geoInfo.cveMunicipio,
    secciones: geoInfo.secciones,
    scopeLabel,
    queryVersion,
    rightOpen,
    onCloseRight,
  };

  return (
    <div className="space-y-6 pb-14 sm:pb-0">

      {/* ── Overlay izquierdo — solo mobile ── */}
      {leftOpen && (
        <div
          className="fixed inset-0 bg-black-eske/40 z-30 sm:hidden"
          aria-hidden="true"
          onClick={() => setLeftOpen(false)}
        />
      )}

      {/* ── Drawer izquierdo (filtros) ── */}
      <div className={[
        "fixed left-0 top-0 bottom-14 w-[min(85vw,320px)]",
        "bg-white-eske dark:bg-[#112230] overflow-y-auto z-40 shadow-xl",
        "transition-transform duration-300 ease-in-out",
        leftOpen ? "translate-x-0" : "-translate-x-full",
        "sm:static sm:z-auto sm:w-auto sm:overflow-visible",
        "sm:bg-transparent sm:shadow-none sm:translate-x-0 sm:bottom-auto",
      ].join(" ")}>
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-bluegreen-eske text-white-eske sm:hidden">
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
        <div className="p-4 sm:p-0">
          <SemanalFilterPanel
            committedAmbito={ambito}
            onConsultar={handleConsultar}
          />
        </div>
      </div>

      {/* ── Selector de categoría — siempre visible en una sola fila ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {DESGLOSES.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDesglose(d.id)}
            aria-pressed={desglose === d.id}
            className={[
              "px-2.5 py-0.5 text-[11px] font-medium rounded-full transition-colors border whitespace-nowrap shrink-0",
              desglose === d.id
                ? "bg-blue-eske text-white-eske border-blue-eske"
                : "bg-white-eske dark:bg-[#18324A] text-black-eske-40 dark:text-[#C7D6E0] border-gray-eske-30 dark:border-white/10 hover:border-blue-eske hover:text-blue-eske",
            ].join(" ")}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* ── Panel activo ── */}
      {desglose === "edad" && <EdadPanel   {...panelProps} />}
      {desglose === "sexo" && <SexoPanel   {...panelProps} />}
      {desglose === "origen" && <OrigenPanel {...panelProps} />}

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
