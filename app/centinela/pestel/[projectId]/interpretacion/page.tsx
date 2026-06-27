"use client";

// app/centinela/pestel/[projectId]/interpretacion/page.tsx
// E6 — Interpretation stage: human-in-the-loop review of the PEST-L analysis.
// Analyst can reposition dimension points on the impact/probability matrix,
// verify bias alerts, review field evidence, and approve the analysis.

import { useEffect, useState, useCallback } from "react";
import PESTELStageNav from "@/app/components/centinela/pestel/PESTELStageNav";
import { useParams, useRouter } from "next/navigation";
import type {
  PestlAnalysisV2,
  HumanAdjustment,
  DimensionCode,
  Classification,
  BiasAlert,
} from "@/types/pestel.types";
import type { DataSourceItem } from "@/app/components/centinela/pestel/interpretacion/VoicesPanelE6";
import ImpactMatrix from "@/app/components/centinela/pestel/interpretacion/ImpactMatrix";
import BiasCheckPanel from "@/app/components/centinela/pestel/interpretacion/BiasCheckPanel";
import VoicesPanelE6 from "@/app/components/centinela/pestel/interpretacion/VoicesPanelE6";
import ComparisonPanel from "@/app/components/centinela/pestel/interpretacion/ComparisonPanel";

type ActiveSection = "matrix" | "bias" | "voices" | "comparison";

export default function InterpretacionPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [analysis, setAnalysis] = useState<PestlAnalysisV2 | null>(null);
  const [previousAnalysis, setPreviousAnalysis] =
    useState<PestlAnalysisV2 | null>(null);
  const [sources, setSources] = useState<DataSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>("matrix");
  // Stage nav — minimum 6 (we're in E6); updated from project data
  const [projectCurrentStage, setProjectCurrentStage] = useState(6);

  // Load the latest approved/reviewed analysis for this project
  const loadAnalysis = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/latest-analysis`
      );
      if (!res.ok) throw new Error("No se pudo cargar el análisis.");
      const { analysisId } = (await res.json()) as { analysisId: string | null };
      if (!analysisId) throw new Error("No hay análisis disponible.");

      const aRes = await fetch(
        `/api/centinela/pestel/analysis/${analysisId}`
      );
      if (!aRes.ok) throw new Error("No se pudo cargar el análisis.");
      const { analysis: analysisData } = (await aRes.json()) as {
        analysis: PestlAnalysisV2 & { id: string };
      };
      setAnalysis(analysisData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el análisis.");
    }
  }, [projectId]);

  const loadPreviousAnalysis = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/previous-analysis`
      );
      if (!res.ok) return;
      const { analysis: prev } = (await res.json()) as {
        analysis: PestlAnalysisV2 | null;
      };
      setPreviousAnalysis(prev);
    } catch {
      // Non-blocking — comparison panel simply won't show
    }
  }, [projectId]);

  const loadSources = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/data-sources`
      );
      if (!res.ok) return;
      const { sources: s } = (await res.json()) as {
        sources: DataSourceItem[];
      };
      setSources(s);
    } catch {
      // Non-blocking
    }
  }, [projectId]);

  useEffect(() => {
    // Load project currentStage for StageNav (non-blocking)
    fetch("/api/centinela/pestel/project")
      .then((r) => r.json())
      .then((data: { projects: { id: string; currentStage?: number }[] }) => {
        const p = data.projects.find((pr) => pr.id === projectId);
        if (p?.currentStage) setProjectCurrentStage(p.currentStage);
      })
      .catch(() => {/* non-critical */});

    Promise.all([loadAnalysis(), loadPreviousAnalysis(), loadSources()]).finally(
      () => setLoading(false)
    );
  }, [loadAnalysis, loadPreviousAnalysis, loadSources, projectId]);

  async function handleAdjust(
    code: DimensionCode,
    newPosition: { x: number; y: number },
    justification: string,
    newClassification: Classification
  ) {
    if (!analysis) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/centinela/pestel/analysis/${analysis.id}/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dimensionCode: code,
            newPosition,
            newClassification,
            justification,
          }),
        }
      );
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error?: string };
        throw new Error(msg ?? "Error al guardar ajuste.");
      }
      const { adjustment } = (await res.json()) as {
        adjustment: HumanAdjustment;
      };
      // Update local state
      setAnalysis((prev) => {
        if (!prev) return prev;
        const existing = prev.adjustments ?? [];
        const filtered = existing.filter((a) => a.dimensionCode !== code);
        return { ...prev, adjustments: [...filtered, adjustment] };
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el ajuste."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAcknowledgeBias(biasType: string) {
    if (!analysis) return;
    const res = await fetch(
      `/api/centinela/pestel/analysis/${analysis.id}/acknowledge-bias`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biasType }),
      }
    );
    if (!res.ok) return;
    // Refresh analysis to get updated biasAlerts
    await loadAnalysis();
  }

  async function handleApprove() {
    if (!analysis) return;
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/centinela/pestel/analysis/${analysis.id}/approve`,
        { method: "POST" }
      );
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error?: string };
        throw new Error(msg ?? "Error al aprobar el análisis.");
      }
      router.push(`/centinela/pestel/${projectId}/informes`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al aprobar el análisis."
      );
      setApproving(false);
    }
  }

  // ─── Derived state ───────────────────────────────────────────────────────

  const unacknowledgedBiases = (analysis?.biasAlerts ?? []).filter(
    (a: BiasAlert) => !a.acknowledgedAt
  );
  const canApprove =
    !approving && !saving && analysis?.status !== "APPROVED" &&
    unacknowledgedBiases.length === 0;

  const SECTIONS: { id: ActiveSection; label: string; badge?: number }[] = [
    { id: "matrix", label: "Matriz" },
    {
      id: "bias",
      label: "Sesgo",
      badge: unacknowledgedBiases.length || undefined,
    },
    {
      id: "voices",
      label: "Voces",
      badge: sources.length || undefined,
    },
    {
      id: "comparison",
      label: "Comparativa",
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center">
        <div
          className="w-8 h-8 border-4 border-bluegreen-eske border-t-transparent
            rounded-full animate-spin"
          aria-label="Cargando"
        />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-gray-eske-10 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-sm text-red-eske mb-3">
            {error ?? "No se encontró el análisis."}
          </p>
          <button
            type="button"
            onClick={() =>
              router.push(`/centinela/pestel/${projectId}/analisis`)
            }
            className="text-sm text-bluegreen-eske hover:underline"
          >
            ← Volver al análisis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      {/* Header */}
      <div className="bg-bluegreen-eske text-white px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() =>
              router.push(`/centinela/pestel/${projectId}/analisis`)
            }
            className="text-sm text-white/70 hover:text-white mb-2 flex items-center
              gap-1 transition-colors"
          >
            ← Análisis
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Interpretación</h1>
              <p className="text-white/80 text-sm mt-0.5">
                Etapa 6 — Revisión y validación estratégica
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={[
                  "text-xs px-2.5 py-1 rounded-full font-medium",
                  analysis.status === "APPROVED"
                    ? "bg-green-eske/20 text-green-eske"
                    : "bg-white/10 text-white/80",
                ].join(" ")}
              >
                {analysis.status === "APPROVED"
                  ? "✓ Aprobado"
                  : "En revisión"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación de etapas */}
      <PESTELStageNav
        projectId={projectId}
        currentStage={projectCurrentStage}
        activeStage={6}
      />

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-eske/30 dark:border-red-700/40 text-red-eske dark:text-red-300
            text-sm px-4 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        {/* Section tabs */}
        <div
          className="flex border-b border-gray-eske-20 dark:border-white/10"
          role="tablist"
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={activeSection === s.id}
              onClick={() => setActiveSection(s.id)}
              className={[
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium",
                "border-b-2 -mb-px transition-colors",
                activeSection === s.id
                  ? "border-bluegreen-eske text-bluegreen-eske"
                  : "border-transparent text-gray-eske-60 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8]",
              ].join(" ")}
            >
              {s.label}
              {s.badge !== undefined && s.badge > 0 && (
                <span
                  className={[
                    "text-xs px-1.5 py-0.5 rounded-full font-medium",
                    s.id === "bias"
                      ? "bg-yellow-eske/20 text-yellow-eske"
                      : "bg-bluegreen-eske/10 text-bluegreen-eske",
                  ].join(" ")}
                >
                  {s.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-6">
          {activeSection === "matrix" && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
                  Matriz de impacto / probabilidad
                </h2>
                <p className="text-xs text-black-eske dark:text-[#9AAEBE]">
                  La IA posicionó cada dimensión según el análisis.
                  {!analysis.status || analysis.status !== "APPROVED"
                    ? " Arrastra los puntos para ajustar. Se requiere justificación."
                    : " El análisis está aprobado — la matriz es de solo lectura."}
                </p>
              </div>
              <ImpactMatrix
                dimensions={analysis.dimensions}
                adjustments={analysis.adjustments ?? []}
                saving={saving}
                onAdjust={handleAdjust}
                readOnly={analysis.status === "APPROVED"}
              />
              {(analysis.adjustments ?? []).length > 0 && (
                <div className="mt-2">
                  <h3 className="text-xs font-semibold text-black-eske dark:text-[#C7D6E0] mb-2">
                    Ajustes realizados
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {(analysis.adjustments ?? []).map((adj) => (
                      <div
                        key={adj.dimensionCode}
                        className="text-xs text-black-eske dark:text-[#C7D6E0] px-3 py-2
                          bg-orange-eske/5 dark:bg-orange-900/10 border border-orange-eske/20 dark:border-orange-700/30 rounded-lg"
                      >
                        <span className="font-semibold text-orange-eske mr-1.5">
                          {adj.dimensionCode}
                        </span>
                        {adj.justification}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === "bias" && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
                  Verificación de sesgos
                </h2>
                <p className="text-xs text-black-eske dark:text-[#9AAEBE]">
                  Revisa las alertas de sesgo detectadas por la IA y confirma
                  los puntos de control metodológico.
                </p>
              </div>
              <BiasCheckPanel
                biasAlerts={analysis.biasAlerts}
                onAcknowledge={handleAcknowledgeBias}
                onAllChecked={() => {/* Optional: auto-advance tab */}}
              />
            </div>
          )}

          {activeSection === "voices" && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
                  Voces del territorio
                </h2>
                <p className="text-xs text-black-eske dark:text-[#9AAEBE]">
                  Fuentes manuales cargadas por el equipo en la Etapa 4.
                  Contrasta estos testimonios con la clasificación de la IA.
                </p>
              </div>
              <VoicesPanelE6 sources={sources} />
            </div>
          )}

          {activeSection === "comparison" && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
                  Comparativa con análisis anterior
                </h2>
                <p className="text-xs text-black-eske dark:text-[#9AAEBE]">
                  Cambios en la clasificación de dimensiones respecto a la
                  versión anterior del análisis.
                </p>
              </div>
              {previousAnalysis ? (
                <ComparisonPanel
                  currentDimensions={analysis.dimensions}
                  previousDimensions={previousAnalysis.dimensions}
                />
              ) : (
                <p className="text-sm text-black-eske dark:text-[#9AAEBE] text-center py-4">
                  No hay análisis anterior con el que comparar.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() =>
              router.push(`/centinela/pestel/${projectId}/analisis`)
            }
            disabled={approving}
            className="px-5 py-2.5 border border-gray-eske-30 dark:border-white/10 text-black-eske dark:text-[#C7D6E0]
              rounded-lg text-sm font-medium hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors
              disabled:opacity-50"
          >
            ← Volver al análisis
          </button>

          {analysis.status !== "APPROVED" ? (
            <div className="flex flex-col items-end gap-1.5">
              {unacknowledgedBiases.length > 0 && (
                <p className="text-xs text-yellow-eske">
                  Revisa {unacknowledgedBiases.length} alerta(s) de sesgo antes
                  de aprobar.
                </p>
              )}
              <button
                type="button"
                onClick={handleApprove}
                disabled={!canApprove}
                className="px-6 py-2.5 bg-orange-eske text-white rounded-lg
                  text-sm font-semibold hover:bg-orange-eske-60 transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {approving ? "Aprobando…" : "Finalizar interpretación →"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                router.push(`/centinela/pestel/${projectId}/informes`)
              }
              className="px-6 py-2.5 bg-bluegreen-eske text-white rounded-lg
                text-sm font-semibold hover:bg-bluegreen-eske-60 transition-colors"
            >
              Ir a Informes →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
