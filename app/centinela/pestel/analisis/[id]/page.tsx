"use client";

import {useState, useEffect, useCallback} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import RiskVectorWidget from "@/app/components/centinela/pestel/dashboard/RiskVectorWidget";
import PESTLPanel from "@/app/components/centinela/pestel/dashboard/PESTLPanel";
import type {PESTELConfig, PESTELFeed} from "@/types/pestel.types";

// ── Hook de polling ───────────────────────────────────────────

type JobStatus = "idle" | "running" | "completed" | "failed";

function usePESTELJob(jobId: string | null) {
  const [status, setStatus] = useState<JobStatus>("idle");
  const [feedId, setFeedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setFeedId(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    setStatus("running");

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/centinela/pestel/status?jobId=${jobId}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          feedId?: string;
          error?: string;
        };
        if (data.status === "completed") {
          clearInterval(interval);
          setStatus("completed");
          setFeedId(data.feedId ?? null);
        } else if (data.status === "failed") {
          clearInterval(interval);
          setStatus("failed");
          setError(data.error ?? "El análisis falló");
        }
      } catch {/* continuar */}
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  return {status, feedId, error, reset};
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(value: unknown): string {
  if (!value) return "";
  try {
    const d =
      typeof value === "string"
        ? new Date(value)
        : new Date((value as {_seconds: number})._seconds * 1000);
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

// ── Página de análisis ────────────────────────────────────────

export default function PESTELAnalisisPage() {
  const params = useParams();
  const configId = params?.id as string;

  const [config, setConfig] = useState<PESTELConfig | null>(null);
  const [feed, setFeed] = useState<PESTELFeed | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const job = usePESTELJob(activeJobId);

  // Cargar config + feed al montar
  useEffect(() => {
    if (!configId) return;

    async function load() {
      try {
        // Cargar todos los configs y encontrar el que corresponde
        const res = await fetch("/api/centinela/pestel/config");
        const data = (await res.json()) as {configs: PESTELConfig[]};
        const found = (data.configs ?? []).find((c) => c.id === configId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setConfig(found);

        // Cargar feed vigente
        setLoadingFeed(true);
        const fr = await fetch(
          `/api/centinela/pestel/feed?configId=${configId}`
        );
        const fd = (await fr.json()) as {feed: PESTELFeed | null};
        setFeed(fd.feed ?? null);
      } catch {
        setNotFound(true);
      } finally {
        setPageLoading(false);
        setLoadingFeed(false);
      }
    }

    load();
  }, [configId]);

  // Cuando el job completa, recargar el feed
  useEffect(() => {
    if (job.status === "completed" && configId) {
      setLoadingFeed(true);
      fetch(`/api/centinela/pestel/feed?configId=${configId}`)
        .then((r) => r.json())
        .then((data: {feed: PESTELFeed | null}) => {
          setFeed(data.feed ?? null);
        })
        .catch(() => {})
        .finally(() => {
          setLoadingFeed(false);
          job.reset();
          setActiveJobId(null);
        });
    }
  }, [job, configId]);

  async function handleTrigger() {
    if (!configId) return;
    setTriggering(true);
    try {
      const res = await fetch("/api/centinela/pestel/trigger", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({configId}),
      });
      const data = (await res.json()) as {jobId?: string; error?: string};
      if (!res.ok) throw new Error(data.error ?? "Error al iniciar");
      setActiveJobId(data.jobId!);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setTriggering(false);
    }
  }

  const isAnalyzing = triggering || job.status === "running";

  // ── Estados de carga ─────────────────────────────────────────

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-white-eske-40 dark:bg-[#0B1620] flex items-center
        justify-center">
        <div
          className="w-6 h-6 border-2 border-bluegreen-eske
            border-t-transparent rounded-full animate-spin"
        />
      </main>
    );
  }

  if (notFound || !config) {
    return (
      <main className="min-h-screen bg-white-eske-40 flex flex-col
        items-center justify-center gap-4 p-6">
        <p className="text-gray-500 dark:text-[#9AAEBE] text-sm">
          No se encontró esta configuración.
        </p>
        <Link
          href="/centinela/pestel"
          className="text-sm text-bluegreen-eske hover:underline"
        >
          ← Volver a PESTEL
        </Link>
      </main>
    );
  }

  // ── Vista principal ──────────────────────────────────────────

  return (
    <main className="min-h-screen bg-white-eske-40 dark:bg-[#0B1620]">
      {/* Header */}
      <div className="bg-bluegreen-eske">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <Link
            href="/centinela/pestel"
            className="inline-flex items-center gap-1.5 text-xs
              text-bluegreen-eske-10/70 hover:text-white transition-colors
              mb-3"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            PESTEL
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-white">
                {config.territorio.nombre}
              </h1>
              <p className="text-xs text-bluegreen-eske-10/70 mt-0.5 capitalize">
                Análisis {config.modo}
                {feed && ` · Actualizado ${formatDate(feed.generadoEn)}`}
              </p>
            </div>

            <button
              type="button"
              onClick={handleTrigger}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-white/15
                hover:bg-white/25 text-white rounded-lg text-sm font-medium
                transition-colors disabled:opacity-50
                disabled:cursor-not-allowed"
            >
              {isAnalyzing && (
                <span
                  className="w-3.5 h-3.5 border-2 border-white/40
                    border-t-white rounded-full animate-spin"
                />
              )}
              {triggering
                ? "Iniciando…"
                : job.status === "running"
                  ? "Analizando…"
                  : feed
                    ? "Actualizar"
                    : "Ejecutar análisis"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col
        gap-5">

        {/* Barra de progreso */}
        {isAnalyzing && (
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm p-4
            border border-bluegreen-eske/20 dark:border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-4 h-4 border-2 border-bluegreen-eske/30
                  border-t-bluegreen-eske rounded-full animate-spin shrink-0"
              />
              <p className="text-sm font-medium text-bluegreen-eske-60">
                {triggering
                  ? "Iniciando análisis…"
                  : "Recopilando fuentes y clasificando con IA…"}
              </p>
            </div>
            <div className="w-full h-1 bg-gray-eske-20 rounded-full
              overflow-hidden">
              <div
                className="h-full bg-bluegreen-eske rounded-full animate-pulse"
                style={{width: "55%"}}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-[#6D8294] mt-2">
              Este proceso tarda entre 1 y 2 minutos. Puedes esperar aquí
              o volver más tarde.
            </p>
          </div>
        )}

        {/* Error del job */}
        {job.status === "failed" && job.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{job.error}</p>
          </div>
        )}

        {/* Resultados */}
        {loadingFeed && !feed && (
          <div className="flex justify-center py-12">
            <div
              className="w-5 h-5 border-2 border-bluegreen-eske
                border-t-transparent rounded-full animate-spin"
            />
          </div>
        )}

        {feed && (
          <>
            <RiskVectorWidget
              vectorRiesgo={feed.vectorRiesgo}
              indicePresionSocial={feed.indicePresionSocial}
              indiceClimaInversion={feed.indiceClimaInversion}
            />
            <PESTLPanel pestl={feed.pestl} />
          </>
        )}

        {!feed && !isAnalyzing && !loadingFeed && (
          <div className="text-center py-16 bg-white-eske dark:bg-[#18324A] rounded-xl
            border border-dashed border-gray-eske-30 dark:border-white/10">
            <p className="text-sm text-gray-400 dark:text-[#9AAEBE] mb-3">
              Sin análisis para este territorio.
            </p>
            <button
              type="button"
              onClick={handleTrigger}
              className="px-5 py-2.5 bg-bluegreen-eske text-white
                rounded-lg text-sm font-medium hover:bg-bluegreen-eske-60
                transition-colors"
            >
              Ejecutar primer análisis
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
