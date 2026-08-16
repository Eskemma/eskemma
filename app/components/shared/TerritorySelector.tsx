"use client";

import { useState, useEffect } from "react";
import type { Territorio, NivelTerritorial } from "@/types/pestel.types";
import type { DistritoSeleccionado, MunicipioSeleccionado } from "@/types/shared.types";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import { useGeoOptionsMultiEstado, type EstadoConCve } from "@/app/components/geo/hooks/useGeoOptionsMultiEstado";
import type { GeoOptionDistrito } from "@/lib/geo/distritos";
import { getCveEntidad } from "@/lib/geo/estadoCve";
import { formatDistritoLabel } from "@/lib/geo/formatDistrito";
import { resolverPrimerElemento } from "@/lib/moddulo/territorioPlural";
import PartidosMultiSelect, { type MultiSelectOption } from "@/app/sefix/components/elecciones/PartidosMultiSelect";

// ==========================================
// DATOS GEOGRÁFICOS
// ==========================================

const ESTADOS_MEXICO = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
  "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima",
  "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo",
  "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
  "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa",
  "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán",
  "Zacatecas",
];

const ESTADOS_MEXICO_OPTIONS: MultiSelectOption[] = ESTADOS_MEXICO.map((e) => ({ value: e, label: e }));

// `todosLabel` de PartidosMultiSelect (Fase 2, 26-08-13) — el componente lo
// usa como texto visible ("Ninguno (limpiar selección)" en el desplegable, y
// como placeholder cuando no hay nada elegido), así que debe ser un texto
// legible, no un sentinela técnico. Se filtra explícitamente en cada
// onChange antes de escribir a estadosSeleccionados/distritosAcumulados — el
// comportamiento propio del componente (selected vacío → onChange([todosLabel]))
// es de Sefix (selección vacía = "todos los partidos"), semántica que no
// aplica aquí (selección vacía = ningún territorio elegido todavía). Ningún
// estado o distrito real se llama "Ninguno", así que no hay colisión posible.
const SENTINELA_LIMPIAR = "Ninguno";

// México primero (tratamiento especial), luego USA y España, resto alfabético
const PAISES_IBEROAMERICA = [
  "México",
  "Estados Unidos",
  "España",
  "Argentina",
  "Bolivia",
  "Brasil",
  "Chile",
  "Colombia",
  "Costa Rica",
  "Cuba",
  "Ecuador",
  "El Salvador",
  "Guatemala",
  "Honduras",
  "Nicaragua",
  "Panamá",
  "Paraguay",
  "Perú",
  "Portugal",
  "Puerto Rico",
  "República Dominicana",
  "Uruguay",
  "Venezuela",
];

// ==========================================
// HELPERS DE DEDUPLICACIÓN (Fase 2, 26-08-13 / Decisión 2, 26-08-16)
// ==========================================

function normalizarParaComparar(s: string): string {
  return s.trim().toLowerCase();
}

// Decisión 2 (26-08-16) — MunicipioSeleccionado[] con estado por entrada,
// dedup por nombre+estado normalizado (mismo criterio que agregarDistrito,
// cve+estado) — un mismo nombre de municipio es válido en 2 estados
// distintos, solo se deduplica dentro del MISMO estado.
function agregarMunicipio(
  actual: MunicipioSeleccionado[],
  estado: string,
  nuevoNombre: string
): MunicipioSeleccionado[] {
  const nuevoNorm = normalizarParaComparar(nuevoNombre);
  if (!nuevoNorm) return actual;
  const yaExiste = actual.some(
    (m) => m.estado === estado && normalizarParaComparar(m.nombre) === nuevoNorm
  );
  if (yaExiste) return actual;
  return [...actual, { nombre: nuevoNombre.trim(), estado }];
}

function agregarDistrito(
  actual: DistritoSeleccionado[],
  nuevo: DistritoSeleccionado & { estado: string }
): DistritoSeleccionado[] {
  const yaExiste = actual.some((d) => d.cve === nuevo.cve && d.estado === nuevo.estado);
  if (yaExiste) return actual;
  return [...actual, nuevo];
}

// ==========================================
// PROPS
// ==========================================

interface Props {
  territorio: Territorio | null;
  onChange: (territorio: Territorio) => void;
  onNext: () => void;
  onBack: () => void;
  /** Texto de la pregunta principal. Varía por contexto. */
  label?: string;
  /** Texto del botón de avance. Default "Continuar →" (wizards de creación). */
  nextLabel?: string;
  /** Texto del botón de retroceso. Default "← Atrás". */
  backLabel?: string;
}

// ==========================================
// COMPONENTE
// ==========================================

export default function TerritorySelector({
  territorio,
  onChange,
  onNext,
  onBack,
  label = "¿Cuál es el territorio de este análisis?",
  nextLabel = "Continuar →",
  backLabel = "← Atrás",
}: Props) {
  const [pais, setPais] = useState(territorio?.pais ?? "");
  const [nivel, setNivel] = useState<NivelTerritorial>(territorio?.nivel ?? "estatal");

  // Decisión 1 (Ronda 3, 26-08-16) — control de Estados UNIFICADO para los
  // 3 niveles no-nacionales (antes: Estatal tenía su propio multi-select y
  // Municipal/Distrito usaban un `estado` singular — "estado en edición"
  // para distrito, dropdown simple para municipal). Mismo campo, mismo
  // fallback ya validado contra proyectos reales (ZMG O2RBnCPiyGJ6u6kyk1rS,
  // Iztapalapa nZvpYu4nnZrsw5hoGcVP): si el proyecto legado solo tiene
  // `estado` singular, se resuelve a [estado] — sin cajas vacías.
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<string[]>(
    territorio?.estadosSeleccionados ?? (territorio?.estado ? [territorio.estado] : [])
  );

  // Municipal (Decisión 2, 26-08-16) — MunicipioSeleccionado[] con estado
  // por entrada. Migración: si municipiosPorEstado está ausente pero
  // municipiosSeleccionados (legado, string[] plano) sí existe, reconstruye
  // una entrada por cada nombre, todas atadas a territorio.estado (el único
  // estado que un proyecto legado podía tener) — verificado contra
  // O2RBnCPiyGJ6u6kyk1rS (ZMG, 10 municipios, sin estado por entrada).
  const [municipiosPorEstado, setMunicipiosPorEstado] = useState<MunicipioSeleccionado[]>(() => {
    if (territorio?.municipiosPorEstado) return territorio.municipiosPorEstado;
    if (territorio?.municipiosSeleccionados && territorio.estado) {
      return territorio.municipiosSeleccionados.map((nombre) => ({ nombre, estado: territorio.estado! }));
    }
    return [];
  });
  // Texto libre en curso, uno por estado (una caja de texto por estado
  // seleccionado, cada una con su propia lista de chips debajo).
  const [municipioInputPorEstado, setMunicipioInputPorEstado] = useState<Record<string, string>>({});

  // Distrito: acumulador multi-estado (Fase 2, sin cambio de shape en esta
  // ronda) — solo cambia CÓMO se llena: antes "estado en edición" + agregar
  // uno a la vez; ahora selector fusionado con clave compuesta
  // "{estado}::{cve}" que cubre TODOS los estados seleccionados a la vez.
  // Entradas legadas de Fase 1 sin `estado` (el único caso real en
  // producción: nZvpYu4nnZrsw5hoGcVP) se completan aquí con el `estado`
  // legado singular del territorio — nunca se deja sin poblar en la UI.
  const [distritosAcumulados, setDistritosAcumulados] = useState<DistritoSeleccionado[]>(() => {
    if (territorio?.distritosSeleccionados) {
      return territorio.distritosSeleccionados.map((d) => ({
        ...d,
        estado: d.estado ?? territorio.estado ?? "",
      }));
    }
    return [];
  });
  const [distritoFallbackTexto, setDistritoFallbackTexto] = useState(""); // solo si TODOS los estados fallan

  // Países no-México: texto libre
  const [estadoTexto, setEstadoTexto] = useState(territorio?.estado ?? "");
  const [municipioTexto, setMunicipioTexto] = useState(territorio?.municipio ?? "");

  const esMexico = pais === "México";
  const requiresEstado = nivel !== "nacional";
  const esDistrito = nivel === "distrito_federal" || nivel === "distrito_local" || nivel === "distrito";
  const requiresMunicipio = nivel === "municipal" || esDistrito;

  // Estados con cve ya resuelto — para el catálogo multi-estado de
  // distritos. getCveEntidad puede devolver null si el nombre no matchea
  // (no debería pasar con ESTADOS_MEXICO, pero se filtra por seguridad,
  // nunca se pasa null al hook).
  const estadosConCve: EstadoConCve[] = esMexico
    ? estadosSeleccionados
        .map((nombre) => ({ nombre, cve: getCveEntidad(nombre) }))
        .filter((e): e is EstadoConCve => e.cve !== null)
    : [];

  const {
    options: distritoOptionsMultiEstado,
    isLoading: loadingDistritos,
    erroresPorEstado: erroresDistritos,
  } = useGeoOptionsMultiEstado<GeoOptionDistrito>({
    tipo: nivel === "distrito_federal" ? "distritos_fed" : "distritos_loc",
    estados: esDistrito ? estadosConCve : [],
  });

  const todosLosEstadosFallaron =
    !loadingDistritos &&
    estadosConCve.length > 0 &&
    Object.keys(erroresDistritos).length === estadosConCve.length;

  // Construir nombre legible y emitir cambio
  useEffect(() => {
    if (!pais) return;

    let estadoVal: string | undefined;
    let municipioVal: string | undefined;
    let cveDistritoVal: string | undefined;
    let distritosSeleccionadosVal: DistritoSeleccionado[] | undefined;
    let estadosSeleccionadosVal: string[] | undefined;
    let municipiosSeleccionadosVal: string[] | undefined;
    let municipiosPorEstadoVal: MunicipioSeleccionado[] | undefined;

    if (esMexico) {
      if (nivel === "estatal") {
        estadoVal = resolverPrimerElemento(estadosSeleccionados, undefined).valor;
        estadosSeleccionadosVal = estadosSeleccionados.length > 0 ? estadosSeleccionados : undefined;
      } else if (nivel === "municipal") {
        const primero = municipiosPorEstado[0];
        estadoVal = primero?.estado;
        municipioVal = primero?.nombre;
        estadosSeleccionadosVal = estadosSeleccionados.length > 0 ? estadosSeleccionados : undefined;
        municipiosPorEstadoVal = municipiosPorEstado.length > 0 ? municipiosPorEstado : undefined;
        municipiosSeleccionadosVal =
          municipiosPorEstado.length > 0 ? municipiosPorEstado.map((m) => m.nombre) : undefined;
      } else if (esDistrito) {
        if (distritosAcumulados.length > 0) {
          const primero = distritosAcumulados[0];
          estadoVal = primero.estado;
          municipioVal = primero.nombre;
          cveDistritoVal = primero.cve;
          distritosSeleccionadosVal = distritosAcumulados;
        } else if (distritoFallbackTexto.trim()) {
          // Camino de error del catálogo (todos los estados fallaron) —
          // solo campos legados, sin entrada estructurada en el acumulador.
          estadoVal = resolverPrimerElemento(estadosSeleccionados, undefined).valor;
          municipioVal = distritoFallbackTexto;
        }
      }
    } else {
      estadoVal = estadoTexto || undefined;
      municipioVal = municipioTexto || undefined;
    }

    const parts: string[] = [];
    if (nivel === "nacional") {
      parts.push(pais);
    } else if (estadoVal) {
      parts.push(estadoVal);
      if (requiresMunicipio && municipioVal) parts.push(municipioVal);
    }

    const nombre = parts.join(" › ");
    if (!nombre) return;

    onChange({
      nivel,
      nombre,
      pais,
      estado: nivel !== "nacional" ? estadoVal : undefined,
      municipio: requiresMunicipio ? municipioVal : undefined,
      cve_distrito: cveDistritoVal,
      distritosSeleccionados: distritosSeleccionadosVal,
      estadosSeleccionados: estadosSeleccionadosVal,
      municipiosSeleccionados: municipiosSeleccionadosVal,
      municipiosPorEstado: municipiosPorEstadoVal,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pais, nivel, estadoTexto, municipioTexto,
    estadosSeleccionados, municipiosPorEstado, distritosAcumulados, distritoFallbackTexto,
  ]);

  const canContinue = (() => {
    if (!pais) return false;
    if (nivel === "nacional") return true;
    if (esMexico) {
      if (nivel === "estatal") return estadosSeleccionados.length > 0;
      if (nivel === "municipal") return estadosSeleccionados.length > 0 && municipiosPorEstado.length > 0;
      if (esDistrito) return distritosAcumulados.length > 0 || distritoFallbackTexto.trim().length > 0;
      return false;
    }
    const estadoVal = estadoTexto.trim();
    if (!estadoVal) return false;
    if (requiresMunicipio) return municipioTexto.trim().length > 0;
    return true;
  })();

  const inputClass =
    "px-3 py-2.5 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske " +
    "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
    "placeholder:text-gray-eske-40 dark:placeholder:text-[#6D8294]";

  const selectClass =
    "px-3 py-2.5 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske " +
    "bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]";

  const chipClass =
    "inline-flex items-center gap-1 px-2 py-1 rounded text-xs " +
    "bg-bluegreen-eske/10 text-bluegreen-eske border border-bluegreen-eske/30";

  function handleDistritosFusionadoChange(vals: string[]) {
    const claves = vals.filter((v) => v !== SENTINELA_LIMPIAR);
    let resultado: DistritoSeleccionado[] = [];
    for (const clave of claves) {
      const separadorIdx = clave.indexOf("::");
      const estadoNombre = clave.slice(0, separadorIdx);
      const cve = clave.slice(separadorIdx + 2);
      const opt = distritoOptionsMultiEstado.find((o) => o.estado === estadoNombre && o.cve === cve);
      const entrada: DistritoSeleccionado & { estado: string } = {
        cve,
        nombre: opt?.cabecera ?? opt?.nombre ?? cve,
        estado: estadoNombre,
      };
      resultado = agregarDistrito(resultado, entrada);
    }
    setDistritosAcumulados(resultado);
  }

  function quitarDistrito(cve: string, estadoDelDistrito: string) {
    setDistritosAcumulados((prev) => prev.filter((d) => !(d.cve === cve && d.estado === estadoDelDistrito)));
  }

  function handleAgregarMunicipio(estado: string) {
    const texto = municipioInputPorEstado[estado] ?? "";
    setMunicipiosPorEstado((prev) => agregarMunicipio(prev, estado, texto));
    setMunicipioInputPorEstado((prev) => ({ ...prev, [estado]: "" }));
  }

  function quitarMunicipio(estado: string, nombre: string) {
    setMunicipiosPorEstado((prev) => prev.filter((m) => !(m.estado === estado && m.nombre === nombre)));
  }

  function resetCamposMexico() {
    setEstadosSeleccionados([]);
    setMunicipiosPorEstado([]);
    setMunicipioInputPorEstado({});
    setDistritosAcumulados([]);
    setDistritoFallbackTexto("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
          {label}
        </h2>
        <p className="text-sm text-gray-eske-70 dark:text-[#9AAEBE]">
          Define el alcance geográfico del proyecto.
        </p>
      </div>

      {/* País */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pais" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0]">
          País
        </label>
        <select
          id="pais"
          value={pais}
          onChange={(e) => {
            setPais(e.target.value);
            setEstadoTexto("");
            setMunicipioTexto("");
            resetCamposMexico();
          }}
          className={selectClass}
        >
          <option value="">— Seleccionar —</option>
          {PAISES_IBEROAMERICA.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Nivel territorial — siempre visible cuando hay país */}
      {pais && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nivel" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
            Nivel territorial
            <InfoTooltip
              content="Define la escala geográfica del análisis. Afecta qué fuentes se consultan y la profundidad del análisis."
              example="Municipal si tu proyecto es una presidencia municipal"
            />
          </label>
          <select
            id="nivel"
            value={nivel}
            onChange={(e) => {
              setNivel(e.target.value as NivelTerritorial);
              resetCamposMexico();
            }}
            className={selectClass}
          >
            <option value="nacional">Nacional</option>
            <option value="estatal">Estatal</option>
            <option value="municipal">Municipal</option>
            <option value="distrito_federal">Distrito electoral federal</option>
            <option value="distrito_local">Distrito electoral local</option>
          </select>
        </div>
      )}

      {/* === RUTA MÉXICO: control de Estados UNIFICADO (Decisión 1) ===
          Mismo control para Estatal, Municipal y Distrito federal/local —
          lo que cambia por nivel es lo que se renderiza DEBAJO. */}
      {esMexico && requiresEstado && (
        <div className="relative">
          <PartidosMultiSelect
            id="estados-mx"
            label={
              <span className="flex items-center gap-1.5">
                Estados
                <InfoTooltip
                  content="Selecciona el estado donde tienes programado ejecutar tu proyecto. (Si lo amerita, puedes seleccionar más de un estado). Esto delimita el territorio para los procesos de la aplicación."
                  example="Nayarit"
                />
              </span>
            }
            options={ESTADOS_MEXICO_OPTIONS}
            selected={estadosSeleccionados}
            onChange={(vals) => setEstadosSeleccionados(vals.filter((v) => v !== SENTINELA_LIMPIAR))}
            placeholder="Buscar estado…"
            todosLabel={SENTINELA_LIMPIAR}
          />
        </div>
      )}

      {/* Municipios — un bloque por estado seleccionado (Decisión 2) */}
      {esMexico && nivel === "municipal" && (
        estadosSeleccionados.length === 0 ? (
          <p className="text-xs text-gray-eske-50 dark:text-[#6D8294] italic">
            Selecciona primero uno o varios estados.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {estadosSeleccionados.map((estadoNombre) => (
              <div
                key={estadoNombre}
                className="flex flex-col gap-1.5 border border-gray-eske-20 dark:border-white/10 rounded-lg p-3"
              >
                <p className="text-xs font-semibold text-black-eske dark:text-[#EAF2F8] flex items-center gap-1.5">
                  {estadoNombre}
                  {estadoNombre === estadosSeleccionados[0] && (
                    <InfoTooltip
                      content="Selecciona el municipio donde tiene lugar tu proyecto. (Si lo amerita, puedes seleccionar más de un municipio). Escribe el nombre exacto."
                      example="Jiutepec"
                    />
                  )}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={municipioInputPorEstado[estadoNombre] ?? ""}
                    onChange={(e) =>
                      setMunicipioInputPorEstado((prev) => ({ ...prev, [estadoNombre]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAgregarMunicipio(estadoNombre);
                      }
                    }}
                    placeholder="ej. Atizapán de Zaragoza"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => handleAgregarMunicipio(estadoNombre)}
                    disabled={!(municipioInputPorEstado[estadoNombre] ?? "").trim()}
                    className="px-4 py-2.5 bg-bluegreen-eske text-white rounded-lg text-sm font-medium
                      hover:bg-bluegreen-eske-60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Agregar
                  </button>
                </div>
                {municipiosPorEstado.filter((m) => m.estado === estadoNombre).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {municipiosPorEstado
                      .filter((m) => m.estado === estadoNombre)
                      .map((m) => (
                        <span key={m.nombre} className={chipClass}>
                          {m.nombre}
                          <button
                            type="button"
                            aria-label={`Quitar ${m.nombre}`}
                            onClick={() => quitarMunicipio(estadoNombre, m.nombre)}
                            className="ml-0.5 hover:text-red-eske focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bluegreen-eske rounded"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Distrito electoral (federal/local) — selector fusionado con clave
          compuesta "{estado}::{cve}" (Decisión 1, 26-08-16) */}
      {esMexico && esDistrito && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
            {nivel === "distrito_federal" ? "Distritos electorales federales" : "Distritos electorales locales"}
            <InfoTooltip
              content={
                nivel === "distrito_federal"
                  ? "Selecciona el Distrito Electoral Federal para tu proyecto. (Si lo amerita, puedes seleccionar más de un distrito). Esto delimita el territorio para los procesos de la aplicación."
                  : "Selecciona el Distrito Electoral Local para tu proyecto. (Si lo amerita, puedes seleccionar más de un distrito local). Esto delimita el territorio para los procesos de la aplicación."
              }
              example={nivel === "distrito_federal" ? "D.F. 1405 PUERTO VALLARTA" : "D.L. 0927 IZTAPALAPA"}
            />
          </label>
          {estadosSeleccionados.length === 0 ? (
            <p className="text-xs text-gray-eske-50 dark:text-[#6D8294] italic">
              Selecciona primero uno o varios estados.
            </p>
          ) : todosLosEstadosFallaron ? (
            <>
              <input
                type="text"
                value={distritoFallbackTexto}
                onChange={(e) => setDistritoFallbackTexto(e.target.value)}
                placeholder="ej. Distrito 27 — Iztapalapa"
                className={inputClass}
              />
              <p className="text-xs text-yellow-eske-70 dark:text-yellow-eske">
                No se pudo cargar el catálogo estructurado de distritos. Escribe el distrito y su
                cabecera manualmente — podrás corregirlo después.
              </p>
            </>
          ) : (
            <>
              {loadingDistritos && (
                <p className="text-xs text-red-eske mb-1" role="status">
                  Cargando distritos…
                </p>
              )}
              {Object.entries(erroresDistritos).map(([estadoConError]) => (
                <p key={estadoConError} className="text-xs text-yellow-eske-70 dark:text-yellow-eske">
                  No se pudo cargar el catálogo de {estadoConError} — los demás estados siguen
                  disponibles.
                </p>
              ))}
              <div className="relative">
                <PartidosMultiSelect
                  label="Distritos"
                  options={distritoOptionsMultiEstado.map((o) => ({
                    value: `${o.estado}::${o.cve}`,
                    label: formatDistritoLabel(
                      nivel as "distrito_federal" | "distrito_local",
                      getCveEntidad(o.estado),
                      o.cve,
                      o.cabecera,
                      o.nombre
                    ),
                  }))}
                  selected={distritosAcumulados.map((d) => `${d.estado}::${d.cve}`)}
                  onChange={handleDistritosFusionadoChange}
                  disabled={loadingDistritos}
                  placeholder="Buscar distrito…"
                  todosLabel={SENTINELA_LIMPIAR}
                />
              </div>
            </>
          )}

          {/* Lista de chips siempre visible — abarca TODOS los estados
              acumulados, no solo los recién cargados. */}
          {distritosAcumulados.length > 0 && (
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-xs font-medium text-black-eske dark:text-[#C7D6E0] uppercase tracking-wide">
                Distritos seleccionados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {distritosAcumulados.map((d) => (
                  <span key={`${d.estado}-${d.cve}`} className={chipClass}>
                    {d.estado || "(estado no especificado)"} — {formatDistritoLabel(
                      nivel as "distrito_federal" | "distrito_local",
                      d.estado ? getCveEntidad(d.estado) : null,
                      d.cve,
                      d.nombre,
                      d.nombre
                    )}
                    <button
                      type="button"
                      aria-label={`Quitar ${d.estado} — ${d.nombre}`}
                      onClick={() => quitarDistrito(d.cve, d.estado ?? "")}
                      className="ml-0.5 hover:text-red-eske focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bluegreen-eske rounded"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === RUTA OTROS PAÍSES: campos de texto libre === */}
      {!esMexico && pais && requiresEstado && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado-texto" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0]">
            {nivel === "estatal" ? "Estado / Provincia / Región" :
             esDistrito ? "Circunscripción / Distrito" :
             "Estado o región"}
          </label>
          <input
            id="estado-texto"
            type="text"
            value={estadoTexto}
            onChange={(e) => setEstadoTexto(e.target.value)}
            placeholder="ej. Buenos Aires"
            className={inputClass}
          />
        </div>
      )}

      {!esMexico && pais && requiresMunicipio && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="municipio-texto" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0]">
            {esDistrito ? "Distrito / circunscripción" : "Municipio / localidad"}
          </label>
          <input
            id="municipio-texto"
            type="text"
            value={municipioTexto}
            onChange={(e) => setMunicipioTexto(e.target.value)}
            placeholder={esDistrito ? "ej. Circunscripción 3" : "ej. La Plata"}
            className={inputClass}
          />
        </div>
      )}

      {/* Vista previa del territorio */}
      {territorio?.nombre && (
        <div className="bg-bluegreen-eske/5 border border-bluegreen-eske/20 rounded-lg px-4 py-3">
          <p className="text-xs text-bluegreen-eske font-medium uppercase tracking-wide mb-0.5">
            Territorio seleccionado
          </p>
          <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
            {territorio.nombre}
          </p>
          {territorio.pais && territorio.pais !== "México" && (
            <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mt-0.5">{territorio.pais}</p>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-gray-eske-30 dark:border-white/10 text-gray-eske-80 dark:text-[#C7D6E0]
            rounded-lg text-sm font-medium hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
        >
          {backLabel}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="px-6 py-2.5 bg-bluegreen-eske text-white rounded-lg text-sm
            font-medium transition-colors hover:bg-bluegreen-eske-60
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
