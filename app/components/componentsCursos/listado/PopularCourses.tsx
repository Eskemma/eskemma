// app/components/componentsCursos/listado/PopularCourses.tsx
import Link from "next/link";
import type { CourseCardItem } from "@/types/course.types";

interface PopularCoursesProps {
  courses: CourseCardItem[];
}

export default function PopularCourses({ courses }: PopularCoursesProps) {
  if (courses.length === 0) return null;

  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-sm p-6 border border-gray-eske-10 dark:border-white/10">
      <h3 className="text-lg font-semibold text-black-eske dark:text-[#C7D6E0] mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-bluegreen-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
        Más Populares
      </h3>
      <ul className="space-y-4">
        {courses.map((course, index) => (
          <li key={course.id}>
            <Link href={`/cursos/${course.slug}`} className="flex gap-3 group">
               <div className="flex-shrink-0 w-8 h-8 bg-bluegreen-eske text-white-eske rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
               </div>
               <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] group-hover:text-bluegreen-eske dark:group-hover:text-[#4791B3] transition-colors line-clamp-2">
                    {course.title}
                  </h4>
                  <p className="text-xs text-black-eske-10 dark:text-[#9AAEBE] mt-1 flex items-center gap-2">
                    <span>{course.enrolledStudents} alumnos</span>
                    <span>•</span>
                    <span className="capitalize">{course.difficulty}</span>
                  </p>
               </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
