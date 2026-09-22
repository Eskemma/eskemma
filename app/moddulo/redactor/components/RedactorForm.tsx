// app/moddulo/redactor/components/RedactorForm.tsx
"use client";

import React, { useState } from "react";
import type { RedactorInput, PublicoObjetivo, TonoMensaje } from "@/types/redactor.types";
import {
  PUBLICO_OPTIONS,
  TONO_OPTIONS,
  TEMA_MIN_LENGTH,
  TEMA_MAX_LENGTH,
  validateRedactorInput,
  countCharacters,
} from "@/lib/redactor/validation";

interface RedactorFormProps {
  onSubmit: (input: RedactorInput) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export default function RedactorForm({ onSubmit, isGenerating, disabled = false }: RedactorFormProps) {
  const [tema, setTema] = useState("");
  const [publico, setPublico] = useState<PublicoObjetivo | "">("");
  const [tono, setTono] = useState<TonoMensaje | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const temaLength = countCharacters(tema);
  const isTemaTooShort = temaLength > 0 && temaLength < TEMA_MIN_LENGTH;
  const isTemaTooLong = temaLength > TEMA_MAX_LENGTH;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar input (con casting explícito para evitar warnings de TypeScript)
    const validation = validateRedactorInput({
      tema,
      publico: publico || undefined,
      tono: tono || undefined,
    });

    if (!validation.isValid) {
      const errorMap: Record<string, string> = {};
      validation.errors.forEach((error) => {
        errorMap[error.field] = error.message;
      });
      setErrors(errorMap);
      return;
    }

    // Limpiar errores y enviar
    setErrors({});
    onSubmit(validation.sanitizedInput!);
  };

  const handleReset = () => {
    setTema("");
    setPublico("");
    setTono("");
    setErrors({});
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md p-6 max-sm:p-4 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-eske-20 dark:border-white/10 pb-4">
        <h2 className="text-xl max-sm:text-lg font-bold text-bluegreen-eske flex items-center gap-2">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Crear Post
        </h2>
      </div>

      {/* Campo: Tema */}
      <div>
        <label
          htmlFor="tema"
          className="block text-sm font-semibold text-bluegreen-eske mb-2"
        >
          Tema del post <span className="text-red-eske-60 dark:text-red-eske-20">*</span>
        </label>
        <textarea
          id="tema"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          disabled={disabled || isGenerating}
          placeholder="Ej: Propuestas para mejorar la educación pública en zonas rurales"
          rows={3}
          className={`
            w-full
            px-4 py-3
            border-2 rounded-lg
            text-sm
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-bluegreen-eske focus:border-transparent
            disabled:bg-gray-eske-10 dark:disabled:bg-[#21425E] disabled:cursor-not-allowed
            bg-white dark:bg-[#112230] dark:text-[#EAF2F8] dark:placeholder-[#6D8294]
            ${errors.tema ? "border-red-eske" : "border-gray-eske-30 dark:border-white/10"}
          `}
          aria-describedby="tema-error tema-counter"
          aria-invalid={!!errors.tema}
        />
        
        {/* Contador de caracteres */}
        <div className="flex items-center justify-between mt-1">
          <div>
            {errors.tema && (
              <p id="tema-error" className="text-xs text-red-eske-60 dark:text-red-eske-20" role="alert">
                {errors.tema}
              </p>
            )}
          </div>
          <p
            id="tema-counter"
            className={`text-xs ${
              isTemaTooShort
                ? "text-orange-eske"
                : isTemaTooLong
                ? "text-red-eske-60 dark:text-red-eske-20"
                : "text-gray-eske-70"
            }`}
          >
            {temaLength} / {TEMA_MAX_LENGTH}
          </p>
        </div>
      </div>

      {/* Campo: Público Objetivo */}
      <div>
        <label
          htmlFor="publico"
          className="block text-sm font-semibold text-bluegreen-eske mb-2"
        >
          Público objetivo <span className="text-red-eske-60 dark:text-red-eske-20">*</span>
        </label>
        <select
          id="publico"
          value={publico}
          onChange={(e) => setPublico(e.target.value as PublicoObjetivo)}
          disabled={disabled || isGenerating}
          className={`
            w-full
            px-4 py-3
            border-2 rounded-lg
            text-sm
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-bluegreen-eske focus:border-transparent
            disabled:bg-gray-eske-10 disabled:cursor-not-allowed
            ${errors.publico ? "border-red-eske" : "border-gray-eske-30"}
          `}
          aria-describedby="publico-error"
          aria-invalid={!!errors.publico}
        >
          <option value="">Selecciona un público</option>
          {PUBLICO_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.publico && (
          <p id="publico-error" className="text-xs text-red-eske-60 dark:text-red-eske-20 mt-1" role="alert">
            {errors.publico}
          </p>
        )}
      </div>

      {/* Campo: Tono */}
      <div>
        <label
          htmlFor="tono"
          className="block text-sm font-semibold text-bluegreen-eske mb-2"
        >
          Tono del mensaje <span className="text-red-eske-60 dark:text-red-eske-20">*</span>
        </label>
        <select
          id="tono"
          value={tono}
          onChange={(e) => setTono(e.target.value as TonoMensaje)}
          disabled={disabled || isGenerating}
          className={`
            w-full
            px-4 py-3
            border-2 rounded-lg
            text-sm
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-bluegreen-eske focus:border-transparent
            disabled:bg-gray-eske-10 disabled:cursor-not-allowed
            ${errors.tono ? "border-red-eske" : "border-gray-eske-30"}
          `}
          aria-describedby="tono-error"
          aria-invalid={!!errors.tono}
        >
          <option value="">Selecciona un tono</option>
          {TONO_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.tono && (
          <p id="tono-error" className="text-xs text-red-eske-60 dark:text-red-eske-20 mt-1" role="alert">
            {errors.tono}
          </p>
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={disabled || isGenerating}
          className="
            flex-1
            bg-bluegreen-eske
            text-white-eske
            px-6 py-3
            rounded-lg
            font-semibold
            text-sm
            hover:bg-bluegreen-eske/90
            disabled:bg-gray-eske-40
            disabled:cursor-not-allowed
            transition-all
            focus-ring-primary
            flex items-center justify-center gap-2
          "
        >
          {isGenerating ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generando...
            </>
          ) : (
            <>
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Generar Posts
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={disabled || isGenerating}
          className="
            px-6 py-3
            rounded-lg
            font-semibold
            text-sm
            bg-gray-eske-10 dark:bg-[#21425E]
            text-gray-eske-80 dark:text-[#C7D6E0]
            hover:bg-gray-eske-20 dark:hover:bg-[#2C5273]
            disabled:opacity-50
            disabled:cursor-not-allowed
            transition-colors
            focus-ring-primary
          "
        >
          Limpiar
        </button>
      </div>
    </form>
  );
}
