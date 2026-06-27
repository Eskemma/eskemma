// app/cursos/components/CourseCard.tsx
// ============================================================
// TARJETA INDIVIDUAL DE CURSO
// Inspirada en PostCardList.tsx pero adaptada para cursos
// ============================================================


import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import type { CourseCardItem } from "@/types/course.types";
import type { UserRole } from "@/types/subscription.types";
import { canAccessCourse, getRoleBadgeColor, getUpgradeMessage } from "@/utils/courseAccessUtils";
import { DIFFICULTY_CONFIG, ROLE_PRESENTATION } from "@/lib/constants/courses";

interface CourseCardProps {
  course: CourseCardItem;
  /** Rol pasado desde un Server Component. Si se omite, se lee desde useAuth(). */
  userRole?: UserRole | null;
}

export default function CourseCard({ course, userRole: userRoleProp }: CourseCardProps) {
  const { user } = useAuth();
  // Si el Server Component pasó el rol, lo usamos directamente (sin flickering).
  // Si no, fallback al rol del cliente (compatibilidad con usos directos de CourseCard).
  const userRole = userRoleProp !== undefined ? userRoleProp : (user?.role || null);
  
  const hasAccess = canAccessCourse(userRole, course.requiredRole);
  const badgeColor = getRoleBadgeColor(course.requiredRole);
  const difficultyInfo = DIFFICULTY_CONFIG[course.difficulty];
  const roleInfo = ROLE_PRESENTATION[course.requiredRole];
  
  // Formatear duración
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins} min`;
    } else if (mins === 0) {
      return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  // Icono según tipo de curso
  const getTypeIcon = () => {
    switch (course.type) {
      case "workshop":
        return "🔧";
      case "masterclass":
        return "🎓";
      default:
        return "📚";
    }
  };

  return (
    <article 
      className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full border border-gray-eske-20 dark:border-white/10"
      role="listitem"
    >
      {/* Imagen o placeholder */}
      <div className="relative h-48 bg-linear-to-br from-blue-eske-40 to-bluegreen-eske overflow-hidden">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={`Imagen del curso: ${course.title}`}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            {getTypeIcon()}
          </div>
        )}
        
        {/* Badge de nivel de acceso */}
        <div className="absolute top-3 right-3">
          <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${badgeColor}`}>
            {roleInfo.label}
          </span>
        </div>
        
        {/* Badge de dificultad */}
        <div className="absolute bottom-3 left-3">
          <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full backdrop-blur-sm shadow-sm ${difficultyInfo.colorClass}`}>
            {difficultyInfo.label}
          </span>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Tipo y categoría */}
        <div className="flex justify-between items-center mb-2 text-sm text-black-eske dark:text-[#C7D6E0] font-normal">
          <span className="flex items-center gap-1">
            <span>{getTypeIcon()}</span>
            <span className="capitalize">{course.type === "workshop" ? "Taller" : course.type}</span>
          </span>
          <span className="bg-gray-eske-10 dark:bg-[#21425E] dark:text-[#C7D6E0] px-2 py-1 rounded-full text-xs">
            {course.category}
          </span>
        </div>

        {/* Título */}
        <h3 className="text-xl font-semibold text-bluegreen-eske-60 dark:text-[#6BA4C6] mb-2 hover:text-bluegreen-eske dark:hover:text-[#EAF2F8] transition-colors">
          <Link 
            href={`/cursos/${course.slug}`}
            className="focus-ring-primary rounded"
            aria-label={`Curso: ${course.title}`}
          >
            {course.title}
          </Link>
        </h3>


        {/* Descripción */}
        <p className="text-black-eske dark:text-[#9AAEBE] text-sm mb-4 line-clamp-3 font-normal">
          {course.description}
        </p>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-black-eske dark:text-[#9AAEBE] font-normal mb-4">
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
            <span>{course.enrolledStudents} estudiantes</span>
          </div>
        </div>

        {/* Tags */}
        {course.tags && course.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {course.tags.slice(0, 3).map(tag => (
              <span 
                key={tag} 
                className="text-xs bg-gray-eske-10 dark:bg-[#21425E] text-black-eske dark:text-[#C7D6E0] font-normal px-2 py-1 rounded-full"
              >
                #{tag}
              </span>
            ))}
            {course.tags.length > 3 && (
              <span className="text-xs text-gray-eske-50">+{course.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Botón de acceso condicional */}
        <div className="mt-auto pt-4 border-t border-gray-eske-20 dark:border-white/10">
          {hasAccess ? (
            <Link
              href={`/cursos/${course.slug}`}
              className="block w-full text-center bg-yellow-eske hover:bg-yellow-eske-60 text-black-eske font-bold py-2 px-4 rounded-lg transition-colors focus-ring-primary shadow-sm active:scale-95"
              aria-label={`Acceder al curso ${course.title}`}
            >
              Acceder al curso →
            </Link>
          ) : (
            <div className="space-y-2">
              <button
                disabled
                className="block w-full text-center bg-gray-eske-30 dark:bg-[#21425E] text-gray-eske-70 dark:text-[#6D8294] font-medium py-2 px-4 rounded-lg cursor-not-allowed"
                aria-label="Curso bloqueado"
              >
                Acceso restringido
              </button>
              <p className="text-xs text-center text-black-eske/70 dark:text-[#9AAEBE] font-normal">
                {getUpgradeMessage(course.requiredRole as any)}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}