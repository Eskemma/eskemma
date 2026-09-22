// app/moddulo/redactor/components/PostPreview.tsx
"use client";

import React, { useState } from "react";
import type { PostVariante } from "@/types/redactor.types";
import { POST_MIN_LENGTH, POST_MAX_LENGTH, getCounterColor } from "@/lib/redactor/validation";

interface PostPreviewProps {
  variante: PostVariante;
  isSelected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  canExport: boolean;
}

export default function PostPreview({
  variante,
  isSelected,
  onSelect,
  onCopy,
  canExport,
}: PostPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const characterCount = variante.caracteresUsados;
  const isValid = characterCount >= POST_MIN_LENGTH && characterCount <= POST_MAX_LENGTH;

  return (
    <article
      className={`
        relative
        bg-white-eske dark:bg-[#18324A]
        rounded-lg
        border-2
        p-5 max-sm:p-4
        transition-all
        cursor-pointer
        ${isSelected ? "border-bluegreen-eske shadow-lg" : "border-gray-eske-20 dark:border-white/10 hover:border-bluegreen-eske/50"}
      `}
      onClick={onSelect}
      role="article"
      aria-label={`Variante: ${variante.titulo}`}
    >
      {/* Badge de selección */}
      {isSelected && (
        <div className="absolute top-3 right-3 bg-bluegreen-eske text-white-eske px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Seleccionada
        </div>
      )}

      {/* Título */}
      <h3 className="text-base max-sm:text-sm font-bold text-bluegreen-eske mb-3 pr-20">
        {variante.titulo}
      </h3>

      {/* Texto del post */}
      <div className="mb-4">
        <p className="text-sm max-sm:text-xs text-gray-eske-90 dark:text-[#C7D6E0] leading-relaxed whitespace-pre-wrap">
          {variante.texto}
        </p>
      </div>

      {/* Contador de caracteres */}
      <div className="flex items-center justify-between mb-3 pb-3 border-t border-gray-eske-20 dark:border-white/10 pt-3">
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 ${isValid ? "text-green-eske-60 dark:text-green-eske-30" : "text-red-eske-60 dark:text-red-eske-20"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            {isValid ? (
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            ) : (
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            )}
          </svg>
          <span className={`text-xs font-medium ${getCounterColor(characterCount)}`}>
            {characterCount} / {POST_MAX_LENGTH} caracteres
          </span>
        </div>
      </div>

      {/* Botón de copiar */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleCopy();
        }}
        disabled={!canExport}
        className={`
          w-full
          px-4 py-2.5
          rounded-lg
          font-semibold
          text-sm
          flex items-center justify-center gap-2
          transition-all
          focus-ring-primary
          ${
            canExport
              ? "bg-bluegreen-eske text-white-eske hover:bg-bluegreen-eske/90"
              : "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-60 dark:text-[#6D8294] cursor-not-allowed"
          }
        `}
        aria-label={canExport ? "Copiar al portapapeles" : "Copia disponible solo en planes de pago"}
      >
        {copied ? (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            ¡Copiado!
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
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {canExport ? "Copiar" : "Copiar (Solo en planes de pago)"}
          </>
        )}
      </button>
    </article>
  );
}
