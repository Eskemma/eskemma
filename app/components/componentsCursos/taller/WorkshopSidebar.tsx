// app/components/componentsCursos/taller/WorkshopSidebar.tsx
// ============================================================
// SIDEBAR DE NAVEGACIÓN DEL TALLER
// Muestra módulos, sesiones y progreso
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TALLER_MODULES } from "@/lib/cursos/taller/diagnostico-electoral/config";
import type { UserWorkshopProgress } from "@/types/firestore.types";

interface WorkshopSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  progress: UserWorkshopProgress | null;
  currentPath: string;
}

export default function WorkshopSidebar({ 
  isOpen, 
  onClose, 
  progress,
  currentPath 
}: WorkshopSidebarProps) {
  const [expandedModules, setExpandedModules] = useState<string[]>(["modulo-1-fundamentos"]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const isSessionCompleted = (sessionId: string): boolean => {
    return !!progress?.sessionsCompleted?.[sessionId];
  };

  const isCurrentSession = (sessionId: string): boolean => {
    return currentPath.includes(sessionId);
  };

  // Calcular progreso total
  const totalSessions = TALLER_MODULES.reduce((acc, m) => acc + m.sessions.length, 0);
  const completedSessions = progress ? Object.keys(progress.sessionsCompleted || {}).length : 0;
  const progressPercentage = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  return (
    <aside
      className={`
        fixed top-0 left-0 z-40 w-80 h-screen bg-white-eske dark:bg-[#0B1620] border-r border-gray-eske-20 dark:border-white/10
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
      aria-label="Sidebar de navegación del taller"
    >
      <div className="h-full px-3 py-4 overflow-y-auto">
        {/* Header del sidebar */}
        <div className="mb-6 px-2">
          <h2 className="text-xl font-bold text-bluegreen-eske">Taller de Diagnóstico Electoral</h2>
          
          {/* Barra de progreso general */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-black-eske dark:text-[#C7D6E0] font-normal mb-1">
              <span>Progreso general</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-eske-20 dark:bg-[#21425E] rounded-full h-2">
              <div
                className="bg-bluegreen-eske h-2 rounded-full transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-2">
              {completedSessions} de {totalSessions} sesiones completadas
            </p>
          </div>
        </div>

        {/* Módulos y sesiones */}
        <nav className="space-y-2" aria-label="Módulos del taller">
          {TALLER_MODULES.map((module, moduleIndex) => {
            const moduleCompleted = module.sessions.every(s => isSessionCompleted(s.id));
            
            return (
              <div key={module.id} className="border border-gray-eske-20 dark:border-white/10 rounded-lg overflow-hidden">
                {/* Módulo header (clickeable) */}
                <button
                  onClick={() => toggleModule(module.id)}
                  className={`
                    w-full flex items-center justify-between p-3 text-left
                    ${moduleCompleted ? 'bg-green-eske-10 dark:bg-green-eske/20' : 'bg-gray-eske-10 dark:bg-[#112230]'}
                    hover:bg-gray-eske-20 dark:hover:bg-white/5 transition-colors
                    focus-ring-primary
                  `}
                  aria-expanded={expandedModules.includes(module.id)}
                  aria-controls={`module-${module.id}-sessions`}
                >
                  <div className="flex-1">
                    <span className="text-xs text-black-eske dark:text-[#9AAEBE] font-normal">Módulo {moduleIndex + 1}</span>
                    <h3 className="font-medium flex items-center gap-2 dark:text-[#C7D6E0]">
                      {module.title}
                      {moduleCompleted && (
                        <span className="text-green-eske" aria-label="Módulo completado">✓</span>
                      )}
                    </h3>
                  </div>
                  <svg
                    className={`w-5 h-5 transition-transform ${expandedModules.includes(module.id) ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Lista de sesiones */}
                {expandedModules.includes(module.id) && (
                  <ul
                    id={`module-${module.id}-sessions`}
                    className="p-2 space-y-1 bg-white-eske dark:bg-[#18324A]"
                    aria-label={`Sesiones del ${module.title}`}
                  >
                    {module.sessions.map((session) => {
                      const completed = isSessionCompleted(session.id);
                      const current = isCurrentSession(session.id);
                      
                      return (
                        <li key={session.id}>
                          <Link
                            href={`/cursos/taller-diagnostico-electoral/${module.id}/${session.id}`}
                            className={`
                              flex items-center gap-2 p-2 rounded-lg text-sm
                              ${current 
                                ? 'bg-bluegreen-eske text-white' 
                                : completed
                                  ? 'text-green-eske-70 dark:text-green-eske-30 hover:bg-gray-eske-10 dark:hover:bg-white/5'
                                  : 'text-black-eske dark:text-[#C7D6E0] font-normal hover:bg-gray-eske-10 dark:hover:bg-white/5'
                              }
                              transition-colors focus-ring-primary
                            `}
                            aria-current={current ? 'page' : undefined}
                          >
                            <span className="w-4 h-4 shrink-0">
                              {completed ? (
                                <span className="text-green-eske">✓</span>
                              ) : (
                                <span className="w-2 h-2 bg-gray-eske-40 rounded-full block mx-auto" />
                              )}
                            </span>
                            <span className="flex-1">{session.title}</span>
                            <span className="text-xs opacity-70">
                              {session.estimatedDuration}min
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer del sidebar */}
        <div className="mt-6 pt-4 border-t border-gray-eske-20 dark:border-white/10">
          <Link
            href="/cursos"
            className="flex items-center gap-2 text-sm text-black-eske dark:text-[#9AAEBE] font-normal hover:text-bluegreen-eske dark:hover:text-[#4791B3] p-2 rounded-lg transition-colors focus-ring-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Volver a cursos</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
