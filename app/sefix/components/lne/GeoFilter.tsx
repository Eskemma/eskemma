"use client";

import { useReducer, useState, useEffect, useRef, useCallback } from "react";
import { useGeoTerritorios } from "@/app/sefix/hooks/useLneSemanal";
import { ESTADOS_LIST } from "@/lib/sefix/constants";
import type { Ambito } from "@/lib/sefix/seriesUtils";
import type { GeoOpcion } from "@/lib/sefix/storage";
import type { GeoFilterState, GeoFilterAction } from "@/types/sefix.types";

// ──────────────────────────────────────────────
// State machine del filtro geográfico
// ──────────────────────────────────────────────
function geoReducer(state: GeoFilterState, action: GeoFilterAction): GeoFilterState {
  switch (action.type) {
    case "SELECT_ENTIDAD":
      return { status: "entidad_selected", entidad: action.entidad, cveEntidad: action.cveEntidad };
    case "SELECT_DISTRITO":
      if (state.status !== "entidad_selected" && state.status !== "distrito_selected" &&
        state.status !== "municipio_selected" && state.status !== "seccion_selected") return state;
      return { ...state, status: "distrito_selected", distrito: action.distrito };
    case "SELECT_MUNICIPIO":
      if (state.status !== "distrito_selected" && state.status !== "municipio_selected" &&
        state.status !== "seccion_selected") return state;
      return { ...state, status: "municipio_selected", municipio: action.municipio };
    case "SELECT_SECCION":
      if (state.status !== "municipio_selected" && state.status !== "seccion_selected") return state;
      // Si se deseleccionan todas, volvemos a municipio_selected
      if (action.seccion.length === 0) {
        return { ...state, status: "municipio_selected" };
      }
      return { ...state, status: "seccion_selected", seccion: action.seccion };
    case "RESET":
      return { status: "idle" };
    default:
      return state;
  }
}

// ──────────────────────────────────────────────
// GeoInfo: resumen del alcance de la consulta
// ──────────────────────────────────────────────
export interface GeoInfo {
  entidad: string;        // "BAJA CALIFORNIA SUR" | "Nacional"
  distrito: string;       // nombre: "0302 LOS CABOS" | "Todos"
  municipio: string;      // nombre: "LOS CABOS" | "Todos"
  seccion: string;        // display: "1431, 1432" | "Todas"
  // CVEs para consultas a la API (undefined cuando es "Todos"/"Nacional")
  cveDistrito?: string;   // cve_distrito del CSV, e.g., "2"
  cveMunicipio?: string;  // cve_municipio del CSV, e.g., "039"
  secciones?: string[];   // números de sección, e.g., ["1431", "1432"]
}

/**
 * Construye GeoInfo para el subtítulo.
 * Usa las listas de distritos y municipios cargadas para resolver nombres
 * completos (cabecera_distrital, nombre_municipio) en lugar de solo claves.
 */
function geoInfoFromState(
  state: GeoFilterState,
  distritosList: GeoOpcion[],
  municipiosList: GeoOpcion[]
): GeoInfo {
  const entidad = state.status !== "idle" ? state.entidad : "Nacional";

  let distrito = "Todos";
  if (
    state.status === "distrito_selected" ||
    state.status === "municipio_selected" ||
    state.status === "seccion_selected"
  ) {
    const cve = (state as { distrito: string }).distrito;
    // Usar el nombre completo de la cabecera distrital (e.g., "0302 LOS CABOS")
    const found = distritosList.find((d) => d.cve === cve);
    distrito = found?.nombre ?? cve;
  }

  let municipio = "Todos";
  if (state.status === "municipio_selected" || state.status === "seccion_selected") {
    const cve = (state as { municipio: string }).municipio;
    // Usar el nombre del municipio (e.g., "LOS CABOS")
    const found = municipiosList.find((m) => m.cve === cve);
    municipio = found?.nombre ?? cve;
  }

  const seccionRaw: string[] | undefined =
    state.status === "seccion_selected"
      ? (state as { seccion: string[] }).seccion
      : undefined;
  const seccion = seccionRaw ? seccionRaw.join(", ") : "Todas";

  const cveDistrito =
    (state.status === "distrito_selected" ||
      state.status === "municipio_selected" ||
      state.status === "seccion_selected")
      ? (state as { distrito: string }).distrito
      : undefined;

  const cveMunicipio =
    (state.status === "municipio_selected" || state.status === "seccion_selected")
      ? (state as { municipio: string }).municipio
      : undefined;

  return { entidad, distrito, municipio, seccion, cveDistrito, cveMunicipio, secciones: seccionRaw };
}

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────
interface GeoFilterProps {
  ambito: Ambito;                // valor comprometido (committed)
  selectedYear: number;          // valor comprometido (committed)
  availableYears: number[];
  onConsultar: (ambito: Ambito, year: number, geoInfo: GeoInfo) => void;
}

export default function GeoFilter({
  ambito,
  selectedYear,
  availableYears,
  onConsultar,
}: GeoFilterProps) {
  // Estado pendiente (pre-commit)
  const [pendingAmbito, setPendingAmbito] = useState<Ambito>(ambito);
  const [pendingYear, setPendingYear] = useState<number>(selectedYear);
  const [geoState, dispatch] = useReducer(geoReducer, { status: "idle" });
  // Copia del geo state en el último "Consultar"
  const committedGeoRef = useRef<GeoFilterState>({ status: "idle" });
  // Rastrea el año anterior para detectar cambios y resetear cascada
  const prevYearRef = useRef<number>(selectedYear);

  // Sincronizar año pendiente cuando carga la lista de años disponibles
  useEffect(() => {
    setPendingYear(selectedYear);
  }, [selectedYear]);

  // Sincronizar ámbito pendiente cuando cambia desde fuera (poco probable pero defensivo)
  useEffect(() => {
    setPendingAmbito(ambito);
  }, [ambito]);

  // Resetear cascada geo cuando el usuario cambia el año (geografía varía por año)
  useEffect(() => {
    if (prevYearRef.current !== pendingYear && geoState.status !== "idle") {
      dispatch({ type: "RESET" });
    }
    prevYearRef.current = pendingYear;
  }, [pendingYear, geoState.status]);

  // ── Selectores dependientes de geo ──
  const entidadNombre = geoState.status !== "idle" ? geoState.entidad : undefined;
  const cveDistrito =
    (geoState.status === "distrito_selected" ||
      geoState.status === "municipio_selected" ||
      geoState.status === "seccion_selected")
      ? (geoState as { distrito: string }).distrito
      : undefined;
  const cveMunicipio =
    (geoState.status === "municipio_selected" || geoState.status === "seccion_selected")
      ? (geoState as { municipio: string }).municipio
      : undefined;

  const { opciones: distritos, isLoading: loadingDistritos } = useGeoTerritorios(
    "distrito", entidadNombre, undefined, undefined, pendingYear
  );
  const { opciones: municipios, isLoading: loadingMunicipios } = useGeoTerritorios(
    "municipio", entidadNombre, cveDistrito, undefined, pendingYear
  );
  const { opciones: secciones, isLoading: loadingSecciones } = useGeoTerritorios(
    "seccion", entidadNombre, undefined, cveMunicipio, pendingYear
  );

  // Secciones actualmente seleccionadas
  const seccionesSeleccionadas =
    geoState.status === "seccion_selected"
      ? (geoState as { seccion: string[] }).seccion
      : [];

  // Estado del selector de secciones estilo tags + popover
  const [seccionSearch, setSeccionSearch] = useState("");
  const [seccionOpen, setSeccionOpen] = useState(false);
  const seccionInputRef = useRef<HTMLInputElement>(null);
  const seccionContainerRef = useRef<HTMLDivElement>(null);

  // Limpiar búsqueda y cerrar popover cuando cambia el municipio (cascade)
  useEffect(() => { setSeccionSearch(""); setSeccionOpen(false); }, [cveMunicipio]);

  // Cerrar popover al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (seccionContainerRef.current && !seccionContainerRef.current.contains(e.target as Node)) {
        setSeccionOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Secciones disponibles: excluir ya seleccionadas, filtrar por búsqueda
  const availableSecciones = secciones.filter(
    (s) =>
      !seccionesSeleccionadas.includes(s.cve) &&
      (seccionSearch === "" || s.cve.includes(seccionSearch))
  );

  const addSeccion = useCallback(
    (cve: string) => {
      dispatch({ type: "SELECT_SECCION", seccion: [...seccionesSeleccionadas, cve] });
      setSeccionSearch("");
      seccionInputRef.current?.focus();
    },
    [seccionesSeleccionadas]
  );

  const removeSeccion = useCallback(
    (cve: string) => {
      dispatch({
        type: "SELECT_SECCION",
        seccion: seccionesSeleccionadas.filter((c) => c !== cve),
      });
    },
    [seccionesSeleccionadas]
  );

  // Reset geo cascade to entidad-only when switching to extranjero
  useEffect(() => {
    if (pendingAmbito === "extranjero") {
      // Keep entidad if selected, but clear deeper selections
      if (
        geoState.status === "distrito_selected" ||
        geoState.status === "municipio_selected" ||
        geoState.status === "seccion_selected"
      ) {
        dispatch({ type: "SELECT_ENTIDAD", entidad: geoState.entidad, cveEntidad: geoState.cveEntidad ?? "" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAmbito]);

  // ── Handlers ──
  const handleEntidadChange = (nombre: string) => {
    if (nombre === "") {
      dispatch({ type: "RESET" });
    } else {
      const cve = ESTADOS_LIST.find((e) => e.nombre === nombre)?.key ?? "";
      dispatch({ type: "SELECT_ENTIDAD", entidad: nombre, cveEntidad: cve });
    }
  };

  const handleReset = () => {
    dispatch({ type: "RESET" });
    setPendingAmbito(ambito);
    setPendingYear(selectedYear);
  };

  // ── Detección de cambios pendientes ──
  const geoChanged =
    JSON.stringify(geoState) !== JSON.stringify(committedGeoRef.current);
  const hasPending =
    pendingAmbito !== ambito ||
    pendingYear !== selectedYear ||
    geoChanged;

  // ── Aplicar consulta ──
  const handleConsultar = () => {
    committedGeoRef.current = { ...geoState };
    onConsultar(pendingAmbito, pendingYear, geoInfoFromState(geoState, distritos, municipios));
  };

  // ── Label resumen (usando nombres completos de las listas cargadas) ──
  const distritoLabel = cveDistrito
    ? (distritos.find((d) => d.cve === cveDistrito)?.nombre ?? cveDistrito)
    : "";
  const municipioLabel = cveMunicipio
    ? (municipios.find((m) => m.cve === cveMunicipio)?.nombre ?? cveMunicipio)
    : "";
  const secLabel =
    geoState.status === "seccion_selected"
      ? `Sec. ${(geoState as { seccion: string[] }).seccion.join(", ")}`
      : "";

  const geoLabel =
    geoState.status === "idle"
      ? "Nacional"
      : geoState.status === "entidad_selected"
        ? geoState.entidad
        : geoState.status === "distrito_selected"
          ? `${geoState.entidad} / ${distritoLabel}`
          : geoState.status === "municipio_selected"
            ? `${geoState.entidad} / ${municipioLabel}`
            : `${geoState.entidad} / ${secLabel}`;

  return (
    <div className="p-4 bg-gray-eske-10 dark:bg-[#112230] rounded-lg border border-gray-eske-20 dark:border-white/10 space-y-3">
      {/* Fila 1: Año + Ámbito + Indicador de alcance */}
      <div className="flex flex-wrap items-start sm:items-center gap-3 sm:gap-4">
        {/* Año */}
        {availableYears.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="sefix-year-select" className="text-xs font-medium text-black-eske-10 dark:text-[#9AAEBE]">
              Año
            </label>
            <select
              id="sefix-year-select"
              value={pendingYear}
              onChange={(e) => setPendingYear(parseInt(e.target.value))}
              className="text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 bg-white-eske dark:bg-[#112230] dark:text-[#EAF2F8] text-black-eske focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {/* Ámbito */}
        <fieldset>
          <legend className="sr-only">Ámbito de datos</legend>
          <div className="flex gap-3">
            {(["nacional", "extranjero"] as Ambito[]).map((a) => (
              <label key={a} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="sefix-ambito"
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
          <svg className="w-3.5 h-3.5 text-bluegreen-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs text-black-eske-20 dark:text-[#9AAEBE] font-medium">{geoLabel}</span>
          {geoState.status !== "idle" && (
            <button
              onClick={handleReset}
              className="ml-1 text-xs text-orange-eske hover:text-orange-eske-60 underline focus-visible:outline-none"
              aria-label="Restablecer filtro geográfico"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* Fila 2: Cascade geográfica + Botón Consultar al final */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">
        {/* Entidad */}
        <div className="flex flex-col gap-1">
          <label htmlFor="geo-entidad" className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">Entidad</label>
          <select
            id="geo-entidad"
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

        {/* Distrito (activo si hay entidad) — SOLO en modo nacional */}
        {pendingAmbito === "nacional" && geoState.status !== "idle" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="geo-distrito" className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
              Distrito {loadingDistritos && <span className="text-red-eske">(cargando…)</span>}
            </label>
            <select
              id="geo-distrito"
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

        {/* Badge estático RESIDENTES EXTRANJERO — solo modo extranjero con entidad seleccionada */}
        {pendingAmbito === "extranjero" && geoState.status !== "idle" && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">Distrito</span>
            <div className="text-sm border border-gray-eske-20 dark:border-white/10 rounded-md px-2 py-1.5 bg-gray-eske-10 dark:bg-[#112230] text-black-eske-20 dark:text-[#9AAEBE] w-full sm:w-auto sm:min-w-[220px] select-none">
              RESIDENTES EXTRANJERO
            </div>
          </div>
        )}

        {/* Municipio (activo si hay distrito) — SOLO en modo nacional */}
        {pendingAmbito === "nacional" && cveDistrito && (
          <div className="flex flex-col gap-1">
            <label htmlFor="geo-municipio" className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
              Municipio {loadingMunicipios && <span className="text-red-eske">(cargando…)</span>}
            </label>
            <select
              id="geo-municipio"
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

        {/* Sección — tags + popover flotante — SOLO en modo nacional */}
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

            {/* Caja de tags: secciones seleccionadas + input de búsqueda */}
            <div
              role="group"
              aria-label="Secciones seleccionadas"
              onClick={() => { setSeccionOpen(true); seccionInputRef.current?.focus(); }}
              className="border border-gray-eske-30 dark:border-white/10 rounded-md bg-white-eske dark:bg-[#112230] min-h-[34px] px-2 py-1 flex flex-wrap gap-1 items-center cursor-text w-full sm:w-auto sm:min-w-[180px]"
            >
              {seccionesSeleccionadas.map((cve) => (
                <span
                  key={cve}
                  className="flex items-center gap-0.5 bg-blue-eske text-white-eske text-xs px-1.5 py-0.5 rounded"
                >
                  {cve}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeSeccion(cve); }}
                    className="opacity-80 hover:opacity-100 leading-none ml-0.5 text-sm"
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

            {/* Popover flotante: lista de secciones disponibles */}
            {seccionOpen && !loadingSecciones && (
              <div
                role="listbox"
                aria-label="Secciones disponibles"
                className="absolute top-full left-0 z-50 mt-1 w-full max-w-[calc(100vw-2rem)] sm:max-w-none border border-gray-eske-30 dark:border-white/10 rounded-md bg-white-eske dark:bg-[#18324A] shadow-lg overflow-y-auto max-h-[140px]"
              >
                {/* Opción "Todas" — limpiar selección */}
                {seccionesSeleccionadas.length > 0 && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => { dispatch({ type: "SELECT_SECCION", seccion: [] }); setSeccionSearch(""); setSeccionOpen(false); }}
                    className="w-full text-left px-2 py-1 text-xs text-black-eske-20 dark:text-[#9AAEBE] italic hover:bg-gray-eske-10 dark:hover:bg-white/5 border-b border-gray-eske-10 dark:border-white/10"
                  >
                    Todas (limpiar selección)
                  </button>
                )}

                {availableSecciones.length === 0 && seccionesSeleccionadas.length === 0 ? (
                  <p className="text-xs text-black-eske-40 dark:text-[#6D8294] px-2 py-1">Sin secciones</p>
                ) : availableSecciones.length === 0 ? (
                  <p className="text-xs text-black-eske-40 dark:text-[#6D8294] px-2 py-1 italic">Todas seleccionadas</p>
                ) : (
                  availableSecciones.map((s) => (
                    <button
                      key={s.cve}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => addSeccion(s.cve)}
                      className="w-full text-left px-2 py-0.5 text-xs text-black-eske dark:text-[#C7D6E0] hover:bg-blue-eske/10 hover:text-blue-eske dark:hover:text-[#4791B3]"
                    >
                      {s.nombre}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Botón Consultar — al final del cascade, alineado abajo */}
        {hasPending && (
          <button
            onClick={handleConsultar}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-eske text-white-eske hover:bg-blue-eske-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske transition-colors w-full sm:w-auto sm:self-end"
          >
            Consultar
          </button>
        )}

        {/* Aviso disponibilidad Extranjero — solo ámbito extranjero */}
        {pendingAmbito === "extranjero" && (
          <div
            className="sm:ml-auto rounded-md px-3 py-2 text-xs text-black-eske dark:text-[#C7D6E0] sm:self-end dark:bg-[#21425E]"
            style={{ backgroundColor: "#bcd1e3ff" }}
          >
            Los datos de Residentes en el Extranjero sólo están disponibles a nivel nacional y estatal.
          </div>
        )}
      </div>
    </div>
  );
}
