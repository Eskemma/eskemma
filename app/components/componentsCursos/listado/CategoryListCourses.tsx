// app/components/componentsCursos/listado/CategoryListCourses.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface CategoryListCoursesProps {
  categories: { id: string; name: string; count: number }[];
}

export default function CategoryListCourses({ categories }: CategoryListCoursesProps) {
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "todos";

  return (
    <nav className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-sm p-6 mb-6 border border-gray-eske-10 dark:border-white/10">
      <h3 className="text-lg font-semibold text-black-eske dark:text-[#C7D6E0] mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-bluegreen-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
        Categorías
      </h3>
      <ul className="space-y-2">
        {categories.map((cat) => {
          const isActive = currentCategory === cat.name;
          return (
            <li key={cat.id}>
              <Link
                href={`/cursos?category=${cat.name}`}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors group ${
                  isActive ? "bg-bluegreen-eske/10 border border-bluegreen-eske" : "hover:bg-white-eske-40 dark:hover:bg-white/5"
                }`}
              >
                <span className={`text-sm ${isActive ? "text-bluegreen-eske font-medium" : "text-black-eske-40 dark:text-[#C7D6E0] group-hover:text-bluegreen-eske"}`}>
                  {cat.name}
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${isActive ? "bg-bluegreen-eske text-white-eske" : "bg-gray-eske-10 dark:bg-[#21425E] text-black-eske-10 dark:text-[#C7D6E0]"}`}>
                  {cat.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
