
//app/layout.tsx

import type { Metadata } from "next";
import { Arimo, PT_Sans, Philosopher } from "next/font/google";
import { ReactNode } from "react";
import "./globals.css";
import Layout from "./components/Layout";
import ClientOnlyBanner from "./components/legal/ClientOnlyBanner";

// Configura Arimo como fuente primaria
const arimo = Arimo({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-arimo",
});

// Configura PT Sans para captions
const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pt-sans",
});

// Configura Philosopher para títulos de posts en el blog
const philosopher = Philosopher({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-philosopher",
});

// Metadata dinámica según entorno
export const metadata: Metadata = {
  title: {
    default: "Eskemma | Consultoría Política",
    template: "%s | Eskemma",
  },
  description: "Plataforma con herramientas avanzadas para campañas políticas, comunicación política, consultoría electoral y análisis de datos electorales",
  
  // Control de indexación dinámico
  robots: {
    index: process.env.NEXT_PUBLIC_ENVIRONMENT === 'production',
    follow: process.env.NEXT_PUBLIC_ENVIRONMENT === 'production',
    noarchive: true,
    nosnippet: process.env.NEXT_PUBLIC_ENVIRONMENT !== 'production',
    noimageindex: process.env.NEXT_PUBLIC_ENVIRONMENT !== 'production',
  },
  
  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: 'https://eskemma.com',
    siteName: 'Eskemma',
    title: 'Eskemma | Consultoría Política',
    description: 'Plataforma con herramientas avanzadas para campañas políticas, comunicación política y análisis electoral',
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Eskemma | Consultoría Política',
    description: 'Plataforma integral para campañas políticas',
  },

  // Otros metadatos
  keywords: [
    'consultoría política',
    'campañas electorales',
    "campaña electoral",
    'análisis electoral',
    'datos electorales',
    'México',
    'estrategia electoral',
    'estrategia política',
  ],
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Script anti-FOUC: aplica .dark antes de que React hidrate */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('eskemma:theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();` }} />
        {/* Leaflet CSS — imported as static asset to avoid Tailwind v4 CSS scanner conflict */}
        <link rel="stylesheet" href="/leaflet.css" />
      </head>
      <body
        className={`${arimo.variable} ${ptSans.variable} ${philosopher.variable} min-h-screen`}
      >
        {/* Skip Link para accesibilidad */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 bg-bluegreen-eske text-white-eske px-6 py-3 rounded-lg font-semibold shadow-lg"
          style={{
            top: "5rem",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          Saltar al contenido principal
        </a>

        <Layout>{children}</Layout>
        <ClientOnlyBanner />
      </body>
    </html>
  );
}
