// app/moddulo/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PHASE_NAMES, PROJECT_TYPE_LABELS } from "@/types/moddulo.types";
import type { ModduloProject } from "@/types/moddulo.types";

export default function ModduloPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ModduloProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/moddulo/projects", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  function handleDeleted(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  function handleStatusChange(id: string, newStatus: ModduloProject["status"]) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-eske-10 dark:bg-[#112230]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-bluegreen-eske border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      {/* Hero */}
      <section className="relative min-h-50 max-sm:min-h-40 w-full flex items-center justify-center bg-bluegreen-eske overflow-hidden">
        <Image
          src="/images/yanmin_yang.jpg"
          alt="Imagen de fondo Moddulo"
          fill
          style={{ objectFit: "cover" }}
          className="object-cover"
          priority
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-bluegreen-eske dark:bg-bluegreen-eske-80 opacity-75" aria-hidden="true" />
        <div className="relative z-10 text-center text-white-eske px-4 sm:px-6 md:px-8 max-w-7xl mx-auto w-full py-8 max-sm:py-6">
          <h1 className="text-[36px] max-sm:text-2xl leading-tight font-bold">Moddulo</h1>
          <p className="mt-4 max-sm:mt-2 text-[18px] max-sm:text-base leading-relaxed font-light">
            El colaborador estratégico para tus proyectos políticos de alto impacto.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="bg-white-eske dark:bg-[#0B1620] py-12 max-sm:py-8 px-4 sm:px-6 md:px-8">
        <div className="w-[90%] mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl max-sm:text-xl font-semibold text-bluegreen-eske dark:text-[#6BA4C6]">
                Mis proyectos
              </h2>
              <p className="text-base font-light text-gray-eske-60 mt-1">
                {projects.length > 0
                  ? `${projects.length} proyecto${projects.length !== 1 ? "s" : ""} en curso`
                  : "Aquí aparecerán tus proyectos estratégicos"}
              </p>
            </div>
            <Link
              href="/moddulo/proyecto/nuevo"
              className="shrink-0 px-5 py-2.5 bg-bluegreen-eske text-white-eske rounded-lg font-medium hover:bg-bluegreen-eske/90 transition-colors text-sm"
            >
              + Nuevo proyecto
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-bluegreen-eske border-t-transparent" />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDeleted={handleDeleted}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// ==========================================
// TARJETA DE PROYECTO
// ==========================================

const STATUS_COLORS: Record<ModduloProject["status"], string> = {
  draft: "bg-gray-eske-20 text-gray-eske-60",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-gray-eske-20 text-gray-eske-50",
};

const STATUS_LABELS: Record<ModduloProject["status"], string> = {
  draft: "Borrador",
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
  archived: "Archivado",
};

function ProjectCard({
  project,
  onDeleted,
  onStatusChange,
}: {
  project: ModduloProject;
  onDeleted: (id: string) => void;
  onStatusChange: (id: string, status: ModduloProject["status"]) => void;
}) {
  const [kebabOpen, setKebabOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);
  const borderColor = project.color ?? "#026988";

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

  async function handleStatusPatch(newStatus: ModduloProject["status"]) {
    setKebabOpen(false);
    try {
      await fetch(`/api/moddulo/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange(project.id!, newStatus);
    } catch {}
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const r = await fetch(`/api/moddulo/projects/${project.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.ok) onDeleted(project.id!);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  const menuItems: { label: string; onClick: () => void; danger?: boolean }[] = [];
  if (project.status === "active") {
    menuItems.push({ label: "Pausar", onClick: () => handleStatusPatch("paused") });
    menuItems.push({ label: "Archivar", onClick: () => handleStatusPatch("archived") });
  }
  if (project.status === "paused") {
    menuItems.push({ label: "Reactivar", onClick: () => handleStatusPatch("active") });
    menuItems.push({ label: "Archivar", onClick: () => handleStatusPatch("archived") });
  }
  if (project.status === "completed") {
    menuItems.push({ label: "Archivar", onClick: () => handleStatusPatch("archived") });
  }
  if (project.status === "archived") {
    menuItems.push({ label: "Restaurar", onClick: () => handleStatusPatch("active") });
  }
  menuItems.push({
    label: "Eliminar",
    onClick: () => { setKebabOpen(false); setConfirmDelete(true); },
    danger: true,
  });

  return (
    <>
      <div className="relative group">
        <Link
          href={`/moddulo/proyecto/${project.id}/${project.currentPhase}`}
          className="block bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 p-5 hover:border-bluegreen-eske/40 hover:shadow-sm transition-all"
          style={{ borderLeft: `4px solid ${borderColor}` }}
        >
          {/* Title + description — pr-8 reserves space for kebab */}
          <div className="flex-1 min-w-0 mb-3 pr-8">
            <h3 className="font-semibold text-gray-eske-80 dark:text-[#C7D6E0] truncate">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mt-0.5 line-clamp-2">
                {project.description}
              </p>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-gray-eske-50 dark:text-[#9AAEBE] flex-wrap">
            <span className="font-medium text-bluegreen-eske/80">
              {PROJECT_TYPE_LABELS[project.type]}
            </span>
            <span aria-hidden="true">·</span>
            <span>Fase: {PHASE_NAMES[project.currentPhase]}</span>
            <span className={`ml-auto shrink-0 font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status]}`}>
              {STATUS_LABELS[project.status]}
            </span>
          </div>
        </Link>

        {/* Kebab — outside Link so clicks don't navigate */}
        <div className="absolute top-3 right-3 z-10" ref={kebabRef}>
          <button
            type="button"
            aria-label="Opciones del proyecto"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setKebabOpen((o) => !o); }}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-eske-40
              hover:text-gray-eske-70 hover:bg-gray-eske-10 dark:hover:bg-white/10
              transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
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
              {menuItems.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors
                    ${item.danger
                      ? "text-red-eske hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "text-gray-eske-70 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
                    }
                    ${i > 0 && menuItems[i - 1]?.danger === false && item.danger
                      ? "border-t border-gray-eske-10 dark:border-white/10 mt-1 pt-2"
                      : ""
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <DeleteModal
          projectName={project.name}
          isDeleting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

// ==========================================
// MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
// ==========================================

function DeleteModal({
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
            Esta acción es permanente y no se puede deshacer. Se perderá todo el historial
            de conversaciones y fases del proyecto.
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

// ==========================================
// ESTADO VACÍO
// ==========================================

function EmptyState() {
  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 p-12 max-sm:p-8 text-center mb-12">
      <div className="w-16 h-16 bg-bluegreen-eske/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-bluegreen-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-eske-80 dark:text-[#C7D6E0] mb-2">
        Aún no tienes proyectos
      </h2>
      <p className="text-gray-eske-50 dark:text-[#9AAEBE] mb-6 text-sm font-light max-w-sm mx-auto">
        Crea tu primer proyecto estratégico y comienza a trabajar con Moddulo como tu colaborador estratégico
      </p>
      <Link
        href="/moddulo/proyecto/nuevo"
        className="px-6 py-3 bg-bluegreen-eske text-white-eske rounded-lg font-medium hover:bg-bluegreen-eske/90 transition-colors text-sm inline-block"
      >
        Crear primer proyecto
      </Link>
    </div>
  );
}
