"use client";

// app/centinela/fontana/FontanaSesionesHub.tsx
// Punto 1 (verificación en navegador, 2026-08-19) — lista de sesiones
// sueltas del usuario (Escenarios b/c sin proyecto vinculado), mismo
// patrón de card-list que los hubs de PESTEL (app/centinela/pestel/page.tsx)
// y Moddulo (app/moddulo/page.tsx): fetch completo + cards con los datos
// clave, sin paginación (volumen esperado bajo por usuario, mismo
// criterio que esos 2 hubs).

import { useRouter } from "next/navigation";
import type { FontanaSesion } from "@/types/fontana.types";

function contarIndicadores(sesion: FontanaSesion): number {
  return (["F1", "F2", "F3", "F4", "F5"] as const).reduce((total, familia) => {
    const seleccion = sesion.indicadoresPorFamilia[familia];
    return total + new Set([...seleccion.minimos, ...seleccion.seleccionUsuario]).size;
  }, 0);
}

function labelTerritorio(sesion: FontanaSesion): string {
  const t = sesion.territorio;
  return t.nombre || [t.estado, t.municipio].filter(Boolean).join(" › ") || "Territorio sin definir";
}

export default function FontanaSesionesHub({
  sesiones, onExplorarNuevo,
}: {
  sesiones: FontanaSesion[];
  onExplorarNuevo: () => void;
}) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] py-10 px-4">
      <div className="max-w-lg mx-auto bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">Fontana</h1>
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">
              Tus exploraciones guardadas — sin proyecto de Moddulo vinculado todavía.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {sesiones.map((s) => (
            <button
              key={s.sesionId}
              type="button"
              onClick={() => router.push(`/centinela/fontana?sesion_id=${s.sesionId}`)}
              className="text-left px-4 py-3 rounded-lg border border-gray-eske-20 dark:border-white/10 hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
            >
              <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8]">{labelTerritorio(s)}</p>
              <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">
                {new Date(s.fechaUltimoGuardado).toLocaleDateString("es-MX")} · {contarIndicadores(s)} indicadores seleccionados
              </p>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onExplorarNuevo}
          className="px-4 py-2.5 rounded-lg bg-bluegreen-eske text-white-eske text-sm font-medium hover:bg-bluegreen-eske-60 transition-colors self-start"
        >
          Explorar nuevo territorio
        </button>
      </div>
    </main>
  );
}
