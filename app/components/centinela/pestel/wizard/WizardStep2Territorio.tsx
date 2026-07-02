"use client";

import TerritorySelector from "@/app/components/shared/TerritorySelector";
import type { Territorio } from "@/types/pestel.types";

interface Props {
  territorio: Territorio | null;
  onChange: (territorio: Territorio) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function WizardStep2Territorio({ territorio, onChange, onNext, onBack }: Props) {
  return (
    <TerritorySelector
      territorio={territorio}
      onChange={onChange}
      onNext={onNext}
      onBack={onBack}
      label="¿Cuál es el territorio de este análisis?"
    />
  );
}
