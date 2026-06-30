// app/centinela/page.tsx
import type { ReactNode } from "react";
import { Metadata } from "next";
import CentinelaHeroSection from "./CentinelaHeroSection";
import AppCard from "../components/centinela/AppCard";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eskemma.com";

export const metadata: Metadata = {
  title: "Centinela — Inteligencia de Contexto | Eskemma",
  description:
    "Suite de herramientas de monitoreo y análisis de contexto político, económico y social para consultores y equipos de campaña.",
  alternates: {
    canonical: `${SITE_URL}/centinela`,
  },
};

// ──────────────────────────────────────────────
// Catálogo de apps del Centinela
// ──────────────────────────────────────────────
const MONITOR_APPS: Array<{
  name: string;
  description: string;
  href: string;
  available: boolean;
  tag?: string;
  accentColor?: string;
  icon: ReactNode;
}> = [
  {
    name: "PESTEL",
    description:
      "Monitoreo configurable de contexto PESTEL en tiempo real. Analiza el entorno político, económico, social, tecnológico, ecológico y legal de tu territorio para alimentar tu estrategia.",
    href: "/centinela/pestel",
    available: true,
    tag: "Nuevo",
    accentColor: "#ee701d",
    icon: (
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
          strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ),
  },
  {
    name: "Termómetro",
    description:
      "Mide el pulso de la opinión pública con encuestas automatizadas y análisis de sentimiento en redes sociales por territorio.",
    href: "/centinela/termometro",
    available: false,
    icon: (
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
          strokeWidth={1.5}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
    ),
  },
  {
    name: "Radar Electoral",
    description:
      "Seguimiento en tiempo real de la competencia electoral: actores, movimientos, recursos, eventos y alertas de adversarios.",
    href: "/centinela/radar-electoral",
    available: false,
    icon: (
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
          strokeWidth={1.5}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        />
      </svg>
    ),
  },
  {
    name: "Reputómetro",
    description:
      "Análisis de reputación y presencia mediática del candidato o servidor público. Cobertura, tono, alcance y tendencias por medio.",
    href: "/centinela/reputometro",
    available: false,
    icon: (
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
          strokeWidth={1.5}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    ),
  },
  {
    name: "Bitácora Legislativa",
    description:
      "Seguimiento automatizado de la agenda legislativa federal y estatal. Iniciativas, votaciones, actores y alertas de impacto territorial.",
    href: "/centinela/bitacora-legislativa",
    available: false,
    icon: (
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
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    name: "Panel de Obra",
    description:
      "Monitoreo de avance de obra pública y programas sociales por territorio. Indicadores de gestión y cumplimiento de compromisos de campaña.",
    href: "/centinela/panel-de-obra",
    available: false,
    icon: (
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
          strokeWidth={1.5}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
];

export default function MonitorPage() {
  return (
    <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      <CentinelaHeroSection />

      {/* Sección de apps */}
      <section className="max-w-7l mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-14">
        {/* Encabezado de sección */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-[#EAF2F8]">
            Herramientas de Monitoreo
          </h2>
          <p className="mt-1 text-sm text-gray-eske-90 dark:text-[#9AAEBE]">
            Selecciona una app para comenzar tu análisis de contexto.
          </p>
        </div>

        {/* Grid de apps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {MONITOR_APPS.map((app) => (
            <AppCard
              key={app.href}
              name={app.name}
              description={app.description}
              href={app.href}
              icon={app.icon}
              available={app.available}
              tag={app.tag}
              accentColor={app.accentColor}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
