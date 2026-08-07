"use client";

// app/centinela/fontana/NaturalezaBadge.tsx
// Badge de naturaleza del dato + tooltip de definición — extraído de
// FontanaComparativeTable.tsx (Celda) para que FontanaMunicipiosModal.tsx
// lo reutilice sin duplicar NATURALEZA_LABEL/CONFIABILIDAD_BORDE.
//
// Confiabilidad: el borde refleja alta/media/baja derivada de la
// naturaleza (paleta con variante distinta por modo claro/oscuro, no
// solo un tono más oscuro — mismo criterio verificado en PESTLPanelV2.tsx).
// Este color/borde significa EXCLUSIVAMENTE confiabilidad del dato — no
// se reutiliza para ninguna otra advertencia (ej. la nota de
// fragmentación municipio↔distrito del modal usa una señal visual
// distinta a propósito, para no solaparse con este significado).

import InfoTooltip from "@/app/components/ui/InfoTooltip";
import { NATURALEZA_DEFINICION } from "@/lib/fontana/naturalezaDato";

type Confiabilidad = "alta" | "media" | "baja";

const CONFIABILIDAD_BORDE: Record<Confiabilidad, string> = {
  alta: "border-green-eske dark:border-green-eske",
  media: "border-brown-eske-60 dark:border-yellow-eske",
  baja: "border-red-eske dark:border-orange-eske-40",
};

const NATURALEZA_A_CONFIABILIDAD: Record<string, Confiabilidad> = {
  dato_directo: "alta",
  calculo_directo: "alta",
  estimacion_modelada: "media",
  estimacion_agregada: "media",
  proxy_conceptual: "baja",
};

const NATURALEZA_LABEL: Record<string, string> = {
  dato_directo: "Dato directo",
  calculo_directo: "Cálculo directo",
  estimacion_modelada: "Estimación modelada",
  estimacion_agregada: "Estimación agregada",
  proxy_conceptual: "Proxy conceptual",
};

export default function NaturalezaBadge({ naturaleza }: { naturaleza: string }) {
  const confiabilidad = NATURALEZA_A_CONFIABILIDAD[naturaleza];
  return (
    <InfoTooltip
      content={NATURALEZA_DEFINICION[naturaleza as keyof typeof NATURALEZA_DEFINICION] ?? naturaleza}
      trigger={NATURALEZA_LABEL[naturaleza] ?? naturaleza}
      triggerClassName={`inline-block px-1.5 py-0.5 rounded border text-[10px] text-black-eske-80 dark:text-[#9AAEBE] cursor-pointer ${
        confiabilidad ? CONFIABILIDAD_BORDE[confiabilidad] : "border-gray-eske-40"
      }`}
    />
  );
}
