"use client";
// app/sefix/components/geo/GeoElectoralFilters.tsx
// Horizontal filter bar for the Geo Electoral Map panel (mirrors EleccionesFilters layout).
import {
  AVAILABLE_YEARS,
  CARGO_DISPLAY_LABELS,
} from "@/lib/sefix/eleccionesConstants";
import { ESTADOS_LIST } from "@/lib/sefix/constants";
import {
  useEleccionesDistritos,
  useEleccionesSecciones,
} from "@/app/sefix/hooks/useEleccionesFilters";

const SELECT_CLS =
  "text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 " +
  "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske " +
  "w-full sm:w-auto sm:min-w-[140px]";

const LABEL_CLS = "text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE]";
const LABEL_DISABLED_CLS = "text-xs font-medium text-black-eske-60/50 dark:text-[#6D8294]";

const CARGOS = Object.entries(CARGO_DISPLAY_LABELS);

interface Props {
  pendingCargo: string;
  pendingAnio: number;
  pendingEstado: string;
  pendingCabecera: string;
  pendingSecciones: string[];
  setCargo: (v: string) => void;
  setAnio: (v: number) => void;
  setEstado: (v: string) => void;
  setCabecera: (v: string) => void;
  setSecciones: (v: string[]) => void;
  hasPending: boolean;
  onConsultar: () => void;
  onRestablecer: () => void;
}

export default function GeoElectoralFilters({
  pendingCargo, pendingAnio, pendingEstado, pendingCabecera, pendingSecciones,
  setCargo, setAnio, setEstado, setCabecera, setSecciones,
  hasPending, onConsultar, onRestablecer,
}: Props) {
  const { opciones: distritoOpciones, isLoading: loadingDistritos } =
    useEleccionesDistritos(pendingAnio, pendingCargo, pendingEstado);

  const { secciones: seccionesDisp, isLoading: loadingSecciones } =
    useEleccionesSecciones(pendingAnio, pendingCargo, pendingEstado, pendingCabecera, pendingCabecera);

  const hasEstado = !!pendingEstado;
  const hasCabecera = !!pendingCabecera;

  const cargoLabel = CARGO_DISPLAY_LABELS[pendingCargo] ?? pendingCargo;
  const scopeLabel = `${pendingAnio} — ${cargoLabel} — ${pendingEstado || "Nacional"}`;

  return (
    <div className="p-4 bg-gray-eske-10 dark:bg-[#0D1E2C] rounded-lg border border-gray-eske-20 dark:border-white/10 space-y-3">

      {/* Row 0: scope + Restablecer */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-black-eske-80 dark:text-[#9AAEBE] font-medium">
          {scopeLabel}
        </span>
        <button
          type="button"
          onClick={onRestablecer}
          className="text-xs text-orange-eske hover:text-orange-eske-60 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-eske rounded"
          aria-label="Restablecer filtros a valores por defecto"
        >
          Restablecer
        </button>
      </div>

      {/* Row 1: all filter controls + Consultar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">

        {/* Año */}
        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label htmlFor="geo-anio" className={LABEL_CLS}>Año</label>
          <select
            id="geo-anio"
            className={SELECT_CLS}
            value={pendingAnio}
            onChange={(e) => setAnio(Number(e.target.value))}
          >
            {AVAILABLE_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Cargo */}
        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label htmlFor="geo-cargo" className={LABEL_CLS}>Cargo</label>
          <select
            id="geo-cargo"
            className={SELECT_CLS}
            value={pendingCargo}
            onChange={(e) => setCargo(e.target.value)}
          >
            {CARGOS.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label htmlFor="geo-estado" className={LABEL_CLS}>Entidad federativa</label>
          <select
            id="geo-estado"
            className={SELECT_CLS}
            value={pendingEstado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">— Nacional —</option>
            {ESTADOS_LIST.map(({ key, nombre }) => (
              <option key={key} value={nombre}>{nombre}</option>
            ))}
          </select>
        </div>

        {/* Distrito federal */}
        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label
            htmlFor="geo-cabecera"
            className={hasEstado ? LABEL_CLS : LABEL_DISABLED_CLS}
          >
            Distrito Federal
          </label>
          <select
            id="geo-cabecera"
            className={SELECT_CLS}
            value={pendingCabecera}
            disabled={!hasEstado || loadingDistritos}
            onChange={(e) => setCabecera(e.target.value)}
          >
            <option value="">
              {loadingDistritos ? "Cargando…" : hasEstado ? "Todos" : "— elige estado —"}
            </option>
            {distritoOpciones.map((o) => (
              <option key={o.cve} value={o.cve}>{o.nombre}</option>
            ))}
          </select>
        </div>

        {/* Secciones — solo si hay distrito */}
        {hasCabecera && (
          <div className="flex flex-col gap-1 flex-1 sm:flex-none">
            <label htmlFor="geo-secciones" className={LABEL_CLS}>
              Secciones
              {pendingSecciones.length > 0 && (
                <span className="ml-1 text-blue-eske font-semibold">
                  ({pendingSecciones.length})
                </span>
              )}
            </label>
            <select
              id="geo-secciones"
              className={`${SELECT_CLS} h-[72px] sm:min-w-[160px]`}
              multiple
              disabled={loadingSecciones}
              value={pendingSecciones}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                setSecciones(selected);
              }}
            >
              {loadingSecciones && <option disabled>Cargando…</option>}
              {!loadingSecciones && seccionesDisp.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
        )}

        {/* Botón Consultar */}
        <div className="flex flex-col justify-end flex-1 sm:flex-none">
          <button
            type="button"
            onClick={onConsultar}
            disabled={!hasPending}
            className={[
              "rounded-md py-1.5 px-4 text-sm font-medium transition-colors whitespace-nowrap",
              hasPending
                ? "bg-blue-eske text-white-eske hover:bg-blue-eske-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
                : "bg-gray-eske-10 text-black-eske-60 dark:bg-white/5 dark:text-[#6D8294] cursor-not-allowed",
            ].join(" ")}
          >
            Consultar
          </button>
        </div>
      </div>
    </div>
  );
}
