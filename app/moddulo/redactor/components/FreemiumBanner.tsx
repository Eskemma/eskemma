// app/moddulo/redactor/components/FreemiumBanner.tsx
"use client";

import React from "react";
import Link from "next/link";

interface FreemiumBannerProps {
  generationsUsed: number;
  generationsLimit: number;
  isLimitReached: boolean;
}

export default function FreemiumBanner({
  generationsUsed,
  generationsLimit,
  isLimitReached,
}: FreemiumBannerProps) {
  if (isLimitReached) {
    return (
      <div
        className="bg-linear-to-r from-orange-eske to-orange-eske-70 text-white-eske rounded-lg p-6 max-sm:p-4 shadow-lg"
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-4 max-sm:flex-col">
          {/* Icono */}
          <div className="shrink-0">
            <svg
              className="w-12 h-12 max-sm:w-10 max-sm:h-10"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Contenido */}
          <div className="flex-1">
            <h3 className="text-lg max-sm:text-base font-bold mb-2">
              Has alcanzado el límite de la versión gratuita
            </h3>
            <p className="text-sm max-sm:text-xs mb-4 opacity-95">
              Ya utilizaste tus <strong>{generationsLimit} generaciones gratuitas</strong>. Mejora al
              Plan Básico para acceso ilimitado al Redactor Político y todas sus funciones.
            </p>

            {/* Beneficios del Plan Básico */}
            <div className="bg-white-eske/10 rounded-lg p-4 mb-4">
              <p className="text-xs font-semibold mb-2 opacity-90">
                Lo que obtienes con el Plan Básico:
              </p>
              <ul className="space-y-1.5">
                {[
                  "Generaciones ilimitadas",
                  "3 variantes por post",
                  "5 hashtags por generación",
                  "Historial completo",
                  "Exportación a TXT/JSON",
                ].map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs">
                    <svg
                      className="w-4 h-4 shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Botones */}
            <div className="flex gap-3 max-sm:flex-col">
              <Link
                href="/#suscripciones"
                className="
                  inline-flex items-center justify-center
                  bg-white-eske
                  text-orange-eske
                  px-6 py-3
                  rounded-lg
                  font-bold
                  text-sm
                  hover:bg-white-eske/90
                  transition-all
                  focus-ring-light
                  shadow-md
                "
              >
                <svg
                  className="w-5 h-5 mr-2"
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
                Mejorar a Plan Básico
              </Link>

              <Link
                href="/moddulo"
                className="
                  inline-flex items-center justify-center
                  bg-white-eske/10
                  text-white-eske
                  px-6 py-3
                  rounded-lg
                  font-semibold
                  text-sm
                  hover:bg-white-eske/20
                  transition-all
                  focus-ring-light
                "
              >
                Volver al Hub
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Banner informativo (aún no alcanza el límite)
  return (
    <div
      className="bg-blue-eske/10 dark:bg-blue-eske/20 border-l-4 border-blue-eske text-blue-eske-90 dark:text-blue-eske-20 p-4 rounded-r-lg"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium">
            Versión gratuita: Has usado <strong>{generationsUsed} de {generationsLimit}</strong> generaciones.
          </p>
          <p className="text-xs mt-1 opacity-80">
            Mejora al Plan Básico ($2,899/mes) para acceso ilimitado.{" "}
            <Link href="/#suscripciones" className="underline font-semibold hover:opacity-80">
              Ver planes
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
