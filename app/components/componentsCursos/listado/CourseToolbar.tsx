// app/components/componentsCursos/listado/CourseToolbar.tsx
// ============================================================
// BARRA DE HERRAMIENTAS PARA CURSOS (FILTROS Y VISTA)
// Reclicado de BlogToolbar.tsx adaptado para cursos
// ============================================================

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import ViewToggle, { ViewMode } from "../../componentsBlog/ViewToggle";

interface CourseToolbarProps {
  onViewChange?: (view: ViewMode) => void;
  categories: { id: string; name: string }[];
}

export default function CourseToolbar({ onViewChange, categories }: CourseToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get("category") || "todos";
  const currentDifficulty = searchParams.get("difficulty") || "todos";
  const currentSearch = searchParams.get("search") || "";
  const currentSort = searchParams.get("sort") || "newest";

  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const buildUrl = (params: {
    category?: string;
    difficulty?: string;
    search?: string;
    sort?: string;
  }) => {
    const urlParams = new URLSearchParams();

    const category = params.category ?? currentCategory;
    const difficulty = params.difficulty ?? currentDifficulty;
    const search = params.search ?? currentSearch;
    const sort = params.sort ?? currentSort;

    if (category && category !== "todos") urlParams.set("category", category);
    if (difficulty && difficulty !== "todos") urlParams.set("difficulty", difficulty);
    if (search && search.trim() !== "") urlParams.set("search", search.trim());
    if (sort && sort !== "newest") urlParams.set("sort", sort);

    const queryString = urlParams.toString();
    return queryString ? `/cursos?${queryString}` : "/cursos";
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(buildUrl({ category: e.target.value }));
  };

  const handleDifficultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(buildUrl({ difficulty: e.target.value }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput }));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(buildUrl({ sort: e.target.value }));
  };

  return (
    <div className="mb-8 bg-white-eske dark:bg-[#18324A] rounded-lg shadow-sm p-4 sm:p-6 border border-gray-eske-10 dark:border-white/10">
      {/* Fila superior con ViewToggle */}
      {onViewChange && (
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-eske-20 dark:border-white/10">
          <h3 className="text-lg font-semibold text-black-eske dark:text-[#C7D6E0]">
            Filtros y Vista
          </h3>
          <ViewToggle onViewChange={onViewChange} />
        </div>
      )}

      {/* Grid de Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium text-black-eske-40 dark:text-[#C7D6E0] mb-2">Categoría</label>
          <select
            value={currentCategory}
            onChange={handleCategoryChange}
            className="w-full px-4 py-2 border border-gray-eske-40 dark:border-white/10 rounded-lg focus-ring-primary bg-white dark:bg-[#112230] dark:text-[#EAF2F8] text-sm"
          >
            <option value="todos">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Dificultad */}
        <div>
          <label className="block text-sm font-medium text-black-eske-40 dark:text-[#C7D6E0] mb-2">Dificultad</label>
          <select
            value={currentDifficulty}
            onChange={handleDifficultyChange}
            className="w-full px-4 py-2 border border-gray-eske-40 dark:border-white/10 rounded-lg focus-ring-primary bg-white dark:bg-[#112230] dark:text-[#EAF2F8] text-sm"
          >
            <option value="todos">Todos los niveles</option>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </div>

        {/* Búsqueda */}
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-black-eske-40 dark:text-[#C7D6E0] mb-2">Buscar</label>
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="¿Qué quieres aprender?"
              className="w-full px-4 py-2 pr-10 border border-gray-eske-40 dark:border-white/10 rounded-lg focus-ring-primary bg-white dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294] text-sm"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-bluegreen-eske">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
          </form>
        </div>

        {/* Ordenamiento */}
        <div>
          <label className="block text-sm font-medium text-black-eske-40 dark:text-[#C7D6E0] mb-2">Ordenar</label>
          <select
            value={currentSort}
            onChange={handleSortChange}
            className="w-full px-4 py-2 border border-gray-eske-40 dark:border-white/10 rounded-lg focus-ring-primary bg-white dark:bg-[#112230] dark:text-[#EAF2F8] text-sm"
          >
            <option value="newest">Más recientes</option>
            <option value="popular">Más populares</option>
            <option value="duration">Duración</option>
          </select>
        </div>
      </div>
    </div>
  );
}
