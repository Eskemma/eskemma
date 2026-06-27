// app/components/moddulo/WhatIsModduloModal.tsx
"use client";

import React, { useEffect } from "react";
import Link from "next/link";

interface WhatIsModduloModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatIsModduloModal({ isOpen, onClose }: WhatIsModduloModalProps) {
  // Cerrar con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="moddulo-modal-title"
    >
      <div
        className="
          bg-white-eske dark:bg-[#18324A]
          rounded-lg
          shadow-2xl
          w-full
          max-w-lg
          max-h-[85vh]
          overflow-y-auto
          p-6 max-sm:p-4
          relative
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="
            absolute
            top-4 right-4
            text-gray-eske-70 dark:text-[#9AAEBE]
            hover:text-black-eske dark:hover:text-[#EAF2F8]
            transition-colors
            focus-ring-primary
            rounded-full
            p-1
          "
          aria-label="Cerrar modal"
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

        {/* Contenido */}
        <div className="space-y-6">
          {/* Header */}
          <div className="pr-8">
            <h2
              id="moddulo-modal-title"
              className="text-2xl max-sm:text-xl font-bold text-black-eske dark:text-[#EAF2F8] mb-2"
            >
              ¿Qué incluye Moddulo?
            </h2>
            <p className="text-base max-sm:text-sm text-gray-eske-90 dark:text-[#9AAEBE]">
              Tu ecosistema completo de apps políticas impulsadas por IA
            </p>
          </div>

          {/* Lista de planes */}
          <div className="space-y-4">
            {/* Plan Basic */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 max-sm:p-3">
              <div className="flex items-start gap-3">
                <div className="bg-blue-eske text-white-eske rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold text-sm">
                  8
                </div>
                <div>
                  <h3 className="font-bold text-base max-sm:text-sm text-black-eske dark:text-[#EAF2F8] mb-1">
                    Plan Basic
                  </h3>
                  <p className="text-sm max-sm:text-xs text-gray-eske-90 dark:text-[#9AAEBE] mb-2">
                    Herramientas fundamentales para gestión de campañas
                  </p>
                  <ul className="text-xs max-sm:text-[11px] text-gray-eske-80 dark:text-[#9AAEBE] space-y-1">
                    <li>• Redactor Político</li>
                    <li>• CRM Comunitario</li>
                    <li>• Dashboard, Calendario y más</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Plan Premium */}
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 max-sm:p-3">
              <div className="flex items-start gap-3">
                <div className="bg-orange-eske text-white-eske rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold text-sm">
                  16
                </div>
                <div>
                  <h3 className="font-bold text-base max-sm:text-sm text-black-eske dark:text-[#EAF2F8] mb-1">
                    Plan Premium
                  </h3>
                  <p className="text-sm max-sm:text-xs text-gray-eske-90 dark:text-[#9AAEBE] mb-2">
                    Todo lo de Basic + IA avanzada y multi-agente
                  </p>
                  <ul className="text-xs max-sm:text-[11px] text-gray-eske-80 dark:text-[#9AAEBE] space-y-1">
                    <li>• Centro de Escucha Social</li>
                    <li>• Estratega IA</li>
                    <li>• Upgrades Premium con ML</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Plan Professional */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 max-sm:p-3">
              <div className="flex items-start gap-3">
                <div className="bg-green-600 text-white-eske rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold text-sm">
                  25
                </div>
                <div>
                  <h3 className="font-bold text-base max-sm:text-sm text-black-eske dark:text-[#EAF2F8] mb-1">
                    Plan Professional
                  </h3>
                  <p className="text-sm max-sm:text-xs text-gray-eske-90 dark:text-[#9AAEBE] mb-2">
                    Suite completa para campañas exitosas
                  </p>
                  <ul className="text-xs max-sm:text-[11px] text-gray-eske-80 dark:text-[#9AAEBE] space-y-1">
                    <li>• Sala de Crisis</li>
                    <li>• Centinela de Redes Avanzado</li>
                    <li>• Territorio Digital y más</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3 pt-2">
            <Link
              href="/#suscripciones"
              className="
                block
                w-full
                bg-orange-eske
                text-white-eske
                text-center
                px-6 py-3 max-sm:py-2.5
                rounded-lg
                font-medium
                text-base max-sm:text-sm
                hover:bg-orange-eske-60
                transition-colors
                focus-ring-primary
              "
              onClick={onClose}
            >
              Ver Planes y Precios
            </Link>

            <button
              onClick={onClose}
              className="
                block
                w-full
                bg-gray-eske-60
                text-white-eske
                text-center
                px-6 py-2.5 max-sm:py-2
                rounded-lg
                font-medium
                text-sm max-sm:text-xs
                hover:bg-gray-eske-90
                transition-colors
                focus-ring-primary
              "
            >
              Explorar Apps
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
