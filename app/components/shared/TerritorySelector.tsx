"use client";

import { useState, useEffect } from "react";
import type { Territorio, NivelTerritorial } from "@/types/pestel.types";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import { useGeoOptions } from "@/app/components/geo/hooks/useGeoOptions";
import type { GeoOptionDistrito } from "@/lib/geo/distritos";
import { getCveEntidad } from "@/lib/geo/estadoCve";

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
  // México: dropdown de estado
  const [estado, setEstado] = useState(territorio?.estado ?? "");
  // México nivel municipal: texto libre (sin catálogo de municipios en esta fase)
  const [municipio, setMunicipio] = useState(territorio?.municipio ?? "");
  // México nivel distrital: selector estructurado contra /api/geo/options
  // (Fase 1 del rediseño de territorio, 26-08-13) — reemplaza el input de
  // texto libre que dependía de que el usuario escribiera "con cabecera en
  // X" para que Fontana pudiera resolver el municipio (nunca ocurría en la
  // práctica: el placeholder anterior ni siquiera usaba esa frase).
  const [distritoSeleccionado, setDistritoSeleccionado] = useState<GeoOptionDistrito | null>(null);
  const [distritoFallbackTexto, setDistritoFallbackTexto] = useState(""); // solo si /api/geo/options falla
  // Países no-México: texto libre
  const [estadoTexto, setEstadoTexto] = useState(territorio?.estado ?? "");
  const [municipioTexto, setMunicipioTexto] = useState(territorio?.municipio ?? "");

  const esMexico = pais === "México";
  const requiresEstado = nivel !== "nacional";
  const esDistrito = nivel === "distrito_federal" || nivel === "distrito_local" || nivel === "distrito";
  const requiresMunicipio = nivel === "municipal" || esDistrito;

  const estadoCveParaDistritos = esMexico && esDistrito && estado ? getCveEntidad(estado) : null;
  const {
    options: distritoOptions,
    isLoading: loadingDistritos,
    error: distritoError,
  } = useGeoOptions<GeoOptionDistrito>({
    tipo: nivel === "distrito_federal" ? "distritos_fed" : "distritos_loc",
    estadoId: estadoCveParaDistritos ?? "",
  });

  // Pre-selecciona el distrito actual del proyecto (si ya tiene cve_distrito
  // válido, ej. al editar un proyecto existente) una vez que el catálogo del
  // estado correspondiente termina de cargar.
  useEffect(() => {
    if (distritoSeleccionado) return;
    if (!territorio?.cve_distrito || distritoOptions.length === 0) return;
    const match = distritoOptions.find((o) => o.cve === territorio.cve_distrito);
    if (match) setDistritoSeleccionado(match);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distritoOptions]);

  // Construir nombre legible y emitir cambio
  useEffect(() => {
    if (!pais) return;

    const estadoVal = esMexico ? estado : estadoTexto;
    const municipioVal = esMexico
      ? (esDistrito
          ? (distritoSeleccionado ? (distritoSeleccionado.cabecera ?? distritoSeleccionado.nombre) : distritoFallbackTexto)
          : municipio)
      : municipioTexto;

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
      estado: nivel !== "nacional" && estadoVal ? estadoVal : undefined,
      municipio: requiresMunicipio && municipioVal ? municipioVal : undefined,
      cve_distrito: esMexico && esDistrito && distritoSeleccionado ? distritoSeleccionado.cve : undefined,
      distritosSeleccionados:
        esMexico && esDistrito && distritoSeleccionado
          ? [{ cve: distritoSeleccionado.cve, nombre: distritoSeleccionado.cabecera ?? distritoSeleccionado.nombre }]
          : undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pais, nivel, estado, municipio, estadoTexto, municipioTexto, distritoSeleccionado, distritoFallbackTexto]);

  const canContinue = (() => {
    if (!pais) return false;
    if (nivel === "nacional") return true;
    const estadoVal = esMexico ? estado : estadoTexto.trim();
    if (!estadoVal) return false;
    if (requiresMunicipio) {
      if (esMexico && esDistrito) {
        return distritoSeleccionado !== null || distritoFallbackTexto.trim().length > 0;
      }
      const municipioVal = esMexico ? municipio.trim() : municipioTexto.trim();
      return municipioVal.length > 0;
    }
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
            // Resetear campos de territorio al cambiar de país
            setEstado("");
            setEstadoTexto("");
            setMunicipio("");
            setMunicipioTexto("");
            setDistritoSeleccionado(null);
            setDistritoFallbackTexto("");
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
              setMunicipio("");
              setMunicipioTexto("");
              setDistritoSeleccionado(null);
              setDistritoFallbackTexto("");
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

      {/* === RUTA MÉXICO: dropdowns con catálogo === */}
      {esMexico && requiresEstado && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado-mx" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
            Estado
            <InfoTooltip
              content="Limita los datos electorales y el scraping de noticias al estado seleccionado."
              example="Morelos"
            />
          </label>
          <select
            id="estado-mx"
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              // El catálogo de distritos es por estado — un distrito
              // seleccionado del estado anterior ya no aplica.
              setDistritoSeleccionado(null);
              setDistritoFallbackTexto("");
            }}
            className={selectClass}
          >
            <option value="">Selecciona un estado</option>
            {ESTADOS_MEXICO.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      )}

      {esMexico && requiresMunicipio && !esDistrito && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="municipio-mx" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
            Municipio
            <InfoTooltip
              content="Permite segmentar los datos al nivel más específico posible dentro del estado."
              example="Jiutepec"
            />
          </label>
          <input
            id="municipio-mx"
            type="text"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            placeholder="ej. Atizapán de Zaragoza"
            className={inputClass}
          />
        </div>
      )}

      {/* Distrito electoral (federal/local) — selector estructurado contra
          el catálogo real del INE (lib/geo/distritos.ts vía
          /api/geo/options), en vez del texto libre que dependía de que el
          usuario escribiera un formato exacto que Fontana pudiera parsear. */}
      {esMexico && requiresMunicipio && esDistrito && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="distrito-mx" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
            {nivel === "distrito_federal" ? "Distrito electoral federal" : "Distrito electoral local"}
            <InfoTooltip
              content="Identifica el distrito exacto dentro del estado. El municipio/cabecera se resuelve automáticamente del catálogo del INE."
              example="D.L. 027 – Iztapalapa"
            />
          </label>
          {!estado ? (
            <p className="text-xs text-gray-eske-50 dark:text-[#6D8294] italic">
              Selecciona primero un estado.
            </p>
          ) : distritoError ? (
            <>
              <input
                id="distrito-mx"
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
            <select
              id="distrito-mx"
              value={distritoSeleccionado?.cve ?? ""}
              disabled={loadingDistritos}
              onChange={(e) => {
                const opt = distritoOptions.find((o) => o.cve === e.target.value) ?? null;
                setDistritoSeleccionado(opt);
              }}
              className={selectClass}
            >
              <option value="">
                {loadingDistritos ? "Cargando distritos…" : "Selecciona un distrito"}
              </option>
              {distritoOptions.map((o) => (
                <option key={o.cve} value={o.cve}>{o.nombre}</option>
              ))}
            </select>
          )}
          {distritoSeleccionado && !distritoSeleccionado.cabecera && (
            <p className="text-xs text-yellow-eske-70 dark:text-yellow-eske">
              Este distrito no tiene una cabecera registrada en el catálogo — se usará la descripción
              genérica ({distritoSeleccionado.nombre}). Verifica que sea correcta.
            </p>
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
