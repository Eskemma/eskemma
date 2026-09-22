// app/components/moddulo/UnderConstructionApp.tsx
"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface UnderConstructionAppProps {
  appName: string;
  appIcon: string;
  isComingSoon: boolean;
}

export default function UnderConstructionApp({
  appName,
  appIcon,
  isComingSoon,
}: UnderConstructionAppProps) {
  return (
    <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white-eske dark:bg-[#18324A] rounded-lg shadow-lg p-8 max-sm:p-6 text-center">
        {/* Ícono de la app */}
        <div className="relative w-24 h-24 max-sm:w-20 max-sm:h-20 mx-auto mb-6">
          <Image
            src={appIcon}
            alt=""
            fill
            className="object-contain"
            aria-hidden="true"
          />
        </div>

        {/* Título */}
        <h1 className="text-3xl max-sm:text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-4">
          {appName}
        </h1>

        {/* Estado */}
        {isComingSoon ? (
          <>
            <div className="inline-block bg-yellow-eske/20 dark:bg-yellow-eske/10 text-brown-eske-80 dark:text-yellow-eske-40 px-4 py-2 rounded-full mb-6">
              <span className="font-medium text-sm">Próximamente</span>
            </div>
            <p className="text-lg max-sm:text-base text-gray-eske-70 dark:text-[#9AAEBE] mb-8">
              Estamos trabajando en esta aplicación. Pronto estará disponible para ti.
            </p>
          </>
        ) : (
          <>
            <div className="inline-block bg-blue-eske/20 text-blue-eske-80 dark:text-blue-eske-30 px-4 py-2 rounded-full mb-6">
              <span className="font-medium text-sm">En Desarrollo</span>
            </div>
            <p className="text-lg max-sm:text-base text-gray-eske-70 dark:text-[#9AAEBE] mb-8">
              Esta aplicación está actualmente en proceso de construcción.
            </p>
          </>
        )}

        {/* Ilustración */}
        <div className="bg-gray-eske-10 dark:bg-[#112230] rounded-lg p-8 max-sm:p-6 mb-8">
          <svg
            className="w-32 h-32 max-sm:w-24 max-sm:h-24 mx-auto text-gray-eske-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
        </div>

        {/* Información adicional */}
        <div className="bg-bluegreen-50 dark:bg-[#112230] border border-bluegreen-eske dark:border-bluegreen-eske-60 rounded-lg p-4 mb-8 text-left">
          <h2 className="font-bold text-base text-bluegreen-eske mb-2">
            💡 ¿Qué puedes hacer mientras?
          </h2>
          <ul className="space-y-2 text-sm text-gray-eske-70 dark:text-[#9AAEBE]">
            <li className="flex items-start gap-2">
              <span className="text-bluegreen-eske">•</span>
              <span>Explora las demás aplicaciones disponibles en tu plan</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bluegreen-eske">•</span>
              <span>Revisa nuestro blog para consejos sobre estrategia política</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bluegreen-eske">•</span>
              <span>Contáctanos si tienes sugerencias para esta app</span>
            </li>
          </ul>
        </div>

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/moddulo"
            className="
              bg-bluegreen-eske
              text-white-eske
              px-6 py-3 max-sm:py-2.5
              rounded-lg
              font-medium
              text-base max-sm:text-sm
              hover:bg-bluegreen-eske-60
              transition-colors
              focus-ring-primary
              inline-block
            "
          >
            Volver al Hub
          </Link>

          <Link
            href="/contacto"
            className="
              bg-gray-eske-10 dark:bg-[#21425E]
              text-gray-eske-80 dark:text-[#C7D6E0]
              px-6 py-3 max-sm:py-2.5
              rounded-lg
              font-medium
              text-base max-sm:text-sm
              hover:bg-gray-eske-20
              transition-colors
              focus-ring-primary
              inline-block
            "
          >
            Contactar Soporte
          </Link>
        </div>
      </div>
    </div>
  );
}
