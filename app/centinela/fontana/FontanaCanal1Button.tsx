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
import { subirContextoTerritorial, subirReporteInterpretativo } from "@/lib/fontana/exportarContextoTerritorial";
import type { FontanaContextoTerritorial } from "@/types/fontana.types";

export default function FontanaCanal1Button({
  sesion, onSesionActualizada, reporteListo,
}: {
  sesion: FontanaSesion;
  onSesionActualizada: (sesion: FontanaSesion) => void;
  // Gate (26-09-09): la entrega solo se habilita cuando la sesión tiene un
  // reporte de sesión generado (pestaña Reporte).
  reporteListo: boolean;
}) {
  const router = useRouter();
  const [entregando, setEntregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Modal de resultado (26-09-12) — solo para la rama "Actualizar entrega"
  // (ya entregado antes), no para la primera entrega (ese caso ya tiene
  // suficiente feedback: la UI transiciona a la nota "Entregado el...").
  // No existe un componente de modal de notificación/resultado compartido
  // en el repo (barrido de los ~35 componentes con role="dialog" del sitio
  // — todos son de contenido propio por flujo, ninguno genérico) — este
  // modal mirror el mismo esqueleto visual ya usado en los modales de
  // Fontana (FontanaMunicipiosModal.tsx: fixed inset-0 + backdrop + panel
  // rounded-xl), consistente con el resto del módulo.
  const [resultadoModal, setResultadoModal] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);
  const projectId = sesion.modduloProjectId!;

  async function handleEntregar() {
    const esActualizacion = !!sesion.entregaCanal1;
    setEntregando(true);
    setError(null);
    try {
      const resContexto = await fetch(`/api/fontana/sesion/${sesion.sesionId}/contexto`);
      if (!resContexto.ok) throw new Error("No se pudo preparar el resultado de Fontana.");
      const { contexto } = (await resContexto.json()) as { contexto: FontanaContextoTerritorial };
      const storagePath = await subirContextoTerritorial(projectId, contexto);

      // Capa interpretativa (Opción A): sube el markdown del reporte a
      // Storage y adjunta solo su path al payload. El botón está gateado
      // por `reporteListo`, así que el reporte existe; el guard de 404 es
      // defensa en profundidad (p. ej. un repunte de tarea PIP concurrente
      // que lo invalidó) — en ese caso se entrega igual, sin la capa.
      let reporteStoragePath: string | undefined;
      try {
        const resRep = await fetch(`/api/fontana/sesion/${sesion.sesionId}/reporte`);
        if (resRep.ok) {
          const { contenidoMarkdown } = (await resRep.json()) as { contenidoMarkdown: string };
          reporteStoragePath = await subirReporteInterpretativo(projectId, contenidoMarkdown);
        }
      } catch {
        // best-effort: no bloquear la entrega de datos por la capa interpretativa
      }

      const res = await fetch("/api/moddulo/f3/canal1/entregar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sesionId: sesion.sesionId, storagePath, reporteStoragePath }),
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
      if (esActualizacion) {
        setResultadoModal({ tipo: "exito", mensaje: "La entrega se actualizó correctamente." });
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error inesperado";
      setError(mensaje);
      if (esActualizacion) {
        setResultadoModal({ tipo: "error", mensaje });
      }
    } finally {
      setEntregando(false);
    }
  }

  if (!sesion.entregaCanal1) {
    return (
      <div className="w-full flex flex-col gap-1.5 items-center sm:items-end sm:w-fit">
        {!reporteListo && (
          <p className="text-xs text-white/80 text-center sm:text-right max-w-xs">
            Genera el reporte de sesión (pestaña Reporte) para habilitar la entrega:
          </p>
        )}
        <button
          type="button"
          onClick={handleEntregar}
          disabled={entregando || !reporteListo}
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
          disabled={entregando || !reporteListo}
          className="text-xs text-white/80 hover:text-white transition-colors underline underline-offset-2 disabled:opacity-50"
        >
          {entregando ? <span className="text-red-eske">Actualizando…</span> : "Actualizar entrega"}
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

      {resultadoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resultado-actualizacion-title"
        >
          <div
            className="absolute inset-0 bg-black-eske/40"
            aria-hidden="true"
            onClick={() => setResultadoModal(null)}
          />
          <div className="relative z-10 bg-white-eske dark:bg-[#18324A] rounded-xl shadow-lg border border-gray-eske-20 dark:border-white/10 w-full max-w-sm p-6 flex flex-col gap-3">
            <h2
              id="resultado-actualizacion-title"
              className={`text-base font-semibold ${resultadoModal.tipo === "exito" ? "text-green-eske" : "text-red-eske"}`}
            >
              {resultadoModal.tipo === "exito" ? "Entrega actualizada" : "No se pudo actualizar la entrega"}
            </h2>
            <p className="text-sm text-black-eske dark:text-[#C7D6E0]">{resultadoModal.mensaje}</p>
            <button
              type="button"
              onClick={() => setResultadoModal(null)}
              className="self-end px-4 py-2 bg-bluegreen-eske text-white rounded-lg text-sm font-medium hover:bg-bluegreen-eske-60 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
