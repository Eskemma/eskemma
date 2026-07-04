"use client";

import { useState, useEffect, useCallback } from "react";
import PESTELStageNav from "@/app/components/centinela/pestel/PESTELStageNav";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import PESTLPanelV2 from "@/app/components/centinela/pestel/dashboard/PESTLPanelV2";
import type {
  PESTELProject,
  PestlAnalysisV2,
} from "@/types/pestel.types";

// ── Polling hook ──────────────────────────────────────────────

type JobPollStatus = "idle" | "running" | "completed" | "failed";

// Max wait time: 20 min (CF timeout is 18 min; buffer for network latency)
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000;

function usePESTELJobV2(jobId: string | null) {
  const [status, setStatus] = useState<JobPollStatus>("idle");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    setStatus("running");

    const startedAt = Date.now();

    const interval = setInterval(async () => {
      // Timeout guard: stop if we've been waiting too long
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(interval);
        setStatus("failed");
        setError(
          "El análisis tardó demasiado (más de 20 minutos). " +
            "Es posible que la Cloud Function haya excedido su tiempo límite. " +
            "Intenta ejecutar el análisis nuevamente."
        );
        return;
      }

      try {
        const res = await fetch(
          `/api/centinela/pestel/status?jobId=${jobId}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          analysisId?: string;
          feedId?: string;
          error?: string;
        };

        if (data.status === "completed") {
          clearInterval(interval);
          setStatus("completed");
          setAnalysisId(data.analysisId ?? null);
        } else if (data.status === "failed") {
          clearInterval(interval);
          setStatus("failed");
          setError(data.error ?? "El análisis falló");
        }
        // "pending" or "running" → keep polling
      } catch {
        // network error → keep polling until timeout
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [jobId]);

  return { status, analysisId, error };
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(value: unknown): string {
  if (!value) return "";
  try {
    const d =
      typeof value === "string"
        ? new Date(value)
        : new Date((value as { _seconds: number })._seconds * 1000);
    return d.toLocaleString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ── Page ──────────────────────────────────────────────────────

export default function AnalisisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const jobIdParam = searchParams.get("jobId");

  const [project, setProject] = useState<PESTELProject | null>(null);
  const [analysis, setAnalysis] = useState<PestlAnalysisV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { status: jobStatus, analysisId, error: jobError } =
    usePESTELJobV2(jobIdParam);

  // Elapsed timer while polling
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (jobStatus !== "running") {
      setElapsedSeconds(0);
      return;
    }
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [jobStatus]);

  // Load project
  const loadProject = useCallback(async () => {
    try {
      const res = await fetch("/api/centinela/pestel/project");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        projects: (PESTELProject & { id: string })[];
      };
      const found = data.projects.find((p) => p.id === projectId);
      if (found) setProject(found);
    } catch {
      setError("No se pudo cargar el proyecto.");
    }
  }, [projectId]);

  // Load analysis from ID
  const loadAnalysis = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(
          `/api/centinela/pestel/analysis/${id}`
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { analysis: PestlAnalysisV2 };
        setAnalysis(data.analysis);
      } catch {
        setError("No se pudo cargar el análisis.");
      }
    },
    []
  );

  // Load most recent analysis for the project (if no jobId in URL)
  const loadLatestAnalysis = useCallback(async () => {
    if (jobIdParam) return; // polling handles it
    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/latest-analysis`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { analysisId: string | null };
      if (data.analysisId) await loadAnalysis(data.analysisId);
    } catch {
      // Silent — no analysis yet is a valid state
    }
  }, [jobIdParam, projectId, loadAnalysis]);

  useEffect(() => {
    Promise.all([loadProject(), loadLatestAnalysis()]).finally(() =>
      setLoading(false)
    );
  }, [loadProject, loadLatestAnalysis]);

  // When job completes, load the resulting analysis
  useEffect(() => {
    if (jobStatus === "completed" && analysisId) {
      loadAnalysis(analysisId);
      // Clean jobId from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("jobId");
      window.history.replaceState({}, "", url.toString());
    }
  }, [jobStatus, analysisId, loadAnalysis]);

  async function handleAcknowledgeBias(biasType: string) {
    if (!analysis?.id) return;
    await fetch(
      `/api/centinela/pestel/analysis/${analysis.id}/acknowledge-bias`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biasType }),
      }
    );
    // Refresh analysis
    await loadAnalysis(analysis.id);
  }

  const isPolling = jobStatus === "running";

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

  return (
    <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      {/* Header */}
      <div className="bg-bluegreen-eske text-white px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push("/centinela/pestel")}
            className="text-sm text-white/70 hover:text-white mb-2 flex items-center
              gap-1 transition-colors"
            aria-label="Volver a PESTEL"
          >
            ← PESTEL
          </button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold">
                {project?.nombre ?? "Proyecto"}
              </h1>
              <p className="text-white/80 text-sm mt-0.5">
                {project?.territorio?.nombre ?? ""} ·{" "}
                <span className="capitalize">{project?.tipo ?? ""}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  router.push(`/centinela/pestel/${projectId}/datos`)
                }
                className="px-4 py-2 border border-white/30 text-white text-sm rounded-lg
                  hover:bg-white/10 transition-colors"
              >
                ← Datos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación de etapas */}
      {project && (
        <PESTELStageNav
          projectId={projectId}
          currentStage={project.currentStage ?? 5}
          activeStage={5}
        />
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Polling state */}
        {isPolling && (
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10
            p-8 flex flex-col items-center gap-4 mb-6">
            <div
              className="w-10 h-10 border-4 border-bluegreen-eske border-t-transparent
                rounded-full animate-spin"
              aria-label="Analizando"
            />
            <div className="text-center">
              <p className="font-semibold text-black-eske dark:text-[#EAF2F8]">
                Analizando con IA…
              </p>
              <p className="text-sm text-black-eske dark:text-[#C7D6E0] mt-1">
                PESTEL está procesando las 6 dimensiones en
                paralelo. Este proceso tarda varios minutos. Por favor, espera.
              </p>
              {elapsedSeconds > 0 && (
                <p className="text-xs text-black-eske dark:text-[#9AAEBE] mt-2">
                  Tiempo transcurrido:{" "}
                  {Math.floor(elapsedSeconds / 60) > 0
                    ? `${Math.floor(elapsedSeconds / 60)} min `
                    : ""}
                  {elapsedSeconds % 60} seg
                </p>
              )}
            </div>
            <div className="w-full max-w-xs h-1.5 bg-gray-eske-20 dark:bg-[#21425E] rounded-full overflow-hidden">
              <div className="h-1.5 bg-bluegreen-eske rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {/* Job error */}
        {(jobStatus === "failed" || error) && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-eske/20 dark:border-red-700/40 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-eske font-medium">Error en el análisis</p>
            <p className="text-sm text-red-eske/80 mt-1">
              {jobError ?? error}
            </p>
            <button
              onClick={() =>
                router.push(`/centinela/pestel/${projectId}/datos`)
              }
              className="mt-3 text-sm text-red-eske underline"
            >
              Volver a Datos para reintentar
            </button>
          </div>
        )}

        {/* Analysis result */}
        {analysis && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8]">
                  Etapa 3 — Resultados del análisis IA
                </h2>
                <p className="text-xs text-black-eske dark:text-[#9AAEBE]">
                  {formatDate(analysis.analyzedAt)}
                </p>
              </div>
              {(analysis.status === "REVIEWED" ||
                analysis.status === "APPROVED") && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/centinela/pestel/${projectId}/interpretacion`
                    )
                  }
                  className="px-5 py-2 bg-orange-eske text-white rounded-lg
                    text-sm font-semibold hover:bg-orange-eske-60 transition-colors
                    shadow-sm shrink-0"
                >
                  {analysis.status === "APPROVED"
                    ? "Ver interpretación →"
                    : "Continuar a Interpretación →"}
                </button>
              )}
            </div>
            <PESTLPanelV2
              analysis={analysis}
              onAcknowledgeBias={handleAcknowledgeBias}
              onChainAdded={analysis.id ? () => loadAnalysis(analysis.id!) : undefined}
            />
          </div>
        )}

        {/* Empty state — only show when not loading and no pending job */}
        {!loading && !isPolling && !jobIdParam && !analysis && !error && (
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10
            p-12 flex flex-col items-center gap-5 text-center">
            <span className="text-5xl" aria-hidden="true">🔍</span>
            <div>
              <p className="font-semibold text-black-eske dark:text-[#EAF2F8] text-lg">
                No hay análisis para este proyecto
              </p>
              <p className="text-sm text-black-eske dark:text-[#9AAEBE] mt-1">
                Agrega fuentes de datos y ejecuta el primer análisis IA.
              </p>
            </div>
            <button
              onClick={() =>
                router.push(`/centinela/pestel/${projectId}/datos`)
              }
              className="px-6 py-2.5 bg-bluegreen-eske text-white rounded-lg text-sm
                font-medium hover:bg-bluegreen-eske-60 transition-colors"
            >
              Ir a Datos →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
