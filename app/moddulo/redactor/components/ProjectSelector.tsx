// app/moddulo/redactor/components/ProjectSelector.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RedactorProject, CreateProjectInput } from "@/types/redactor.types";
import { getPlanLimits } from "@/lib/redactor/constants";
import CreateProjectModal from "./CreateProjectModal";

interface ProjectSelectorProps {
  userId: string;
  userPlan: string | null | undefined;
  onProjectSelected: (project: RedactorProject) => void;
  isVisitor?: boolean; // ⭐ NUEVO: Indica si es visitante
}

export default function ProjectSelector({
  userId,
  userPlan,
  onProjectSelected,
  isVisitor = false, // ⭐ Default false
}: ProjectSelectorProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<RedactorProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limits = getPlanLimits(userPlan);

  // Cargar proyectos al montar
  useEffect(() => {
    if (isVisitor) {
      loadVisitorProjects();
    } else {
      loadProjects();
    }
  }, [userId, isVisitor]);

  /**
   * Carga dinámica de proyectos con lazy loading
   */
  const loadProjects = async () => {
    try {
      setIsLoading(true);
      
      // Import dinámico del módulo de proyectos
      const projectsModule = await import("@/lib/redactor/projects");
      const userProjects = await projectsModule.getUserProjects(userId);
      
      setProjects(userProjects);
    } catch (err: any) {
      console.error("Error al cargar proyectos:", err);
      setError(err.message || "No se pudieron cargar los proyectos");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ⭐ NUEVO: Cargar proyectos de visitantes desde localStorage
   */
  const loadVisitorProjects = () => {
    try {
      setIsLoading(true);
      
      const stored = localStorage.getItem("redactor_visitor_projects");
      if (stored) {
        const visitorProjects: RedactorProject[] = JSON.parse(stored);
        setProjects(visitorProjects);
      } else {
        setProjects([]);
      }
    } catch (err: any) {
      console.error("Error al cargar proyectos de visitante:", err);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Crea un nuevo proyecto con validación de límites
   */
  const handleCreateProject = async (input: CreateProjectInput) => {
    try {
      setIsCreating(true);
      setError(null);

      if (isVisitor) {
        // ⭐ Visitante: Crear proyecto en localStorage
        
        // Verificar límite (1 proyecto para visitantes)
        if (projects.length >= 1) {
          throw new Error("Has alcanzado el límite de 1 proyecto para usuarios no registrados. Regístrate para crear más proyectos.");
        }

        // Crear proyecto "virtual"
        const newProject: RedactorProject = {
          id: `visitor_${Date.now()}`,
          userId: "visitor",
          name: input.name.trim(),
          description: input.description?.trim() || "",
          configuration: null as any,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
          stats: {
            totalGenerations: 0,
            lastGenerationAt: null,
          },
          isActive: true,
          isArchived: false,
        };

        // Guardar en localStorage
        const updatedProjects = [...projects, newProject];
        localStorage.setItem("redactor_visitor_projects", JSON.stringify(updatedProjects));
        
        setProjects(updatedProjects);
        
        // Seleccionar el nuevo proyecto
        await handleSelectProject(newProject);
        
      } else {
        // Usuario autenticado: Crear en Firestore
        const projectsModule = await import("@/lib/redactor/projects");
        
        // Verificar límite
        const canCreate = await projectsModule.canCreateMoreProjects(userId, limits.maxProjects);
        if (!canCreate) {
          throw new Error(
            `Has alcanzado el límite de ${limits.maxProjects} proyecto${
              limits.maxProjects === 1 ? "" : "s"
            } de tu plan. Mejora tu plan para crear más proyectos.`
          );
        }

        // Crear proyecto
        const newProject = await projectsModule.createProject(userId, input);

        // Recargar proyectos
        await loadProjects();

        // Seleccionar el nuevo proyecto
        await handleSelectProject(newProject);
      }
      
    } catch (err: any) {
      console.error("Error al crear proyecto:", err);
      setError(err.message || "No se pudo crear el proyecto");
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Selecciona y activa un proyecto
   */
  const handleSelectProject = async (project: RedactorProject) => {
    try {
      if (!isVisitor) {
        // Usuario autenticado: Activar en Firestore
        const projectsModule = await import("@/lib/redactor/projects");
        await projectsModule.setActiveProject(userId, project.id);
      }
      
      // Notificar al padre (tanto visitantes como autenticados)
      onProjectSelected(project);
    } catch (err: any) {
      console.error("Error al seleccionar proyecto:", err);
      setError(err.message || "No se pudo seleccionar el proyecto");
    }
  };

  const handleOpenCreateModal = () => {
    setError(null);
    setShowCreateModal(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-eske-10 dark:bg-[#0B1620]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-bluegreen-eske border-t-transparent" />
          <p className="mt-4 text-black-eske-20 dark:text-[#9AAEBE]">Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      {/* Header */}
      <div className="bg-white-eske dark:bg-[#112230] border-b border-gray-eske-20 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/moddulo"
            className="inline-flex items-center gap-2 text-bluegreen-eske hover:text-bluegreen-eske/80 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Volver al Hub</span>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-bluegreen-eske mb-2">Redactor Político</h1>
              <p className="text-sm text-black-eske-20 dark:text-[#9AAEBE]">
                Selecciona un proyecto o crea uno nuevo para comenzar
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">Proyectos</p>
              <p className="text-2xl font-bold text-bluegreen-eske">
                {projects.length} / {limits.maxProjects === 999 ? "∞" : limits.maxProjects}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-900 dark:text-red-300 p-4 rounded-r-lg mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Botón crear proyecto */}
        <div className="mb-6">
          <button
            onClick={handleOpenCreateModal}
            disabled={projects.length >= limits.maxProjects}
            className="
              w-full sm:w-auto
              flex items-center justify-center gap-2
              px-6 py-3
              bg-bluegreen-eske
              text-white-eske
              font-semibold
              rounded-lg
              hover:bg-bluegreen-eske/90
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear Nuevo Proyecto
          </button>
          {projects.length >= limits.maxProjects && (
            <p className="text-sm text-red-600 mt-2">
              Has alcanzado el límite de proyectos.{" "}
              <Link href="/#suscripciones" className="underline font-medium">
                Mejora tu plan
              </Link>
            </p>
          )}
        </div>

        {/* Lista de proyectos */}
        {projects.length === 0 ? (
          <div className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-24 h-24 mx-auto text-gray-eske-30 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-xl font-bold text-gray-eske-80 dark:text-[#C7D6E0] mb-2">
              Aún no tienes proyectos
            </h3>
            <p className="text-gray-eske-60 dark:text-[#9AAEBE] mb-6">
              Crea tu primer proyecto para comenzar a generar contenido político profesional
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="
                inline-flex items-center gap-2
                px-6 py-3
                bg-bluegreen-eske
                text-white-eske
                font-semibold
                rounded-lg
                hover:bg-bluegreen-eske/90
                transition-colors
              "
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Mi Primer Proyecto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelectProject(project)}
                className="
                  bg-white-eske dark:bg-[#18324A]
                  rounded-lg
                  shadow-md
                  p-6
                  text-left
                  hover:shadow-xl hover:-translate-y-1
                  transition-all duration-300
                  border-2 border-transparent dark:border-white/10
                  hover:border-bluegreen-eske dark:hover:border-bluegreen-eske-40
                  focus:outline-none focus:ring-2 focus:ring-bluegreen-eske focus:ring-offset-2
                "
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-bluegreen-eske mb-1">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-black-eske-20 dark:text-[#9AAEBE] line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                  {project.isActive && (
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                      Activo
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>{project.stats.totalGenerations} posts</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      Actualizado {new Date(project.updatedAt).toLocaleDateString("es-MX")}
                    </span>
                  </div>
                </div>

                {/* Context badge */}
                {project.configuration && (
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`
                        text-xs font-medium px-2 py-1 rounded-full
                        ${
                          project.configuration.context === "electoral"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }
                      `}
                    >
                      {project.configuration.context === "electoral"
                        ? "🗳️ Electoral"
                        : "🏛️ Gubernamental"}
                    </span>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                      {project.configuration.country === "mexico" ? "🇲🇽 México" : project.configuration.country}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de creación */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
        isLoading={isCreating}
      />
    </div>
  );
}
