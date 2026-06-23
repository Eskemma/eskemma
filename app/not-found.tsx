// app/not-found.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white-eske dark:bg-[#0B1620] px-6 text-center">
      <p className="text-6xl font-bold text-bluegreen-eske dark:text-bluegreen-eske-40 mb-4 select-none">
        404
      </p>
      <h1 className="text-2xl font-semibold text-black-eske dark:text-[#EAF2F8] mb-3">
        Página no encontrada
      </h1>
      <p className="text-black-eske-60 dark:text-[#9AAEBE] max-w-sm mb-8">
        La dirección que buscas no existe o fue movida. Puedes volver al inicio
        o explorar el contenido disponible.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-bluegreen-eske text-white-eske rounded-lg font-semibold hover:bg-bluegreen-eske-70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-2"
        >
          Volver al inicio
        </Link>
        <Link
          href="/blog"
          className="px-6 py-3 border border-gray-eske-20 dark:border-white/10 text-black-eske dark:text-[#EAF2F8] rounded-lg font-semibold hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-2"
        >
          Ir al blog
        </Link>
      </div>
    </main>
  );
}
