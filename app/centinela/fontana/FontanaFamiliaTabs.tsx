"use client";

// app/centinela/fontana/FontanaFamiliaTabs.tsx
// Navegación por familia — círculo de color + letra + nombre + contador,
// mismo patrón ya usado en el acordeón de dimensiones de PESTEL
// (WizardStep3Variables.tsx: w-7 h-7 rounded-full + código + "N variables"),
// aplicado con la paleta propia de Fontana por familia (ya aprobada desde
// el Paso 2/4 — Fontana_T10_Cierre_Paso4.md §5), no la de PESTEL (que usa
// un solo color para las 6 dimensiones).
//
// Solo Familia 1 está construida este incremento — F2-F5 se muestran con
// su color y contador (siempre 0) pero deshabilitadas, sin onClick real.

import type { FamiliaFontanaId } from "@/types/fontana.types";

interface FamiliaTabInfo {
  id: FamiliaFontanaId;
  nombre: string;
  color: string;
}

const FAMILIAS: FamiliaTabInfo[] = [
  { id: "F1", nombre: "Sociodemográficos", color: "#026988" },
  { id: "F2", nombre: "Socioeconómicos", color: "#DB6015" },
  { id: "F3", nombre: "Geopolíticos", color: "#D10F3F" },
  { id: "F4", nombre: "Comparación internacional", color: "#248CC1" },
  { id: "F5", nombre: "Características territoriales", color: "#FFD14A" },
];

const FAMILIAS_DISPONIBLES: FamiliaFontanaId[] = ["F1"];

interface Props {
  familiaActiva: FamiliaFontanaId;
  conteos: Record<FamiliaFontanaId, number>;
  onCambiar: (id: FamiliaFontanaId) => void;
}

export default function FontanaFamiliaTabs({ familiaActiva, conteos, onCambiar }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Familias de indicadores">
      {FAMILIAS.map((f) => {
        const activa = f.id === familiaActiva;
        const habilitada = FAMILIAS_DISPONIBLES.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={activa}
            aria-disabled={!habilitada}
            disabled={!habilitada}
            onClick={() => onCambiar(f.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap border shrink-0 transition-colors ${
              habilitada ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
            } ${activa ? "" : "border-transparent"}`}
            style={
              activa
                ? { color: f.color, borderColor: f.color, backgroundColor: `${f.color}0d` }
                : undefined
            }
          >
            <span
              className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 text-white-eske"
              style={{ backgroundColor: f.color }}
              aria-hidden="true"
            >
              {f.id.replace("F", "")}
            </span>
            <span className="font-medium text-black-eske dark:text-[#EAF2F8]">{f.nombre}</span>
            <span className="text-xs text-black-eske-80 dark:text-[#9AAEBE]">{conteos[f.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
