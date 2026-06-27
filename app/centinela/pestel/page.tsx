"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PESTELProject } from "@/types/pestel.types";

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
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

const TYPE_LABELS: Record<string, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

const TYPE_ICONS: Record<string, string> = {
  electoral: "🗳️",
  gubernamental: "🏛️",
  legislativo: "📜",
  ciudadano: "✊",
};

const STAGE_LABELS: Record<number, string> = {
  1: "Tipo de proyecto",
  2: "Territorio",
  3: "Variables PEST-L",
  4: "Datos",
  5: "Análisis IA",
  6: "Interpretación",
  7: "Informes",
  8: "Monitoreo",
};

// ── Project card ──────────────────────────────────────────────

function ProjectCard({ project }: { project: PESTELProject & { id: string } }) {
  const router = useRouter();
  const stage = project.currentStage ?? 1;
  const hasAnalysis = stage >= 5;

  function handleClick() {
    if (stage <= 3) {
      router.push(`/centinela/pestel/nuevo`);
    } else if (stage === 4) {
      router.push(`/centinela/pestel/${project.id}/datos`);
    } else if (stage === 5) {
      router.push(`/centinela/pestel/${project.id}/analisis`);
    } else if (stage === 6) {
      router.push(`/centinela/pestel/${project.id}/interpretacion`);
    } else if (stage === 7) {
      router.push(`/centinela/pestel/${project.id}/informes`);
    } else {
      router.push(`/centinela/pestel/${project.id}/monitoreo`);
    }
  }

  function handleCreateModduloProject(e: React.MouseEvent) {
    e.stopPropagation();
    const params = new URLSearchParams({
      from: "pestel",
      pestelProjectId: project.id,
      pestelProjectName: project.nombre,
      pestelProjectType: project.tipo,
    });
    router.push(`/moddulo/proyecto/nuevo?${params.toString()}`);
  }

  return (
    <div
      className="group bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border
        border-gray-eske-20 dark:border-white/10 p-5 flex flex-col gap-4
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
        w-full"
    >
      {/* Clickable body */}
      <button
        type="button"
        onClick={handleClick}
        className="text-left flex flex-col gap-4 flex-1"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden="true">
              {TYPE_ICONS[project.tipo] ?? "📊"}
            </span>
            <div className="min-w-0">
              <h3
                className="font-semibold text-bluegreen-eske-60 dark:text-[#6BA4C6]
                  group-hover:text-bluegreen-eske dark:group-hover:text-[#EAF2F8] transition-colors truncate"
              >
                {project.nombre}
              </h3>
              <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5">
                {TYPE_LABELS[project.tipo] ?? project.tipo} ·{" "}
                {project.territorio?.nombre ?? ""}
              </p>
            </div>
          </div>
          <svg
            className="w-4 h-4 text-gray-eske-30 group-hover:text-bluegreen-eske
              transition-colors shrink-0 mt-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>

        {/* Stage + date */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs bg-bluegreen-eske/10 text-bluegreen-eske
            px-2.5 py-1 rounded-full font-medium">
            Etapa {stage} — {STAGE_LABELS[stage] ?? ""}
          </span>
          {project.createdAt && (
            <span className="text-xs text-gray-eske-50">
              {formatDate(project.createdAt)}
            </span>
          )}
        </div>

        {/* Horizon */}
        <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
          Horizonte: {project.horizonte}{" "}
          {project.horizonte === 1 ? "mes" : "meses"}
        </p>
      </button>

      {/* Iniciar en Moddulo */}
      <div className="border-t border-gray-eske-20 dark:border-white/10 pt-3">
        <button
          type="button"
          onClick={handleCreateModduloProject}
          disabled={!hasAnalysis}
          title={
            hasAnalysis
              ? "Crear un proyecto en Moddulo usando este análisis PEST-L"
              : "Completa al menos un análisis para habilitar esta acción"
          }
          className="w-full flex items-center justify-center gap-2 px-3 py-2
            text-xs font-semibold rounded-lg transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
            border border-orange-eske/40 text-orange-eske
            hover:bg-orange-eske/5 disabled:hover:bg-transparent"
        >
          <span aria-hidden="true">⚡</span>
          Iniciar proyecto en Moddulo
        </button>
      </div>
    </div>
  );
}

// ── Hub page ──────────────────────────────────────────────────

export default function PESTELHubPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<
    (PESTELProject & { id: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/centinela/pestel/project");
      if (!res.ok) return;
      const data = (await res.json()) as {
        projects: (PESTELProject & { id: string })[];
      };
      setProjects(data.projects ?? []);
    } catch {
      // Silent — show empty state
    }
  }, []);

  useEffect(() => {
    loadProjects().finally(() => setLoading(false));
  }, [loadProjects]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white-eske-40 flex items-center
        justify-center">
        <div
          className="w-6 h-6 border-2 border-bluegreen-eske
            border-t-transparent rounded-full animate-spin"
          aria-label="Cargando"
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      {/* Header */}
      <div className="bg-bluegreen-eske">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-start gap-4">
            <span className="text-4xl" aria-hidden="true">
              🛡️
            </span>
            <div>
              <h1 className="text-2xl font-bold text-white">PESTEL</h1>
              <p className="text-sm text-white/75 mt-1 max-w-xl leading-relaxed">
                Análisis PEST-L con IA para proyectos de comunicación política.
                Define el territorio, configura las variables y obtén un análisis
                estratégico trazable y potenciado por IA.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* CTA */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8]">
              Mis proyectos
            </h2>
            {projects.length > 0 && (
              <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5">
                {projects.length}{" "}
                {projects.length === 1 ? "proyecto activo" : "proyectos activos"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/centinela/pestel/nuevo")}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-eske
              text-white rounded-lg text-sm font-medium
              hover:bg-orange-eske-60 transition-colors shadow-sm"
          >
            <span aria-hidden="true">+</span> Nuevo proyecto
          </button>
        </div>

        {/* Project grid */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-16 bg-white-eske dark:bg-[#18324A]
            rounded-xl border border-dashed border-gray-eske-30 dark:border-white/10 text-center">
            <span className="text-5xl" aria-hidden="true">
              🛡️
            </span>
            <div>
              <p className="font-semibold text-black-eske dark:text-[#EAF2F8]">
                No tienes proyectos todavía
              </p>
              <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] mt-1 max-w-sm">
                Crea tu primer proyecto para comenzar un análisis PEST-L con IA.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/centinela/pestel/nuevo")}
              className="px-6 py-2.5 bg-bluegreen-eske text-white rounded-lg
                text-sm font-medium hover:bg-bluegreen-eske-60 transition-colors"
            >
              Crear primer proyecto →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
