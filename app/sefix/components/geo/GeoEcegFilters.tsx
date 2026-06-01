"use client";
// app/sefix/components/geo/GeoEcegFilters.tsx
// Filter bar for Estadísticos Geoelectorales (ECEG 2020).
// Visual style matches EleccionesFilters (text-sm, rounded-md, dark:bg-[#112230]).
// Order: [ECEG 2020] [Entidad] [Municipio] [|] [Distrito] [Sección] [Consultar] [Restablecer]
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { DISTRITO_TODOS } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegFilterMode } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { GeoOption } from "@/types/geo.types";

const ESTADOS = Object.keys(ESTADO_CVE_MAP);

// Matches EleccionesFilters SELECT_CLS exactly
const SELECT_CLS =
  "text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 " +
  "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske " +
  "w-full sm:w-auto sm:min-w-[140px] " +
  "disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

const LABEL_CLS =
  "block text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE] mb-0.5 select-none";

interface GeoEcegFiltersProps {
  // Pending state
  pendingEstado: string;
  pendingMunicipioNombre: string;
  pendingMunicipioCve: string;
  pendingCabeceraCve: string;
  pendingCabeceraLabel: string;
  pendingSecciones: string[];
  pendingFilterMode: EcegFilterMode;
  // Options
  municipioOptions: GeoOption[];
  distritoOptions: GeoOption[];
  seccionOptions: GeoOption[];
  municipioLoading: boolean;
  distritoLoading: boolean;
  seccionLoading: boolean;
  // Actions
  setEstado: (v: string) => void;
  setMunicipio: (cve: string, nombre: string) => void;
  setCabecera: (cve: string, label: string) => void;
  setSecciones: (v: string[]) => void;
  onConsultar: () => void;
  onRestablecer: () => void;
  hasPending: boolean;
}

export default function GeoEcegFilters({
  pendingEstado,
  pendingMunicipioNombre,
  pendingMunicipioCve,
  pendingCabeceraCve,
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
  onConsultar,
  onRestablecer,
  hasPending,
}: GeoEcegFiltersProps) {
  // Compute estado_id to build district labels like "1405 PUERTO VALLARTA"
  const estadoId = ESTADO_CVE_MAP[pendingEstado] ?? "";

  const municipioDisabled = !pendingEstado || municipioLoading;
  const distritoDisabled = !pendingEstado || distritoLoading;
  const seccionEnabled =
    (pendingFilterMode === "municipio" && Boolean(pendingMunicipioCve)) ||
    (pendingFilterMode === "distrito" &&
      Boolean(pendingCabeceraCve) &&
      pendingCabeceraCve !== DISTRITO_TODOS);

  function handleEstado(e: React.ChangeEvent<HTMLSelectElement>) {
    setEstado(e.target.value);
  }

  function handleMunicipio(e: React.ChangeEvent<HTMLSelectElement>) {
    const cve = e.target.value;
    if (!cve) { setMunicipio("", ""); return; }
    const opt = municipioOptions.find((o) => o.cve === cve);
    if (opt) setMunicipio(opt.cve, opt.nombre);
  }

  function handleDistrito(e: React.ChangeEvent<HTMLSelectElement>) {
    const cve = e.target.value;
    if (!cve) return;
    if (cve === DISTRITO_TODOS) {
      setCabecera(DISTRITO_TODOS, "Todos los distritos");
      return;
    }
    const opt = distritoOptions.find((o) => o.cve === cve);
    if (opt) {
      // Store display format "3102 PROGRESO" (same as dropdown choices)
      const cityName = opt.nombre.includes("–") ? opt.nombre.split("–")[1].trim() : opt.nombre;
      const prefix = `${estadoId}${opt.cve.slice(-2)}`;
      setCabecera(opt.cve, `${prefix} ${cityName}`);
    }
  }

  // Sección: add-and-pill via dropdown OR direct number entry
  function handleSeccionAdd(e: React.ChangeEvent<HTMLSelectElement>) {
    const cve = e.target.value;
    e.target.value = "";
    if (!cve || pendingSecciones.includes(cve)) return;
    setSecciones([...pendingSecciones, cve]);
  }

  function addSeccionByInput(raw: string) {
    const num = parseInt(raw.trim(), 10);
    if (isNaN(num) || num < 1) return;
    const cve = String(num).padStart(4, "0");
    // Validate against available options (if loaded)
    if (seccionOptions.length > 0 && !seccionOptions.find((o) => o.cve === cve)) return;
    if (pendingSecciones.includes(cve)) return;
    setSecciones([...pendingSecciones, cve]);
  }

  function handleSeccionInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSeccionByInput((e.target as HTMLInputElement).value);
      (e.target as HTMLInputElement).value = "";
    }
  }

  function handleSeccionInputBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (e.target.value.trim()) {
      addSeccionByInput(e.target.value);
      e.target.value = "";
    }
  }

  function removeSeccion(cve: string) {
    setSecciones(pendingSecciones.filter((s) => s !== cve));
  }

  const distritoSelectValue = pendingFilterMode === "distrito" ? pendingCabeceraCve : "";

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-2 flex-wrap">
      {/* ── Año badge ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5">
        <span className={LABEL_CLS}>Año</span>
        <span
          className={
            "inline-flex items-center px-2.5 py-1.5 rounded-md text-sm font-semibold " +
            "bg-bluegreen-eske/10 dark:bg-bluegreen-eske/20 text-bluegreen-eske " +
            "border border-bluegreen-eske/30 whitespace-nowrap"
          }
        >
          ECEG 2020
        </span>
      </div>

      {/* ── Entidad Federativa ────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5">
        <label className={LABEL_CLS} htmlFor="eceg-estado">
          Entidad Federativa
        </label>
        <select
          id="eceg-estado"
          value={pendingEstado}
          onChange={handleEstado}
          className={SELECT_CLS}
        >
          <option value="">Nacional</option>
          {ESTADOS.map((nombre) => (
            <option key={nombre} value={nombre}>
              {nombre}
            </option>
          ))}
        </select>
      </div>

      {/* ── Municipio ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5">
        <label className={LABEL_CLS} htmlFor="eceg-municipio">
          Municipio
        </label>
        <select
          id="eceg-municipio"
          value={pendingFilterMode === "municipio" ? pendingMunicipioCve : ""}
          onChange={handleMunicipio}
          disabled={municipioDisabled}
          className={SELECT_CLS}
          aria-busy={municipioLoading}
        >
          <option value="">{municipioLoading ? "Cargando…" : "Todos"}</option>
          {municipioOptions.map((o) => (
            <option key={o.cve} value={o.cve}>
              {o.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* ── Visual separator between paths ───────────────────────────── */}
      <div
        className="hidden sm:flex items-end pb-2 text-black-eske-30 dark:text-white/20 text-sm select-none"
        aria-hidden="true"
      >
        |
      </div>

      {/* ── Distrito Federal ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5">
        <label className={LABEL_CLS} htmlFor="eceg-distrito">
          Distrito Federal
        </label>
        <select
          id="eceg-distrito"
          value={distritoSelectValue}
          onChange={handleDistrito}
          disabled={distritoDisabled}
          className={SELECT_CLS}
          aria-busy={distritoLoading}
        >
          <option value="" disabled hidden>
            {distritoLoading ? "Cargando…" : "— Seleccionar —"}
          </option>
          <option value={DISTRITO_TODOS}>Todos los distritos</option>
          {distritoOptions.map((o) => {
            // API returns nombre = "D.F. 005 – PUERTO VALLARTA"
            // Extract only the city name after "–", then format as "1405 PUERTO VALLARTA"
            const cityName = o.nombre.includes("–")
              ? o.nombre.split("–")[1].trim()
              : o.nombre;
            const prefix = `${estadoId}${o.cve.slice(-2)}`;
            return (
              <option key={o.cve} value={o.cve}>
                {prefix} {cityName}
              </option>
            );
          })}
        </select>
      </div>

      {/* ── Sección (captura directa + selección de listado) ────────── */}
      <div className="flex flex-col gap-0.5">
        <label className={LABEL_CLS} htmlFor="eceg-seccion-input">
          Sección
        </label>

        {/* Fila: input numérico + select de listado */}
        <div className="flex gap-1 items-stretch">
          {/* Input de captura directa */}
          <input
            id="eceg-seccion-input"
            type="number"
            min={1}
            max={9999}
            placeholder="# sección"
            disabled={!seccionEnabled}
            onKeyDown={handleSeccionInputKeyDown}
            onBlur={handleSeccionInputBlur}
            className={
              "text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 " +
              "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske " +
              "disabled:opacity-40 disabled:cursor-not-allowed " +
              "w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            }
            aria-label="Escribir número de sección y presionar Enter para agregar"
            title="Escribe el número de sección y presiona Enter o Tab para agregar"
          />

          {/* Select del listado filtrado */}
          <select
            id="eceg-seccion"
            value=""
            onChange={handleSeccionAdd}
            disabled={!seccionEnabled || seccionLoading}
            className={SELECT_CLS + " flex-1"}
            aria-busy={seccionLoading}
            aria-label="Seleccionar sección del listado"
          >
            <option value="">
              {!seccionEnabled
                ? "— Seleccione municipio o distrito —"
                : seccionLoading
                ? "Cargando…"
                : pendingSecciones.length === 0
                ? "Todas"
                : "+ Agregar del listado"}
            </option>
            {seccionEnabled &&
              !seccionLoading &&
              seccionOptions
                .filter((o) => !pendingSecciones.includes(o.cve))
                .map((o) => (
                  <option key={o.cve} value={o.cve}>
                    {parseInt(o.cve, 10)}
                  </option>
                ))}
          </select>
        </div>

        {/* Secciones seleccionadas como pills */}
        {pendingSecciones.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 max-w-[280px]">
            {pendingSecciones.map((cve) => (
              <span
                key={cve}
                className={
                  "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded " +
                  "bg-blue-eske/10 dark:bg-blue-eske/20 text-blue-eske border border-blue-eske/30"
                }
              >
                {parseInt(cve, 10)}
                <button
                  type="button"
                  onClick={() => removeSeccion(cve)}
                  aria-label={`Quitar sección ${parseInt(cve, 10)}`}
                  className="hover:text-red-eske focus-visible:outline-none rounded"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setSecciones([])}
              className="text-[10px] text-black-eske-40 dark:text-[#6B8A9E] hover:text-orange-eske underline focus-visible:outline-none rounded"
            >
              Limpiar ({pendingSecciones.length})
            </button>
          </div>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex items-end gap-3">
        {/* Issue 4: Consultar solo aparece cuando hay cambios pendientes */}
        {hasPending && (
          <button
            type="button"
            onClick={onConsultar}
            className={
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors " +
              "bg-blue-eske text-white-eske hover:bg-blue-eske-60 " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
            }
            aria-label="Ejecutar consulta con los filtros seleccionados"
          >
            Consultar
          </button>
        )}

        {/* Issue 1: Restablecer como texto-link naranja (igual que EleccionesFilters) */}
        <button
          type="button"
          onClick={onRestablecer}
          className={
            "text-xs text-orange-eske hover:text-orange-eske-60 underline " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-eske rounded"
          }
          aria-label="Restablecer filtros a valores por defecto"
        >
          Restablecer
        </button>
      </div>
    </div>
  );
}
