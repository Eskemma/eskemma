// app/moddulo/not-found.tsx
// 404 dentro de Moddulo: un proyecto eliminado (o sin acceso) al que apunta un enlace, p. ej. una sesión de
// Fontana vinculada a un proyecto que ya no existe. Mismo diseño que app/not-found.tsx, con salida útil.
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proyecto no encontrado — Moddulo | Eskemma",
  robots: { index: false, follow: false },
};

export default function ModduloNotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white-eske dark:bg-[#0B1620] px-6 text-center">
      <p className="text-6xl font-bold text-bluegreen-eske dark:text-bluegreen-eske-40 mb-4 select-none">
        404
      </p>
      <h1 className="text-2xl font-semibold text-black-eske dark:text-[#EAF2F8] mb-3">
        Proyecto no encontrado
      </h1>
      <p className="text-black-eske-20 dark:text-[#9AAEBE] max-w-sm mb-8">
        Este proyecto ya no existe o no tienes acceso a él. Puede que se haya eliminado. Vuelve a tus proyectos para
        continuar.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/moddulo"
          className="px-6 py-3 bg-bluegreen-eske text-white-eske rounded-lg font-semibold hover:bg-bluegreen-eske-70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-2"
        >
          Volver a mis proyectos
        </Link>
        <Link
          href="/"
          className="px-6 py-3 border border-gray-eske-20 dark:border-white/10 text-black-eske dark:text-[#EAF2F8] rounded-lg font-semibold hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-2"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
