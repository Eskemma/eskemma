// lib/centinela/pestel/aprobacion.ts
// Reglas puras de la aprobación de un análisis PESTEL en Centinela (T6): justificación (ajuste y
// aprobación con confianza baja), retiro de la aprobación al ajustar, texto de la franja que lo dice y
// rótulo de informes anteriores al último ajuste. Sin firebase: lo comparten las rutas y las pantallas.

export const JUSTIFICACION_MIN = 20;
export const JUSTIFICACION_MAX = 1000;

export type ResultadoJustificacion =
  | { ok: true; valor: string }
  | { ok: false; motivo: "falta" | "corta" | "larga"; mensaje: string };

export function mensajeJustificacionLarga(longitud: number): string {
  return `La justificación no puede superar 1 000 caracteres (tiene ${longitud}). Acórtala.`;
}

/** Justificación de un AJUSTE: 20 a 1 000 caracteres (recortada). Mismos textos que la ruta de siempre. */
export function validarJustificacionAjuste(texto: unknown): ResultadoJustificacion {
  if (typeof texto !== "string" || texto.trim().length < JUSTIFICACION_MIN) {
    return { ok: false, motivo: "corta", mensaje: "La justificación debe tener al menos 20 caracteres." };
  }
  const valor = texto.trim();
  if (valor.length > JUSTIFICACION_MAX) {
    return { ok: false, motivo: "larga", mensaje: mensajeJustificacionLarga(valor.length) };
  }
  return { ok: true, valor };
}

export interface AprobacionAnterior {
  approvedAt: unknown;
  approvedBy: unknown;
  justificacion?: string;
  confianza?: number;
}

/**
 * Si el análisis está APPROVED, lo que se archiva de su aprobación al retirarla (copiado de la lectura
 * TRANSACCIONAL, sin `undefined`: Firestore no los admite). null si no estaba aprobado: no se retira nada.
 * Con un reintento de la transacción el documento ya no está APPROVED y devuelve null: no se vuelve a
 * copiar ni se pisa `aprobacionAnterior`.
 */
export function planRetiroAprobacion(data: {
  status?: unknown;
  approvedAt?: unknown;
  approvedBy?: unknown;
  aprobacionJustificacion?: unknown;
  aprobacionConfianza?: unknown;
}): { anterior: AprobacionAnterior } | null {
  if (data.status !== "APPROVED") return null;
  const anterior: AprobacionAnterior = {
    approvedAt: data.approvedAt ?? null,
    approvedBy: data.approvedBy ?? null,
  };
  if (typeof data.aprobacionJustificacion === "string") anterior.justificacion = data.aprobacionJustificacion;
  if (typeof data.aprobacionConfianza === "number") anterior.confianza = data.aprobacionConfianza;
  return { anterior };
}

/** Milisegundos de un valor de fecha de Firestore tal como llega al cliente (Timestamp, {_seconds}, ISO). */
export function aMillis(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    const o = v as { _seconds?: unknown; seconds?: unknown; toMillis?: () => number };
    if (typeof o.toMillis === "function") return o.toMillis();
    const s = typeof o._seconds === "number" ? o._seconds : typeof o.seconds === "number" ? o.seconds : null;
    if (s !== null) return s * 1000;
  }
  return null;
}

/**
 * Franja de «la aprobación se retiró», derivada de lo GUARDADO (sobrevive a recargas). Solo mientras el
 * análisis no esté aprobado. `etiquetaDimension` y `formatoFecha` los pone la pantalla.
 */
export function textoAprobacionRetirada(
  a: { status?: unknown; aprobacionAnterior?: { approvedAt?: unknown } | null; aprobacionRetirada?: { en?: unknown; porDimension?: unknown } | null },
  etiquetaDimension: (codigo: string) => string,
  formatoFecha: (ms: number) => string
): string | null {
  if (a.status === "APPROVED" || !a.aprobacionAnterior || !a.aprobacionRetirada) return null;
  const aprobada = aMillis(a.aprobacionAnterior.approvedAt);
  const retirada = aMillis(a.aprobacionRetirada.en);
  const dim = typeof a.aprobacionRetirada.porDimension === "string" ? etiquetaDimension(a.aprobacionRetirada.porDimension) : null;
  const partes = [
    aprobada !== null ? `La aprobación del ${formatoFecha(aprobada)} se retiró` : "La aprobación se retiró",
    dim ? ` por un ajuste en ${dim}` : " por un ajuste",
    retirada !== null ? ` el ${formatoFecha(retirada)}.` : ".",
    " Vuelve a aprobar cuando termines tus ajustes.",
  ];
  return partes.join("");
}

/**
 * ¿El informe se generó antes del último ajuste del analista? (los informes usan los ajustes: uno generado
 * antes de un ajuste nuevo quedó desfasado). Sin fechas válidas no se rotula.
 */
export function informeAnteriorAlAjuste(
  informe: { generadoEn?: unknown } | null | undefined,
  adjustments: { adjustedAt?: unknown }[] | null | undefined
): boolean {
  const generado = aMillis(informe?.generadoEn);
  if (generado === null) return false;
  let ultimo: number | null = null;
  for (const a of adjustments ?? []) {
    const t = aMillis(a.adjustedAt);
    if (t !== null && (ultimo === null || t > ultimo)) ultimo = t;
  }
  return ultimo !== null && generado < ultimo;
}
