// app/sefix/page.tsx
import { Metadata } from "next";
import { getServerSession } from "@/lib/server/session.server";
import SefixDashboard from "./SefixDashboard";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eskemma.com";

export const metadata: Metadata = {
  title: "SEFIX — Dashboard de datos electorales - México | Eskemma",
  description:
    "Dashboard de análisis del Padrón Electoral, Lista Nominal y resultados electorales de México. Datos oficiales INE.",
  alternates: {
    canonical: `${SITE_URL}/sefix`,
  },
};

export default async function SefixPage() {
  const session = await getServerSession();
  return <SefixDashboard role={session?.role ?? null} />;
}
