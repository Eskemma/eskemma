// app/moddulo/proyecto/[projectId]/layout.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import PhaseNav from "@/app/moddulo/components/PhaseNav";
import type { RDAItem, PhaseId, PhaseStatus } from "@/types/moddulo.types";
import { PHASE_ORDER } from "@/types/moddulo.types";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const projectId = params?.projectId as string;
  const pathname = usePathname();
  // Mismo patrón que PhaseNav.tsx para derivar la fase activa — las rutas son
  // carpetas estáticas por fase, no [phaseId] dinámico.
  const isEvaluacionActive = pathname.includes("/evaluacion");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  // RDA acumulativo del proyecto — se lee UNA vez aquí (el layout envuelve
  // las 9 páginas de fase sin pertenecer a ninguna) y se pasa a PhaseNav,
  // en vez de que cada page.tsx de fase traiga su propia copia.
  const [rda, setRda] = useState<Record<string, RDAItem>>({});
  // Estados reales de las 9 fases — antes nunca se cableaba, así que el
  // estado "completada" del sidebar nunca se renderizaba en producción.
  const [phaseStatuses, setPhaseStatuses] = useState<Partial<Record<PhaseId, PhaseStatus>>>({});
  // Nombre del proyecto — mostrado en el breadcrumb del header.
  const [projectName, setProjectName] = useState<string>("");

  // Bloquear scroll del body — el scroll vive dentro del chat, no en la página
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/moddulo/projects/${projectId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.project?.rda) setRda(data.project.rda);
        if (data?.project?.name) setProjectName(data.project.name);
        if (data?.project?.phases) {
          const statuses: Partial<Record<PhaseId, PhaseStatus>> = {};
          for (const phaseId of PHASE_ORDER) {
            const s = data.project.phases[phaseId]?.status;
            if (s) statuses[phaseId] = s;
          }
          setPhaseStatuses(statuses);
        }
      })
      .catch(() => { /* no-op — el sidebar simplemente no muestra estados */ });
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-eske-60">Proyecto no especificado</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] bg-gray-eske-10 dark:bg-[#0B1620] flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="bg-bluegreen-eske text-white-eske py-3 px-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Hamburger — mobile abre drawer, desktop colapsa sidebar */}
            <button
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setDesktopSidebarOpen((v) => !v);
                } else {
                  setMobileSidebarOpen(true);
                }
              }}
              className="p-2 -ml-2 rounded-lg hover:bg-white-eske/10 transition-colors shrink-0"
              aria-label="Menú de fases"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Back link */}
            <Link
              href="/moddulo"
              className="text-sm text-white-eske/70 hover:text-white-eske inline-flex items-center gap-1 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Mis Proyectos</span>
            </Link>

            <span className="text-white-eske/50 shrink-0">/</span>
            <span className="font-medium text-sm shrink-0">Moddulo</span>

            {projectName && (
              <>
                <span className="text-white-eske/50 shrink-0">-</span>
                <span className="text-sm text-white-eske truncate min-w-0 max-w-[100px] sm:max-w-[220px] md:max-w-[420px]">
                  {projectName}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Descarga consolidada de todos los informes del proyecto —
                oculta por completo (no solo deshabilitada) antes de F9. */}
            {isEvaluacionActive && (
              <button
                className="p-2 rounded-lg hover:bg-white-eske/10 transition-colors text-white-eske/80 hover:text-white-eske"
                title="Exportar proyecto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar — animado con width transition */}
        <div
          className={`hidden lg:block shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
            desktopSidebarOpen ? "w-56" : "w-0"
          }`}
        >
          <div className="w-56 h-full">
            <PhaseNav projectId={projectId} rda={rda} phaseStatuses={phaseStatuses} />
          </div>
        </div>

        {/* Mobile sidebar overlay — siempre en el DOM, animado con CSS */}
        <div
          className={`lg:hidden fixed inset-0 z-50 flex transition-all duration-300 ${
            mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
          />

          {/* Drawer */}
          <div
            className={`relative w-72 max-w-[85vw] bg-white-eske dark:bg-[#18324A] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 bg-bluegreen-eske text-white-eske shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Moddulo</span>
                <span className="text-white-eske/50 text-xs">/ Proyecto</span>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white-eske/10 transition-colors"
                aria-label="Cerrar menú"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Phase nav */}
            <div className="flex-1 overflow-hidden">
              <PhaseNav
                projectId={projectId}
                rda={rda}
                phaseStatuses={phaseStatuses}
                onLinkClick={() => setMobileSidebarOpen(false)}
              />
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
