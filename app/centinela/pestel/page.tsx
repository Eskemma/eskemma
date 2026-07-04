"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  3: "Variables PESTEL",
  4: "Datos",
  5: "Análisis IA",
  6: "Interpretación",
  7: "Informes",
  8: "Monitoreo",
};

// ── Project card ──────────────────────────────────────────────

type PESTELProjectWithId = PESTELProject & { id: string };

function ProjectCard({
  project,
  onDeleted,
  onArchived,
}: {
  project: PESTELProjectWithId;
  onDeleted: (id: string) => void;
  onArchived: (id: string) => void;
}) {
  const router = useRouter();
  const [kebabOpen, setKebabOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);
  const stage = project.currentStage ?? 1;
  const accentColor = project.color ?? "#026988";

  useEffect(() => {
    if (!kebabOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [kebabOpen]);

  function navigateToProject() {
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

  async function handleArchive() {
    setKebabOpen(false);
    try {
      await fetch(`/api/centinela/pestel/project/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: false }),
      });
      onArchived(project.id);
    } catch {}
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const r = await fetch(`/api/centinela/pestel/project/${project.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.ok) onDeleted(project.id);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <div
        className="group relative bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border
          border-gray-eske-20 dark:border-white/10 p-5 flex flex-col gap-4
          hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 w-full"
        style={{ borderLeft: `4px solid ${accentColor}` }}
      >
        {/* Clickable body */}
        <button
          type="button"
          onClick={navigateToProject}
          className="text-left flex flex-col gap-4 flex-1 pr-8"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
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

        {/* Kebab — outside navigable button */}
        <div className="absolute top-3 right-3 z-10" ref={kebabRef}>
          <button
            type="button"
            aria-label="Opciones del proyecto"
            onClick={() => setKebabOpen((o) => !o)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-eske-40
              hover:text-gray-eske-70 hover:bg-gray-eske-10 dark:hover:bg-white/10
              transition-colors focus-visible:opacity-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>

          {kebabOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-44 bg-white-eske dark:bg-[#1E3A52]
                rounded-lg shadow-lg border border-gray-eske-20 dark:border-white/10 py-1 z-20"
            >
              <button
                type="button"
                onClick={handleArchive}
                className="w-full text-left px-3 py-2 text-sm text-gray-eske-70 dark:text-[#C7D6E0]
                  hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
              >
                Archivar
              </button>
              <div className="border-t border-gray-eske-10 dark:border-white/10 my-1" />
              <button
                type="button"
                onClick={() => { setKebabOpen(false); setConfirmDelete(true); }}
                className="w-full text-left px-3 py-2 text-sm text-red-eske
                  hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <PESTELDeleteModal
          projectName={project.nombre}
          isDeleting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

// ── Delete modal ──────────────────────────────────────────────

function PESTELDeleteModal({
  projectName,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-gray-eske-80 dark:text-[#C7D6E0] text-base">
            ¿Eliminar «{projectName}»?
          </h3>
          <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] mt-1.5 leading-relaxed">
            Esta acción es permanente. Se eliminarán el proyecto y todos los análisis,
            variables, fuentes de datos y alertas asociadas.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-eske-60 hover:text-gray-eske-80
              transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium bg-red-eske text-white-eske rounded-lg
              hover:bg-red-eske/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hub page ──────────────────────────────────────────────────

export default function PESTELHubPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<PESTELProjectWithId[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/centinela/pestel/project");
      if (!res.ok) return;
      const data = (await res.json()) as { projects: PESTELProjectWithId[] };
      setProjects(data.projects ?? []);
    } catch {
      // Silent — show empty state
    }
  }, []);

  useEffect(() => {
    loadProjects().finally(() => setLoading(false));
  }, [loadProjects]);

  function handleDeleted(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  function handleArchived(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white-eske-40 flex items-center justify-center">
        <div
          className="w-6 h-6 border-2 border-bluegreen-eske border-t-transparent rounded-full animate-spin"
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
            <span className="text-4xl" aria-hidden="true">🛡️</span>
            <div>
              <h1 className="text-2xl font-bold text-white">PESTEL</h1>
              <p className="text-sm text-white/75 mt-1 max-w-xl leading-relaxed">
                Análisis PESTEL con IA para proyectos de comunicación política.
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
            <span className="text-5xl" aria-hidden="true">🛡️</span>
            <div>
              <p className="font-semibold text-black-eske dark:text-[#EAF2F8]">
                No tienes proyectos todavía
              </p>
              <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] mt-1 max-w-sm">
                Crea tu primer proyecto para comenzar un análisis PESTEL con IA.
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
              <ProjectCard
                key={project.id}
                project={project}
                onDeleted={handleDeleted}
                onArchived={handleArchived}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
