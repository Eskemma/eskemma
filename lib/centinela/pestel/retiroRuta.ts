// lib/centinela/pestel/retiroRuta.ts
// T8a — pure pieces of the retirement of a route (410 + counter). No firebase, no network.
//
// The counter document stores ONLY totals and a date: no uid, no IP, no payload, no headers.
//   retiros_rutas/export-to-moddulo = { total, sinSesion, ultimaLlamada }
// `sinSesion` = calls that arrived without a valid session (what used to be a 401). `total` includes them.

export const RETIRO_COLECCION = "retiros_rutas";
export const RETIRO_EXPORT_TO_MODDULO = "export-to-moddulo";

export const MENSAJE_RETIRO_EXPORT_TO_MODDULO =
  "Esta ruta fue retirada. Para vincular un análisis de Centinela con un proyecto de Moddulo usa, en Centinela, " +
  "«Iniciar proyecto en Moddulo», «Vincular a proyecto existente» o, si ya está vinculado, " +
  "«Regresar a Moddulo F2 con resultados»; en Moddulo F2, el menú ⋮ → «Vincular con análisis independiente».";

/** The 410 body. `error` is a stable code for machines; `mensaje` is for people. */
export function cuerpoRetiro(mensaje: string): { error: "ruta_retirada"; mensaje: string } {
  return { error: "ruta_retirada", mensaje };
}

export interface ValoresContador {
  increment: (n: number) => unknown;
  ahora: unknown;
}

/** Document fields for one counter write. `pendientes` = calls accumulated by the throttle plus this one. */
export function camposContador(
  conteo: { total: number; sinSesion: number },
  v: ValoresContador
): Record<string, unknown> {
  const campos: Record<string, unknown> = { total: v.increment(conteo.total), ultimaLlamada: v.ahora };
  // `sinSesion` is always written (even as +0) so the field exists from the first call and the console shows it.
  campos.sinSesion = v.increment(conteo.sinSesion);
  return campos;
}

/**
 * Per-instance throttle for the counter. A public route that writes on every call could be hammered by a scanner
 * (a Firestore document sustains about one write per second). The first call of an instance writes at once; calls
 * inside the window are only added to memory and travel with the next write after the window. Consequences, declared:
 * `total`, `sinSesion` AND `ultimaLlamada` are LOWER BOUNDS / may lag. Calls held in memory are written only when ANOTHER
 * call reaches the same instance after the window; if none arrives (the instance freezes or is recycled) that tail is
 * lost for good. So: `total` and `sinSesion` can undercount, and `ultimaLlamada` can be older than the real last call.
 * What is guaranteed: the first call of each instance is written at once, so a document that does not exist means zero
 * calls reached any instance, and `total > 0` means at least that many. That is all the 30-day measurement needs.
 */
export function crearLimitador(ventanaMs: number, reloj: () => number = () => Date.now()) {
  let ultimaEscritura = -Infinity;
  let pendiente = { total: 0, sinSesion: 0 };
  return {
    /** Registers a call; returns what to write now, or null if the call stays in memory. */
    registrar(sinSesion: boolean): { total: number; sinSesion: number } | null {
      pendiente = { total: pendiente.total + 1, sinSesion: pendiente.sinSesion + (sinSesion ? 1 : 0) };
      const ahora = reloj();
      if (ahora - ultimaEscritura < ventanaMs) return null;
      ultimaEscritura = ahora;
      const aEscribir = pendiente;
      pendiente = { total: 0, sinSesion: 0 };
      return aEscribir;
    },
    /** A failed write gives its counts back so the next write carries them. */
    devolver(c: { total: number; sinSesion: number }) {
      pendiente = { total: pendiente.total + c.total, sinSesion: pendiente.sinSesion + c.sinSesion };
    },
  };
}
