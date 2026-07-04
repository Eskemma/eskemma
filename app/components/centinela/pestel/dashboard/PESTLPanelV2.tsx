"use client";

import { useState } from "react";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import type {
  PestlAnalysisV2,
  DimensionAnalysis,
  ImpactChain,
  BiasAlert,
  DimensionCode,
  RiskLevel,
  Senal,
} from "@/types/pestel.types";
import { DIMENSION_META, DIMENSION_ORDER } from "@/types/pestel.types";

const CLASSIFICATION_CONFIG = {
  OPORTUNIDAD: { label: "Oportunidad", color: "text-green-eske", bg: "bg-green-eske/10" },
  AMENAZA: { label: "Amenaza", color: "text-red-eske", bg: "bg-red-eske/10" },
  NEUTRAL: { label: "Neutral", color: "text-[#816000] dark:text-yellow-eske", bg: "bg-[#FFF2CC] dark:bg-yellow-eske/20" },
};

const TREND_ICONS = {
  ASCENDENTE: "↑",
  DESCENDENTE: "↓",
  ESTABLE: "→",
};

const RISK_COLORS = {
  CRÍTICO: "text-red-eske bg-red-eske/10",
  MODERADO: "text-purple-700 dark:text-yellow-eske-60 bg-purple-100 dark:bg-yellow-eske/10",
  BAJO: "text-green-eske bg-green-eske/10",
};

interface Props {
  analysis: PestlAnalysisV2;
  onAcknowledgeBias?: (biasType: string) => Promise<void>;
  onChainAdded?: () => Promise<void>;
}

export default function PESTLPanelV2({ analysis, onAcknowledgeBias, onChainAdded }: Props) {
  const [activeTab, setActiveTab] = useState<DimensionCode>("P");
  const [acknowledgingBias, setAcknowledgingBias] = useState<string | null>(null);
  const [chainsExpanded, setChainsExpanded] = useState(true);
  const [showAddChain, setShowAddChain] = useState(false);
  const [addingChain, setAddingChain] = useState(false);
  const [chainForm, setChainForm] = useState<{
    dimensions: DimensionCode[];
    description: string;
    riskLevel: RiskLevel;
    recommendation: string;
  }>({ dimensions: [], description: "", riskLevel: "MODERADO", recommendation: "" });

  const sortedDimensions = [...analysis.dimensions].sort(
    (a, b) => DIMENSION_ORDER.indexOf(a.code) - DIMENSION_ORDER.indexOf(b.code)
  );

  const activeDim = sortedDimensions.find((d) => d.code === activeTab);
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

  async function handleSubmitChain() {
    if (!analysis.id || chainForm.dimensions.length === 0 || !chainForm.description.trim()) return;
    setAddingChain(true);
    try {
      await fetch(`/api/centinela/pestel/analysis/${analysis.id}/impact-chain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chainForm),
      });
      setChainForm({ dimensions: [], description: "", riskLevel: "MODERADO", recommendation: "" });
      setShowAddChain(false);
      if (onChainAdded) await onChainAdded();
    } finally {
      setAddingChain(false);
    }
  }

  async function handleDeleteChain(index: number) {
    if (!analysis.id) return;
    await fetch(`/api/centinela/pestel/analysis/${analysis.id}/impact-chain`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    if (onChainAdded) await onChainAdded();
  }

  function toggleChainDim(code: DimensionCode) {
    setChainForm((prev) => ({
      ...prev,
      dimensions: prev.dimensions.includes(code)
        ? prev.dimensions.filter((d) => d !== code)
        : [...prev.dimensions, code],
    }));
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
                ? "text-purple-700 dark:text-yellow-eske"
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
                ? "bg-purple-400 dark:bg-yellow-eske"
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
            aria-label="Dimensiones PESTEL"
          >
            {sortedDimensions.map((dim) => {
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
                  <span className="hidden sm:inline">{DIMENSION_META[dim.code].label}</span>
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
      <section aria-labelledby="chains-heading">
        <div className="flex items-center justify-between">
          <span
            id="chains-heading"
            className="inline-flex items-center gap-1.5 font-semibold text-black-eske dark:text-[#EAF2F8]"
          >
            Cadenas de impacto transversal ({analysis.impactChains.length})
            <InfoTooltip
              content="Las cadenas de impacto muestran cómo un evento en una dimensión PESTEL provoca efectos en cascada en otras. Por ejemplo, un cambio legal (L) puede afectar la economía (E) y generar tensión social (S). Identificar estas conexiones permite anticipar consecuencias indirectas que no son evidentes al analizar cada dimensión de forma aislada."
              example="Una reforma electoral (P) puede tensionar la agenda legislativa (L) y activar movilización ciudadana (S)."
              placement="right"
            />
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddChain((v) => !v)}
              className="text-xs font-medium text-bluegreen-eske hover:underline"
              aria-expanded={showAddChain}
            >
              + Agregar cadena
            </button>
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
        </div>

        {/* Inline form for adding analyst chains */}
        {showAddChain && (
          <div className="mt-3 bg-white-eske dark:bg-[#18324A] rounded-xl border border-bluegreen-eske/30 p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-bluegreen-eske uppercase tracking-wide">
              Agregar cadena de impacto
            </p>
            <div>
              <p className="text-xs text-black-eske dark:text-[#9AAEBE] mb-1.5">Dimensiones involucradas</p>
              <div className="flex flex-wrap gap-2">
                {DIMENSION_ORDER.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleChainDim(code)}
                    className={[
                      "w-8 h-8 rounded-full text-xs font-bold transition-colors",
                      chainForm.dimensions.includes(code)
                        ? "bg-bluegreen-eske text-white"
                        : "bg-gray-eske-10 dark:bg-[#21425E] text-black-eske dark:text-[#C5D8E8] hover:bg-bluegreen-eske/20",
                    ].join(" ")}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor="chain-description"
                className="text-xs text-black-eske dark:text-[#9AAEBE] mb-1 block"
              >
                Descripción (máx. 200 caracteres)
              </label>
              <textarea
                id="chain-description"
                rows={2}
                maxLength={200}
                value={chainForm.description}
                onChange={(e) => setChainForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full text-sm rounded-lg border border-gray-eske-20 dark:border-white/10
                  bg-gray-eske-10 dark:bg-[#21425E] text-black-eske dark:text-[#EAF2F8]
                  px-3 py-2 resize-none focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-bluegreen-eske"
                placeholder="Describe cómo se relacionan las dimensiones seleccionadas…"
              />
            </div>
            <div>
              <label
                htmlFor="chain-risk"
                className="text-xs text-black-eske dark:text-[#9AAEBE] mb-1 block"
              >
                Nivel de riesgo
              </label>
              <select
                id="chain-risk"
                value={chainForm.riskLevel}
                onChange={(e) => setChainForm((p) => ({ ...p, riskLevel: e.target.value as RiskLevel }))}
                className="text-sm rounded-lg border border-gray-eske-20 dark:border-white/10
                  bg-gray-eske-10 dark:bg-[#21425E] text-black-eske dark:text-[#EAF2F8]
                  px-3 py-2 focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-bluegreen-eske"
              >
                <option value="CRÍTICO">CRÍTICO</option>
                <option value="MODERADO">MODERADO</option>
                <option value="BAJO">BAJO</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="chain-recommendation"
                className="text-xs text-black-eske dark:text-[#9AAEBE] mb-1 block"
              >
                Recomendación (máx. 100 caracteres)
              </label>
              <input
                id="chain-recommendation"
                type="text"
                maxLength={300}
                value={chainForm.recommendation}
                onChange={(e) => setChainForm((p) => ({ ...p, recommendation: e.target.value }))}
                className="w-full text-sm rounded-lg border border-gray-eske-20 dark:border-white/10
                  bg-gray-eske-10 dark:bg-[#21425E] text-black-eske dark:text-[#EAF2F8]
                  px-3 py-2 focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-bluegreen-eske"
                placeholder="Acción sugerida para gestionar esta cadena…"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddChain(false)}
                className="px-4 py-1.5 text-xs rounded-lg border border-gray-eske-20
                  dark:border-white/20 text-black-eske dark:text-[#C5D8E8]
                  hover:bg-gray-eske-10 dark:hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitChain}
                disabled={addingChain || chainForm.dimensions.length === 0 || !chainForm.description.trim()}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-bluegreen-eske
                  text-white hover:bg-bluegreen-eske-60 disabled:opacity-50 transition-colors"
              >
                {addingChain ? "Guardando…" : "Agregar cadena"}
              </button>
            </div>
          </div>
        )}

        {chainsExpanded && analysis.impactChains.length > 0 && (
          <div id="chains-list" className="flex flex-col gap-3 mt-3">
            {analysis.impactChains.map((chain, i) => (
              <ImpactChainCard
                key={i}
                chain={chain}
                onDelete={chain.source === "analyst" ? () => handleDeleteChain(i) : undefined}
              />
            ))}
          </div>
        )}

        {chainsExpanded && analysis.impactChains.length === 0 && !showAddChain && (
          <p className="mt-3 text-sm text-gray-eske-60 dark:text-[#9AAEBE] italic">
            No hay cadenas de impacto registradas. Usa &quot;Agregar cadena&quot; para añadir tu propio análisis.
          </p>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function DimensionPanel({ dim }: { dim: DimensionAnalysis }) {
  const config = CLASSIFICATION_CONFIG[dim.classification];
  const hasTripartite = dim.senalesFavorables !== undefined;

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
                ? "bg-purple-400 dark:bg-yellow-eske"
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

      {/* Tripartite signals (C3) — only for new analyses */}
      {hasTripartite && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-black-eske dark:text-[#9AAEBE] uppercase tracking-wide">
            Señales detectadas
          </h4>
          <SignalGroup
            tipo="favorable"
            senales={dim.senalesFavorables ?? []}
            label="Favorables"
            colorClass="text-green-eske"
            bgClass="bg-green-eske/10"
            icon="✓"
          />
          <SignalGroup
            tipo="adversa"
            senales={dim.senalesAdversas ?? []}
            label="Adversas"
            colorClass="text-red-eske"
            bgClass="bg-red-eske/10"
            icon="!"
          />
          <SignalGroup
            tipo="incierta"
            senales={dim.senalesInciertas ?? []}
            label="Inciertas"
            colorClass="text-bluegreen-eske dark:text-bluegreen-eske-40"
            bgClass="bg-bluegreen-eske/10 dark:bg-bluegreen-eske/20"
            icon="?"
          />
        </div>
      )}

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

function SignalGroup({
  senales, label, colorClass, bgClass, icon,
}: {
  tipo: string;
  senales: Senal[];
  label: string;
  colorClass: string;
  bgClass: string;
  icon: string;
}) {
  const [open, setOpen] = useState(false);
  if (senales.length === 0) return null;

  return (
    <div className="border border-gray-eske-20 dark:border-white/10 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-4 py-2.5
          bg-white-eske dark:bg-[#18324A] hover:bg-gray-eske-10 dark:hover:bg-white/5
          transition-colors text-left"
        aria-expanded={open}
      >
        <span
          className={[
            "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
            bgClass, colorClass,
          ].join(" ")}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className={["text-sm font-medium flex-1", colorClass].join(" ")}>
          {label}
        </span>
        <span className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mr-2">
          {senales.length}
        </span>
        <span
          className="text-gray-eske-60 dark:text-[#9AAEBE] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-gray-eske-10 dark:divide-white/5">
          {senales.map((s, i) => (
            <li key={i} className="px-4 py-3 bg-white-eske dark:bg-[#112230]">
              <p className="text-sm text-black-eske dark:text-[#C7D6E0]">{s.descripcion}</p>
              <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-1">
                {s.fuente}
                {s.fechaCorte ? ` · ${s.fechaCorte}` : ""}
                {" · "}
                <span className={[
                  s.nivelConfianza === "alto" ? "text-green-eske"
                    : s.nivelConfianza === "medio"
                      ? "text-purple-700 dark:text-yellow-eske-60"
                    : "text-red-eske",
                ].join("")}>
                  confianza {
                    s.nivelConfianza === "alto" ? "alta"
                      : s.nivelConfianza === "medio" ? "media"
                      : "baja"
                  }
                </span>
                {s.origenInternacional && " · internacional"}
              </p>
            </li>
          ))}
        </ul>
      )}
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
          : "border-purple-200 bg-purple-50 dark:border-yellow-eske/30 dark:bg-yellow-900/10",
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
          {acknowledging ? "Guardando…" : "Marcar como revisado"}
        </button>
      )}
    </div>
  );
}

function ImpactChainCard({
  chain,
  onDelete,
}: {
  chain: ImpactChain;
  onDelete?: () => void;
}) {
  const riskClass = RISK_COLORS[chain.riskLevel] ?? RISK_COLORS.BAJO;
  const isAnalyst = chain.source === "analyst";

  return (
    <div className={[
      "rounded-xl shadow-sm border p-4",
      isAnalyst
        ? "bg-bluegreen-eske/5 dark:bg-bluegreen-eske/10 border-bluegreen-eske/30"
        : "bg-white-eske dark:bg-[#18324A] border-gray-eske-20 dark:border-white/10",
    ].join(" ")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1 shrink-0 flex-wrap">
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
          {isAnalyst && (
            <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded
              bg-bluegreen-eske/10 text-bluegreen-eske">
              Analista
            </span>
          )}
        </div>
        {isAnalyst && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 text-gray-eske-60 hover:text-red-eske transition-colors"
            aria-label="Eliminar cadena"
          >
            ×
          </button>
        )}
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
