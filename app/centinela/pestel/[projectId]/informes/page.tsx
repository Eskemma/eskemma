"use client";

// app/centinela/pestel/[projectId]/informes/page.tsx
// E7 — Report generation: 4 formats with Claude streaming + PDF/DOCX export.

import { useState, useEffect, useCallback, useRef } from "react";
import PESTELStageNav from "@/app/components/centinela/pestel/PESTELStageNav";
import { useParams, useRouter } from "next/navigation";
import ScorecardTable from "@/app/components/centinela/pestel/informes/ScorecardTable";
import ReportViewer from "@/app/components/centinela/pestel/informes/ReportViewer";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import {
  buildScorecard,
  type Scorecard,
} from "@/lib/pestel/matrizUtils";
import {
  exportToPdf,
  exportToDocx,
  type ReportFormat,
} from "@/lib/pestel/exportUtils";
import {
  extraerEstadoGuardado,
  informeVigentePorFormato,
  parsearCacheLocalLegada,
  parsearPendientes,
  planMigracionLocal,
  reconciliarPendientes,
  textoVigente,
  REPORT_FORMATS,
  type PendientesPorFormato,
} from "@/lib/pestel/informesSync";
import type {
  PESTELProject,
  PestlAnalysisV2,
  PestlDimensionConfig,
} from "@/types/pestel.types";

// Persistencia de informes (26-10-03): la fuente de verdad es Firestore
// (pestel_analyses/{id}.informes). La clave LEGADA de localStorage ya no se
// escribe: solo se lee una vez para migrarla, y nunca se borra. El buffer de
// "pendientes" guarda una edición solo mientras el servidor no la confirma.
const claveLegada = (projectId: string, analysisId: string) =>
  `pestel_report_${projectId}_${analysisId}`;
const claveMigrada = (projectId: string, analysisId: string) =>
  `pestel_report_migrado_${projectId}_${analysisId}`;
const clavePendientes = (analysisId: string) =>
  `pestel_informes_pendientes_${analysisId}`;
const GUARDADO_DEBOUNCE_MS = 800;

// "lleno": el análisis ya no admite más informes/ediciones (límite de 1 MB del documento).
// "sin_guardar": el informe se generó pero el servidor no pudo guardarlo.
type EstadoGuardado = "idle" | "guardando" | "guardado" | "error" | "lleno" | "sin_guardar";
type ResultadoEnvio = "ok" | "lleno" | "error";

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
  {
    id: "insights_por_tipo",
    label: "Mapa de insights",
    description: "Agrupados por tipo de proyecto",
    borderClass: "border-l-4 border-b-2 border-orange-eske",
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
  // id del informe (Firestore) que respalda el texto de cada formato
  const [informeIds, setInformeIds] = useState<
    Partial<Record<ReportFormat, string>>
  >({});
  // formatos con ediciones del usuario (para avisar antes de "Regenerar")
  const [editados, setEditados] = useState<
    Partial<Record<ReportFormat, boolean>>
  >({});
  // formatos cuyo informe se generó pero NO quedó guardado en el servidor
  const [sinGuardar, setSinGuardar] = useState<Partial<Record<ReportFormat, boolean>>>({});
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>("idle");
  const [confirmRegenerar, setConfirmRegenerar] = useState(false);
  const guardadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // ── Guardado de ediciones en servidor ──────────────────────────

  const leerPendientes = useCallback((analysisId: string): PendientesPorFormato => {
    try {
      return parsearPendientes(localStorage.getItem(clavePendientes(analysisId)));
    } catch {
      return {};
    }
  }, []);

  const escribirPendientes = useCallback(
    (analysisId: string, p: PendientesPorFormato) => {
      try {
        if (Object.keys(p).length === 0) {
          localStorage.removeItem(clavePendientes(analysisId));
        } else {
          localStorage.setItem(clavePendientes(analysisId), JSON.stringify(p));
        }
      } catch {
        // almacenamiento no disponible — el guardado en servidor sigue su curso
      }
    },
    []
  );

  /** Envía una edición al servidor; devuelve true si quedó confirmada. */
  const enviarEdicion = useCallback(
    async (
      analysisId: string,
      formato: ReportFormat,
      informeId: string,
      contenido: string
    ): Promise<ResultadoEnvio> => {
      try {
        const res = await fetch(
          `/api/centinela/pestel/analysis/${analysisId}/informes/${informeId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contenido }),
            keepalive: contenido.length < 60_000,
          }
        );
        if (res.status === 413) return "lleno";
        if (!res.ok) return "error";
        const p = leerPendientes(analysisId);
        // solo se limpia si no hay una edición más nueva esperando
        if (p[formato]?.contenido === contenido) {
          delete p[formato];
          escribirPendientes(analysisId, p);
        }
        return "ok";
      } catch {
        return "error";
      }
    },
    [leerPendientes, escribirPendientes]
  );

  // Carga inicial: informes del servidor + migración de la caché local legada
  // + reenvío de ediciones que quedaron sin confirmar. Se ejecuta una vez por análisis.
  useEffect(() => {
    if (!analysis?.id) return;
    const analysisId = analysis.id;
    let cancelado = false;

    (async () => {
      let vigentes = informeVigentePorFormato(analysis.informes);

      // 1. Migración de lo que el usuario ya tenía solo en este navegador.
      try {
        const yaMigrado = localStorage.getItem(claveMigrada(projectId, analysisId));
        if (!yaMigrado) {
          const local = parsearCacheLocalLegada(
            localStorage.getItem(claveLegada(projectId, analysisId))
          );
          let todoOk = true;
          for (const accion of planMigracionLocal(local, vigentes)) {
            if (accion.tipo === "conservar_local") continue;
            const ok =
              accion.tipo === "crear"
                ? await fetch(
                    `/api/centinela/pestel/analysis/${analysisId}/informes`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        formato: accion.formato,
                        contenido: accion.contenido,
                      }),
                    }
                  ).then((r) => r.ok)
                : (await enviarEdicion(
                    analysisId,
                    accion.formato,
                    accion.informeId,
                    accion.contenido
                  )) === "ok";
            if (!ok) todoOk = false;
          }
          // Se marca solo si todo se confirmó; si no, reintenta en la próxima
          // carga. La clave legada NO se borra en ningún caso.
          if (todoOk) localStorage.setItem(claveMigrada(projectId, analysisId), "1");
        }
      } catch {
        // almacenamiento o red no disponibles — se reintenta en la próxima carga
      }

      // 2. Si la migración o el reenvío cambiaron algo, se relee el análisis.
      const pendientes = leerPendientes(analysisId);
      for (const acc of reconciliarPendientes(pendientes, vigentes)) {
        if (acc.tipo === "reenviar") {
          await enviarEdicion(analysisId, acc.formato, acc.informeId, acc.contenido);
        } else {
          delete pendientes[acc.formato];
        }
      }
      escribirPendientes(analysisId, pendientes);

      try {
        const res = await fetch(`/api/centinela/pestel/analysis/${analysisId}`);
        if (res.ok) {
          const data = (await res.json()) as {
            analysis: PestlAnalysisV2 & { id: string };
          };
          vigentes = informeVigentePorFormato(data.analysis.informes);
        }
      } catch {
        // se usan los informes ya cargados
      }
      if (cancelado) return;

      const textos: Partial<Record<ReportFormat, string>> = {};
      const ids: Partial<Record<ReportFormat, string>> = {};
      const edits: Partial<Record<ReportFormat, boolean>> = {};
      for (const rf of REPORT_FORMATS) {
        const inf = vigentes[rf];
        if (!inf) continue;
        textos[rf] = textoVigente(inf);
        ids[rf] = inf.id;
        if (inf.contenidoEditado !== undefined) edits[rf] = true;
      }
      // Lo que el usuario ya generó/editó en esta sesión mientras cargaba gana
      // sobre lo recién leído del servidor.
      setReportCache((prev) => ({ ...textos, ...prev }));
      setInformeIds((prev) => ({ ...ids, ...prev }));
      setEditados((prev) => ({ ...edits, ...prev }));
      const formatos = REPORT_FORMATS.filter((rf) => textos[rf]);
      if (formatos.length > 0) {
        // el formato más recientemente generado
        const masReciente = formatos.reduce((a, b) =>
          Date.parse(vigentes[a]!.generadoEn) >= Date.parse(vigentes[b]!.generadoEn)
            ? a
            : b
        );
        setActiveFormat(masReciente);
      }
    })();

    return () => {
      cancelado = true;
    };
    // analysis.informes se lee solo al montar/cambiar de análisis
  }, [analysis?.id, projectId]);

  // Al cerrar la pestaña con un guardado en curso, se intenta enviar ya.
  useEffect(() => {
    if (!analysis?.id) return;
    const analysisId = analysis.id;
    function alSalir() {
      const p = leerPendientes(analysisId);
      for (const rf of REPORT_FORMATS) {
        const e = p[rf];
        if (e) void enviarEdicion(analysisId, rf, e.informeId, e.contenido);
      }
    }
    window.addEventListener("pagehide", alSalir);
    return () => window.removeEventListener("pagehide", alSalir);
  }, [analysis?.id, leerPendientes, enviarEdicion]);

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

    // Clear this format's text while regenerating. Si había una edición sin
    // confirmar de ESTE informe, se cancela: el informe nuevo la reemplaza.
    if (guardadoTimer.current) clearTimeout(guardadoTimer.current);
    if (analysis?.id) {
      const p = leerPendientes(analysis.id);
      if (p[format]) {
        delete p[format];
        escribirPendientes(analysis.id, p);
      }
    }
    setEstadoGuardado("idle");
    setSinGuardar((prev) => ({ ...prev, [format]: false }));
    setReportCache((prev) => {
      const next = { ...prev };
      delete next[format];
      return next;
    });
    setInformeIds((prev) => {
      const next = { ...prev };
      delete next[format];
      return next;
    });
    setEditados((prev) => ({ ...prev, [format]: false }));

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

      // El servidor guarda el informe antes de cerrar el stream y entrega su
      // id: permite guardar ediciones apenas termina la generación.
      const nuevoInformeId = res.headers.get("X-Informe-Id");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        // Update cache in real-time so the viewer shows streaming text (sin la
        // marca de "no guardado", que solo puede llegar al final)
        setReportCache((prev) => ({
          ...prev,
          [format]: extraerEstadoGuardado(accumulated).texto,
        }));
      }
      // Si el servidor no pudo guardar el informe, lo avisa con una marca al final.
      if (extraerEstadoGuardado(accumulated).guardado) {
        if (nuevoInformeId) {
          setInformeIds((prev) => ({ ...prev, [format]: nuevoInformeId }));
        }
      } else {
        setSinGuardar((prev) => ({ ...prev, [format]: true }));
        setEstadoGuardado("sin_guardar");
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

  // Autoguardado con debounce. El texto queda primero en el buffer local de
  // "pendientes" (por si se cierra la pestaña o cae la red) y se borra de ahí
  // solo cuando el servidor confirma. Guarda la ÚLTIMA edición, no un historial.
  function handleContentChange(text: string) {
    if (!activeFormat || !analysis?.id) return;
    const formato = activeFormat;
    const analysisId = analysis.id;
    setReportCache((prev) => ({ ...prev, [formato]: text }));
    setEditados((prev) => ({ ...prev, [formato]: true }));

    const informeId = informeIds[formato];
    if (!informeId) {
      // Sin id no hay dónde guardar: el informe no quedó guardado en el servidor.
      setEstadoGuardado("sin_guardar");
      return;
    }

    const p = leerPendientes(analysisId);
    p[formato] = { informeId, contenido: text, ts: Date.now() };
    escribirPendientes(analysisId, p);
    setEstadoGuardado("guardando");

    if (guardadoTimer.current) clearTimeout(guardadoTimer.current);
    guardadoTimer.current = setTimeout(async () => {
      const r = await enviarEdicion(analysisId, formato, informeId, text);
      setEstadoGuardado(r === "ok" ? "guardado" : r);
    }, GUARDADO_DEBOUNCE_MS);
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
              <h2 className="font-semibold text-black-eske dark:text-[#EAF2F8] flex items-center gap-1">
                Scorecard ponderado
                <InfoTooltip
                  content="Tabla que sintetiza el peso relativo, score y señal dominante de cada dimensión PESTEL. Permite comparar el equilibrio entre amenazas y oportunidades en el análisis."
                  placement="right"
                />
              </h2>
              <p className="text-xs text-black-eske dark:text-[#9AAEBE] mt-0.5">
                Calculado con los pesos configurados para el análisis.
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
            Los informes generados y tus ediciones se guardan en tu cuenta.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                {!generating && estadoGuardado !== "idle" && (
                  <span
                    className={
                      estadoGuardado === "error" ||
                      estadoGuardado === "lleno" ||
                      estadoGuardado === "sin_guardar"
                        ? "text-xs text-red-eske-60 dark:text-red-eske-10"
                        : "text-xs text-black-eske-20 dark:text-[#9AAEBE]"
                    }
                    role="status"
                  >
                    {estadoGuardado === "guardando" && "Guardando…"}
                    {estadoGuardado === "guardado" && "Cambios guardados"}
                    {estadoGuardado === "error" &&
                      "No se pudo guardar. Se reintentará al volver a abrir esta página."}
                    {estadoGuardado === "lleno" &&
                      "Este análisis ya no admite más cambios guardados (límite de espacio)."}
                    {estadoGuardado === "sin_guardar" &&
                      "Este informe no está guardado en tu cuenta."}
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
                  onClick={() => {
                    if (!activeFormat) return;
                    if (editados[activeFormat]) setConfirmRegenerar(true);
                    else handleGenerate(activeFormat, true);
                  }}
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

        {/* ── Informe sin guardar / sin espacio ── */}
        {((activeFormat && sinGuardar[activeFormat]) || estadoGuardado === "lleno") && (
          <div
            role="alert"
            className="bg-red-eske/10 dark:bg-red-eske/20 border border-red-eske/20 dark:border-red-eske/40 rounded-xl p-4"
          >
            <p className="text-sm text-red-eske-60 dark:text-red-eske-10 font-medium">
              {estadoGuardado === "lleno"
                ? "Este análisis no admite más cambios guardados"
                : "El informe se generó, pero no se pudo guardar en tu cuenta"}
            </p>
            <p className="text-sm text-black-eske-40 dark:text-[#C7D6E0] mt-1">
              {estadoGuardado === "lleno"
                ? "Acumuló demasiados informes y ediciones y alcanzó el límite de espacio. Copia o descarga tu texto ahora para no perderlo, y genera un análisis nuevo para seguir trabajando."
                : "Si sales de esta página lo perderás. Copia o descarga el texto ahora (los botones de arriba siguen funcionando) y vuelve a generarlo más tarde; cualquier edición que hagas tampoco se guardará."}
            </p>
          </div>
        )}

        {/* ── Generate error ── */}
        {generateError && (
          <div className="bg-red-eske/10 dark:bg-red-eske/20 border border-red-eske/20 dark:border-red-eske/40 rounded-xl p-4">
            <p className="text-sm text-red-eske dark:text-red-eske-10 font-medium">
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

      {confirmRegenerar && activeFormat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmRegenerar(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="regenerar-titulo"
            className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-3">
              <h3
                id="regenerar-titulo"
                className="font-semibold text-black-eske dark:text-[#C7D6E0] text-base"
              >
                ¿Regenerar el informe «
                {FORMAT_OPTIONS.find((f) => f.id === activeFormat)?.label}»?
              </h3>
              <p className="text-sm text-black-eske-20 dark:text-[#9AAEBE] leading-relaxed">
                Este informe tiene ediciones tuyas. Al regenerarlo, la pantalla mostrará
                un texto nuevo en lugar de tus cambios. El informe actual queda guardado
                en el sistema, pero por ahora no hay una forma de consultarlo desde
                esta pantalla.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmRegenerar(false)}
                className="px-4 py-2 text-sm font-medium text-black-eske-20 dark:text-[#9AAEBE]
                  hover:text-black-eske dark:hover:text-[#C7D6E0] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmRegenerar(false);
                  handleGenerate(activeFormat, true);
                }}
                className="px-4 py-2 text-sm font-medium bg-red-eske-60 text-white-eske rounded-lg
                  hover:bg-red-eske-60/90 transition-colors"
              >
                Regenerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
