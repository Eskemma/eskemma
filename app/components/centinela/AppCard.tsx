// app/components/centinela/AppCard.tsx
"use client";

import Link from "next/link";

interface AppCardProps {
  name: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  available: boolean;
  tag?: string; // ej. "Nuevo", "Beta"
}

export default function AppCard({
  name,
  description,
  href,
  icon,
  available,
  tag,
}: AppCardProps) {
  const cardContent = (
    <div
      className={`group relative bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md p-6 flex flex-col gap-4 transition-all duration-200 h-full ${
        available
          ? "hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
          : "opacity-60 cursor-default"
      }`}
    >
      {/* Badges superiores */}
      <div className="flex items-start justify-between">
        {/* Ícono de la app */}
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-bluegreen-eske/10 text-bluegreen-eske">
          {icon}
        </div>
        <div className="flex items-center gap-2">
          {tag && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-bluegreen-eske text-white-eske">
              {tag}
            </span>
          )}
          {!available && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-[#112230] text-gray-500 dark:text-[#9AAEBE]">
              Próximamente
            </span>
          )}
        </div>
      </div>

      {/* Nombre y descripción */}
      <div className="flex-1">
        <h3
          className={`text-lg font-semibold mb-1 transition-colors duration-200 ${
            available
              ? "text-bluegreen-eske-60 group-hover:text-bluegreen-eske dark:text-[#6BA4C6] dark:group-hover:text-[#EAF2F8]"
              : "text-gray-500 dark:text-[#9AAEBE]"
          }`}
        >
          {name}
        </h3>
        <p className="text-sm text-gray-eske-90 dark:text-[#9AAEBE] leading-relaxed line-clamp-3">
          {description}
        </p>
      </div>

      {/* Botón de acción */}
      <div className="mt-auto pt-2 border-t border-gray-100 dark:border-white/10">
        {available ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-bluegreen-eske group-hover:gap-2.5 transition-all duration-200">
            Abrir app
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
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-[#6D8294]">Disponible próximamente</span>
        )}
      </div>
    </div>
  );

  if (!available) {
    return <div className="h-full">{cardContent}</div>;
  }

  return (
    <Link href={href} className="h-full block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske rounded-lg">
      {cardContent}
    </Link>
  );
}
