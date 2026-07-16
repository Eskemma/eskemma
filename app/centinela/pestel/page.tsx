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

const PESTEL_STATUS_COLORS: Record<string, string> = {
  active:   "",
  paused:   "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-eske-20 text-gray-eske-50",
};

const PESTEL_STATUS_LABELS: Record<string, string> = {
  active:   "Activo",
  paused:   "Pausado",
  archived: "Archivado",
};

const COLOR_SWATCHES = ["#026988", "#248cc1", "#ffa366", "#649941", "#ffd14a", "#d10f3f", "#474747"];

// ── Project card ──────────────────────────────────────────────

type PESTELProjectWithId = PESTELProject & { id: string };

function ProjectCard({
  project,
  onDeleted,
  onUpdated,
  onStatusChanged,
}: {
  project: PESTELProjectWithId;
  onDeleted: (id: string) => void;
  onUpdated: (id: string, patch: { nombre: string; color: string }) => void;
  onStatusChanged: (id: string, newStatus: string) => void;
}) {
  const router = useRouter();
  const [kebabOpen, setKebabOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(project.nombre);
  const [editColor, setEditColor] = useState(project.color ?? "#026988");
  const [saving, setSaving] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);
  const stage = project.currentStage ?? 1;
  const status = project.status ?? "active";
  const isArchived = status === "archived";
  const accentColor = isArchived ? "#9ca3af" : (project.color ?? "#026988");

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
    if (isArchived) return;
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

  async function handleStatusChange(newStatus: string) {
    setKebabOpen(false);
    try {
      await fetch(`/api/centinela/pestel/project/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChanged(project.id, newStatus);
    } catch {}
  }

  async function handleSaveEdit() {
    if (editName.trim().length < 3) return;
    setSaving(true);
    try {
      await fetch(`/api/centinela/pestel/project/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nombre: editName.trim(), color: editColor }),
      });
      onUpdated(project.id, { nombre: editName.trim(), color: editColor });
      setEditOpen(false);
    } catch {} finally {
      setSaving(false);
    }
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

  function buildKebabItems() {
    if (isArchived) {
      return [
        { label: "Activar", onClick: () => handleStatusChange("active"), danger: false },
        null,
        { label: "Eliminar", onClick: () => { setKebabOpen(false); setConfirmDelete(true); }, danger: true },
      ];
    }
    if (status === "paused") {
      return [
        { label: "Editar", onClick: () => { setKebabOpen(false); setEditOpen(true); }, danger: false },
        { label: "Reactivar", onClick: () => handleStatusChange("active"), danger: false },
        { label: "Archivar", onClick: () => handleStatusChange("archived"), danger: false },
        null,
        { label: "Eliminar", onClick: () => { setKebabOpen(false); setConfirmDelete(true); }, danger: true },
      ];
    }
    // active
    return [
      { label: "Editar", onClick: () => { setKebabOpen(false); setEditOpen(true); }, danger: false },
      { label: "Pausar", onClick: () => handleStatusChange("paused"), danger: false },
      { label: "Archivar", onClick: () => handleStatusChange("archived"), danger: false },
      null,
      { label: "Eliminar", onClick: () => { setKebabOpen(false); setConfirmDelete(true); }, danger: true },
    ];
  }

  return (
    <>
      <div
        className="group bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border
          border-gray-eske-20 dark:border-white/10 p-5 flex flex-col gap-4
          hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 w-full min-w-0"
        style={{ borderLeft: `4px solid ${accentColor}` }}
      >
        {/* Header: title-button (flex-1) + kebab (shrink-0) as flex siblings */}
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={navigateToProject}
            disabled={isArchived}
            className="flex items-start gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
          >
            <span className="text-2xl shrink-0 mt-0.5" aria-hidden="true">
              {TYPE_ICONS[project.tipo] ?? "📊"}
            </span>
            <div className="min-w-0">
              <h3
                className={`font-semibold transition-colors truncate ${
                  isArchived
                    ? "text-gray-eske-50"
                    : "text-bluegreen-eske-60 dark:text-[#6BA4C6] group-hover:text-bluegreen-eske dark:group-hover:text-[#EAF2F8]"
                }`}
              >
                {project.nombre}
              </h3>
              <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5 truncate">
                {TYPE_LABELS[project.tipo] ?? project.tipo} ·{" "}
                {project.territorio?.nombre ?? ""}
              </p>
            </div>
          </button>

          {/* Kebab: shrink-0 sibling, never overlaps title */}
          <div className="relative shrink-0" ref={kebabRef}>
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
                {buildKebabItems().map((item, i) =>
                  item === null ? (
                    <div key={`sep-${i}`} className="border-t border-gray-eske-10 dark:border-white/10 my-1" />
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        item.danger
                          ? "text-red-eske hover:bg-red-50 dark:hover:bg-red-900/20"
                          : "text-gray-eske-70 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Body: stage + date + horizon + status badge */}
        <button
          type="button"
          onClick={navigateToProject}
          disabled={isArchived}
          className="text-left flex flex-col gap-4 disabled:cursor-default"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isArchived
                ? "bg-gray-eske-20 text-gray-eske-50"
                : "bg-bluegreen-eske/10 text-bluegreen-eske"
            }`}>
              Etapa {stage} — {STAGE_LABELS[stage] ?? ""}
            </span>
            {status !== "active" && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PESTEL_STATUS_COLORS[status]}`}>
                {PESTEL_STATUS_LABELS[status]}
              </span>
            )}
            {project.createdAt && (
              <span className="text-xs text-gray-eske-50">
                {formatDate(project.createdAt)}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
            Horizonte: {project.horizonte}{" "}
            {project.horizonte === 1 ? "mes" : "meses"}
          </p>
        </button>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}
        >
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">
            <h3 className="font-semibold text-black-eske dark:text-[#EAF2F8] text-base">
              Editar proyecto
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="pestel-edit-name" className="block text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE] mb-1">
                  Nombre
                </label>
                <input
                  id="pestel-edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-white focus:outline-none focus:ring-1 focus:ring-bluegreen-eske"
                />
                <p className="text-xs text-gray-eske-40 dark:text-[#6D8294] mt-0.5">{editName.length}/100</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE] mb-2">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setEditColor(hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        editColor === hex ? "border-black-eske scale-110" : "border-transparent"
                      }`}
                      aria-label={`Color ${hex}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-eske-60 hover:text-gray-eske-80 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving || editName.trim().length < 3}
                className="px-4 py-2 text-sm font-medium bg-bluegreen-eske text-white rounded-lg hover:bg-bluegreen-eske/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

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

  function handleUpdated(id: string, patch: { nombre: string; color: string }) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }

  function handleStatusChanged(id: string, newStatus: string) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: newStatus as PESTELProject["status"] } : p
      )
    );
  }

  const activeAndPaused = projects.filter((p) => (p.status ?? "active") !== "archived");
  const archived = projects.filter((p) => (p.status ?? "active") === "archived");
  const activeCount = projects.filter((p) => (p.status ?? "active") === "active").length;

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
            {activeCount > 0 && (
              <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5">
                {activeCount}{" "}
                {activeCount === 1 ? "proyecto activo" : "proyectos activos"}
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

        {/* Project grid — active + paused */}
        {activeAndPaused.length === 0 && archived.length === 0 ? (
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
        ) : activeAndPaused.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAndPaused.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
                onStatusChanged={handleStatusChanged}
              />
            ))}
          </div>
        ) : null}

        {/* Archived section */}
        {archived.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-gray-eske-60 dark:text-[#9AAEBE] uppercase tracking-wide">
              Archivados
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {archived.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDeleted={handleDeleted}
                  onUpdated={handleUpdated}
                  onStatusChanged={handleStatusChanged}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
