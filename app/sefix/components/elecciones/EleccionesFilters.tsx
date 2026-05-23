"use client";
import {
  AVAILABLE_YEARS,
  CARGO_CSV_LABELS,
  CARGO_DISPLAY_LABELS,
  PARTIDO_LABELS,
  PARTY_COLORS,
} from "@/lib/sefix/eleccionesConstants";
import { ESTADOS_LIST } from "@/lib/sefix/constants";
import PartidosMultiSelect, { MultiSelectOption } from "./PartidosMultiSelect";
import {
  useEleccionesDistritos,
  useEleccionesMunicipios,
  useEleccionesSecciones,
} from "@/app/sefix/hooks/useEleccionesFilters";

const SELECT_CLS =
  "text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 " +
  "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske " +
  "w-full sm:w-auto sm:min-w-[140px]";

const LABEL_CLS = "text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE]";
const LABEL_DISABLED_CLS = "text-xs font-medium text-black-eske-60/50 dark:text-[#6D8294]";
const RADIO_CLS = "flex items-center gap-1.5 text-xs text-black-eske dark:text-[#EAF2F8] cursor-pointer";

interface Props {
  pendingAnio: number;
  pendingCargo: string;
  pendingEstado: string;
  pendingPartidos: string[];
  pendingTipo: string;
  pendingPrincipio: string;
  pendingCabecera: string;
  pendingMunicipio: string;
  pendingSecciones: string[];
  pendingIncluirExtranjero: boolean;
  setAnio: (v: number) => void;
  setCargo: (v: string) => void;
  setEstado: (v: string) => void;
  setPartidos: (v: string[]) => void;
  setTipo: (v: string) => void;
  setPrincipio: (v: string) => void;
  setCabecera: (v: string) => void;
  setMunicipio: (v: string) => void;
  setSecciones: (v: string[]) => void;
  setIncluirExtranjero: (v: boolean) => void;
  hasPending: boolean;
  onConsultar: () => void;
  onRestablecer: () => void;
  cargosDisponibles: string[];
  partidosDisponibles: string[];
  tiposDisponibles: string[];
  principiosDisponibles: string[];
  hasExtranjero: boolean;
  /** When true, hide the Partidos/Coaliciones multiselect (used by Visualización Geográfica). */
  hidePartidos?: boolean;
  /** When true, show the year as a static read-only badge instead of a select. */
  fixedAnio?: boolean;
}

export default function EleccionesFilters({
  pendingAnio, pendingCargo, pendingEstado, pendingPartidos,
  pendingTipo, pendingPrincipio, pendingCabecera, pendingMunicipio, pendingSecciones,
  pendingIncluirExtranjero,
  setAnio, setCargo, setEstado, setPartidos, setTipo, setPrincipio,
  setCabecera, setMunicipio, setSecciones, setIncluirExtranjero,
  hasPending, onConsultar, onRestablecer,
  cargosDisponibles, partidosDisponibles,
  tiposDisponibles, principiosDisponibles,
  hasExtranjero,
  hidePartidos = false,
  fixedAnio = false,
}: Props) {
  const { opciones: distritos, isLoading: loadingDist } = useEleccionesDistritos(
    pendingAnio, pendingCargo, pendingEstado,
  );
  const { opciones: municipios, isLoading: loadingMun } = useEleccionesMunicipios(
    pendingAnio, pendingCargo, pendingEstado, pendingCabecera,
  );
  const { secciones: seccionesDisp, isLoading: loadingSec } = useEleccionesSecciones(
    pendingAnio, pendingCargo, pendingEstado, pendingCabecera, pendingMunicipio,
  );

  const partidoOptions: MultiSelectOption[] = partidosDisponibles.map((p) => ({
    value: p,
    label: PARTIDO_LABELS[p] ?? p,
    color: PARTY_COLORS[p] ?? PARTY_COLORS.DEFAULT,
  }));

  const seccionOptions: MultiSelectOption[] = seccionesDisp.map((s) => ({
    value: s,
    label: s,
  }));

  const isNacional = !pendingEstado;
  const hasCabecera = !!pendingCabecera;
  const hasMunicipio = !!pendingMunicipio;
  const isExtranjeroDistrito = pendingCabecera.toUpperCase().includes("VOTO EN EL EXTRANJERO");

  const tieneOrdinaria = tiposDisponibles.includes("ORDINARIA");
  const tieneExtraordinaria = tiposDisponibles.includes("EXTRAORDINARIA");
  const showTipoRadios = tieneOrdinaria && tieneExtraordinaria;
  const showPrincipioRadios = principiosDisponibles.length > 1;

  // Casos especiales con Entidad restringida (2021/SEN y 2023/SEN)
  const isLockedEstado = (pendingAnio === 2021 && pendingCargo === "sen") || pendingAnio === 2023;
  const lockedEstadoLabel = pendingAnio === 2023 ? "TAMAULIPAS" : "NAYARIT";

  const geoScope = pendingEstado || "Nacional";
  const cargoScope = CARGO_DISPLAY_LABELS[pendingCargo] ?? pendingCargo.toUpperCase();
  const scopeLabel = `${pendingAnio} — ${cargoScope} — ${geoScope}`;

  return (
    <div className="p-4 bg-gray-eske-10 dark:bg-[#0D1E2C] rounded-lg border border-gray-eske-20 dark:border-white/10 space-y-3">

      {/* Fila 0: Scope + Restablecer */}
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

      {/* Fila 1: Año, Cargo, Entidad federativa */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">
        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label htmlFor="ef-anio" className={LABEL_CLS}>Año</label>
          {fixedAnio ? (
            <div
              className={`${SELECT_CLS} bg-gray-eske-10 dark:bg-white/5 text-black-eske-60 dark:text-[#6D8294] cursor-default select-none`}
              aria-label={`Año fijo: ${pendingAnio}`}
            >
              {pendingAnio}
            </div>
          ) : (
            <select
              id="ef-anio"
              value={pendingAnio}
              onChange={(e) => setAnio(parseInt(e.target.value))}
              className={SELECT_CLS}
            >
              {AVAILABLE_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label htmlFor="ef-cargo" className={LABEL_CLS}>Cargo</label>
          <select
            id="ef-cargo"
            value={pendingCargo}
            onChange={(e) => setCargo(e.target.value)}
            className={SELECT_CLS}
          >
            {cargosDisponibles.map((c) => (
              <option key={c} value={c}>{CARGO_CSV_LABELS[c] ?? c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label htmlFor="ef-estado" className={LABEL_CLS}>Entidad federativa</label>
          <select
            id="ef-estado"
            value={pendingEstado}
            onChange={(e) => setEstado(e.target.value)}
            className={SELECT_CLS}
          >
            {isLockedEstado ? (
              <>
                <option value={lockedEstadoLabel}>{lockedEstadoLabel}</option>
                {hasExtranjero && (
                  <option value="VOTO EN EL EXTRANJERO">— VOTO EN EL EXTRANJERO —</option>
                )}
              </>
            ) : (
              <>
                <option value="">— Nacional —</option>
                {ESTADOS_LIST.map((e) => (
                  <option key={e.key} value={e.nombre}>{e.nombre}</option>
                ))}
                {(isNacional || pendingEstado === "VOTO EN EL EXTRANJERO") && hasExtranjero && (
                  <option value="VOTO EN EL EXTRANJERO">— VOTO EN EL EXTRANJERO —</option>
                )}
              </>
            )}
          </select>
        </div>

        {/* Checkbox: incluir/excluir VOTO EN EL EXTRANJERO (solo para SENADURIA y PRESIDENCIA) */}
        {hasExtranjero && pendingCargo !== "dip" && pendingEstado !== "VOTO EN EL EXTRANJERO" && (
          <div className="flex items-end flex-shrink-0 pb-1.5 gap-1.5">
            <input
              type="checkbox"
              id="ef-extranjero"
              checked={pendingIncluirExtranjero}
              onChange={(e) => setIncluirExtranjero(e.target.checked)}
              className="accent-blue-eske"
            />
            <label htmlFor="ef-extranjero" className={LABEL_CLS + " cursor-pointer"}>
              Voto extranjero
            </label>
          </div>
        )}
      </div>

      {/* Fila 2: Distrito, Municipio, Sección + radios (condicional) + Partidos + Consultar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">

        {/* Distrito */}
        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label
            htmlFor="ef-cabecera"
            className={isNacional ? LABEL_DISABLED_CLS : LABEL_CLS}
          >
            Distrito{loadingDist && <span className="ml-1 text-[10px] text-red-eske">(Cargando…)</span>}
          </label>
          <select
            id="ef-cabecera"
            value={pendingCabecera}
            onChange={(e) => setCabecera(e.target.value)}
            disabled={isNacional || loadingDist}
            className={SELECT_CLS}
          >
            <option value="">Todos</option>
            {distritos.map((d) => (
              <option key={d.cve} value={d.cve}>{d.nombre}</option>
            ))}
          </select>
        </div>

        {/* Municipio */}
        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label
            htmlFor="ef-municipio"
            className={!hasCabecera ? LABEL_DISABLED_CLS : LABEL_CLS}
          >
            Municipio{loadingMun && <span className="ml-1 text-[10px] text-red-eske">(Cargando…)</span>}
          </label>
          <select
            id="ef-municipio"
            value={pendingMunicipio}
            onChange={(e) => setMunicipio(e.target.value)}
            disabled={!hasCabecera || loadingMun}
            className={SELECT_CLS}
          >
            <option value="">Todos</option>
            {municipios.map((m) => (
              <option key={m.cve} value={m.cve}>{m.nombre}</option>
            ))}
          </select>
        </div>

        {/* Sección */}
        <div className="flex-1 sm:flex-none sm:min-w-[180px]">
          <PartidosMultiSelect
            id="ef-secciones"
            label={<>Sección{loadingSec && <span className="ml-1 text-red-eske">(Cargando…)</span>}</>}
            options={seccionOptions}
            selected={pendingSecciones.length > 0 ? pendingSecciones : ["Todas"]}
            onChange={(v) => setSecciones(v.filter((x) => x !== "Todas"))}
            disabled={!hasMunicipio || loadingSec || isExtranjeroDistrito}
            placeholder="Buscar sección..."
            todosLabel="Todas"
          />
        </div>

        {/* Tipo de elección (condicional) */}
        {showTipoRadios && (
          <fieldset className="flex-shrink-0">
            <legend className={`${LABEL_CLS} mb-1`}>Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {tiposDisponibles.map((t) => (
                <label key={t} className={RADIO_CLS}>
                  <input
                    type="radio"
                    name="ef-tipo"
                    value={t}
                    checked={pendingTipo === t}
                    onChange={() => setTipo(t)}
                    className="accent-blue-eske"
                  />
                  {t === "ORDINARIA" ? "Ordinaria" : t === "EXTRAORDINARIA" ? "Extraordinaria" : "Ambas"}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Tipo informacional bloqueado (casos 2021/SEN y 2023/SEN) */}
        {isLockedEstado && !showTipoRadios && (
          <fieldset className="flex-shrink-0 opacity-70">
            <legend className={`${LABEL_CLS} mb-1`}>Tipo</legend>
            <label className={RADIO_CLS + " cursor-default"}>
              <input
                type="radio"
                name="ef-tipo-locked"
                disabled
                defaultChecked
                aria-label="Tipo de elección: Extraordinaria (bloqueado)"
                className="accent-blue-eske"
              />
              Extraordinaria
            </label>
          </fieldset>
        )}

        {/* Principio electoral (condicional) */}
        {showPrincipioRadios && (
          <fieldset className="flex-shrink-0">
            <legend className={`${LABEL_CLS} mb-1`}>Principio</legend>
            <div className="flex flex-wrap gap-2">
              {principiosDisponibles.map((p) => (
                <label key={p} className={RADIO_CLS}>
                  <input
                    type="radio"
                    name="ef-principio"
                    value={p}
                    checked={pendingPrincipio === p}
                    onChange={() => setPrincipio(p)}
                    className="accent-blue-eske"
                  />
                  {p === "MAYORIA RELATIVA" ? "MR" : "RP"}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Partidos — oculto en modo geo (hidePartidos=true) */}
        {!hidePartidos && (
          <div className="flex-1 sm:flex-none sm:min-w-[200px]">
            <PartidosMultiSelect
              id="ef-partidos"
              label="Partidos / coaliciones"
              options={partidoOptions}
              selected={pendingPartidos}
              onChange={setPartidos}
              placeholder="Buscar partido..."
              todosLabel="Todos"
            />
          </div>
        )}

        {/* Botón Consultar — solo cuando hay cambios pendientes */}
        {hasPending && (
          <div className="flex items-end flex-shrink-0">
            <button
              type="button"
              onClick={onConsultar}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-blue-eske text-white-eske hover:bg-blue-eske-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
              aria-label="Ejecutar consulta con los filtros seleccionados"
            >
              Consultar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
