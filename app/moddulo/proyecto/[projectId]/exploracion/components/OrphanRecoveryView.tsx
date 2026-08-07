"use client";

// OrphanRecoveryView — shown when the Moddulo project that a PESTEL analysis
// was linked to has been hard-deleted. Lets the user create a new Moddulo
// project pre-filled from the surviving PESTEL data and recover the analysis.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Territorio } from "@/types/pestel.types";

interface Props {
  pestAnalysisId: string | null;
  deadProjectId: string;
}

interface PestelMeta {
  pestelProjectId: string;
  nombre: string;
  tipo: "electoral" | "gubernamental" | "legislativo" | "ciudadano";
  territorio: Territorio;
}

const TYPE_LABELS: Record<string, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

export default function OrphanRecoveryView({ pestAnalysisId, deadProjectId: _dead }: Props) {
  const router = useRouter();

  const [meta, setMeta] = useState<PestelMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!pestAnalysisId) return;
    setLoading(true);
    fetch(`/api/centinela/pestel/analysis-meta?analysis_id=${pestAnalysisId}`)
      .then((r) => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? "Error")))
      .then((data: PestelMeta) => {
        setMeta(data);
        setProjectName(data.nombre);
      })
      .catch((err: unknown) => {
        setMetaError(typeof err === "string" ? err : "No se pudo cargar la información del análisis.");
      })
      .finally(() => setLoading(false));
  }, [pestAnalysisId]);

  async function handleCreate() {
    if (!meta || !projectName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/moddulo/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: meta.tipo,
          name: projectName.trim(),
          territorio: meta.territorio,
          pestelProjectId: meta.pestelProjectId,
          pestAnalysisId,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Error al crear proyecto");
      }
      const { project } = await res.json() as { project: { id: string } };
      router.push(
        `/moddulo/proyecto/${project.id}/exploracion?pest_analysis_id=${pestAnalysisId}`
      );
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Error inesperado");
      setCreating(false);
    }
  }

  // Case: arrived without a pest_analysis_id — nothing to recover
  if (!pestAnalysisId) {
    return (
      <div className="min-h-screen bg-white-eske flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-eske-30 p-8 space-y-4 text-center">
          <div className="text-4xl" aria-hidden="true">⚠️</div>
          <h1 className="font-semibold text-xl text-black-eske">
            Este proyecto ya no existe
          </h1>
          <p className="text-sm text-black-eske/70 leading-relaxed">
            El proyecto de Moddulo fue eliminado y no encontramos ningún análisis
            PESTEL asociado para recuperar. Puedes crear un nuevo proyecto desde cero.
          </p>
          <Link
            href="/moddulo/nuevo"
            className="inline-block mt-2 px-5 py-2.5 rounded-lg bg-blue-eske text-white text-sm font-medium
                       hover:bg-blue-eske-80 transition-colors"
          >
            Nuevo proyecto
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white-eske flex items-start justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-bluegreen-eske">
            Recuperación de análisis
          </p>
          <h1 className="text-2xl font-semibold text-black-eske">
            El proyecto vinculado fue eliminado
          </h1>
          <p className="text-sm text-black-eske/70 leading-relaxed">
            El proyecto de Moddulo asociado a este análisis PESTEL ya no existe.
            Puedes crear uno nuevo y recuperar el análisis automáticamente.
          </p>
        </div>

        {/* Loading meta */}
        {loading && (
          <div className="rounded-xl border border-gray-eske-30 bg-white p-6 text-sm text-red-eske text-center">
            Cargando información del análisis…
          </div>
        )}

        {/* Meta error */}
        {!loading && metaError && (
          <div role="alert" className="rounded-xl border border-red-eske/30 bg-red-eske/5 p-5 text-sm text-red-eske leading-relaxed">
            {metaError}
          </div>
        )}

        {/* Main card */}
        {!loading && meta && (
          <div className="rounded-xl border border-gray-eske-30 bg-white divide-y divide-gray-eske-20">

            {/* What IS recovered */}
            <div className="p-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-eske">
                Qué se recupera
              </p>
              <ul className="text-sm text-black-eske/80 space-y-1 list-disc list-inside">
                <li>Análisis PESTEL completo (5 dimensiones)</li>
                <li>Señales, narrativas y niveles de confianza</li>
                <li>Fuentes y artículos de referencia</li>
                <li>Nombre y tipo de proyecto PESTEL</li>
              </ul>
            </div>

            {/* What is NOT recovered */}
            <div className="p-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-eske">
                Qué no se recupera
              </p>
              <ul className="text-sm text-black-eske/80 space-y-1 list-disc list-inside">
                <li>Variables de Propósito (F1 / XPCTO) — deben completarse de nuevo</li>
                <li>Historial de conversación con Moddulo</li>
              </ul>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="recovery-name"
                  className="block text-xs font-semibold text-black-eske"
                >
                  Nombre del nuevo proyecto
                </label>
                <input
                  id="recovery-name"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-lg border border-gray-eske-30 px-3 py-2 text-sm text-black-eske
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
                  placeholder="Nombre del proyecto"
                  maxLength={120}
                />
              </div>

              <div className="flex gap-4 text-sm text-black-eske/70">
                <span>
                  <span className="font-medium text-black-eske">Tipo:</span>{" "}
                  {TYPE_LABELS[meta.tipo] ?? meta.tipo}
                </span>
                {meta.territorio?.nombre && (
                  <span>
                    <span className="font-medium text-black-eske">Territorio:</span>{" "}
                    {meta.territorio.nombre}
                  </span>
                )}
              </div>

              {createError && (
                <div role="alert" className="text-sm text-red-eske bg-red-eske/5 border border-red-eske/20 rounded-lg px-3 py-2">
                  {createError}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !projectName.trim()}
                className="w-full rounded-lg bg-blue-eske text-white text-sm font-medium px-4 py-2.5
                           hover:bg-blue-eske-80 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creando proyecto…" : "Crear proyecto y recuperar análisis"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
