// app/moddulo/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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
      .catch(() => { })
      .finally(() => setIsLoading(false));
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-eske-10 dark:bg-[#112230]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-bluegreen-eske border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      {/* Hero — mismo patrón que servicios/ */}
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
          <h1 className="text-[36px] max-sm:text-2xl leading-tight font-bold">
            Moddulo
          </h1>
          <p className="mt-4 max-sm:mt-2 text-[18px] max-sm:text-base leading-relaxed font-light">
            El colaborador estratégico para tus proyectos políticos de alto impacto.
          </p>
        </div>
      </section>

      {/* Cuerpo del hub */}
      <section className="bg-white-eske dark:bg-[#0B1620] py-12 max-sm:py-8 px-4 sm:px-6 md:px-8">
        <div className="w-[90%] mx-auto max-w-7xl">

          {/* Encabezado de sección + CTA */}
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

          {/* Lista de proyectos */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-bluegreen-eske border-t-transparent" />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
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

function ProjectCard({ project }: { project: ModduloProject }) {
  const statusColors: Record<ModduloProject["status"], string> = {
    draft: "bg-gray-eske-20 text-gray-eske-60",
    active: "bg-green-100 text-green-700",
    paused: "bg-yellow-100 text-yellow-700",
    completed: "bg-blue-100 text-blue-700",
    archived: "bg-gray-eske-20 text-gray-eske-50",
  };

  const statusLabels: Record<ModduloProject["status"], string> = {
    draft: "Borrador",
    active: "Activo",
    paused: "Pausado",
    completed: "Completado",
    archived: "Archivado",
  };

  const borderColor = project.color ?? "#026988";

  return (
    <Link
      href={`/moddulo/proyecto/${project.id}/${project.currentPhase}`}
      className="block bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 p-5 hover:border-bluegreen-eske/40 hover:shadow-sm transition-all"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-eske-80 dark:text-[#C7D6E0] truncate">{project.name}</h3>
          {project.description && (
            <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mt-0.5 line-clamp-2">{project.description}</p>
          )}
        </div>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[project.status]}`}>
          {statusLabels[project.status]}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-eske-50 dark:text-[#9AAEBE]">
        <span className="font-medium text-bluegreen-eske/80">
          {PROJECT_TYPE_LABELS[project.type]}
        </span>
        <span>·</span>
        <span>Fase actual: {PHASE_NAMES[project.currentPhase]}</span>
      </div>
    </Link>
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
