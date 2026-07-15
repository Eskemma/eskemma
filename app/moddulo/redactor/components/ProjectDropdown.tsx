// app/moddulo/redactor/components/ProjectDropdown.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import type { RedactorProject } from "@/types/redactor.types";

interface ProjectDropdownProps {
  currentProject: RedactorProject;
  allProjects: RedactorProject[];
  onProjectChange: (project: RedactorProject) => void;
  onCreateNew: () => void;
}

export default function ProjectDropdown({
  currentProject,
  allProjects,
  onProjectChange,
  onCreateNew,
}: ProjectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectProject = (project: RedactorProject) => {
    setIsOpen(false);
    if (project.id !== currentProject.id) {
      onProjectChange(project);
    }
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    onCreateNew();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2
          px-4 py-2
          bg-white-eske dark:bg-[#18324A]
          border border-gray-eske-30 dark:border-white/10
          rounded-lg
          hover:bg-gray-eske-10 dark:hover:bg-white/5
          transition-colors
          text-sm
          focus:outline-none focus:ring-2 focus:ring-bluegreen-eske focus:ring-offset-2
        "
      >
        {/* Icon */}
        <svg
          className="w-5 h-5 text-bluegreen-eske shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>

        {/* Nombre del proyecto */}
        <span className="font-medium text-gray-eske-90 dark:text-[#C7D6E0] max-w-37.5 truncate min-w-0">
          {currentProject.name}
        </span>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-eske-60 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
            absolute
            top-full mt-2
            right-0
            w-72
            bg-white-eske dark:bg-[#18324A]
            border border-gray-eske-20 dark:border-white/10
            rounded-lg
            shadow-xl
            z-50
            max-h-96
            overflow-y-auto
          "
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-eske-20 dark:border-white/10">
            <p className="text-xs font-semibold text-gray-eske-60 dark:text-[#9AAEBE] uppercase">Mis Proyectos</p>
          </div>

          {/* Lista de proyectos */}
          <div className="py-2">
            {allProjects.map((project) => {
              const isActive = project.id === currentProject.id;

              return (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className={`
                    w-full
                    text-left
                    px-4 py-3
                    hover:bg-gray-eske-10 dark:hover:bg-white/5
                    transition-colors
                    ${isActive ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`
                          text-sm font-semibold
                          truncate
                          ${isActive ? "text-bluegreen-eske" : "text-gray-eske-90 dark:text-[#C7D6E0]"}
                        `}
                      >
                        {project.name}
                      </p>
                      {project.description && (
                        <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] truncate mt-0.5">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-eske-50">
                          {project.stats.totalGenerations} posts
                        </span>
                      </div>
                    </div>

                    {/* Checkmark si está activo */}
                    {isActive && (
                      <svg
                        className="w-5 h-5 text-bluegreen-eske shrink-0 ml-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-eske-20 dark:border-white/10" />

          {/* Crear nuevo proyecto */}
          <div className="p-2">
            <button
              onClick={handleCreateNew}
              className="
                w-full
                flex items-center gap-2
                px-3 py-2
                text-sm font-semibold
                text-bluegreen-eske
                hover:bg-blue-50 dark:hover:bg-white/5
                rounded-lg
                transition-colors
              "
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Crear Nuevo Proyecto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
