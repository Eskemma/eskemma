"use client";

// app/components/centinela/pestel/interpretacion/BiasCheckPanel.tsx
// Displays the three bias verification questions required before approving.
// Each question must be marked as "reviewed" (not necessarily resolved).

import { useState } from "react";
import type { BiasAlert } from "@/types/pestel.types";

const BIAS_CHECKS = [
  {
    id: "dimensions_coverage",
    question:
      "¿Todas las dimensiones tienen al menos 3 variables analizadas con datos suficientes?",
  },
  {
    id: "field_validation",
    question:
      "¿Los factores con alta probabilidad cuentan con al menos una fuente de validación de campo (no solo digital)?",
  },
  {
    id: "contradictions",
    question:
      "¿Los hallazgos de IA son consistentes con los datos manuales cargados por el equipo? Si hay contradicciones, ¿están identificadas?",
  },
];

interface Props {
  biasAlerts: BiasAlert[];
  onAcknowledge: (biasType: string) => Promise<void>;
  onAllChecked: () => void;
}

export default function BiasCheckPanel({
  biasAlerts,
  onAcknowledge,
  onAllChecked,
}: Props) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const unacknowledgedBiases = biasAlerts.filter((a) => !a.acknowledgedAt);
  const allChecked =
    checkedIds.size === BIAS_CHECKS.length &&
    unacknowledgedBiases.length === 0;

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAcknowledge(biasType: string) {
    setAcknowledging(biasType);
    try {
      await onAcknowledge(biasType);
    } finally {
      setAcknowledging(null);
    }
  }

  // Notify parent when all items are checked
  if (allChecked) {
    // Use a deferred call to avoid setState-during-render
    setTimeout(onAllChecked, 0);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Automated bias alerts from E5 */}
      {biasAlerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
            Alertas de sesgo detectadas por IA
          </h3>
          {biasAlerts.map((alert, i) => (
            <div
              key={i}
              className={[
                "flex items-start gap-3 px-3 py-2.5 rounded-lg border",
                alert.acknowledgedAt
                  ? "border-gray-eske-20 dark:border-white/10 bg-gray-eske-10 dark:bg-[#21425E] opacity-60"
                  : "border-yellow-eske/30 bg-yellow-eske/5 dark:bg-yellow-900/10",
              ].join(" ")}
            >
              <span
                className="text-sm mt-0.5 shrink-0"
                aria-hidden="true"
              >
                {alert.acknowledgedAt ? "✅" : "⚠️"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-black-eske dark:text-[#C7D6E0] leading-relaxed">
                  {alert.description}
                </p>
              </div>
              {!alert.acknowledgedAt && (
                <button
                  type="button"
                  onClick={() => handleAcknowledge(alert.type)}
                  disabled={acknowledging === alert.type}
                  className="text-xs text-bluegreen-eske hover:underline
                    shrink-0 disabled:opacity-50"
                >
                  {acknowledging === alert.type ? "…" : "Marcar como revisado"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Manual verification checklist */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
          Verificación de calidad
        </h3>
        <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
          Confirma que revisaste cada punto antes de aprobar el análisis.
        </p>
        {BIAS_CHECKS.map((check) => {
          const checked = checkedIds.has(check.id);
          return (
            <label
              key={check.id}
              className={[
                "flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer",
                "transition-colors select-none",
                checked
                  ? "border-green-eske/40 bg-green-eske/5"
                  : "border-gray-eske-20 dark:border-white/10 hover:bg-gray-eske-10 dark:hover:bg-white/5",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleCheck(check.id)}
                className="mt-0.5 accent-bluegreen-eske shrink-0"
              />
              <span className="text-xs text-black-eske dark:text-[#C7D6E0] leading-relaxed">
                {check.question}
              </span>
            </label>
          );
        })}
      </div>

      {/* Progress indicator */}
      <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] text-right">
        {checkedIds.size} / {BIAS_CHECKS.length} puntos confirmados
        {unacknowledgedBiases.length > 0 && (
          <span className="text-yellow-eske ml-2">
            · {unacknowledgedBiases.length} alerta(s) pendiente(s)
          </span>
        )}
      </p>
    </div>
  );
}
