// app/components/componentsCursos/listado/CourseCardList.tsx
// ============================================================
// TARJETA DE CURSO EN FORMATO LISTA (HORIZONTAL)
// Inspirada en PostCardList.tsx pero para cursos
// ============================================================


import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import type { CourseCardItem } from "@/types/course.types";
import type { UserRole } from "@/types/subscription.types";
import { 
  canAccessCourse, 
  getRoleBadgeColor,
  getUpgradeMessage 
} from "@/utils/courseAccessUtils";
import { DIFFICULTY_CONFIG, ROLE_PRESENTATION } from "@/lib/constants/courses";

interface CourseCardListProps {
  course: CourseCardItem;
  userRole?: UserRole | null;
}

export default function CourseCardList({ course, userRole: userRoleProp }: CourseCardListProps) {
  const { user } = useAuth();
  const userRole = userRoleProp !== undefined ? userRoleProp : (user?.role || null);
  
  const hasAccess = canAccessCourse(userRole, course.requiredRole);
  const badgeColor = getRoleBadgeColor(course.requiredRole);
  const difficultyInfo = DIFFICULTY_CONFIG[course.difficulty];
  const roleInfo = ROLE_PRESENTATION[course.requiredRole];
  
  // Formatear duración
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    return `${hours}h ${mins}m`;
  };

  // Icono según tipo de curso
  const getTypeIcon = () => {
    switch (course.type) {
      case "workshop": return "🔧";
      case "masterclass": return "🎓";
      default: return "📚";
    }
  };

  return (
    <article className="flex flex-col sm:flex-row gap-4 sm:gap-6 bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-4 sm:p-5 border border-gray-eske-20 dark:border-white/10">
      {/* Imagen - Responsive */}
      <div className="w-full sm:w-48 md:w-64 shrink-0 relative h-40 sm:h-auto bg-linear-to-br from-blue-eske-40 to-bluegreen-eske rounded-lg overflow-hidden">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={`Imagen del curso: ${course.title}`}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {getTypeIcon()}
          </div>
        )}
        
        {/* Badges sobre imagen en móvil */}
        <div className="absolute top-2 right-2 sm:hidden">
          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${badgeColor}`}>
            {roleInfo.label}
          </span>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 flex flex-col">
        {/* Badges y Categoría (Desktop) */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className={`hidden sm:inline-block px-3 py-1 text-xs font-semibold rounded-full ${badgeColor}`}>
              {roleInfo.label}
            </span>
            <span className="bg-gray-eske-10 dark:bg-[#21425E] text-black-eske dark:text-[#C7D6E0] font-normal px-2 py-1 rounded-full text-xs">
              {course.category}
            </span>
          </div>
          <div className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full ${difficultyInfo.colorClass}`}>
             {difficultyInfo.label}
          </div>
        </div>

        {/* Título */}
        <h3 className="text-xl sm:text-2xl font-semibold text-bluegreen-eske-60 dark:text-[#6BA4C6] mb-2 hover:text-bluegreen-eske dark:hover:text-[#EAF2F8] transition-colors">
          <Link 
            href={`/cursos/${course.slug}`}
            className="focus-ring-primary rounded"
          >
            {course.title}
          </Link>
        </h3>

        {/* Descripción */}
        <p className="text-black-eske dark:text-[#9AAEBE] text-sm sm:text-base mb-4 line-clamp-2 sm:line-clamp-3 font-normal">
          {course.description}
        </p>

        {/* Footer: Metadata y Botón */}
        <div className="mt-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-eske-10 dark:border-white/10">
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-black-eske dark:text-[#9AAEBE] font-normal">
            <div className="flex items-center gap-1">
              <span>{getTypeIcon()}</span>
              <span className="capitalize">{course.type === "workshop" ? "Taller" : course.type}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatDuration(course.estimatedDuration)}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>{course.enrolledStudents}</span>
            </div>
          </div>

          {/* Botón */}
          <div className="shrink-0">
            {hasAccess ? (
              <Link
                href={`/cursos/${course.slug}`}
                className="inline-block px-6 py-2 bg-yellow-eske hover:bg-yellow-eske-60 text-black-eske font-bold rounded-lg transition-colors focus-ring-primary text-sm shadow-sm active:scale-95"
              >
                Acceder al curso →
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-black-eske/60 dark:text-[#9AAEBE] font-normal max-w-[120px] text-right leading-tight">
                  {getUpgradeMessage(course.requiredRole as any)}
                </span>
                <button
                  disabled
                  className="bg-gray-eske-30 dark:bg-[#21425E] text-gray-eske-70 dark:text-[#6D8294] font-medium py-2 px-4 rounded-lg cursor-not-allowed text-sm"
                >
                  Restringido
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
