// lib/moddulo/eventosProyecto.ts
// C4b-2a — aviso entre el panel «Historial» (vive en el layout) y la página de la fase (tiene su propio estado).
// Tras un «volver» confirmado por el servidor (200) el panel AVISA; la página se suscribe y vuelve a leer proyecto y
// resultados. Módulo puro: el destino del evento se inyecta (`EventTarget`); por defecto es `window` (solo en el navegador).

export const EVENTO_PROYECTO_ACTUALIZADO = "moddulo:proyecto-actualizado";

/** Lo mínimo que se necesita de un destino de eventos (`window` o un `EventTarget`). */
export interface DestinoEventos {
  addEventListener(tipo: string, cb: (e: Event) => void): void;
  removeEventListener(tipo: string, cb: (e: Event) => void): void;
  dispatchEvent(e: Event): boolean;
}

function destinoPorDefecto(): DestinoEventos | null {
  return typeof window !== "undefined" ? (window as unknown as DestinoEventos) : null;
}

/** Avisa que el proyecto cambió en el servidor. Sin destino (servidor, pruebas sin ventana) no hace nada. */
export function avisarProyectoActualizado(projectId: string, destino: DestinoEventos | null = destinoPorDefecto()): void {
  if (!destino || typeof projectId !== "string" || projectId.length === 0) return;
  destino.dispatchEvent(new CustomEvent(EVENTO_PROYECTO_ACTUALIZADO, { detail: { projectId } }));
}

/** Suscribe `cb` a los avisos de ESTE proyecto (los de otro se ignoran). Devuelve el desuscriptor. */
export function suscribirProyectoActualizado(
  projectId: string,
  cb: () => void,
  destino: DestinoEventos | null = destinoPorDefecto()
): () => void {
  if (!destino) return () => {};
  const alEvento = (e: Event) => {
    const detalle = (e as CustomEvent<{ projectId?: unknown }>).detail;
    if (detalle && detalle.projectId === projectId) cb();
  };
  destino.addEventListener(EVENTO_PROYECTO_ACTUALIZADO, alEvento);
  return () => destino.removeEventListener(EVENTO_PROYECTO_ACTUALIZADO, alEvento);
}
