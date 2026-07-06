// app/moddulo/components/PhaseTransitionReview.tsx
"use client";

import { useState } from "react";
import type { RiskSignal } from "@/lib/moddulo/risks";
import type { PhaseId, XPCTO } from "@/types/moddulo.types";
import { PHASE_NAMES } from "@/types/moddulo.types";
import type { CriterioDVS } from "@/lib/moddulo/dvs-criteria";

interface PhaseTransitionReviewProps {
  phaseId: PhaseId;
  nextPhaseId: PhaseId | null;
  xpcto: Partial<XPCTO>;
  risks: RiskSignal[];
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  dvsChecklist?: CriterioDVS[];
}

export default function PhaseTransitionReview({
  phaseId,
  nextPhaseId,
  xpcto,
  risks,
  onConfirm,
  onCancel,
  isSubmitting = false,
  dvsChecklist,
}: PhaseTransitionReviewProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const criticals = risks.filter((r) => r.level === "critical");
  const warnings = risks.filter((r) => r.level === "warning");

  const integrityLevel =
    criticals.length > 0 ? "red" : warnings.length > 0 ? "yellow" : "green";

  const hasRisks = risks.length > 0;
  const canProceed = !hasRisks || acknowledged;

  // Calcular completitud del XPCTO
  const xpctoFields = [
    { key: "Hito (X)", value: xpcto.hito },
    { key: "Sujeto (P)", value: xpcto.sujeto },
    { key: "Cap. Financiero (C)", value: xpcto.capacidades?.financiero },
    { key: "Cap. Humano (C)", value: xpcto.capacidades?.humano },
    { key: "Cap. Logístico (C)", value: xpcto.capacidades?.logistico },
    { key: "Fecha Límite (T)", value: xpcto.tiempo?.fechaLimite },
    { key: "Justificación (O)", value: xpcto.justificacion },
  ];
  const completedFields = xpctoFields.filter((f) => f.value && f.value.toString().trim().length > 0);
  const completionPct = Math.round((completedFields.length / xpctoFields.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-eske/50">
      <div className="bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header con semáforo */}
        <div className={`px-6 py-5 rounded-t-2xl ${
          integrityLevel === "green" ? "bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800" :
          integrityLevel === "yellow" ? "bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800" :
          "bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800"
        }`}>
          <div className="flex items-center gap-3">
            <IntegrityBadge level={integrityLevel} />
            <div>
              <h2 className="font-bold text-gray-eske-80 dark:text-[#C7D6E0] text-lg">
                Revisión de cierre — {PHASE_NAMES[phaseId]}
              </h2>
              <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5">
                {integrityLevel === "green" && "La fase está lista para cerrar. Todo se ve sólido."}
                {integrityLevel === "yellow" && "Hay observaciones pendientes. Puedes avanzar, pero revísalas."}
                {integrityLevel === "red" && "Se detectaron riesgos críticos. Te recomiendo resolverlos antes de avanzar."}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Completitud XPCTO */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-eske-70 dark:text-[#9AAEBE]">Completitud del XPCTO</span>
              <span className="text-sm font-bold text-gray-eske-80 dark:text-[#C7D6E0]">{completionPct}%</span>
            </div>
            <div className="h-2 bg-gray-eske-20 dark:bg-[#112230] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  completionPct === 100 ? "bg-green-500" :
                  completionPct >= 60 ? "bg-yellow-500" : "bg-red-400"
                }`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {xpctoFields.map((f) => (
                <div key={f.key} className="flex items-center gap-1.5 text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
                  {f.value && f.value.toString().trim().length > 0 ? (
                    <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-gray-eske-30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    </svg>
                  )}
                  {f.key}
                </div>
              ))}
            </div>
          </div>

          {/* Riesgos detectados */}
          {hasRisks && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-eske-70 dark:text-[#9AAEBE]">
                Señales detectadas por Moddulo
              </h3>

              {criticals.map((risk) => (
                <RiskCard key={risk.id} risk={risk} />
              ))}
              {warnings.map((risk) => (
                <RiskCard key={risk.id} risk={risk} />
              ))}

              {/* Checkbox de reconocimiento */}
              <label className="flex items-start gap-3 cursor-pointer mt-3 p-3 bg-gray-eske-10 dark:bg-[#112230] rounded-lg">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-bluegreen-eske cursor-pointer"
                />
                <span className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] leading-relaxed">
                  Entiendo las observaciones de Moddulo y decido avanzar de todas formas.
                  El consultor tiene soberanía sobre esta decisión.
                </span>
              </label>
            </div>
          )}

          {/* Checklist DVS F2 */}
          {dvsChecklist && dvsChecklist.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-eske-70 dark:text-[#9AAEBE]">
                Criterios de suficiencia del DVS
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {dvsChecklist.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
                      c.satisfecho
                        ? "bg-green-eske-10 dark:bg-green-eske/10"
                        : c.severidad === "bloqueante"
                          ? "bg-red-eske-10 dark:bg-red-eske/10"
                          : "bg-yellow-eske-10 dark:bg-yellow-eske/10"
                    }`}
                  >
                    {c.satisfecho ? (
                      <svg className="w-3.5 h-3.5 text-green-eske-60 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-eske-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                      </svg>
                    )}
                    <span className={`leading-snug ${
                      c.satisfecho
                        ? "text-green-eske-80 dark:text-green-eske-40"
                        : c.severidad === "bloqueante"
                          ? "text-red-eske-80 dark:text-red-eske-40"
                          : "text-black-eske dark:text-[#C5D8E8]"
                    }`}>
                      {c.descripcion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Siguiente fase */}
          {nextPhaseId && (
            <div className="flex items-center gap-2 text-sm text-gray-eske-50 dark:text-[#9AAEBE] pt-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span>Siguiente fase: <strong className="text-gray-eske-70 dark:text-[#C7D6E0]">{PHASE_NAMES[nextPhaseId]}</strong></span>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-2.5 border border-gray-eske-20 dark:border-white/10 text-gray-eske-60 dark:text-[#9AAEBE] rounded-lg text-sm font-medium hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            Seguir trabajando
          </button>
          <button
            onClick={onConfirm}
            disabled={!canProceed || isSubmitting}
            className="flex-[2] py-2.5 bg-bluegreen-eske text-white-eske rounded-lg text-sm font-medium hover:bg-bluegreen-eske/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white-eske/30 border-t-white-eske rounded-full animate-spin" />
                Cerrando fase...
              </>
            ) : (
              nextPhaseId ? `Cerrar y avanzar a ${PHASE_NAMES[nextPhaseId]}` : "Cerrar fase"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTES
// ==========================================

function IntegrityBadge({ level }: { level: "green" | "yellow" | "red" }) {
  const config = {
    green: { bg: "bg-green-500", label: "Verde", icon: "M5 13l4 4L19 7" },
    yellow: { bg: "bg-yellow-500", label: "Amarillo", icon: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" },
    red: { bg: "bg-red-500", label: "Rojo", icon: "M6 18L18 6M6 6l12 12" },
  }[level];

  return (
    <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={config.icon} />
      </svg>
    </div>
  );
}

function RiskCard({ risk }: { risk: RiskSignal }) {
  const isCritical = risk.level === "critical";
  return (
    <div className={`p-3 rounded-lg border text-sm ${
      isCritical
        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
    }`}>
      <div className="flex items-start gap-2">
        <span className={`text-xs font-bold uppercase tracking-wide mt-0.5 ${
          isCritical ? "text-red-600" : "text-yellow-700"
        }`}>
          {isCritical ? "⚠ Crítico" : "○ Aviso"}
        </span>
      </div>
      <p className={`font-semibold mt-0.5 ${isCritical ? "text-red-800 dark:text-red-300" : "text-yellow-800 dark:text-yellow-300"}`}>
        {risk.title}
      </p>
      <p className={`text-xs mt-1 leading-relaxed ${isCritical ? "text-red-700 dark:text-red-400" : "text-yellow-700 dark:text-yellow-400"}`}>
        {risk.description}
      </p>
    </div>
  );
}
