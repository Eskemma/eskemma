"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { mensajeDeAvisoAsistente } from "@/lib/centinela/pestel/destinoTrasCrear";
import { urlSinAviso } from "@/lib/moddulo/guardadoHonesto";

// Aviso del asistente «Nuevo proyecto» (`?aviso=<código>`, lista cerrada, texto fijo por código; el valor
// de la URL nunca se pinta). Se lee una vez y se quita de la URL para que no reaparezca al recargar
// ni al compartir el enlace (mismo mecanismo que el aviso de cierre de fase de Moddulo).
function Aviso() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!searchParams.has("aviso")) return;
    setMensaje(mensajeDeAvisoAsistente(searchParams.get("aviso")));
    router.replace(urlSinAviso(pathname, searchParams.toString()));
  }, [searchParams, router, pathname]);

  if (!mensaje) return null;
  return (
    <div
      role="status"
      className="max-w-4xl mx-6 sm:mx-auto mt-4 flex items-start justify-between gap-3 rounded-lg border border-yellow-eske/30 bg-yellow-eske/10 px-3 py-2 text-sm text-brown-eske-60 dark:text-yellow-eske"
    >
      <span>{mensaje}</span>
      <button
        type="button"
        onClick={() => setMensaje(null)}
        aria-label="Cerrar aviso"
        className="shrink-0 font-medium underline focus-visible:outline focus-visible:outline-2"
      >
        Cerrar
      </button>
    </div>
  );
}

export default function AvisoAsistentePestel() {
  return (
    <Suspense fallback={null}>
      <Aviso />
    </Suspense>
  );
}
