// app/components/componentsBlog/BlogToolbar.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants/categories";
import { useState, useEffect } from "react";
import ViewToggle, { ViewMode } from "./ViewToggle";

interface BlogToolbarProps {
  onViewChange?: (view: ViewMode) => void;
}

export default function BlogToolbar({ onViewChange }: BlogToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get("category") || "todos";
  const currentSort = searchParams.get("sort") || "newest";
  const currentSearch = searchParams.get("search") || "";

  const [searchInput, setSearchInput] = useState(currentSearch);

  // Sincronizar searchInput con URL cuando cambia
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  // Función para construir URL con todos los parámetros
  const buildUrl = (params: {
    category?: string;
    search?: string;
    sort?: string;
  }) => {
    const urlParams = new URLSearchParams();

    const category = params.category ?? currentCategory;
    const search = params.search ?? currentSearch;
    const sort = params.sort ?? currentSort;

    if (category && category !== "todos") {
      urlParams.set("category", category);
    }
    if (search && search.trim() !== "") {
      urlParams.set("search", search.trim());
    }
    if (sort && sort !== "newest") {
      urlParams.set("sort", sort);
    }

    const queryString = urlParams.toString();
    return queryString ? `/blog?${queryString}` : "/blog";
  };

  // Handler para cambio de categoría
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    router.push(buildUrl({ category }));
  };

  // Handler para búsqueda
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput }));
  };

  // Handler para limpiar búsqueda
  const handleClearSearch = () => {
    setSearchInput("");
    router.push(buildUrl({ search: "" }));
  };

  // Handler para cambio de ordenamiento
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sort = e.target.value;
    router.push(buildUrl({ sort }));
  };

  return (
    <div className="mb-8 bg-white-eske dark:bg-[#18324A] rounded-lg shadow-sm p-4 sm:p-6">
      {/* ✅ NUEVO: Fila superior con título y ViewToggle */}
      {onViewChange && (
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-eske-20 dark:border-white/10">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-[#C7D6E0]">
            Filtros y Vista
          </h3>
          <ViewToggle onViewChange={onViewChange} />
        </div>
      )}

      {/* Grid de 3 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* Columna 1: Filtro por Categoría */}
        <div>
          <label
            htmlFor="category-filter"
            className="block text-sm font-medium text-gray-700 dark:text-[#C7D6E0] mb-2"
          >
            Categoría
          </label>
          <select
            id="category-filter"
            value={currentCategory}
            onChange={handleCategoryChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus-ring-primary bg-white dark:bg-[#112230] text-gray-700 dark:text-[#EAF2F8] cursor-pointer transition-all duration-200 hover:border-bluegreen-eske"
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

        {/* Columna 2: Buscador */}
        <div>
          <label
            htmlFor="search-posts"
            className="block text-sm font-medium text-gray-700 dark:text-[#C7D6E0] mb-2"
          >
            Buscar
          </label>
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              id="search-posts"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Título, contenido o autor..."
              className="w-full px-4 py-2 pr-20 border border-gray-300 dark:border-white/10 rounded-lg focus-ring-primary bg-white dark:bg-[#112230] text-gray-700 dark:text-[#EAF2F8] placeholder:text-gray-400 dark:placeholder:text-[#6D8294] transition-all duration-200 hover:border-bluegreen-eske"
              aria-label="Buscar publicaciones por título, contenido o autor"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[#6D8294] hover:text-gray-600 dark:hover:text-[#9AAEBE] transition-colors focus-ring-primary rounded"
                aria-label="Limpiar búsqueda"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            <button
              type="submit"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-bluegreen-eske hover:text-bluegreen-eske-70 transition-colors focus-ring-primary rounded"
              aria-label="Buscar publicaciones"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </form>
        </div>

        {/* Columna 3: Ordenamiento */}
        <div>
          <label
            htmlFor="sort-posts"
            className="block text-sm font-medium text-gray-700 dark:text-[#C7D6E0] mb-2"
          >
            Ordenar por
          </label>
          <select
            id="sort-posts"
            value={currentSort}
            onChange={handleSortChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus-ring-primary bg-white dark:bg-[#112230] text-gray-700 dark:text-[#EAF2F8] cursor-pointer transition-all duration-200 hover:border-bluegreen-eske"
            aria-label="Ordenar publicaciones"
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="popular">Más populares</option>
          </select>
        </div>
      </div>

      {/* Indicadores de filtros activos */}
      {(currentCategory !== "todos" ||
        currentSearch ||
        currentSort !== "newest") && (
        <div
          className="mt-4 flex flex-wrap gap-2 items-center"
          role="status"
          aria-live="polite"
          aria-label="Filtros activos"
        >
          <span className="text-sm text-gray-600 dark:text-[#9AAEBE]">Filtros activos:</span>

          {currentCategory !== "todos" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-bluegreen-eske text-white-eske">
              {CATEGORIES.find((c) => c.id === currentCategory)?.label ||
                currentCategory}
              <button
                onClick={() => router.push(buildUrl({ category: "todos" }))}
                className="ml-2 hover:text-gray-200 focus-ring-primary rounded"
                aria-label={`Quitar filtro de categoría ${CATEGORIES.find((c) => c.id === currentCategory)?.label || currentCategory}`}
              >
                ×
              </button>
            </span>
          )}

          {currentSearch && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-eske/20 text-blue-800 dark:text-[#C7D6E0]">
              Búsqueda: &quot;{currentSearch}&quot;
              <button
                onClick={handleClearSearch}
                className="ml-2 hover:text-blue-600 focus-ring-primary rounded"
                aria-label={`Quitar filtro de búsqueda ${currentSearch}`}
              >
                ×
              </button>
            </span>
          )}

          {currentSort !== "newest" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              {currentSort === "oldest" ? "Más antiguos" : "Más populares"}
              <button
                onClick={() => router.push(buildUrl({ sort: "newest" }))}
                className="ml-2 hover:text-purple-600 focus-ring-primary rounded"
                aria-label={`Quitar ordenamiento por ${currentSort === "oldest" ? "más antiguos" : "más populares"}`}
              >
                ×
              </button>
            </span>
          )}

          <Link
            href="/blog"
            className="text-xs text-gray-600 dark:text-[#9AAEBE] hover:text-bluegreen-eske dark:hover:text-[#4791B3] underline focus-ring-primary rounded"
            aria-label="Limpiar todos los filtros"
          >
            Limpiar todos
          </Link>
        </div>
      )}
    </div>
  );
}
