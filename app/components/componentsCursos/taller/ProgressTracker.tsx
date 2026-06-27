// app/components/componentsCursos/taller/ProgressTracker.tsx
// ============================================================
// COMPONENTE DE PROGRESO
// Muestra el avance del usuario en el taller
// ============================================================


import { TALLER_MODULES } from "@/lib/cursos/taller/diagnostico-electoral/config";
import type { UserWorkshopProgress } from "@/types/firestore.types";

interface ProgressTrackerProps {
  progress: UserWorkshopProgress | null;
  variant?: "compact" | "full";
  showDetails?: boolean;
}

export default function ProgressTracker({ 
  progress, 
  variant = "compact",
  showDetails = false 
}: ProgressTrackerProps) {
  
  // Calcular estadísticas
  const totalSessions = TALLER_MODULES.reduce((acc, m) => acc + m.sessions.length, 0);
  const completedSessions = progress ? Object.keys(progress.sessionsCompleted || {}).length : 0;
  const percentage = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
  
  // Calcular progreso por módulo
  const moduleProgress = TALLER_MODULES.map(module => {
    const moduleCompleted = module.sessions.filter(s => 
      progress?.sessionsCompleted?.[s.id]
    ).length;
    const moduleTotal = module.sessions.length;
    const modulePercentage = moduleTotal > 0 ? (moduleCompleted / moduleTotal) * 100 : 0;
    
    return {
      id: module.id,
      title: module.title,
      completed: moduleCompleted,
      total: moduleTotal,
      percentage: modulePercentage,
    };
  });

  if (variant === "compact") {
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-black-eske dark:text-[#C7D6E0] font-normal">Progreso general</span>
          <span className="font-medium text-bluegreen-eske">{Math.round(percentage)}%</span>
        </div>
        <div className="w-full bg-gray-eske-20 dark:bg-[#21425E] rounded-full h-2">
          <div
            className="bg-bluegreen-eske h-2 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showDetails && (
          <p className="text-xs text-black-eske/60 dark:text-[#9AAEBE] font-normal">
            {completedSessions} de {totalSessions} sesiones completadas
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progreso general */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg dark:text-[#EAF2F8]">Tu progreso</h3>
        <div className="flex justify-between text-sm">
          <span className="text-black-eske dark:text-[#C7D6E0] font-normal">Completado</span>
          <span className="font-medium text-bluegreen-eske">{Math.round(percentage)}%</span>
        </div>
        <div className="w-full bg-gray-eske-20 dark:bg-[#21425E] rounded-full h-3">
          <div
            className="bg-bluegreen-eske h-3 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-sm text-black-eske dark:text-[#C7D6E0] font-normal">
          {completedSessions} de {totalSessions} sesiones completadas
        </p>
      </div>

      {/* Progreso por módulo */}
      <div className="space-y-4">
        <h4 className="font-medium text-black-eske dark:text-[#C7D6E0]">Detalle por módulo</h4>
        {moduleProgress.map(module => (
          <div key={module.id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-black-eske dark:text-[#C7D6E0] font-normal">{module.title}</span>
              <span className="font-medium">
                {module.completed}/{module.total}
              </span>
            </div>
            <div className="w-full bg-gray-eske-20 rounded-full h-2">
              <div
                className="bg-bluegreen-eske h-2 rounded-full transition-all"
                style={{ width: `${module.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tiempo estimado restante */}
      {progress && (
        <div className="pt-4 border-t border-gray-eske-20 dark:border-white/10">
          <p className="text-sm text-black-eske dark:text-[#C7D6E0] font-normal">
            <span className="font-medium">Tiempo restante estimado:</span>{' '}
            {Math.round((totalSessions - completedSessions) * 0.75)} horas
          </p>
        </div>
      )}
    </div>
  );
}