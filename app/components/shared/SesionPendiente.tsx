"use client";

// Spinner shown by AuthProvider while the session could not be verified because
// of a TRANSIENT error (network, Firestore unavailable, rate limit), and the
// "Sin conexión" panel for pages once the retries were exhausted.
// Contrast of the secondary text: black-eske-20 7.45:1 / #9AAEBE on dark.

import { useEffect, useState } from "react";
import { MS_TEXTO_SIN_CONEXION } from "@/lib/auth/decidirSesionTrasError";

export function EsperaSesionPendiente() {
  const [explicar, setExplicar] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setExplicar(true), MS_TEXTO_SIN_CONEXION);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-gray-eske-10 dark:bg-[#112230]"
      role="status"
      aria-live="polite"
    >
      <div
        className="animate-spin rounded-full h-10 w-10 border-4 border-bluegreen-eske border-t-transparent motion-reduce:animate-none"
        aria-hidden="true"
      />
      {explicar ? (
        <p className="text-sm text-black-eske-20 dark:text-[#9AAEBE]">Sin conexión. Reintentando…</p>
      ) : (
        <span className="sr-only">Verificando tu sesión</span>
      )}
    </div>
  );
}

export function SesionSinConexion({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-gray-eske-10 dark:bg-[#112230]"
      role="alert"
    >
      <p className="text-sm text-black-eske-20 dark:text-[#9AAEBE] max-w-sm">
        Sin conexión. No pudimos verificar tu sesión; no se cerró.
      </p>
      <button
        type="button"
        onClick={onReintentar}
        className="px-4 py-2 text-sm font-medium bg-bluegreen-eske text-white rounded-lg hover:bg-bluegreen-eske-60 transition-colors focus-visible:outline focus-visible:outline-2"
      >
        Reintentar
      </button>
    </div>
  );
}
