// app/components/componentsBlog/CategoryList.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/constants/categories";
import { CategoryCount } from "@/types/post.types";

interface CategoryListProps {
  categoryCounts: CategoryCount;
}

export default function CategoryList({ categoryCounts }: CategoryListProps) {
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "todos";

  return (
    <nav
      className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-sm p-6 mb-6"
      aria-label="Categorías de publicaciones"
    >
      <h3 className="text-lg font-semibold text-black-eske dark:text-[#C7D6E0] mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-bluegreen-eske"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
        Categorías
      </h3>
      <ul className="space-y-2" role="list">
        {CATEGORIES.map((category) => {
          const count = categoryCounts[category.id] || 0;
          if (count === 0) return null;

          const isActive = currentCategory === category.id;

          return (
            <li key={category.id}>
              <Link
                href={`/blog?category=${category.id}`}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors group focus-ring-primary ${
                  isActive
                    ? "bg-bluegreen-eske/10 border border-bluegreen-eske"
                    : "hover:bg-white-eske-40 dark:hover:bg-white/5"
                }`}
                aria-label={`Ver ${count} publicación${count !== 1 ? "es" : ""} de ${category.label}`}
                aria-current={isActive ? "page" : undefined}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-sm transition-colors ${
                      isActive
                        ? "text-bluegreen-eske font-medium"
                        : "text-black-eske-40 dark:text-[#C7D6E0] group-hover:text-bluegreen-eske"
                    }`}
                  >
                    {category.label}
                  </span>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isActive
                      ? "bg-bluegreen-eske text-white-eske"
                      : "bg-gray-eske-10 dark:bg-[#21425E] text-black-eske-10 dark:text-[#C7D6E0]"
                  }`}
                  aria-label={`${count} publicación${count !== 1 ? "es" : ""}`}
                >
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
