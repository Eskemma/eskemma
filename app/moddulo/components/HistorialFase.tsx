"use client";

// C4a-2b — botón «Historial» de la cabecera + panel. El botón SOLO existe en las 3 fases con historial (`faseDeRuta`).
// Mientras el panel está abierto el contenido de la página (`contenidoRef`) queda `inert`; el panel se dibuja en un portal
// FUERA de ese subárbol. Al cerrar se quita el `inert` y el foco vuelve a este botón.

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { dondeVaElFoco, TEXTOS_PANEL } from "@/lib/moddulo/versionado/estadoPanelHistorial";
import { inertarCubiertos } from "@/lib/moddulo/versionado/inertCubiertos";
import PanelHistorial from "./PanelHistorial";
import { useHistorialFase } from "./useHistorialFase";
import { useVolver } from "./useVolver";

interface Props {
  projectId: string;
  pathname: string;
  contenidoRef: RefObject<HTMLElement | null>;
}

export default function HistorialFase({ projectId, pathname, contenidoRef }: Props) {
  const h = useHistorialFase(projectId, pathname);
  const botonRef = useRef<HTMLButtonElement>(null);
  const abierto = h.estado.abierto;
  // «Volver» (solo F3). Tras un 200 confirmado se recarga la 1.ª página del historial (la versión nueva queda «★ Versión actual»).
  const volver = useVolver(projectId, () => {
    if (abierto) h.actualizar();
  });
  const cancelarVolver = volver.cancelar;
  // Al abrir o cerrar el panel se descarta una vista terminada (éxito/error); con la escritura en vuelo no hace nada.
  useEffect(() => {
    cancelarVolver();
  }, [abierto, cancelarVolver]);

  useEffect(() => {
    if (!abierto) return;
    const contenido = contenidoRef.current;
    if (contenido) contenido.inert = true;
    // H-V63: cabecera y pie (solo los marcados con `data-cubre-dialogo`) también quedan inertes; se restauran en el cleanup.
    const restaurarCubiertos = inertarCubiertos(document);
    return () => {
      if (contenido) contenido.inert = false;
      restaurarCubiertos();
      // Primero se quita el `inert`, después se devuelve el foco (un elemento inerte no puede recibirlo).
      if (dondeVaElFoco("cerrar") === "boton_historial") botonRef.current?.focus();
    };
  }, [abierto, contenidoRef]);

  if (!h.fase) return null;
  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={h.abrir}
        aria-haspopup="dialog"
        aria-label={TEXTOS_PANEL.boton}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-2 text-sm text-white-eske transition-colors hover:bg-white-eske/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white-eske sm:min-h-[36px] sm:px-3"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="hidden sm:inline">{TEXTOS_PANEL.boton}</span>
      </button>
      {abierto && typeof document !== "undefined"
        ? createPortal(
            <PanelHistorial
              fase={h.fase}
              estado={h.estado}
              onCerrar={h.cerrar}
              onActualizar={h.actualizar}
              onCargarMas={h.cargarMas}
              onComprobarDeriva={h.comprobarDeriva}
              volver={
                h.fase === "investigacion"
                  ? {
                      estado: volver.estado,
                      clave: volver.claveRef.current,
                      onAbrir: volver.abrir,
                      onConfirmar: volver.confirmar,
                      onCancelar: volver.cancelar,
                      onVerHistorial: () => {
                        volver.cancelar();
                        h.actualizar();
                      },
                    }
                  : undefined
              }
            />,
            document.body
          )
        : null}
    </>
  );
}
