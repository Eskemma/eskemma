"use client";

import { useState } from "react";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import type {
  PestlAnalysisV2,
  DimensionAnalysis,
  ImpactChain,
  BiasAlert,
  DimensionCode,
} from "@/types/pestel.types";

const DIMENSION_LABELS: Record<DimensionCode, string> = {
  P: "Político",
  E: "Económico",
  S: "Social",
  T: "Tecnológico",
  L: "Legal / Ambiental",
};

const CLASSIFICATION_CONFIG = {
  OPORTUNIDAD: { label: "Oportunidad", color: "text-green-eske", bg: "bg-green-eske/10" },
  AMENAZA: { label: "Amenaza", color: "text-red-eske", bg: "bg-red-eske/10" },
  NEUTRAL: { label: "Neutral", color: "text-gray-eske-70", bg: "bg-gray-eske-20" },
};

const TREND_ICONS = {
  ASCENDENTE: "↑",
  DESCENDENTE: "↓",
  ESTABLE: "→",
};

const RISK_COLORS = {
  CRÍTICO: "text-red-eske bg-red-eske/10",
  MODERADO: "text-yellow-eske bg-yellow-eske/10",
  BAJO: "text-green-eske bg-green-eske/10",
};

interface Props {
  analysis: PestlAnalysisV2;
  onAcknowledgeBias?: (biasType: string) => Promise<void>;
}

export default function PESTLPanelV2({ analysis, onAcknowledgeBias }: Props) {
  const [activeTab, setActiveTab] = useState<DimensionCode>("P");
  const [acknowledgingBias, setAcknowledgingBias] = useState<string | null>(null);
  const [chainsExpanded, setChainsExpanded] = useState(false);

  const activeDim = analysis.dimensions.find((d) => d.code === activeTab);
  const pendingBiases = analysis.biasAlerts.filter((b) => !b.acknowledgedAt);
  const allBiasesAcknowledged = pendingBiases.length === 0;

  async function handleAcknowledge(biasType: string) {
    if (!onAcknowledgeBias) return;
    setAcknowledgingBias(biasType);
    try {
      await onAcknowledgeBias(biasType);
    } finally {
      setAcknowledgingBias(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Global confidence */}
      <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-black-eske dark:text-[#EAF2F8]">Confianza global del análisis</h3>
          <span
            className={[
              "text-2xl font-bold",
              analysis.globalConfidence >= 70
                ? "text-green-eske"
                : analysis.globalConfidence >= 50
                ? "text-yellow-eske"
                : "text-red-eske",
            ].join(" ")}
          >
            {analysis.globalConfidence}%
          </span>
        </div>
        <div className="h-2 bg-gray-eske-20 dark:bg-[#21425E] rounded-full">
          <div
            className={[
              "h-2 rounded-full transition-all",
              analysis.globalConfidence >= 70
                ? "bg-green-eske"
                : analysis.globalConfidence >= 50
                ? "bg-yellow-eske"
                : "bg-red-eske",
            ].join(" ")}
            style={{ width: `${analysis.globalConfidence}%` }}
            role="progressbar"
            aria-valuenow={analysis.globalConfidence}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        {analysis.globalConfidence < 50 && (
          <p className="mt-3 text-sm text-red-eske bg-red-eske/5 border border-red-eske/20
            rounded-lg px-3 py-2">
            Análisis insuficiente — regresa a Datos y agrega más fuentes para
            mejorar la confianza antes de proceder.
          </p>
        )}
        {analysis.status === "REVIEWED" && allBiasesAcknowledged && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-eske
            bg-green-eske/10 border border-green-eske/20 rounded-lg px-3 py-2">
            <span aria-hidden="true">✓</span>
            Análisis listo para interpretación
          </div>
        )}
      </div>

      {/* Bias alerts */}
      {analysis.biasAlerts.length > 0 && (
        <section aria-labelledby="bias-heading">
          <h3
            id="bias-heading"
            className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-3"
          >
            Alertas de sesgo detectadas
          </h3>
          <div className="flex flex-col gap-3">
            {analysis.biasAlerts.map((alert: BiasAlert) => (
              <BiasAlertCard
                key={alert.type}
                alert={alert}
                acknowledging={acknowledgingBias === alert.type}
                onAcknowledge={
                  onAcknowledgeBias
                    ? () => handleAcknowledge(alert.type)
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Dimension tabs */}
      <section aria-labelledby="dims-heading">
        <h3
          id="dims-heading"
          className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-3"
        >
          Análisis por dimensión
        </h3>
        <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 overflow-hidden">
          {/* Tab list */}
          <div
            className="flex border-b border-gray-eske-20 dark:border-white/10 overflow-x-auto"
            role="tablist"
            aria-label="Dimensiones PEST-L"
          >
            {analysis.dimensions.map((dim) => {
              const config = CLASSIFICATION_CONFIG[dim.classification];
              return (
                <button
                  key={dim.code}
                  role="tab"
                  aria-selected={activeTab === dim.code}
                  onClick={() => setActiveTab(dim.code)}
                  className={[
                    "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                    activeTab === dim.code
                      ? "border-bluegreen-eske text-bluegreen-eske bg-bluegreen-eske/5 dark:bg-bluegreen-eske/10"
                      : "border-transparent text-gray-eske-70 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8]",
                  ].join(" ")}
                >
                  <span className="font-bold mr-1.5">{dim.code}</span>
                  <span className="hidden sm:inline">{DIMENSION_LABELS[dim.code]}</span>
                  <span
                    className={[
                      "ml-2 text-xs px-1.5 py-0.5 rounded",
                      config.bg,
                      config.color,
                    ].join(" ")}
                  >
                    {config.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tab panel */}
          {activeDim && (
            <div className="p-6" role="tabpanel">
              <DimensionPanel dim={activeDim} />
            </div>
          )}
        </div>
      </section>

      {/* Impact chains */}
      {analysis.impactChains.length > 0 && (
        <section aria-labelledby="chains-heading">
          <div className="flex items-center justify-between">
            <span
              id="chains-heading"
              className="inline-flex items-center gap-1.5 font-semibold text-black-eske dark:text-[#EAF2F8]"
            >
              Cadenas de impacto transversal ({analysis.impactChains.length})
              <InfoTooltip
                content="Las cadenas de impacto muestran cómo un evento en una dimensión PEST-L provoca efectos en cascada en otras. Por ejemplo, un cambio legal (L) puede afectar la economía (E) y generar tensión social (S). Identificar estas conexiones permite anticipar consecuencias indirectas que no son evidentes al analizar cada dimensión de forma aislada."
                example="Una reforma electoral (P) puede tensionar la agenda legislativa (L) y activar movilización ciudadana (S)."
                placement="right"
              />
            </span>
            <button
              type="button"
              onClick={() => setChainsExpanded((v) => !v)}
              className="text-black-eske dark:text-[#9AAEBE] hover:text-bluegreen-eske dark:hover:text-[#6BA4C6] transition-colors"
              aria-expanded={chainsExpanded}
              aria-controls="chains-list"
              aria-label={chainsExpanded ? "Colapsar cadenas" : "Expandir cadenas"}
            >
              <span
                aria-hidden="true"
                style={{
                  transform: chainsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  display: "inline-block",
                  transition: "transform 0.2s",
                }}
              >
                ▾
              </span>
            </button>
          </div>

          {chainsExpanded && (
            <div id="chains-list" className="flex flex-col gap-3 mt-3">
              {analysis.impactChains.map((chain, i) => (
                <ImpactChainCard key={i} chain={chain} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function DimensionPanel({ dim }: { dim: DimensionAnalysis }) {
  const config = CLASSIFICATION_CONFIG[dim.classification];

  return (
    <div className="flex flex-col gap-5">
      {/* Signal + badges */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={[
              "text-xs font-semibold px-2.5 py-1 rounded-full",
              config.bg,
              config.color,
            ].join(" ")}
          >
            {config.label}
          </span>
          <span className="text-xs text-black-eske dark:text-[#C7D6E0] bg-gray-eske-10 dark:bg-[#21425E]
            px-2.5 py-1 rounded-full">
            Tendencia {TREND_ICONS[dim.trend]} {dim.trend.toLowerCase()}
          </span>
          <span className="text-xs text-black-eske dark:text-[#C7D6E0] bg-gray-eske-10 dark:bg-[#21425E]
            px-2.5 py-1 rounded-full">
            Intensidad {dim.intensity.toLowerCase()}
          </span>
        </div>
        <p className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] leading-snug">
          {dim.mainSignal}
        </p>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-black-eske dark:text-[#9AAEBE] w-20 shrink-0">
          Confianza
        </span>
        <div className="flex-1 h-1.5 bg-gray-eske-20 dark:bg-[#21425E] rounded-full">
          <div
            className={[
              "h-1.5 rounded-full",
              dim.confidence >= 70
                ? "bg-green-eske"
                : dim.confidence >= 40
                ? "bg-yellow-eske"
                : "bg-red-eske",
            ].join(" ")}
            style={{ width: `${dim.confidence}%` }}
            role="progressbar"
            aria-valuenow={dim.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className="text-xs text-black-eske dark:text-[#9AAEBE] w-10 text-right">
          {dim.confidence}%
        </span>
      </div>

      {/* Narrative */}
      <div>
        <h4 className="text-xs font-semibold text-black-eske dark:text-[#9AAEBE] uppercase
          tracking-wide mb-2">
          Narrativa
        </h4>
        <div className="text-sm text-black-eske dark:text-[#C7D6E0] leading-relaxed whitespace-pre-line">
          {dim.narrative}
        </div>
      </div>
    </div>
  );
}

function BiasAlertCard({
  alert,
  acknowledging,
  onAcknowledge,
}: {
  alert: BiasAlert;
  acknowledging: boolean;
  onAcknowledge?: () => void;
}) {
  const isAcknowledged = Boolean(alert.acknowledgedAt);

  return (
    <div
      className={[
        "flex items-start gap-3 p-4 rounded-xl border",
        isAcknowledged
          ? "border-gray-eske-20 dark:border-white/10 bg-gray-eske-10 dark:bg-[#21425E] opacity-60"
          : "border-yellow-eske/30 bg-yellow-eske/5 dark:bg-yellow-900/10",
      ].join(" ")}
    >
      <span className="text-lg mt-0.5" aria-hidden="true">
        {isAcknowledged ? "✅" : "⚠️"}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8] capitalize">
          {alert.type.replace(/_/g, " ")}
        </p>
        <p className="text-xs text-black-eske dark:text-[#C7D6E0] mt-0.5">{alert.description}</p>
        {isAcknowledged && (
          <p className="text-xs text-gray-eske-50 mt-1">Revisado</p>
        )}
      </div>
      {!isAcknowledged && onAcknowledge && (
        <button
          type="button"
          onClick={onAcknowledge}
          disabled={acknowledging}
          className="shrink-0 text-xs font-medium text-bluegreen-eske
            hover:underline disabled:opacity-50"
        >
          {acknowledging ? "Guardando…" : "Marcar revisado"}
        </button>
      )}
    </div>
  );
}

function ImpactChainCard({ chain }: { chain: ImpactChain }) {
  const riskClass = RISK_COLORS[chain.riskLevel] ?? RISK_COLORS.BAJO;

  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-1 shrink-0">
          {chain.dimensions.map((code, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-bluegreen-eske/10 text-bluegreen-eske
                text-xs font-bold flex items-center justify-center">
                {code}
              </span>
              {i < chain.dimensions.length - 1 && (
                <span className="text-gray-eske-40 text-xs">→</span>
              )}
            </span>
          ))}
        </div>
        <span
          className={[
            "shrink-0 text-xs font-semibold px-2 py-0.5 rounded",
            riskClass,
          ].join(" ")}
        >
          {chain.riskLevel}
        </span>
      </div>
      <p className="text-sm text-black-eske dark:text-[#C7D6E0] mt-2">{chain.description}</p>
      {chain.recommendation && (
        <p className="text-xs text-bluegreen-eske mt-2 font-medium">
          → {chain.recommendation}
        </p>
      )}
    </div>
  );
}
