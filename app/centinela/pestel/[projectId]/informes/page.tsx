"use client";

// app/centinela/pestel/[projectId]/informes/page.tsx
// E7 — Report generation: 4 formats with Claude streaming + PDF/DOCX export.

import { useState, useEffect, useCallback } from "react";
import PESTELStageNav from "@/app/components/centinela/pestel/PESTELStageNav";
import { useParams, useRouter } from "next/navigation";
import ScorecardTable from "@/app/components/centinela/pestel/informes/ScorecardTable";
import ReportViewer from "@/app/components/centinela/pestel/informes/ReportViewer";
import {
  buildScorecard,
  type Scorecard,
} from "@/lib/pestel/matrizUtils";
import {
  exportToPdf,
  exportToDocx,
  type ReportFormat,
} from "@/lib/pestel/exportUtils";
import type {
  PESTELProject,
  PestlAnalysisV2,
  PestlDimensionConfig,
} from "@/types/pestel.types";

const FORMAT_OPTIONS: {
  id: ReportFormat;
  label: string;
  description: string;
  borderClass: string;
}[] = [
  {
    id: "executive",
    label: "Ejecutivo",
    description: "Resumen para dirección política",
    borderClass: "border-l-4 border-b-2 border-bluegreen-eske",
  },
  {
    id: "technical",
    label: "Técnico completo",
    description: "Metodología + fuentes + narrativas",
    borderClass: "border-l-4 border-b-2 border-green-eske",
  },
  {
    id: "foda",
    label: "FODA-lista",
    description: "Oportunidades y amenazas PESTEL",
    borderClass: "border-l-4 border-b-2 border-yellow-eske",
  },
  {
    id: "scenarios",
    label: "Escenarios",
    description: "Optimista / Base / Pesimista",
    borderClass: "border-l-4 border-b-2 border-red-eske",
  },
];

export default function InformesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<PESTELProject | null>(null);
  const [analysis, setAnalysis] = useState<
    (PestlAnalysisV2 & { id: string }) | null
  >(null);
  const [variableConfigs, setVariableConfigs] = useState<
    PestlDimensionConfig[]
  >([]);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Cache: one entry per format, persists across tab switches
  const [reportCache, setReportCache] = useState<
    Partial<Record<ReportFormat, string>>
  >({});
  const [activeFormat, setActiveFormat] = useState<ReportFormat | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copiar");
  const [exportingDocx, setExportingDocx] = useState(false);

  // Derived current content
  const currentContent =
    activeFormat !== null ? (reportCache[activeFormat] ?? "") : "";

  // ── Load data ──────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      const projRes = await fetch("/api/centinela/pestel/project");
      if (!projRes.ok) throw new Error("No se pudo cargar el proyecto.");
      const projData = (await projRes.json()) as {
        projects: (PESTELProject & { id: string })[];
      };
      const found = projData.projects.find((p) => p.id === projectId);
      if (!found) throw new Error("Proyecto no encontrado.");
      setProject(found);

      const latestRes = await fetch(
        `/api/centinela/pestel/project/${projectId}/latest-analysis`
      );
      if (!latestRes.ok) throw new Error("No se pudo cargar el análisis.");
      const latestData = (await latestRes.json()) as {
        analysisId: string | null;
      };
      if (!latestData.analysisId)
        throw new Error("No hay análisis disponible.");

      const analysisRes = await fetch(
        `/api/centinela/pestel/analysis/${latestData.analysisId}`
      );
      if (!analysisRes.ok) throw new Error("No se pudo cargar el análisis.");
      const analysisData = (await analysisRes.json()) as {
        analysis: PestlAnalysisV2 & { id: string };
      };
      setAnalysis(analysisData.analysis);

      const configRes = await fetch(
        `/api/centinela/pestel/project/${projectId}/variable-configs`
      );
      const configs: PestlDimensionConfig[] = configRes.ok
        ? ((await configRes.json()) as { configs: PestlDimensionConfig[] })
            .configs
        : [];
      setVariableConfigs(configs);

      setScorecard(buildScorecard(analysisData.analysis.dimensions, configs));
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Error al cargar datos."
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Restore persisted reports for this analysis when analysis loads
  useEffect(() => {
    if (!analysis?.id) return;
    try {
      const saved = localStorage.getItem(`pestel_report_${projectId}_${analysis.id}`);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<Record<ReportFormat, string>>;
      setReportCache(parsed);
      // Pre-select the last cached format
      const formats = Object.keys(parsed) as ReportFormat[];
      if (formats.length > 0) setActiveFormat(formats[formats.length - 1]);
    } catch {
      // corrupt storage entry — ignore
    }
  }, [analysis?.id, projectId]);

  // Persist cache whenever it changes
  useEffect(() => {
    if (!analysis?.id || Object.keys(reportCache).length === 0) return;
    try {
      localStorage.setItem(
        `pestel_report_${projectId}_${analysis.id}`,
        JSON.stringify(reportCache)
      );
    } catch {
      // storage full — ignore
    }
  }, [reportCache, analysis?.id, projectId]);

  // ── Generate report (streaming) ────────────────────────────────
  // force=true → always regenerate (Regenerar button)
  // force=false → use cache if available (format tab click)

  async function handleGenerate(format: ReportFormat, force = false) {
    if (!analysis?.id) return;

    // If cached and not forced, just switch the active tab
    if (!force && reportCache[format]) {
      setActiveFormat(format);
      setGenerateError(null);
      return;
    }

    setActiveFormat(format);
    setGenerateError(null);
    setGenerating(true);

    // Clear this format's cache while regenerating
    setReportCache((prev) => {
      const next = { ...prev };
      delete next[format];
      return next;
    });

    try {
      const res = await fetch(
        `/api/centinela/pestel/analysis/${analysis.id}/generate-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format }),
        }
      );

      if (!res.ok || !res.body) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error ?? "Error al generar el informe.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        // Update cache in real-time so the viewer shows streaming text
        setReportCache((prev) => ({ ...prev, [format]: accumulated }));
      }
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Error al generar el informe."
      );
    } finally {
      setGenerating(false);
    }
  }

  // ── Edit — update cache for active format ──────────────────────

  function handleContentChange(text: string) {
    if (!activeFormat) return;
    setReportCache((prev) => ({ ...prev, [activeFormat]: text }));
  }

  // ── Copy to clipboard ──────────────────────────────────────────

  async function handleCopy() {
    if (!currentContent) return;
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopyLabel("Copiado ✓");
      setTimeout(() => setCopyLabel("Copiar"), 2000);
    } catch {
      // silent fail
    }
  }

  // ── Export PDF ─────────────────────────────────────────────────

  async function handleExportPdf() {
    if (!currentContent || !activeFormat || !project) return;
    await exportToPdf(currentContent, project.nombre, activeFormat);
  }

  // ── Export DOCX ────────────────────────────────────────────────

  async function handleExportDocx() {
    if (!currentContent || !activeFormat || !project) return;
    setExportingDocx(true);
    try {
      await exportToDocx(currentContent, project.nombre, activeFormat);
    } finally {
      setExportingDocx(false);
    }
  }

  // ── Loading / error states ─────────────────────────────────────

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

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center px-6">
        <div className="bg-white-eske dark:bg-[#18324A] rounded-xl p-8 max-w-md text-center shadow-sm border border-gray-eske-20 dark:border-white/10">
          <p className="font-semibold text-red-eske">{loadError}</p>
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
                <span className="font-medium">Etapa 5 — Informes</span>
              </p>
            </div>
            <button
              onClick={() =>
                router.push(`/centinela/pestel/${projectId}/interpretacion`)
              }
              className="px-4 py-2 border border-white/30 text-white text-sm rounded-lg
                hover:bg-white/10 transition-colors"
            >
              ← Interpretación
            </button>
          </div>
        </div>
      </div>

      {/* Navegación de etapas */}
      {project && (
        <PESTELStageNav
          projectId={projectId}
          currentStage={project.currentStage ?? 7}
          activeStage={7}
        />
      )}

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* ── Scorecard ── */}
        {scorecard && analysis && (
          <section className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-eske-20 dark:border-white/10">
              <h2 className="font-semibold text-black-eske dark:text-[#EAF2F8]">
                Scorecard ponderado
              </h2>
              <p className="text-xs text-black-eske dark:text-[#9AAEBE] mt-0.5">
                Calculado con los pesos configurados en la Etapa 3
              </p>
            </div>
            <div className="px-1 py-2">
              <ScorecardTable
                scorecard={scorecard}
                dimensions={analysis.dimensions}
              />
            </div>
          </section>
        )}

        {/* ── Format selector ── */}
        <section className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5">
          <h2 className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">
            Generar informe
          </h2>
          <p className="text-xs text-black-eske dark:text-[#9AAEBE] mb-4">
            Selecciona el formato y PESTEL generará el texto en tiempo real.
            Los informes ya generados se guardan en esta sesión.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FORMAT_OPTIONS.map((opt) => {
              const isCached = Boolean(reportCache[opt.id]);
              const isActive = activeFormat === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleGenerate(opt.id)}
                  disabled={generating}
                  className={[
                    "relative flex flex-col items-start gap-1 rounded-lg p-3",
                    "text-left transition-all",
                    opt.borderClass,
                    isActive
                      ? "bg-bluegreen-eske/5 ring-1 ring-bluegreen-eske"
                      : "hover:bg-gray-eske-10 dark:hover:bg-white/5",
                    generating ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {isCached && (
                    <span
                      className="absolute top-2 right-2 text-green-eske text-xs font-bold"
                      aria-label="Generado"
                    >
                      ✓
                    </span>
                  )}
                    <span className="font-bold text-sm text-black-eske dark:text-[#EAF2F8] pr-4">
                    {opt.label}
                  </span>
                  <span className="text-xs text-black-eske dark:text-[#9AAEBE] leading-snug">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Report viewer ── */}
        {(currentContent || generating) && (
          <section className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5 flex flex-col gap-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {generating && (
                  <span className="flex items-center gap-1.5 text-xs text-bluegreen-eske font-medium">
                    <span
                      className="w-3 h-3 border-2 border-bluegreen-eske border-t-transparent
                        rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    Generando…
                  </span>
                )}
                {!generating && activeFormat && (
                  <span className="text-xs font-medium text-black-eske dark:text-[#C7D6E0]">
                    {FORMAT_OPTIONS.find((f) => f.id === activeFormat)?.label}{" "}
                    — listo
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!currentContent || generating}
                  className="px-3 py-1.5 text-xs border border-gray-eske-20 dark:border-white/10 rounded-lg
                    hover:bg-gray-eske-10 dark:hover:bg-white/5 disabled:opacity-40 transition-colors
                    text-black-eske dark:text-[#C7D6E0]"
                >
                  {copyLabel}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    activeFormat && handleGenerate(activeFormat, true)
                  }
                  disabled={generating || !activeFormat}
                  className="px-3 py-1.5 text-xs border border-gray-eske-20 dark:border-white/10 rounded-lg
                    hover:bg-gray-eske-10 dark:hover:bg-white/5 disabled:opacity-40 transition-colors
                    text-black-eske dark:text-[#C7D6E0]"
                >
                  Regenerar
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={!currentContent || generating}
                  className="px-3 py-1.5 text-xs bg-bluegreen-eske text-white rounded-lg
                    hover:bg-bluegreen-eske/90 disabled:opacity-40 transition-colors"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportDocx}
                  disabled={!currentContent || generating || exportingDocx}
                  className="px-3 py-1.5 text-xs bg-bluegreen-eske text-white rounded-lg
                    hover:bg-bluegreen-eske/90 disabled:opacity-40 transition-colors"
                >
                  {exportingDocx ? "Generando…" : "Word (.docx)"}
                </button>
              </div>
            </div>

            <ReportViewer
              content={currentContent}
              streaming={generating}
              onContentChange={handleContentChange}
            />
          </section>
        )}

        {/* ── Generate error ── */}
        {generateError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-eske/20 dark:border-red-700/40 rounded-xl p-4">
            <p className="text-sm text-red-eske dark:text-red-300 font-medium">
              Error al generar el informe
            </p>
            <p className="text-sm text-red-eske/80 mt-1">{generateError}</p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() =>
              router.push(`/centinela/pestel/${projectId}/monitoreo`)
            }
            className="px-6 py-2.5 bg-orange-eske text-white rounded-lg text-sm
              font-semibold hover:bg-orange-eske/90 transition-colors shadow-sm"
          >
            Continuar a Monitoreo →
          </button>
        </div>
      </div>
    </div>
  );
}
