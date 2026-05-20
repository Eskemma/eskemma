"use client";

import { useState, useMemo } from "react";
import { GeoVisualizador } from "./GeoVisualizador";
import { useGeoOptions } from "./hooks/useGeoOptions";
import PartidosMultiSelect from "@/app/sefix/components/elecciones/PartidosMultiSelect";
import type {
  GeoScopeElectoral,
  GeoLayerConfig,
  GeoColorRamp,
} from "@/types/geo.types";

// ─── Estados de México: CVE_ENT (01–32) → nombre oficial ───────────────────

const ENTIDADES: { id: string; nombre: string }[] = [
  { id: "01", nombre: "AGUASCALIENTES" },
  { id: "02", nombre: "BAJA CALIFORNIA" },
  { id: "03", nombre: "BAJA CALIFORNIA SUR" },
  { id: "04", nombre: "CAMPECHE" },
  { id: "05", nombre: "COAHUILA" },
  { id: "06", nombre: "COLIMA" },
  { id: "07", nombre: "CHIAPAS" },
  { id: "08", nombre: "CHIHUAHUA" },
  { id: "09", nombre: "CIUDAD DE MÉXICO" },
  { id: "10", nombre: "DURANGO" },
  { id: "11", nombre: "GUANAJUATO" },
  { id: "12", nombre: "GUERRERO" },
  { id: "13", nombre: "HIDALGO" },
  { id: "14", nombre: "JALISCO" },
  { id: "15", nombre: "ESTADO DE MÉXICO" },
  { id: "16", nombre: "MICHOACÁN" },
  { id: "17", nombre: "MORELOS" },
  { id: "18", nombre: "NAYARIT" },
  { id: "19", nombre: "NUEVO LEÓN" },
  { id: "20", nombre: "OAXACA" },
  { id: "21", nombre: "PUEBLA" },
  { id: "22", nombre: "QUERÉTARO" },
  { id: "23", nombre: "QUINTANA ROO" },
  { id: "24", nombre: "SAN LUIS POTOSÍ" },
  { id: "25", nombre: "SINALOA" },
  { id: "26", nombre: "SONORA" },
  { id: "27", nombre: "TABASCO" },
  { id: "28", nombre: "TAMAULIPAS" },
  { id: "29", nombre: "TLAXCALA" },
  { id: "30", nombre: "VERACRUZ" },
  { id: "31", nombre: "YUCATÁN" },
  { id: "32", nombre: "ZACATECAS" },
];

type Modo = "municipio" | "distrito_fed" | "distrito_loc";
type GeoFuente = "ine" | "inegi";

// ─── Estado de navegación (pending + committed) ────────────────────────────

interface GeoNavPending {
  estado_id: string;
  modo: Modo | null;
  cve_unidad: string;    // municipio, d.fed o d.loc seleccionado
  cve_loc: string;       // INEGI only: localidad (CVE_LOC)
  secciones: string[];   // multi-select secciones (INE only)
}

interface GeoNavState {
  fuente: GeoFuente;
  pending: GeoNavPending;
  committed: GeoNavPending;
  queryVersion: number;
}

const DEFAULT_PENDING: GeoNavPending = {
  estado_id: "",
  modo: null,
  cve_unidad: "",
  cve_loc: "",
  secciones: [],
};

// ─── Derivación de scope y layers ─────────────────────────────────────────

const DEFAULT_RAMP: GeoColorRamp = {
  min: 0, max: 100,
  colorLow: "#EFF6FF", colorHigh: "#1D4ED8",
  noDataColor: "#e2e8f0",
};

const STROKE_CONTORNO = { strokeColor: "#1e3a5f", strokeWidth: 2.5 };

function deriveScope(fuente: GeoFuente, p: GeoNavPending): GeoScopeElectoral {
  const { estado_id, modo, cve_unidad, cve_loc, secciones } = p;
  const secField = secciones.length > 0 ? { cve_secciones: secciones } : {};

  if (!estado_id) return { nivel: "nacional" };

  if (fuente === "inegi") {
    if (cve_unidad && cve_loc)
      return { nivel: "municipio", estado_id, cve_municipio: cve_unidad, cve_loc };
    if (cve_unidad)
      return { nivel: "municipio", estado_id, cve_municipio: cve_unidad };
    return { nivel: "entidad", estado_id };
  }

  // INE mode
  if (cve_unidad && modo === "municipio")
    return { nivel: "municipio", estado_id, cve_municipio: cve_unidad, ...secField };
  if (cve_unidad && modo === "distrito_fed")
    return { nivel: "distrito_fed", estado_id, cve_distrito_fed: cve_unidad, ...secField };
  if (cve_unidad && modo === "distrito_loc")
    return { nivel: "distrito_loc", estado_id, cve_distrito_loc: cve_unidad, ...secField };

  if (modo === "municipio")    return { nivel: "municipio",    estado_id };
  if (modo === "distrito_fed") return { nivel: "distrito_fed", estado_id };
  if (modo === "distrito_loc") return { nivel: "distrito_loc", estado_id };

  return { nivel: "entidad", estado_id };
}

const TOOLTIP_MUN    = (p: Record<string, unknown>) => `<strong>${p.NOMGEO ?? p.CVE_MUN ?? ""}</strong><br/><span style="font-size:11px">${p.NOMBRE_ENT ?? ""}</span>`;
const TOOLTIP_DFED   = (p: Record<string, unknown>) => `<strong>Distrito Electoral Federal ${p.DISTRITO_FED ?? ""}</strong><br/><span style="font-size:11px">${p.NOMBRE_ENT ?? ""}</span>`;
const TOOLTIP_DLOC   = (p: Record<string, unknown>) => `<strong>Distrito Electoral Local ${p.DISTRITO_LOC ?? ""}</strong><br/><span style="font-size:11px">${p.NOMBRE_ENT ?? ""}</span>`;
const TOOLTIP_ENT    = (p: Record<string, unknown>) => `<strong>${p.NOMBRE_ENT ?? p.CVE_ENT ?? ""}</strong>`;
const TOOLTIP_SEC    = (p: Record<string, unknown>) => {
  const agebStr = p.AGEBS ? String(p.AGEBS) : "";
  const agebList = agebStr ? agebStr.split(",") : [];
  const agebLine = agebList.length > 0
    ? `<br/><span style="font-size:10px">AGEBs (${agebList.length}): ${agebList.slice(0, 4).join(", ")}${agebList.length > 4 ? "…" : ""}</span>`
    : "";
  return `<strong>Sección ${p.CVE_SECCION ?? ""}</strong>` +
    `<br/>Municipio: ${p.NOMGEO ?? "—"}` +
    `<br/>Distrito Federal: ${p.DISTRITO_FED ?? "—"}` +
    `<br/>Distrito Local: ${p.DISTRITO_LOC ?? "—"}` +
    agebLine;
};
const TOOLTIP_AGEB   = (p: Record<string, unknown>) =>
  `<strong>AGEB ${p.CVEGEO ?? ""}</strong>` +
  `<br/>Municipio: ${p.CVE_MUN ?? "—"}` +
  (p.CVE_LOC ? `<br/>Localidad: ${p.CVE_LOC}` : "") +
  (p.CVE_SECCION  ? `<br/>Sección: ${p.CVE_SECCION}`           : "") +
  (p.DISTRITO_FED ? `<br/>Distrito Federal: ${p.DISTRITO_FED}` : "") +
  (p.DISTRITO_LOC ? `<br/>Distrito Local: ${p.DISTRITO_LOC}`   : "");

const AGEB_STYLE = {
  fillColor: "#ef4444",
  fillOpacity: 0.55,
  strokeColor: "#991b1b",
  strokeWidth: 0.4,
} as const;

function deriveLayers(
  fuente: GeoFuente,
  p: GeoNavPending,
  colorRamp: GeoColorRamp,
  data?: Record<string, number>
): GeoLayerConfig[] {
  const { estado_id, modo, cve_unidad, cve_loc, secciones } = p;

  // ── INEGI mode ──────────────────────────────────────────────────────────
  if (fuente === "inegi") {
    if (!estado_id) {
      return [{ id: "entidades", tipo: "entidades", visible: true, colorRamp, data, tooltip: TOOLTIP_ENT }];
    }
    // Estado selected: show AGEBs immediately + municipios outlines for drill-down
    // Both ageb_urbana and ageb_rural are per-state files — loaded once and cached.
    // When municipio or localidad is selected, filterByScope narrows the results.
    return [
      { id: "municipios",  tipo: "municipios",  visible: true, ...STROKE_CONTORNO, tooltip: TOOLTIP_MUN },
      { id: "ageb_urbana", tipo: "ageb_urbana", visible: true, ...AGEB_STYLE, tooltip: TOOLTIP_AGEB },
      { id: "ageb_rural",  tipo: "ageb_rural",  visible: true, ...AGEB_STYLE, strokeWidth: 0.3, tooltip: TOOLTIP_AGEB },
    ];
  }

  // ── INE mode (default) ──────────────────────────────────────────────────
  if (!estado_id) {
    return [{ id: "entidades", tipo: "entidades", visible: true, colorRamp, data, tooltip: TOOLTIP_ENT }];
  }

  if (cve_unidad && modo) {
    const contourTipo = modo === "municipio" ? "municipios"
      : modo === "distrito_fed" ? "distritos_fed" : "distritos_loc";
    const contourTooltip = modo === "municipio" ? TOOLTIP_MUN
      : modo === "distrito_fed" ? TOOLTIP_DFED : TOOLTIP_DLOC;

    // Single sección selected → show AGEB polygons (red) inside sección contour (blue outline)
    if (secciones.length === 1) {
      return [
        { id: "contorno", tipo: contourTipo, visible: true, ...STROKE_CONTORNO, tooltip: contourTooltip },
        { id: "ageb_urbana", tipo: "ageb_urbana", visible: true, ...AGEB_STYLE, tooltip: TOOLTIP_AGEB },
        { id: "ageb_rural",  tipo: "ageb_rural",  visible: true, ...AGEB_STYLE, strokeWidth: 0.3, tooltip: TOOLTIP_AGEB },
        {
          id: "secciones",
          tipo: "secciones",
          visible: true,
          fillColor: "transparent",
          strokeColor: "#1e40af",
          strokeWidth: 1.5,
          tooltip: TOOLTIP_SEC,
          selectedKeys: new Set([secciones[0]]),
          selectedStyle: { color: "#1d4ed8", weight: 2.5, fillColor: "#bfdbfe", fillOpacity: 0.35 },
        },
      ];
    }

    return [
      { id: "contorno", tipo: contourTipo, visible: true, ...STROKE_CONTORNO, colorRamp, data, tooltip: contourTooltip },
      { id: "secciones", tipo: "secciones", visible: true, colorRamp, data, strokeColor: "#475569", strokeWidth: 0.4, tooltip: TOOLTIP_SEC },
    ];
  }

  if (modo === "municipio")    return [{ id: "municipios",    tipo: "municipios",    visible: true, colorRamp, data, tooltip: TOOLTIP_MUN }];
  if (modo === "distrito_fed") return [{ id: "distritos_fed", tipo: "distritos_fed", visible: true, colorRamp, data, tooltip: TOOLTIP_DFED }];
  if (modo === "distrito_loc") return [{ id: "distritos_loc", tipo: "distritos_loc", visible: true, colorRamp, data, tooltip: TOOLTIP_DLOC }];

  return [{ id: "municipios", tipo: "municipios", visible: true, colorRamp, data, tooltip: TOOLTIP_MUN }];
}

// ─── Helpers de UI ─────────────────────────────────────────────────────────

const SELECT_CLS =
  "text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 " +
  "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske " +
  "disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto sm:min-w-[160px]";

const LABEL_CLS = "block text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE] mb-1";

function scopeLabel(fuente: GeoFuente, p: GeoNavPending): string {
  if (!p.estado_id) return "Nacional";
  const ent = ENTIDADES.find(e => e.id === p.estado_id)?.nombre ?? p.estado_id;
  const parts = [ent];
  if (fuente === "inegi") {
    if (p.cve_unidad) parts.push(`Mun. ${p.cve_unidad}`);
    if (p.cve_loc) parts.push(`Loc. ${p.cve_loc}`);
  } else {
    const modoLabel = p.modo === "municipio" ? "Municipio"
      : p.modo === "distrito_fed" ? "Dist. Electoral Federal"
      : p.modo === "distrito_loc" ? "Dist. Electoral Local"
      : "";
    if (modoLabel) parts.push(modoLabel);
    if (p.cve_unidad) parts.push(p.cve_unidad);
    if (p.secciones.length > 0) parts.push(`${p.secciones.length} sección(es)`);
  }
  return parts.join(" — ");
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface GeoNavegadorProps {
  height?: string;
  className?: string;
  colorRamp?: GeoColorRamp;
  data?: Record<string, number>;
  onScopeChange?: (scope: GeoScopeElectoral) => void;
  onFeatureClick?: (layerId: string, props: Record<string, unknown>) => void;
}

// ─── Componente principal ──────────────────────────────────────────────────

export function GeoNavegador({
  height = "500px",
  className = "",
  colorRamp = DEFAULT_RAMP,
  data,
  onScopeChange,
  onFeatureClick,
}: GeoNavegadorProps) {
  const [state, setState] = useState<GeoNavState>({
    fuente: "ine",
    pending: DEFAULT_PENDING,
    committed: DEFAULT_PENDING,
    queryVersion: 0,
  });

  const { fuente, pending, committed } = state;
  const hasPending = JSON.stringify(pending) !== JSON.stringify(committed);

  // ── Cambio de fuente (aplica inmediatamente, reset de filtros) ──────────

  function setFuente(f: GeoFuente) {
    setState(prev => ({
      fuente: f,
      pending: DEFAULT_PENDING,
      committed: DEFAULT_PENDING,
      queryVersion: prev.queryVersion + 1,
    }));
  }

  // ── Mutaciones del pending ───────────────────────────────────────────────

  function setPendingEstado(estado_id: string) {
    const next: GeoNavPending = { estado_id, modo: "municipio", cve_unidad: "", cve_loc: "", secciones: [] };
    if (fuente === "inegi") {
      // Auto-commit immediately in INEGI mode
      setState(prev => ({ ...prev, pending: next, committed: next, queryVersion: prev.queryVersion + 1 }));
      onScopeChange?.(deriveScope(fuente, next));
    } else {
      setState(prev => ({ ...prev, pending: next }));
    }
  }

  function setPendingModo(modo: Modo) {
    setState(prev => ({
      ...prev,
      pending: { ...prev.pending, modo, cve_unidad: "", cve_loc: "", secciones: [] },
    }));
  }

  function setPendingUnidad(cve_unidad: string) {
    if (fuente === "inegi") {
      const next: GeoNavPending = { ...pending, cve_unidad, cve_loc: "" };
      setState(prev => ({ ...prev, pending: next, committed: next, queryVersion: prev.queryVersion + 1 }));
      onScopeChange?.(deriveScope(fuente, next));
    } else {
      setState(prev => ({ ...prev, pending: { ...prev.pending, cve_unidad, secciones: [] } }));
    }
  }

  function setPendingLoc(cve_loc: string) {
    // INEGI only — auto-commit
    const next: GeoNavPending = { ...pending, cve_loc };
    setState(prev => ({ ...prev, pending: next, committed: next, queryVersion: prev.queryVersion + 1 }));
    onScopeChange?.(deriveScope(fuente, next));
  }

  function setPendingSecciones(secciones: string[]) {
    setState(prev => ({
      ...prev,
      pending: { ...prev.pending, secciones },
    }));
  }

  function handleConsultar() {
    setState(prev => ({ ...prev, committed: prev.pending, queryVersion: prev.queryVersion + 1 }));
    onScopeChange?.(deriveScope(fuente, pending));
  }

  function handleRestablecer() {
    setState(prev => ({ ...prev, pending: DEFAULT_PENDING, committed: DEFAULT_PENDING, queryVersion: prev.queryVersion + 1 }));
    onScopeChange?.(deriveScope(fuente, DEFAULT_PENDING));
  }

  // ── Opciones para los selects ────────────────────────────────────────────

  const optTipo = fuente === "inegi"
    ? "municipios"
    : pending.modo === "municipio" ? "municipios"
    : pending.modo === "distrito_fed" ? "distritos_fed"
    : pending.modo === "distrito_loc" ? "distritos_loc"
    : "municipios";

  const { options: unidadOptions, isLoading: loadingUnidad } = useGeoOptions({
    tipo: optTipo,
    estadoId: pending.estado_id,
  });

  // Localidades: INEGI only, needs estado + municipio selected
  const { options: localidadOptions, isLoading: loadingLocalidades } = useGeoOptions({
    tipo: "localidades",
    estadoId: fuente === "inegi" && pending.cve_unidad ? pending.estado_id : "",
    municipio: fuente === "inegi" ? pending.cve_unidad : undefined,
  });

  const { options: seccionesOptions, isLoading: loadingSecciones } = useGeoOptions({
    tipo: "secciones",
    estadoId: pending.cve_unidad ? pending.estado_id : "",
    municipio:    pending.modo === "municipio"    ? pending.cve_unidad : undefined,
    distrito_fed: pending.modo === "distrito_fed" ? pending.cve_unidad : undefined,
    distrito_loc: pending.modo === "distrito_loc" ? pending.cve_unidad : undefined,
  });

  const seccionesMultiOptions = useMemo(
    () => seccionesOptions.map(o => ({ value: o.cve, label: o.nombre })),
    [seccionesOptions]
  );

  const seccionesSelected = pending.secciones.length > 0 ? pending.secciones : ["Todas"];

  // ── Derivar scope y layers del committed (no del pending) ────────────────
  const scope  = useMemo(() => deriveScope(fuente, committed),                          [fuente, committed]);
  const layers = useMemo(() => deriveLayers(fuente, committed, colorRamp, data), [fuente, committed, colorRamp, data]);

  // ── Labels dinámicos ─────────────────────────────────────────────────────
  const modoLabel = pending.modo === "municipio" ? "Municipio"
    : pending.modo === "distrito_fed" ? "Dist. Electoral Federal"
    : pending.modo === "distrito_loc" ? "Dist. Electoral Local"
    : "";

  return (
    <div className={`flex flex-col gap-3 ${className}`}>

      {/* ── Panel de filtros ────────────────────────────────────────────── */}
      <div className="p-4 bg-gray-eske-10 dark:bg-[#0D1E2C] rounded-lg border border-gray-eske-20 dark:border-white/10 space-y-3">

        {/* Fila header: selector de fuente + scope label + Restablecer */}
        <div className="flex items-center justify-between gap-2 flex-wrap">

          {/* Selector de fuente: Vista Electoral / Datos Generales */}
          <div className="flex gap-1" role="group" aria-label="Vista de datos">
            {(["ine", "inegi"] as GeoFuente[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFuente(f)}
                aria-pressed={fuente === f}
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske ${
                  fuente === f
                    ? f === "ine"
                      ? "bg-blue-eske text-white-eske border-blue-eske"
                      : "bg-red-500 text-white border-red-500"
                    : "bg-white-eske dark:bg-[#18324A] text-black-eske-60 dark:text-white/60 border-gray-eske-20 hover:border-blue-eske"
                }`}
              >
                {f === "ine" ? "Vista Electoral" : "Datos Generales"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-black-eske-80 dark:text-[#9AAEBE] font-medium">
              {scopeLabel(fuente, committed)}
            </span>
            <button
              type="button"
              onClick={handleRestablecer}
              className="text-xs text-orange-eske hover:text-orange-eske-60 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-eske rounded"
            >
              Restablecer
            </button>
          </div>
        </div>

        {/* Fila 1: Entidad + Nivel de análisis (INE only) */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">

          {/* Entidad federativa */}
          <div>
            <label htmlFor="geo-nav-entidad" className={LABEL_CLS}>Entidad federativa</label>
            <select
              id="geo-nav-entidad"
              value={pending.estado_id}
              onChange={(e) => setPendingEstado(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Nacional</option>
              {ENTIDADES.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          {/* Nivel de análisis — INE only */}
          {fuente === "ine" && pending.estado_id && (
            <fieldset>
              <legend className={LABEL_CLS}>Nivel de análisis</legend>
              <div className="flex gap-1" role="group" aria-label="Nivel de análisis">
                {(["municipio", "distrito_fed", "distrito_loc"] as Modo[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPendingModo(m)}
                    aria-pressed={pending.modo === m}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske ${
                      pending.modo === m
                        ? "bg-blue-eske text-white-eske border-blue-eske"
                        : "bg-white-eske dark:bg-[#18324A] text-black-eske-60 dark:text-white/60 border-gray-eske-20 hover:border-blue-eske"
                    }`}
                  >
                    {m === "municipio" ? "Municipio" : m === "distrito_fed" ? "Distrito Electoral Federal" : "Distrito Electoral Local"}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        {/* Fila 2: Municipio / Unidad + Localidad (INEGI) + Secciones (INE) + Consultar (INE) */}
        {pending.estado_id && (fuente === "inegi" || pending.modo) && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">

            {/* Municipio — en ambos modos */}
            <div>
              <label htmlFor="geo-nav-unidad" className={LABEL_CLS}>
                {fuente === "inegi" ? "Municipio" : modoLabel}
                {loadingUnidad && (
                  <span className="ml-1 text-[10px] text-blue-eske">(Cargando…)</span>
                )}
              </label>
              <select
                id="geo-nav-unidad"
                value={pending.cve_unidad}
                onChange={(e) => setPendingUnidad(e.target.value)}
                disabled={loadingUnidad}
                className={SELECT_CLS}
              >
                <option value="">Todos</option>
                {unidadOptions.map(o => (
                  <option key={o.cve} value={o.cve}>{o.nombre}</option>
                ))}
              </select>
            </div>

            {/* Localidad — INEGI only, cuando hay municipio */}
            {fuente === "inegi" && pending.cve_unidad && (
              <div>
                <label htmlFor="geo-nav-loc" className={LABEL_CLS}>
                  Localidad
                  {loadingLocalidades && (
                    <span className="ml-1 text-[10px] text-blue-eske">(Cargando…)</span>
                  )}
                </label>
                <select
                  id="geo-nav-loc"
                  value={pending.cve_loc}
                  onChange={(e) => setPendingLoc(e.target.value)}
                  disabled={loadingLocalidades}
                  className={SELECT_CLS}
                >
                  <option value="">Todas</option>
                  {localidadOptions.map(o => (
                    <option key={o.cve} value={o.cve}>{o.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Multi-select de secciones — INE only */}
            {fuente === "ine" && pending.cve_unidad && (
              <div className="relative min-w-[200px] sm:max-w-[280px]">
                <PartidosMultiSelect
                  label={
                    <>
                      Sección(es)
                      {loadingSecciones && (
                        <span className="ml-1 text-[10px] text-blue-eske font-normal">(Cargando…)</span>
                      )}
                    </>
                  }
                  options={seccionesMultiOptions}
                  selected={seccionesSelected}
                  onChange={(vals) => {
                    const clean = vals.filter(v => v !== "Todas");
                    setPendingSecciones(clean);
                  }}
                  disabled={loadingSecciones}
                  placeholder="Buscar sección…"
                  todosLabel="Todas"
                />
              </div>
            )}

            {/* Botón Consultar — INE only, cuando hay cambios pendientes */}
            {fuente === "ine" && hasPending && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleConsultar}
                  className="px-4 py-1.5 rounded-md text-sm font-medium
                             bg-blue-eske text-white-eske hover:bg-blue-eske-60
                             transition-colors focus-visible:outline-none
                             focus-visible:ring-2 focus-visible:ring-blue-eske"
                >
                  Consultar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Consultar INE a nivel nacional o cuando no hay modo aún */}
        {fuente === "ine" && (!pending.estado_id || !pending.modo) && hasPending && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleConsultar}
              className="px-4 py-1.5 rounded-md text-sm font-medium
                         bg-blue-eske text-white-eske hover:bg-blue-eske-60
                         transition-colors focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-blue-eske"
            >
              Consultar
            </button>
          </div>
        )}
      </div>

      {/* ── Mapa ─────────────────────────────────────────────────────────── */}
      <GeoVisualizador
        scope={scope}
        layers={layers}
        height={height}
        queryVersion={state.queryVersion}
        onFeatureClick={onFeatureClick}
      />
    </div>
  );
}
