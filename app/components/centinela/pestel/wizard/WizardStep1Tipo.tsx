"use client";

import { useRef } from "react";
import type { TipoProyecto } from "@/types/pestel.types";
import InfoTooltip from "@/app/components/ui/InfoTooltip";

const PALETTE = ["#026988","#248cc1","#ffa366","#649941","#ffd14a","#d10f3f","#474747"];

interface Props {
  tipo: TipoProyecto | null;
  nombre: string;
  horizonte: number;
  color: string;
  onChange: (fields: {
    tipo?: TipoProyecto;
    nombre?: string;
    horizonte?: number;
    color?: string;
  }) => void;
  onNext: () => void;
}

const PROJECT_TYPES: {
  value: TipoProyecto;
  label: string;
  description: string;
  icon: string;
  placeholder: string;
}[] = [
  {
    value: "electoral",
    label: "Electoral",
    description: "Campaña política o proceso electoral",
    icon: "🗳️",
    placeholder: "Campaña [candidato] [año]",
  },
  {
    value: "gubernamental",
    label: "Gubernamental",
    description: "Gestión de gobierno en ejercicio",
    icon: "🏛️",
    placeholder: "Gobierno de [estado/municipio]",
  },
  {
    value: "legislativo",
    label: "Legislativo",
    description: "Proceso legislativo o bancada",
    icon: "📜",
    placeholder: "Bancada [partido] [congreso]",
  },
  {
    value: "ciudadano",
    label: "Ciudadano",
    description: "Movimiento social u organización civil",
    icon: "✊",
    placeholder: "Movimiento [nombre]",
  },
];

export default function WizardStep1Tipo({
  tipo,
  nombre,
  horizonte,
  color,
  onChange,
  onNext,
}: Props) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const selectedType = PROJECT_TYPES.find((t) => t.value === tipo);
  const canContinue = tipo !== null && nombre.trim().length > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Type selection */}
      <div>
        <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-1 flex items-center gap-1.5">
          ¿Qué tipo de proyecto es?
          <InfoTooltip
            content="Define el marco metodológico del análisis. Cada tipo activa un conjunto distinto de variables PESTEL por defecto, ajustado a su contexto político."
            example="Si coordinas una campaña a diputado local → Electoral"
          />
        </h2>
        <p className="text-sm text-gray-eske-70 dark:text-[#9AAEBE] mb-4">
          El tipo define las variables PESTEL que se activan por defecto.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {PROJECT_TYPES.map((pt) => (
            <button
              key={pt.value}
              type="button"
              onClick={() => onChange({ tipo: pt.value })}
              className={[
                "flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all",
                tipo === pt.value
                  ? "border-bluegreen-eske bg-bluegreen-eske/5 dark:bg-bluegreen-eske/10"
                  : "border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#21425E] hover:border-gray-eske-40 dark:hover:border-white/20",
              ].join(" ")}
              aria-pressed={tipo === pt.value}
            >
              <span className="text-2xl" aria-hidden="true">
                {pt.icon}
              </span>
              <span className="font-semibold text-black-eske dark:text-[#EAF2F8]">{pt.label}</span>
              <span className="text-xs text-gray-eske-70 dark:text-[#9AAEBE]">{pt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Project name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="project-name" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
          Nombre del proyecto
          <InfoTooltip
            content="Identificador interno del proyecto. No es público. Usa un nombre que permita distinguirlo de otros proyectos."
            example="Campaña Distrito 5 Morelos 2025"
          />
        </label>
        <input
          id="project-name"
          type="text"
          value={nombre}
          onChange={(e) => onChange({ nombre: e.target.value })}
          placeholder={selectedType?.placeholder ?? "Nombre del proyecto"}
          className="px-3 py-2.5 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm
            focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
            placeholder:text-gray-eske-50 dark:placeholder-[#6D8294]
            bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
          maxLength={80}
        />
        <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
          Máximo 80 caracteres. Usa un nombre descriptivo que recuerdes fácilmente.
        </p>
      </div>

      {/* Horizon slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="horizonte" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
            Horizonte temporal
            <InfoTooltip
              content="Período futuro que el análisis debe anticipar. Más meses implica mayor incertidumbre pero mayor utilidad para planeación estratégica."
              example="6 meses para una campaña de temporada media"
            />
          </label>
          <span className="text-sm font-semibold text-bluegreen-eske">
            {horizonte} {horizonte === 1 ? "mes" : "meses"}
          </span>
        </div>
        <input
          id="horizonte"
          type="range"
          min={1}
          max={24}
          step={1}
          value={horizonte}
          onChange={(e) => onChange({ horizonte: Number(e.target.value) })}
          className="w-full accent-bluegreen-eske"
        />
        <div className="flex justify-between text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
          <span>1 mes</span>
          <span>24 meses</span>
        </div>
      </div>

      {/* Color picker */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5">
          Color de identificación
          <InfoTooltip
            content="Color que identifica este proyecto en el Hub de PESTEL. Útil cuando tienes varios proyectos activos."
          />
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ color: c })}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: c,
                borderColor: color === c ? "#fff" : "transparent",
                outline: color === c ? `2px solid ${c}` : "none",
              }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
            />
          ))}
          <button
            type="button"
            onClick={() => colorInputRef.current?.click()}
            className="w-7 h-7 rounded-full border-2 border-dashed border-gray-eske-40
              flex items-center justify-center text-gray-eske-60 hover:border-gray-eske-70
              transition-colors text-xs font-bold"
            aria-label="Elegir color personalizado"
          >
            +
          </button>
          <input
            ref={colorInputRef}
            type="color"
            value={color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
          <input
            type="text"
            value={color}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{6}$/.test(val)) onChange({ color: val });
            }}
            maxLength={7}
            className="w-24 px-2 py-1 border border-gray-eske-30 dark:border-white/10 rounded-lg
              text-xs font-mono bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
            aria-label="Código hexadecimal del color"
          />
          <span
            className="w-7 h-7 rounded-full border border-gray-eske-20 shrink-0"
            style={{ background: color }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
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
