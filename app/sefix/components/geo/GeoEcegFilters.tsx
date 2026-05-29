"use client";
// app/sefix/components/geo/GeoEcegFilters.tsx
// Filter bar for Estadísticos Geoelectorales (ECEG 2020).
// Order: [ECEG 2020] [Estado] [Municipio] [Distrito] [Sección] [Consultar] [Restablecer]
// Municipio and Distrito are mutually exclusive paths (enforced in useGeoEcegFilters).
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { DISTRITO_TODOS } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegFilterMode } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { GeoOption } from "@/types/geo.types";

const ESTADOS = Object.keys(ESTADO_CVE_MAP);

const SELECT_BASE =
  "text-xs border rounded px-2 py-1.5 " +
  "bg-white-eske dark:bg-[#0D1E2C] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske " +
  "disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors";

const SELECT_IDLE =
  SELECT_BASE +
  " border-gray-eske-30 dark:border-white/10 text-black-eske-70 dark:text-[#9AAEBE]";

const SELECT_ACTIVE =
  SELECT_BASE +
  " border-blue-eske dark:border-blue-eske text-black-eske dark:text-[#EAF2F8] font-medium";

const LABEL_CLS =
  "block text-[10px] font-semibold uppercase tracking-wide text-black-eske-40 dark:text-[#6B8A9E] mb-0.5 select-none";

interface GeoEcegFiltersProps {
  // Pending state
  pendingEstado: string;
  pendingMunicipioNombre: string;
  pendingMunicipioCve: string;
  pendingCabeceraCve: string;
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
  const estadoDisabled = false;
  const municipioDisabled = !pendingEstado;
  const distritoDisabled = !pendingEstado;

  // Sección enabled only when a specific municipio OR a specific (non-TODOS) district is selected
  const seccionEnabled =
    (pendingFilterMode === "municipio" && Boolean(pendingMunicipioCve)) ||
    (pendingFilterMode === "distrito" &&
      Boolean(pendingCabeceraCve) &&
      pendingCabeceraCve !== DISTRITO_TODOS);

  // Visual active state: which path is "lit up"
  const munActive = pendingFilterMode === "municipio" && Boolean(pendingMunicipioNombre);
  const distActive = pendingFilterMode === "distrito" && Boolean(pendingCabeceraCve);

  function handleEstado(e: React.ChangeEvent<HTMLSelectElement>) {
    setEstado(e.target.value);
  }

  function handleMunicipio(e: React.ChangeEvent<HTMLSelectElement>) {
    const cve = e.target.value;
    if (!cve) {
      // User cleared municipio — stay in municipio mode with no municipio
      setMunicipio("", "");
      return;
    }
    const opt = municipioOptions.find((o) => o.cve === cve);
    if (opt) setMunicipio(opt.cve, opt.nombre);
  }

  function handleDistrito(e: React.ChangeEvent<HTMLSelectElement>) {
    const cve = e.target.value;
    if (!cve) return; // placeholder option — user reopened without changing
    if (cve === DISTRITO_TODOS) {
      setCabecera(DISTRITO_TODOS, "Todos los distritos");
      return;
    }
    const opt = distritoOptions.find((o) => o.cve === cve);
    if (opt) setCabecera(opt.cve, opt.nombre);
  }

  function handleSecciones(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSecciones(selected);
  }

  // Compute the current display value for the Distrito select
  const distritoSelectValue = pendingFilterMode === "distrito" ? pendingCabeceraCve : "";

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-2 flex-wrap"
      role="search"
      aria-label="Filtros de consulta ECEG"
    >
      {/* ── Year badge ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5">
        <span className={LABEL_CLS}>Año</span>
        <span
          className={
            "inline-flex items-center px-2 py-1.5 rounded text-xs font-semibold " +
            "bg-bluegreen-eske/10 dark:bg-bluegreen-eske/20 text-bluegreen-eske " +
            "border border-bluegreen-eske/30"
          }
        >
          ECEG 2020
        </span>
      </div>

      {/* ── Estado ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 min-w-[9rem]">
        <label className={LABEL_CLS} htmlFor="eceg-estado">
          Entidad Federativa
        </label>
        <select
          id="eceg-estado"
          value={pendingEstado}
          onChange={handleEstado}
          disabled={estadoDisabled}
          className={pendingEstado ? SELECT_ACTIVE : SELECT_IDLE}
        >
          <option value="">Nacional</option>
          {ESTADOS.map((nombre) => (
            <option key={nombre} value={nombre}>
              {nombre.charAt(0) + nombre.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {/* ── Municipio ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 min-w-[10rem]">
        <label className={LABEL_CLS} htmlFor="eceg-municipio">
          Municipio
          {pendingFilterMode === "municipio" && pendingMunicipioNombre && (
            <span className="ml-1 normal-case font-normal text-blue-eske">activo</span>
          )}
        </label>
        <select
          id="eceg-municipio"
          value={pendingFilterMode === "municipio" ? pendingMunicipioCve : ""}
          onChange={handleMunicipio}
          disabled={municipioDisabled || municipioLoading}
          className={munActive ? SELECT_ACTIVE : SELECT_IDLE}
          aria-busy={municipioLoading}
        >
          <option value="">{municipioLoading ? "Cargando…" : "Todos"}</option>
          {municipioOptions.map((o) => (
            <option key={o.cve} value={o.cve}>
              {o.nombre.charAt(0) + o.nombre.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {/* ── Separador visual de paths ─────────────────────────────── */}
      <div
        className="hidden sm:flex items-end pb-1.5 text-black-eske-30 dark:text-white/20 text-xs select-none"
        aria-hidden="true"
      >
        |
      </div>

      {/* ── Distrito ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 min-w-[10rem]">
        <label className={LABEL_CLS} htmlFor="eceg-distrito">
          Distrito Federal
          {pendingFilterMode === "distrito" && pendingCabeceraCve && (
            <span className="ml-1 normal-case font-normal text-blue-eske">activo</span>
          )}
        </label>
        <select
          id="eceg-distrito"
          value={distritoSelectValue}
          onChange={handleDistrito}
          disabled={distritoDisabled || distritoLoading}
          className={distActive ? SELECT_ACTIVE : SELECT_IDLE}
          aria-busy={distritoLoading}
        >
          <option value="" disabled hidden>
            {distritoLoading ? "Cargando…" : "— Seleccionar —"}
          </option>
          <option value={DISTRITO_TODOS}>Todos los distritos</option>
          {distritoOptions.map((o) => (
            <option key={o.cve} value={o.cve}>
              Dto. {o.cve} — {o.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* ── Sección ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 min-w-[8rem]">
        <label className={LABEL_CLS} htmlFor="eceg-seccion">
          Sección
        </label>
        <select
          id="eceg-seccion"
          multiple
          size={Math.min(4, Math.max(1, seccionOptions.length))}
          value={pendingSecciones}
          onChange={handleSecciones}
          disabled={!seccionEnabled || seccionLoading}
          className={
            (pendingSecciones.length > 0 ? SELECT_ACTIVE : SELECT_IDLE) +
            " min-h-[2rem]"
          }
          aria-busy={seccionLoading}
          aria-label="Seleccionar secciones (múltiple)"
          title="Ctrl+clic para seleccionar múltiples secciones"
        >
          {!seccionEnabled && <option value="" disabled>— Seleccione municipio o distrito —</option>}
          {seccionEnabled && seccionLoading && <option value="" disabled>Cargando…</option>}
          {seccionEnabled &&
            !seccionLoading &&
            seccionOptions.map((o) => (
              <option key={o.cve} value={o.cve}>
                {o.nombre}
              </option>
            ))}
        </select>
        {pendingSecciones.length > 0 && (
          <button
            type="button"
            onClick={() => setSecciones([])}
            className="text-[10px] text-black-eske-40 dark:text-[#6B8A9E] hover:text-red-eske dark:hover:text-red-eske text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-eske rounded"
          >
            Limpiar selección ({pendingSecciones.length})
          </button>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="flex items-end gap-2 sm:ml-1">
        <button
          type="button"
          onClick={onConsultar}
          disabled={!pendingEstado}
          className={
            "px-3 py-1.5 rounded text-xs font-semibold transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske-40 " +
            "disabled:opacity-40 disabled:cursor-not-allowed " +
            (hasPending
              ? "bg-blue-eske text-white-eske hover:bg-blue-eske-80"
              : "bg-gray-eske-20 dark:bg-white/10 text-black-eske-60 dark:text-[#9AAEBE]")
          }
        >
          Consultar
        </button>
        <button
          type="button"
          onClick={onRestablecer}
          className={
            "px-2 py-1.5 rounded text-xs transition-colors " +
            "text-black-eske-50 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
          }
          aria-label="Restablecer filtros"
        >
          Restablecer
        </button>
      </div>
    </div>
  );
}
