// app/components/componentsBlog/CategoryFilter.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/constants/categories";

export default function CategoryFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "todos";
  const currentPage = searchParams.get("page") || "1";

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCategory = e.target.value;

    // Construir nueva URL con la categoría seleccionada (resetear a página 1)
    if (selectedCategory === "todos") {
      router.push("/blog");
    } else {
      router.push(`/blog?category=${selectedCategory}`);
    }
  };

  return (
    <div className="w-full">
      <label
        htmlFor="category-filter"
        className="block text-sm font-medium text-black-eske-40 dark:text-[#C7D6E0] mb-2"
      >
        Categoría
      </label>
      <select
        id="category-filter"
        value={currentCategory}
        onChange={handleCategoryChange}
        className="w-full px-4 py-2 border border-gray-eske-40 dark:border-white/10 rounded-lg focus-ring-primary bg-white dark:bg-[#112230] text-black-eske-40 dark:text-[#EAF2F8] cursor-pointer transition-all duration-200 hover:border-bluegreen-eske"
        aria-label="Filtrar publicaciones por categoría"
      >
        <option value="todos">Todas las categorías</option>
        {CATEGORIES.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </select>
    </div>
  );
}
