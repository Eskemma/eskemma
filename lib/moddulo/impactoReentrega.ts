// lib/moddulo/impactoReentrega.ts
// SERVER-ONLY (usa `lib/versionado/huella`, que depende de node:crypto). C3b — qué se pierde cuando Fontana
// ENTREGA DE NUEVO sobre un resultado que ya está APROBADO en M2, y la huella que ata la confirmación del
// usuario a ese estado exacto. Puro: sin Firestore ni red.
//
// Regla de producto: el sistema avisa y el usuario decide. La semántica de la reentrega NO cambia (tras
// confirmar, el resultado queda sin aprobar y la tarea vuelve a «En curso»); solo deja de ocurrir en silencio.
//
// Las líneas dicen SOLO hechos verificables por el servidor. No prometen «volver a la anterior» (no existe
// lector ni restaurar hasta C4) y no afirman nada que la pantalla haya verificado por su cuenta.

import { huellaContenido } from "@/lib/versionado/huella";

export interface EstadoReentrega {
  resultado: { aprobado?: unknown; notasUsuario?: unknown };
  asignacion?: { estado?: unknown; resultadoId?: unknown };
}

/** Solo un resultado APROBADO pide confirmación; sin aprobación (o primera entrega) no hay nada que perder. */
export function requiereConfirmacionReentrega(resultado: { aprobado?: unknown } | undefined): boolean {
  return resultado?.aprobado === true;
}

/**
 * Huella del estado que el usuario vio: aprobación, notas, y estado y resultadoId de la asignación. Sin uid, sin
 * contenido del resultado (puede ser grande) y sin el sello del historial.
 */
export function huellaReentrega(e: EstadoReentrega): string {
  return huellaContenido({
    aprobado: e.resultado.aprobado === true,
    notasUsuario: typeof e.resultado.notasUsuario === "string" ? e.resultado.notasUsuario : null,
    estado: typeof e.asignacion?.estado === "string" ? e.asignacion.estado : null,
    resultadoId: typeof e.asignacion?.resultadoId === "string" ? e.asignacion.resultadoId : null,
  });
}

/**
 * ¿Trae el cuerpo una confirmación VÁLIDA? `confirmarReemplazo` debe ser exactamente `true` Y la huella debe ser un
 * texto igual a la actual. Cualquier otra cosa (ausente, malformada, vieja) es «no confirmado»: la ruta responde
 * 409 con el estado actual, nunca 400.
 */
export function confirmacionValida(
  cuerpo: { confirmarReemplazo?: unknown; huella?: unknown },
  huellaActual: string
): boolean {
  return cuerpo.confirmarReemplazo === true && typeof cuerpo.huella === "string" && cuerpo.huella === huellaActual;
}

const ZONA = "America/Mexico_City";

/** «12 de noviembre de 2026» en hora de la Ciudad de México (nunca UTC: cerca de la medianoche cambia el día). */
export function formatearFechaAprobacion(iso: string | null | undefined): string | null {
  if (typeof iso !== "string") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, day: "numeric", month: "long", year: "numeric" }).format(d);
}

export interface EntradaLineas {
  /** `aprobacion.en` de la versión VIGENTE del historial, solo si esa versión trae aprobado:true; si no, null. */
  selloEn: string | null;
  tieneNotas: boolean;
  /** La asignación de Canal 1 vuelve a «En curso» (su `resultadoId` apuntaba a este resultado). */
  reiniciaAsignacion: boolean;
}

/** Las líneas del aviso, en español claro. Solo hechos. */
export function lineasReentrega(e: EntradaLineas): string[] {
  const fecha = formatearFechaAprobacion(e.selloEn);
  const lineas = [
    `El resultado que entregaste antes está aprobado (${fecha ? `desde el ${fecha}` : "sin autoría registrada"}).`,
    "Al entregar de nuevo, quedará sin aprobar y tendrás que aprobarlo otra vez en «M2 · Resultados recibidos».",
  ];
  if (e.reiniciaAsignacion) {
    lineas.push("La tarea de Canal 1 volverá a «En curso» hasta que apruebes el resultado nuevo.");
  }
  if (e.tieneNotas) {
    lineas.push("Las notas que escribiste al aprobar dejarán de verse en el resultado.");
  }
  lineas.push("La versión aprobada queda guardada en el historial del proyecto: puedes consultarla en el panel «Historial» de la fase de Investigación del proyecto en Moddulo y, si tienes permiso, volver a ella desde ahí.");
  return lineas;
}
