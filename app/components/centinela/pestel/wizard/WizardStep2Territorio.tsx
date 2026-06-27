"use client";

import { useState, useEffect } from "react";
import type { Territorio, NivelTerritorial } from "@/types/pestel.types";
import InfoTooltip from "@/app/components/ui/InfoTooltip";

const ESTADOS_MEXICO = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
  "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima",
  "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo",
  "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
  "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa",
  "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán",
  "Zacatecas",
];

interface Props {
  territorio: Territorio | null;
  onChange: (territorio: Territorio) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function WizardStep2Territorio({
  territorio,
  onChange,
  onNext,
  onBack,
}: Props) {
  const [nivel, setNivel] = useState<NivelTerritorial>(
    territorio?.nivel ?? "estatal"
  );
  const [estado, setEstado] = useState(territorio?.estado ?? "");
  const [municipio, setMunicipio] = useState(territorio?.municipio ?? "");

  // Build the readable name and emit changes
  useEffect(() => {
    const parts: string[] = [];
    if (nivel === "nacional") {
      parts.push("México");
    } else if (estado) {
      parts.push(estado);
      if ((nivel === "municipal" || nivel === "distrito") && municipio) {
        parts.push(municipio);
      }
    }
    const nombre = parts.join(" › ");
    if (!nombre) return;

    onChange({
      nivel,
      estado: nivel !== "nacional" ? estado : undefined,
      municipio:
        nivel === "municipal" || nivel === "distrito" ? municipio : undefined,
      nombre,
    });
  }, [nivel, estado, municipio]); // eslint-disable-line react-hooks/exhaustive-deps

  const requiresEstado = nivel !== "nacional";
  const requiresMunicipio = nivel === "municipal" || nivel === "distrito";

  const canContinue =
    (!requiresEstado || estado.length > 0) &&
    (!requiresMunicipio || municipio.trim().length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
          ¿Cuál es el territorio de análisis?
        </h2>
        <p className="text-sm text-gray-eske-70 dark:text-[#9AAEBE]">
          Define el alcance geográfico del proyecto.
        </p>
      </div>

      {/* Nivel */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nivel" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
          Nivel territorial
          <InfoTooltip
            content="Define la escala geográfica del monitoreo. Afecta qué fuentes se consultan y la profundidad del análisis electoral."
            example="Municipal si tu proyecto es una presidencia municipal"
          />
        </label>
        <select
          id="nivel"
          value={nivel}
          onChange={(e) => setNivel(e.target.value as NivelTerritorial)}
          className="px-3 py-2.5 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm
            focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
            bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
        >
          <option value="nacional">Nacional</option>
          <option value="estatal">Estatal</option>
          <option value="municipal">Municipal</option>
          <option value="distrito">Distrito electoral</option>
        </select>
      </div>

      {/* Estado */}
      {requiresEstado && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
            Estado
            <InfoTooltip
              content="Limita el scraping de noticias y los datos electorales al estado seleccionado, mejorando la relevancia del análisis."
              example="Morelos"
            />
          </label>
          <select
            id="estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="px-3 py-2.5 border border-gray-eske-30 rounded-lg text-sm
              focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
              bg-white-eske"
          >
            <option value="">Selecciona un estado</option>
            {ESTADOS_MEXICO.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Municipio */}
      {requiresMunicipio && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="municipio" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
            {nivel === "distrito" ? "Distrito / descripción" : "Municipio"}
            <InfoTooltip
              content="Permite segmentar noticias y datos electorales al nivel más específico posible dentro del estado."
              example={nivel === "distrito" ? "Distrito 02 Jiutepec" : "Jiutepec"}
            />
          </label>
          <input
            id="municipio"
            type="text"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            placeholder={
              nivel === "distrito"
                ? "ej. Distrito 5 — Atizapán de Zaragoza"
                : "ej. Atizapán de Zaragoza"
            }
            className="px-3 py-2.5 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm
              focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
              placeholder:text-gray-eske-50 dark:placeholder-[#6D8294]
              bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
          />
        </div>
      )}

      {/* Preview */}
      {territorio?.nombre && (
        <div className="bg-bluegreen-eske/5 border border-bluegreen-eske/20 rounded-lg px-4 py-3">
          <p className="text-xs text-bluegreen-eske font-medium uppercase tracking-wide mb-0.5">
            Territorio seleccionado
          </p>
          <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
            {territorio.nombre}
          </p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-gray-eske-30 dark:border-white/10 text-gray-eske-80 dark:text-[#C7D6E0]
            rounded-lg text-sm font-medium hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
        >
          ← Atrás
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="px-6 py-2.5 bg-bluegreen-eske text-white rounded-lg text-sm
            font-medium transition-colors hover:bg-bluegreen-eske-60
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
