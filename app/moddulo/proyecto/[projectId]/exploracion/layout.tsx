// app/moddulo/proyecto/[projectId]/exploracion/layout.tsx
// Server component: provee metadata SEO para la ruta autenticada F2-Exploración.
// page.tsx es "use client" y no puede exportar metadata directamente.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "F2 · Exploración — Moddulo | Eskemma",
  robots: { index: false, follow: false },
};

export default function ExploracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
