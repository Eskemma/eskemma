// app/components/componentsCursos/listado/PaginationCursos.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

interface PaginationCursosProps {
  currentPage: number;
  totalPages: number;
  categoryFilter?: string;
  difficultyFilter?: string;
  searchQuery?: string;
  sortBy?: string;
}

export default function PaginationCursos({
  currentPage,
  totalPages,
  categoryFilter = "todos",
  difficultyFilter = "todos",
  searchQuery = "",
  sortBy = "newest",
}: PaginationCursosProps) {
  
  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set("page", page.toString());

    if (categoryFilter && categoryFilter !== "todos") params.set("category", categoryFilter);
    if (difficultyFilter && difficultyFilter !== "todos") params.set("difficulty", difficultyFilter);
    if (searchQuery && searchQuery.trim() !== "") params.set("search", searchQuery.trim());
    if (sortBy && sortBy !== "newest") params.set("sort", sortBy);

    return `/cursos?${params.toString()}`;
  };

  const pageNumbers = useMemo(() => {
    const delta = 2;
    const range: (number | string)[] = [];
    const rangeWithDots: (number | string)[] = [];

    range.push(1);
    for (let i = currentPage - delta; i <= currentPage + delta; i++) {
      if (i > 1 && i < totalPages) range.push(i);
    }
    if (totalPages > 1) range.push(totalPages);

    let prev = 0;
    for (const page of range) {
      if (typeof page === "number") {
        if (page - prev > 1) rangeWithDots.push("...");
        rangeWithDots.push(page);
        prev = page;
      }
    }
    return rangeWithDots;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav className="flex justify-center items-center gap-1 sm:gap-2 mt-12 mb-8 flex-wrap">
      {/* Botón: Anterior */}
      <Link
        href={buildUrl(Math.max(1, currentPage - 1))}
        className={`flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          currentPage === 1 ? "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-90 dark:text-[#6D8294] cursor-not-allowed" : "bg-white-eske dark:bg-[#18324A] text-bluegreen-eske border border-gray-eske-40 dark:border-white/10 hover:bg-bluegreen-eske hover:text-white-eske"
        }`}
        aria-disabled={currentPage === 1}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </Link>

      {/* Números */}
      <div className="flex items-center gap-1 sm:gap-2">
        {pageNumbers.map((pageNum, idx) => {
          if (pageNum === "...") return <span key={idx} className="px-2 py-2 text-black-eske-10 dark:text-[#9AAEBE] text-sm">•••</span>;
          const isActive = pageNum === currentPage;
          return (
            <Link
              key={pageNum}
              href={buildUrl(pageNum as number)}
              className={`flex items-center justify-center min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive ? "bg-bluegreen-eske text-white-eske shadow-md" : "bg-white-eske dark:bg-[#18324A] text-black-eske-40 dark:text-[#C7D6E0] border border-gray-eske-40 dark:border-white/10 hover:border-bluegreen-eske"
              }`}
            >
              {pageNum}
            </Link>
          );
        })}
      </div>

      {/* Botón: Siguiente */}
      <Link
        href={buildUrl(Math.min(totalPages, currentPage + 1))}
        className={`flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          currentPage === totalPages ? "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-90 dark:text-[#6D8294] cursor-not-allowed" : "bg-white-eske dark:bg-[#18324A] text-bluegreen-eske border border-gray-eske-40 dark:border-white/10 hover:bg-bluegreen-eske hover:text-white-eske"
        }`}
        aria-disabled={currentPage === totalPages}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </Link>
    </nav>
  );
}
