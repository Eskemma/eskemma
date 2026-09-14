// app/moddulo/redactor/components/CreateProjectModal.tsx
"use client";

import React, { useState } from "react";
import type { CreateProjectInput } from "@/types/redactor.types";
import { MESSAGES } from "@/lib/redactor/constants";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => Promise<void>;
  isLoading?: boolean;
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Validación
  const validateForm = (): boolean => {
    setError(null);

    if (!name.trim()) {
      setError(MESSAGES.PROJECT_NAME_REQUIRED);
      return false;
    }

    if (name.trim().length < 3) {
      setError(MESSAGES.PROJECT_NAME_TOO_SHORT);
      return false;
    }

    if (name.trim().length > 50) {
      setError(MESSAGES.PROJECT_NAME_TOO_LONG);
      return false;
    }

    return true;
  };

  // Handler para crear
  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      // Limpiar y cerrar
      setName("");
      setDescription("");
      setError(null);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al crear proyecto");
    }
  };

  // Handler para cerrar
  const handleClose = () => {
    if (isLoading) return; // No permitir cerrar mientras carga
    setName("");
    setDescription("");
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black-eske/80"
      onClick={handleClose}
    >
      {/* Modal */}
      <div
        className="relative bg-white-eske dark:bg-[#18324A] rounded-lg shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-eske-20 dark:border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-bluegreen-eske">Crear Nuevo Proyecto</h2>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-eske-70 dark:text-[#9AAEBE] hover:text-gray-eske-90 dark:hover:text-[#EAF2F8] transition-colors disabled:opacity-50"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-900 dark:text-red-300 p-3 rounded-r text-sm">
              <p className="font-medium">{error}</p>
            </div>
          )}

          {/* Nombre del proyecto */}
          <div>
            <label
              htmlFor="project-name"
              className="block text-sm font-semibold text-gray-eske-90 dark:text-[#C7D6E0] mb-2"
            >
              Nombre del proyecto <span className="text-red-500">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              placeholder="Ej: Campaña Gubernatura 2025"
              maxLength={50}
              className="
                w-full
                px-4 py-2.5
                border border-gray-eske-30 dark:border-white/10
                rounded-lg
                text-sm
                bg-white dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]
                focus:ring-2 focus:ring-bluegreen-eske focus:border-transparent
                disabled:bg-gray-eske-10 dark:disabled:bg-[#21425E] disabled:cursor-not-allowed
                transition-colors
              "
            />
            <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-1">
              {name.length}/50 caracteres
            </p>
          </div>

          {/* Descripción (opcional) */}
          <div>
            <label
              htmlFor="project-description"
              className="block text-sm font-semibold text-gray-eske-90 dark:text-[#C7D6E0] mb-2"
            >
              Descripción <span className="text-black-eske-20 font-normal">(opcional)</span>
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              placeholder="Breve descripción del proyecto..."
              rows={3}
              maxLength={200}
              className="
                w-full
                px-4 py-2.5
                border border-gray-eske-30
                rounded-lg
                text-sm
                resize-none
                focus:ring-2 focus:ring-bluegreen-eske focus:border-transparent
                disabled:bg-gray-eske-10 disabled:cursor-not-allowed
                transition-colors
              "
            />
            <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-1">
              {description.length}/200 caracteres
            </p>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded-r">
            <p className="text-xs text-blue-900 dark:text-blue-300">
              <strong>Nota:</strong> Después de crear el proyecto, podrás configurar los detalles
              específicos (candidato, tipo de comunicación, etc.).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-eske-20 dark:border-white/10 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="
              px-4 py-2
              text-sm font-medium
              text-gray-eske-80 dark:text-[#C7D6E0]
              bg-gray-eske-10 dark:bg-[#21425E]
              hover:bg-gray-eske-20 dark:hover:bg-[#2C5273]
              rounded-lg
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={isLoading || !name.trim()}
            className="
              px-6 py-2
              text-sm font-semibold
              text-white-eske
              bg-bluegreen-eske
              hover:bg-bluegreen-eske/90
              rounded-lg
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            "
          >
            {isLoading ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white-eske border-t-transparent" />
                Creando...
              </>
            ) : (
              "Crear Proyecto"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
