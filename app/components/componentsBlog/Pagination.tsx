// app/components/componentsBlog/Pagination.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  categoryFilter?: string;
  searchQuery?: string;
  sortBy?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  categoryFilter = "todos",
  searchQuery = "",
  sortBy = "newest",
}: PaginationProps) {
  // Construir URL manteniendo TODOS los filtros
  const buildUrl = (page: number) => {
    const params = new URLSearchParams();

    params.set("page", page.toString());

    if (categoryFilter && categoryFilter !== "todos") {
      params.set("category", categoryFilter);
    }
    if (searchQuery && searchQuery.trim() !== "") {
      params.set("search", searchQuery.trim());
    }
    if (sortBy && sortBy !== "newest") {
      params.set("sort", sortBy);
    }

    return `/blog?${params.toString()}`;
  };

  // Generar array de números de página con lógica de dots
  const pageNumbers = useMemo(() => {
    const delta = 2; // Números a mostrar alrededor de la página actual
    const range: (number | string)[] = [];
    const rangeWithDots: (number | string)[] = [];

    // Siempre mostrar primera página
    range.push(1);

    for (let i = currentPage - delta; i <= currentPage + delta; i++) {
      if (i > 1 && i < totalPages) {
        range.push(i);
      }
    }

    // Siempre mostrar última página
    if (totalPages > 1) {
      range.push(totalPages);
    }

    // Agregar dots donde hay saltos
    let prev = 0;
    for (const page of range) {
      if (typeof page === "number") {
        if (page - prev > 1) {
          rangeWithDots.push("...");
        }
        rangeWithDots.push(page);
        prev = page;
      }
    }

    return rangeWithDots;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav
      className="flex justify-center items-center gap-1 sm:gap-2 mt-12 mb-8 flex-wrap"
      role="navigation"
      aria-label="Paginación de publicaciones del blog"
    >
      {/* Botón: Primera página */}
      <Link
        href={buildUrl(1)}
        className={`
          hidden sm:flex items-center justify-center
          px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-200 focus-ring-primary
          ${
            currentPage === 1
              ? "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-90 dark:text-[#6D8294] cursor-not-allowed"
              : "bg-white-eske dark:bg-[#18324A] text-bluegreen-eske border border-gray-eske-40 dark:border-white/10 hover:bg-bluegreen-eske hover:text-white-eske hover:border-bluegreen-eske"
          }
        `}
        aria-label="Ir a la primera página"
        aria-disabled={currentPage === 1}
        tabIndex={currentPage === 1 ? -1 : 0}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
          />
        </svg>
        <span className="ml-1 hidden md:inline">Primera</span>
      </Link>

      {/* Botón: Anterior */}
      <Link
        href={buildUrl(Math.max(1, currentPage - 1))}
        className={`
          flex items-center justify-center
          px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-200 focus-ring-primary
          ${
            currentPage === 1
              ? "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-90 dark:text-[#6D8294] cursor-not-allowed"
              : "bg-white-eske dark:bg-[#18324A] text-bluegreen-eske border border-gray-eske-40 dark:border-white/10 hover:bg-bluegreen-eske hover:text-white-eske hover:border-bluegreen-eske"
          }
        `}
        aria-label="Ir a la página anterior"
        aria-disabled={currentPage === 1}
        tabIndex={currentPage === 1 ? -1 : 0}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span className="ml-1 hidden xs:inline">Anterior</span>
      </Link>

      {/* Números de página */}
      <div className="flex items-center gap-1 sm:gap-2">
        {pageNumbers.map((pageNum, idx) => {
          if (pageNum === "...") {
            return (
              <span
                key={`dots-${idx}`}
                className="px-2 py-2 text-black-eske-10 dark:text-[#9AAEBE] text-sm"
                aria-hidden="true"
              >
                •••
              </span>
            );
          }

          const isActive = pageNum === currentPage;

          return (
            <Link
              key={pageNum}
              href={buildUrl(pageNum as number)}
              className={`
                flex items-center justify-center
                min-w-[36px] sm:min-w-[40px] h-9 sm:h-10
                rounded-lg text-sm font-medium
                transition-all duration-200 focus-ring-primary
                ${
                  isActive
                    ? "bg-bluegreen-eske text-white-eske shadow-md scale-105"
                    : "bg-white-eske dark:bg-[#18324A] text-black-eske-40 dark:text-[#C7D6E0] border border-gray-eske-40 dark:border-white/10 hover:bg-bluegreen-eske-10 hover:border-bluegreen-eske"
                }
              `}
              aria-label={`${isActive ? "Página actual, " : ""}Ir a la página ${pageNum}`}
              aria-current={isActive ? "page" : undefined}
            >
              {pageNum}
            </Link>
          );
        })}
      </div>

      {/* Botón: Siguiente */}
      <Link
        href={buildUrl(Math.min(totalPages, currentPage + 1))}
        className={`
          flex items-center justify-center
          px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-200 focus-ring-primary
          ${
            currentPage === totalPages
              ? "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-90 dark:text-[#6D8294] cursor-not-allowed"
              : "bg-white-eske dark:bg-[#18324A] text-bluegreen-eske border border-gray-eske-40 dark:border-white/10 hover:bg-bluegreen-eske hover:text-white-eske hover:border-bluegreen-eske"
          }
        `}
        aria-label="Ir a la página siguiente"
        aria-disabled={currentPage === totalPages}
        tabIndex={currentPage === totalPages ? -1 : 0}
      >
        <span className="mr-1 hidden xs:inline">Siguiente</span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Link>

      {/* Botón: Última página */}
      <Link
        href={buildUrl(totalPages)}
        className={`
          hidden sm:flex items-center justify-center
          px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-200 focus-ring-primary
          ${
            currentPage === totalPages
              ? "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-90 dark:text-[#6D8294] cursor-not-allowed"
              : "bg-white-eske dark:bg-[#18324A] text-bluegreen-eske border border-gray-eske-40 dark:border-white/10 hover:bg-bluegreen-eske hover:text-white-eske hover:border-bluegreen-eske"
          }
        `}
        aria-label="Ir a la última página"
        aria-disabled={currentPage === totalPages}
        tabIndex={currentPage === totalPages ? -1 : 0}
      >
        <span className="mr-1 hidden md:inline">Última</span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 5l7 7-7 7M5 5l7 7-7 7"
          />
        </svg>
      </Link>

      {/* Indicador móvil de página actual */}
      <div
        className="flex sm:hidden items-center justify-center px-3 py-2 bg-gray-eske-10 dark:bg-[#21425E] rounded-lg text-xs text-black-eske-20 dark:text-[#9AAEBE] ml-2"
        role="status"
        aria-label={`Página ${currentPage} de ${totalPages}`}
      >
        Pág. {currentPage}/{totalPages}
      </div>
    </nav>
  );
}
