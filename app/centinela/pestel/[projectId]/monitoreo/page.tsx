"use client";

// app/centinela/pestel/[projectId]/monitoreo/page.tsx
// E8 — Continuous monitoring dashboard: dimension status, history chart, alerts feed.

import { useState, useEffect, useCallback } from "react";
import PESTELStageNav from "@/app/components/centinela/pestel/PESTELStageNav";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import { useParams, useRouter } from "next/navigation";
import DimensionStatusGrid from "@/app/components/centinela/pestel/monitoreo/DimensionStatusGrid";
import HistoryChart from "@/app/components/centinela/pestel/monitoreo/HistoryChart";
import AlertsFeed from "@/app/components/centinela/pestel/monitoreo/AlertsFeed";
import CrisisBanner from "@/app/components/centinela/pestel/monitoreo/CrisisBanner";
import ModduloButton from "@/app/components/centinela/pestel/ModduloButton";
import type {
  PESTELProject,
  PestlAnalysisV2,
  PESTELAlertV2,
} from "@/types/pestel.types";

interface HistoryEntry {
  id: string;
  version: number;
  globalConfidence: number;
  analyzedAt: string;
}

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
    });
  } catch {
    return "";
  }
}

function calcularIntervaloSugerido(tipo: string, horizonte: number): number {
  if (horizonte > 12) return tipo === "legislativo" ? 48 : 72;
  if (horizonte > 6)  return tipo === "legislativo" ? 24 : 48;
  if (horizonte > 3)  return tipo === "legislativo" ? 12 : 24;
  if (horizonte > 1)  return tipo === "legislativo" ? 6  : 12;
  return tipo === "legislativo" ? 4 : 6;
}

function TokenCostEstimate({ tipo, horizonte }: { tipo: string; horizonte: number }) {
  const intervalo = calcularIntervaloSugerido(tipo, horizonte);
  const tokensPerMonth = Math.round(2000 * (720 / intervalo));
  return (
    <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] bg-gray-eske-10 dark:bg-[#21425E]
      px-3 py-2 rounded-lg">
      Con el intervalo sugerido de {intervalo} h: ~{tokensPerMonth.toLocaleString("es-MX")} tokens/mes
    </p>
  );
}

export default function MonitoreoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<PESTELProject | null>(null);
  const [analysis, setAnalysis] = useState<
    (PestlAnalysisV2 & { id: string }) | null
  >(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [alerts, setAlerts] = useState<PESTELAlertV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoMonitor, setAutoMonitor] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      // 1. Project
      const projRes = await fetch("/api/centinela/pestel/project");
      if (!projRes.ok) throw new Error("No se pudo cargar el proyecto.");
      const projData = (await projRes.json()) as {
        projects: (PESTELProject & { id: string })[];
      };
      const found = projData.projects.find((p) => p.id === projectId);
      if (!found) throw new Error("Proyecto no encontrado.");
      setProject(found);
      setAutoMonitor(found.autoMonitorEnabled ?? false);

      // 2. Latest analysis
      const latestRes = await fetch(
        `/api/centinela/pestel/project/${projectId}/latest-analysis`
      );
      if (latestRes.ok) {
        const latestData = (await latestRes.json()) as {
          analysisId: string | null;
        };
        if (latestData.analysisId) {
          const analysisRes = await fetch(
            `/api/centinela/pestel/analysis/${latestData.analysisId}`
          );
          if (analysisRes.ok) {
            const analysisData = (await analysisRes.json()) as {
              analysis: PestlAnalysisV2 & { id: string };
            };
            setAnalysis(analysisData.analysis);
          }
        }
      }

      // 3. History
      const histRes = await fetch(
        `/api/centinela/pestel/project/${projectId}/history`
      );
      if (histRes.ok) {
        const histData = (await histRes.json()) as { history: HistoryEntry[] };
        setHistory(histData.history);
      }

      // 4. Advance stage to 8 if needed (silent)
      if (found.currentStage < 8) {
        fetch(`/api/centinela/pestel/project/${projectId}/stage`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: 8 }),
        }).catch(() => {/* non-critical */});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleToggleAutoMonitor = async () => {
    const next = !autoMonitor;
    setTogglingAuto(true);
    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/auto-centinela`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        }
      );
      if (res.ok) setAutoMonitor(next);
    } finally {
      setTogglingAuto(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center px-6">
        <div className="bg-white-eske dark:bg-[#18324A] rounded-xl p-8 max-w-md text-center shadow-sm border border-gray-eske-20 dark:border-white/10">
          <p className="font-semibold text-red-eske">{error}</p>
          <button
            onClick={() => router.push("/centinela/pestel")}
            className="mt-4 px-4 py-2 bg-bluegreen-eske text-white rounded-lg text-sm"
          >
            Volver a PESTEL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      {/* ── Header ── */}
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
                {" · "}
                <span className="font-medium">Etapa 6 — Monitoreo</span>
              </p>
            </div>
            <button
              onClick={() =>
                router.push(`/centinela/pestel/${projectId}/informes`)
              }
              className="px-4 py-2 border border-white/30 text-white text-sm rounded-lg
                hover:bg-white/10 transition-colors"
            >
              ← Informes
            </button>
          </div>
        </div>
      </div>

      {/* Navegación de etapas */}
      {project && (
        <PESTELStageNav
          projectId={projectId}
          currentStage={project.currentStage ?? 8}
          activeStage={8}
        />
      )}

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* ── Crisis banner ── */}
        <CrisisBanner alerts={alerts} projectId={projectId} />

        {/* ── Dimension status ── */}
        {analysis && (
          <section className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-black-eske dark:text-[#EAF2F8] flex items-center gap-1.5">
                  Estado actual — PESTEL
                  <InfoTooltip
                    content="Resumen de la clasificación más reciente para cada dimensión. La confianza global es el promedio ponderado de certeza de todos los análisis dimensionales. Para mejorar estos porcentajes: agrega fuentes de mayor confiabilidad en 'Datos' y asegura cobertura verde en el semáforo."
                    placement="right"
                  />
                </h2>
                <p className="text-xs text-black-eske dark:text-[#9AAEBE] mt-0.5">
                  Análisis v{analysis.version} ·{" "}
                  {formatDate(analysis.analyzedAt)} ·{" "}
                  {analysis.globalConfidence}% confianza global
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/centinela/pestel/${projectId}/analisis`
                  )
                }
                className="text-xs text-bluegreen-eske hover:underline shrink-0"
              >
                Ver análisis completo →
              </button>
            </div>
            <DimensionStatusGrid dimensions={analysis.dimensions} />
          </section>
        )}

        {/* ── 2-col grid: History + Alerts ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* History chart */}
          <section className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5">
            <h2 className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-1 flex items-center gap-1.5">
              Tendencia de confianza
              <InfoTooltip
                content="Evolución de la confianza global a través de los análisis realizados (automáticos cada 6 horas + manuales). Una tendencia ascendente indica mejora en calidad de datos y fuentes. Para mejorar la tendencia: diversifica tipos de fuentes en 'Datos', agrega fuentes manuales del equipo, y reduce dimensiones en rojo en el semáforo de cobertura."
                placement="right"
              />
            </h2>
            <p className="text-xs text-black-eske dark:text-[#9AAEBE] mb-3">
              Confianza global a través de los análisis realizados
            </p>
            <HistoryChart history={history} />
            {history.length > 0 && (
              <p className="text-xs text-black-eske dark:text-[#9AAEBE] mt-2 text-right">
                {history.length} análisis · v1 – v{history[history.length - 1]?.version}
              </p>
            )}
          </section>

          {/* Alerts feed */}
          <section className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-black-eske dark:text-[#EAF2F8] flex items-center gap-1.5">
                Alertas
                <InfoTooltip
                  content="Las alertas se generan cuando el score de riesgo del análisis supera el umbral del proyecto (vector ≥ 70 por defecto). Se activan en cada análisis —manual o automático—. Las alertas de crisis activan el banner rojo en la parte superior."
                  placement="right"
                />
              </h2>
              {alerts.filter((a) => !a.readAt).length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5
                  bg-red-eske text-white text-xs rounded-full font-bold">
                  {alerts.filter((a) => !a.readAt).length}
                </span>
              )}
            </div>
            <p className="text-xs text-black-eske dark:text-[#9AAEBE] mb-3">
              Verificadas cada 30 segundos
            </p>
            <AlertsFeed
              projectId={projectId}
              onAlertsChange={setAlerts}
            />
          </section>
        </div>

        {/* ── Análisis automático ── */}
        <section className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5">
          <h2 className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
            Monitoreo automático
          </h2>
          <p className="text-xs text-black-eske dark:text-[#9AAEBE] mb-3">
            Si activas esta opción, el sistema ejecuta un análisis automático cada 6 horas.
            Por defecto está desactivado — solo se ejecuta si tú lo habilitas.
          </p>
          {project && (
            <TokenCostEstimate tipo={project.tipo} horizonte={project.horizonte} />
          )}
          <label className="flex items-center gap-3 cursor-pointer w-fit mt-4">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={autoMonitor}
                disabled={togglingAuto}
                onChange={handleToggleAutoMonitor}
                aria-label="Habilitar análisis automáticos cada 6 horas"
              />
              <div
                className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                  autoMonitor
                    ? "bg-bluegreen-eske"
                    : "bg-gray-eske-30 dark:bg-white/20"
                } ${togglingAuto ? "opacity-50" : ""}`}
              />
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow
                  transition-transform duration-200 ${autoMonitor ? "translate-x-5" : ""}`}
              />
            </div>
            <span className="text-sm font-medium text-black-eske dark:text-[#EAF2F8]">
              {togglingAuto
                ? "Guardando…"
                : autoMonitor
                ? "Análisis automáticos activados"
                : "Análisis automáticos desactivados"}
            </span>
          </label>
        </section>

        {/* ── Análisis manual ── */}
        <section className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-black-eske dark:text-[#EAF2F8]">
                Ejecutar análisis manual
              </h2>
              <p className="text-xs text-black-eske dark:text-[#9AAEBE] mt-0.5">
                Ejecuta un análisis en cualquier momento desde la pantalla de Datos.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                router.push(`/centinela/pestel/${projectId}/datos`)
              }
              className="px-5 py-2.5 bg-bluegreen-eske text-white text-sm font-semibold
                rounded-lg hover:bg-bluegreen-eske/90 transition-colors shadow-sm shrink-0"
            >
              Ir a Datos →
            </button>
          </div>
        </section>

        {/* ── Footer ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/centinela/pestel")}
            className="px-6 py-2.5 border border-gray-eske-20 dark:border-white/10 text-black-eske dark:text-[#C7D6E0]
              rounded-lg text-sm hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
          >
            ← Ir a PESTEL
          </button>
          <ModduloButton
            project={project}
            projectId={projectId}
            analysisId={analysis?.id}
            onLinked={loadAll}
          />
        </div>
      </div>
    </div>
  );
}
