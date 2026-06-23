// app/contacto/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eskemma.com";

export const metadata: Metadata = {
  title: "Contacto | Eskemma",
  description:
    "Ponte en contacto con el equipo de Eskemma. Resolvemos tus dudas sobre la plataforma de consultoría política y sus módulos.",
  alternates: {
    canonical: `${SITE_URL}/contacto`,
  },
};

export default function ContactoLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
