"use client";

// app/centinela/fontana/FontanaCanal1Button.tsx
// Pieza 5 del plan de escenarios (b)/(c) (2026-08-19) — entrega real de
// Canal 1 en Escenario (a) (sesión con tareaPipIds[0] real). 3 estados
// (Punto 5): nunca entregado → "Entregar a Moddulo F3"; ya entregado →
// nota "Entregado el {fecha}" + "Actualizar entrega" + "Regresar a Moddulo
// F3"; en curso → spinner. Un solo try/catch cubriendo los 3 pasos
// (Punto 8): reservar contexto → subir a Storage → confirmar entrega.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FontanaSesion } from "@/types/fontana.types";
import { subirContextoTerritorial } from "@/lib/fontana/exportarContextoTerritorial";
import type { FontanaContextoTerritorial } from "@/types/fontana.types";

export default function FontanaCanal1Button({
  sesion, onSesionActualizada,
}: {
  sesion: FontanaSesion;
  onSesionActualizada: (sesion: FontanaSesion) => void;
}) {
  const router = useRouter();
  const [entregando, setEntregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectId = sesion.modduloProjectId!;

  async function handleEntregar() {
    setEntregando(true);
    setError(null);
    try {
      const resContexto = await fetch(`/api/fontana/sesion/${sesion.sesionId}/contexto`);
      if (!resContexto.ok) throw new Error("No se pudo preparar el resultado de Fontana.");
      const { contexto } = (await resContexto.json()) as { contexto: FontanaContextoTerritorial };
      const storagePath = await subirContextoTerritorial(projectId, contexto);

      const res = await fetch("/api/moddulo/f3/canal1/entregar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sesionId: sesion.sesionId, storagePath }),
      });
      const data = await res.json();
      // Mejora tras verificación en navegador (2026-08-19) — el mensaje
      // genérico ocultaba la causa real (ej. "Asignación de Canal 1 (T10)
      // no encontrada en el tablero"), indiagnosticable desde la UI. El
      // resultado ya se subió a Storage en este punto; se muestra el
      // motivo real del servidor cuando viene, con el genérico como
      // respaldo.
      if (!res.ok) {
        const motivo = data.message ?? data.error;
        throw new Error(
          motivo
            ? `El resultado se subió pero no se pudo confirmar la entrega: ${motivo}`
            : "El resultado se subió pero no se pudo confirmar la entrega."
        );
      }
      onSesionActualizada({ ...sesion, entregaCanal1: { fecha: data.fecha, resultadoId: data.resultadoId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEntregando(false);
    }
  }

  if (!sesion.entregaCanal1) {
    return (
      <div className="w-full flex flex-col items-center gap-1.5 sm:w-fit sm:items-end">
        <button
          type="button"
          onClick={handleEntregar}
          disabled={entregando}
          className="px-5 py-2.5 bg-white text-bluegreen-eske rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors shadow-sm disabled:opacity-60"
        >
          {entregando ? "Entregando…" : "Entregar a Moddulo F3"}
        </button>
        {error && <p className="text-xs text-red-eske max-w-xs text-right">{error}</p>}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-1.5 sm:w-fit sm:items-end">
      <p className="text-xs text-white/80">
        Entregado el {new Date(sesion.entregaCanal1.fecha).toLocaleDateString("es-MX")}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleEntregar}
          disabled={entregando}
          className="text-xs text-white/80 hover:text-white transition-colors underline underline-offset-2 disabled:opacity-50"
        >
          {entregando ? "Actualizando…" : "Actualizar entrega"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/moddulo/proyecto/${projectId}/investigacion`)}
          className="px-4 py-2 border border-white/30 text-white text-xs rounded-lg hover:bg-white/10 transition-colors"
        >
          Regresar a Moddulo F3
        </button>
      </div>
      {error && <p className="text-xs text-red-eske max-w-xs text-right">{error}</p>}
    </div>
  );
}
