// app/centinela/fontana/notas-metodologicas/page.tsx
// Página de lectura de "Notas metodológicas de Fontana" — Server
// Component que solo lee el .md del repo (contenido editorial estático,
// editado a mano, sin generación por IA ni Firestore — ver Fase 4 del
// plan de arquitectura) y lo pasa al visor compartido. Cuando llegue
// Sefix-AI (u otra app), su página equivalente hace exactamente esto con
// su propio .md — sin tocar MethodologyDocView.

import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import MethodologyDocView from "@/app/components/shared/MethodologyDoc/MethodologyDocView";

export const metadata: Metadata = {
  title: "Notas metodológicas de Fontana — Eskemma",
  description: "Cómo Fontana obtiene sus datos, qué tan confiables son y qué hace cuando algo no está disponible.",
  robots: { index: false, follow: false },
};

const RUTA_DOC = path.join(
  process.cwd(),
  "docs/ecosistema/T10-fontana/Fontana_T10_Notas_Metodologicas.md"
);

export default function NotasMetodologicasPage() {
  const markdown = fs.readFileSync(RUTA_DOC, "utf-8");

  return (
    <div className="min-h-screen bg-white-eske dark:bg-[#0F2233]">
      <div className="bg-bluegreen-eske text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold">Notas metodológicas</h1>
          <p className="text-white/80 text-sm mt-0.5">Fontana — datos abiertos institucionales</p>
        </div>
      </div>
      <MethodologyDocView markdown={markdown} brandLabel="Fontana" baseName="Notas-metodologicas-Fontana" />
    </div>
  );
}
