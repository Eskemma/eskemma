"use client";

import TerritorySelector from "@/app/components/shared/TerritorySelector";
import type { Territorio } from "@/types/pestel.types";

interface Props {
  territorio: Territorio | null;
  onChange: (territorio: Territorio) => void;
  onNext: () => void;
  onBack: () => void;
  // Fase 4 del rediseño de territorio (26-08-18) — capturados en el Paso 1
  // (WizardStep1Tipo.tsx) antes de este paso, para la sugerencia de nivel.
  tipoProyecto?: string;
  nombreProyecto?: string;
}

export default function WizardStep2Territorio({ territorio, onChange, onNext, onBack, tipoProyecto, nombreProyecto }: Props) {
  return (
    <TerritorySelector
      territorio={territorio}
      onChange={onChange}
      onNext={onNext}
      onBack={onBack}
      label="¿Cuál es el territorio de este análisis?"
      tipoProyecto={tipoProyecto}
      nombreProyecto={nombreProyecto}
    />
  );
}
