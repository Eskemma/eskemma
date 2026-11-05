// lib/moddulo/controlImportAuto.ts
// PURE. T5b — the guard of the automatic import («pest_analysis_id» in the URL, effect C7) and of its «Reintentar».
// Three promises: (1) never two calls in flight; (2) after a failure the SAME id is not tried again by the effect
// (the effect can re-run when unrelated state changes; without this it would loop on a failing server); (3) once the
// user closes the strip the effect stays quiet for that id (a different id may still arrive). The page keeps one instance in a ref.

export interface ControlImportAuto {
  /** ¿Puede el efecto disparar el import de este id? (hay id, nada en vuelo y este id no acaba de fallar). */
  puedeDispararAuto(pestId: string | null): boolean;
  /** Reserva el único vuelo; `false` si ya hay uno (doble clic en «Reintentar», efecto + botón). */
  comenzar(): boolean;
  /** Termina el vuelo. Un fallo (o un conflicto que abre el modal) marca el id para que el efecto no lo repita. */
  terminar(pestId: string, exito: boolean): void;
  /**
   * «Cerrar» la franja: el id queda ignorado por el efecto aunque el parámetro tarde en salir de la URL
   * (`router.replace` no es instantáneo); el llamador lo quita para que F5 no repita.
   */
  cerrar(pestId: string): void;
  enVuelo(): boolean;
}

export function crearControlImportAuto(): ControlImportAuto {
  let vuelo = false;
  let fallidoId: string | null = null;
  return {
    puedeDispararAuto: (pestId) => !!pestId && !vuelo && fallidoId !== pestId,
    comenzar: () => {
      if (vuelo) return false;
      vuelo = true;
      return true;
    },
    terminar: (pestId, exito) => {
      vuelo = false;
      fallidoId = exito ? null : pestId;
    },
    cerrar: (pestId) => {
      fallidoId = pestId;
    },
    enVuelo: () => vuelo,
  };
}
