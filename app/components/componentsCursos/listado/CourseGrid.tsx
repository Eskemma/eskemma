// app/cursos/components/CourseGrid.tsx
// ============================================================
// GRID DE CURSOS
// Muestra los cursos en formato de cuadrícula
// ============================================================


import type { CourseCardItem } from "@/types/course.types";
import type { UserRole } from "@/types/subscription.types";
import CourseCard from "./CourseCard";

interface CourseGridProps {
  courses: CourseCardItem[];
  /** Rol del usuario pasado desde el Server Component padre para evitar flickering. */
  userRole?: UserRole | null;
}

export default function CourseGrid({ courses, userRole }: CourseGridProps) {
  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-black-eske dark:text-[#C7D6E0] text-lg font-normal">
          No hay cursos que coincidan con tu búsqueda.
        </p>
        <p className="text-black-eske/60 dark:text-[#9AAEBE] mt-2 font-normal">
          Intenta con otros filtros o términos de búsqueda.
        </p>
      </div>
    );
  }

  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
      role="list"
      aria-label="Listado de cursos disponibles"
    >
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} userRole={userRole} />
      ))}
    </div>
  );
}