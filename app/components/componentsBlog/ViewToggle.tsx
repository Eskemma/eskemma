// app/components/componentsBlog/ViewToggle.tsx
"use client";

import { useState, useEffect } from "react";

export type ViewMode = "grid" | "list";

interface ViewToggleProps {
  onViewChange: (view: ViewMode) => void;
}

export default function ViewToggle({ onViewChange }: ViewToggleProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [mounted, setMounted] = useState(false);

  // Cargar preferencia desde localStorage al montar
  useEffect(() => {
    setMounted(true);
    const savedView = localStorage.getItem("blogViewMode") as ViewMode;
    if (savedView && (savedView === "grid" || savedView === "list")) {
      setViewMode(savedView);
      onViewChange(savedView);
    }
  }, [onViewChange]);

  // Guardar preferencia en localStorage
  const handleViewChange = (newView: ViewMode) => {
    setViewMode(newView);
    localStorage.setItem("blogViewMode", newView);
    onViewChange(newView);
  };

  // Evitar hidratación incorrecta
  if (!mounted) {
    return (
      <div
        className="flex items-center gap-2 bg-white-eske dark:bg-[#18324A] rounded-lg p-1 border border-gray-eske-40 dark:border-white/10"
        role="status"
        aria-label="Cargando selector de vista"
      >
        <div
          className="w-20 h-9 bg-gray-eske-10 dark:bg-[#112230] rounded animate-pulse"
          aria-hidden="true"
        ></div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 bg-white-eske dark:bg-[#18324A] rounded-lg p-1 border border-gray-eske-40 dark:border-white/10 shadow-sm"
      role="group"
      aria-label="Selector de vista del blog"
    >
      {/* Botón Grid */}
      <button
        onClick={() => handleViewChange("grid")}
        className={`
          flex items-center justify-center gap-2
          px-3 py-2 rounded-md
          text-sm font-medium
          transition-all duration-200 focus-ring-primary
          ${
            viewMode === "grid"
              ? "bg-bluegreen-eske text-white-eske shadow-sm"
              : "text-black-eske-40 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
          }
        `}
        aria-label="Cambiar a vista en cuadrícula"
        aria-pressed={viewMode === "grid"}
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
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
        <span className="hidden sm:inline">Grid</span>
      </button>

      {/* Botón Lista */}
      <button
        onClick={() => handleViewChange("list")}
        className={`
          flex items-center justify-center gap-2
          px-3 py-2 rounded-md
          text-sm font-medium
          transition-all duration-200 focus-ring-primary
          ${
            viewMode === "list"
              ? "bg-bluegreen-eske text-white-eske shadow-sm"
              : "text-black-eske-40 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
          }
        `}
        aria-label="Cambiar a vista en lista"
        aria-pressed={viewMode === "list"}
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
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
        <span className="hidden sm:inline">Lista</span>
      </button>
    </div>
  );
}
