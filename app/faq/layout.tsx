// app/faq/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eskemma.com";

export const metadata: Metadata = {
  title: "Preguntas Frecuentes | Eskemma",
  description:
    "Respuestas a las preguntas más comunes sobre Eskemma: módulos disponibles, planes de suscripción, metodología y soporte para consultores y equipos políticos.",
  alternates: {
    canonical: `${SITE_URL}/faq`,
  },
};

export default function FaqLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
