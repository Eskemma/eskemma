"use client";
import {
  ESTADOS_LIST,
} from "@/lib/sefix/constants";
import {
  CARGO_DISPLAY_LABELS_LOC,
  PARTY_COLORS_LOC,
  getPartidoLabelLoc,
} from "@/lib/sefix/eleccionesLocalesConstants";
import PartidosMultiSelect, {
  MultiSelectOption,
} from "@/app/sefix/components/elecciones/PartidosMultiSelect";
import {
  useLocalesDistritos,
  useLocalesMunicipios,
  useLocalesSecciones,
} from "@/app/sefix/hooks/useEleccionesLocalesFilters";

const SELECT_CLS =
  "text-sm border border-gray-eske-30 dark:border-white/10 rounded-md px-2 py-1.5 " +
  "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske " +
  "w-full sm:w-auto sm:min-w-[140px]";

const LABEL_CLS = "text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE]";
const LABEL_DISABLED_CLS = "text-xs font-medium text-black-eske-60/50 dark:text-[#6D8294]";
const RADIO_CLS = "flex items-center gap-1.5 text-xs text-black-eske dark:text-[#EAF2F8] cursor-pointer";

interface Props {
  pendingEstado: string;
  pendingAnio: number;
  pendingCargo: string;
  pendingPartidos: string[];
  pendingTipo: string;
  pendingPrincipio: string;
  pendingCabecera: string;
  pendingMunicipio: string;
  pendingSecciones: string[];
  setEstado: (v: string) => void;
  setAnio: (v: number) => void;
  setCargo: (v: string) => void;
  setPartidos: (v: string[]) => void;
  setTipo: (v: string) => void;
  setPrincipio: (v: string) => void;
  setCabecera: (v: string) => void;
  setMunicipio: (v: string) => void;
  setSecciones: (v: string[]) => void;
  hasPending: boolean;
  onConsultar: () => void;
  onRestablecer: () => void;
  availableYears: number[];
  loadingYears: boolean;
  cargosDisponibles: string[];
  loadingCargos: boolean;
  partidosDisponibles: string[];
  loadingPartidos: boolean;
  tiposDisponibles: string[];
  principiosDisponibles: string[];
}

export default function EleccionesLocalesFilters({
  pendingEstado, pendingAnio, pendingCargo, pendingPartidos,
  pendingTipo, pendingPrincipio, pendingCabecera, pendingMunicipio, pendingSecciones,
  setEstado, setAnio, setCargo, setPartidos, setTipo, setPrincipio,
  setCabecera, setMunicipio, setSecciones,
  hasPending, onConsultar, onRestablecer,
  availableYears, loadingYears,
  cargosDisponibles, loadingCargos,
  partidosDisponibles, loadingPartidos, tiposDisponibles, principiosDisponibles,
}: Props) {
  const { opciones: distritos, isLoading: loadingDist } = useLocalesDistritos(
    pendingAnio, pendingCargo, pendingEstado,
  );
  const { opciones: municipios, isLoading: loadingMun } = useLocalesMunicipios(
    pendingAnio, pendingCargo, pendingEstado, pendingCabecera,
  );
  const { secciones: seccionesDisp, isLoading: loadingSec } = useLocalesSecciones(
    pendingAnio, pendingCargo, pendingEstado, pendingCabecera, pendingMunicipio,
  );

  const partidoOptions: MultiSelectOption[] = partidosDisponibles.map((p) => ({
    value: p,
    label: getPartidoLabelLoc(p),
    color: PARTY_COLORS_LOC[p] ?? PARTY_COLORS_LOC["DEFAULT"] ?? "#90A4AE",
  }));

  const seccionOptions: MultiSelectOption[] = seccionesDisp.map((s) => ({
    value: s,
    label: s,
  }));

  const hasCabecera = !!pendingCabecera;
  const hasMunicipio = !!pendingMunicipio;

  const tieneOrdinaria = tiposDisponibles.includes("ORDINARIA");
  const tieneExtraordinaria = tiposDisponibles.includes("EXTRAORDINARIA");
  const showTipoRadios = tieneOrdinaria && tieneExtraordinaria;
  const showPrincipioRadios = principiosDisponibles.length > 1;

  const cargoLabel = CARGO_DISPLAY_LABELS_LOC[pendingCargo] ?? pendingCargo;
  const scopeLabel = `${pendingAnio} — ${cargoLabel} — ${pendingEstado || "—"}`;

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

      {/* Fila 1: Estado (primario), Año, Cargo */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">

        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label htmlFor="loc-estado" className={LABEL_CLS}>Entidad federativa</label>
          <select
            id="loc-estado"
            value={pendingEstado}
            onChange={(e) => setEstado(e.target.value)}
            className={SELECT_CLS}
          >
            {ESTADOS_LIST.map((e) => (
              <option key={e.key} value={e.nombre}>{e.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label htmlFor="loc-anio" className={LABEL_CLS}>
            Año{loadingYears && <span className="ml-1 text-[10px] text-red-eske">(Cargando…)</span>}
          </label>
          <select
            id="loc-anio"
            value={pendingAnio}
            onChange={(e) => setAnio(parseInt(e.target.value))}
            disabled={availableYears.length === 0}
            className={SELECT_CLS}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
            {availableYears.length === 0 && (
              <option value={pendingAnio}>{pendingAnio}</option>
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label htmlFor="loc-cargo" className={LABEL_CLS}>
            Cargo{loadingCargos && <span className="ml-1 text-[10px] text-red-eske">(Cargando…)</span>}
          </label>
          <select
            id="loc-cargo"
            value={pendingCargo}
            onChange={(e) => setCargo(e.target.value)}
            disabled={cargosDisponibles.length === 0}
            className={SELECT_CLS}
          >
            {cargosDisponibles.map((c) => (
              <option key={c} value={c}>{CARGO_DISPLAY_LABELS_LOC[c] ?? c}</option>
            ))}
            {cargosDisponibles.length === 0 && (
              <option value={pendingCargo}>{CARGO_DISPLAY_LABELS_LOC[pendingCargo] ?? pendingCargo}</option>
            )}
          </select>
        </div>
      </div>

      {/* Fila 2: Geo cascade + radios + Partidos + Consultar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end">

        {/* Distrito */}
        <div className="flex flex-col gap-1 flex-1 sm:flex-none">
          <label
            htmlFor="loc-cabecera"
            className={loadingDist ? LABEL_DISABLED_CLS : LABEL_CLS}
          >
            Distrito{loadingDist && <span className="ml-1 text-[10px] text-red-eske">(Cargando…)</span>}
          </label>
          <select
            id="loc-cabecera"
            value={pendingCabecera}
            onChange={(e) => setCabecera(e.target.value)}
            disabled={loadingDist}
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
            htmlFor="loc-municipio"
            className={!hasCabecera ? LABEL_DISABLED_CLS : LABEL_CLS}
          >
            Municipio{loadingMun && <span className="ml-1 text-[10px] text-red-eske">(Cargando…)</span>}
          </label>
          <select
            id="loc-municipio"
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
            id="loc-secciones"
            label={<>Sección{loadingSec && <span className="ml-1 text-red-eske">(Cargando…)</span>}</>}
            options={seccionOptions}
            selected={pendingSecciones.length > 0 ? pendingSecciones : ["Todas"]}
            onChange={(v) => setSecciones(v.filter((x) => x !== "Todas"))}
            disabled={!hasMunicipio || loadingSec}
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
                    name="loc-tipo"
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

        {/* Principio electoral (condicional) */}
        {showPrincipioRadios && (
          <fieldset className="flex-shrink-0">
            <legend className={`${LABEL_CLS} mb-1`}>Principio</legend>
            <div className="flex flex-wrap gap-2">
              {principiosDisponibles.map((p) => (
                <label key={p} className={RADIO_CLS}>
                  <input
                    type="radio"
                    name="loc-principio"
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

        {/* Partidos */}
        <div className="flex-1 sm:flex-none sm:min-w-[200px]">
          <PartidosMultiSelect
            id="loc-partidos"
            label={<>Partidos{loadingPartidos && <span className="ml-1 text-red-eske">(Cargando…)</span>}</>}
            options={partidoOptions}
            selected={pendingPartidos}
            onChange={setPartidos}
            placeholder="Buscar partido..."
            todosLabel="Todos"
          />
        </div>

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
