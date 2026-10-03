// lib/pestel/informesTamano.ts
// Vigilancia del tamaño de pestel_analyses/{id}, que guarda TODOS los informes de E7
// dentro de su array `informes` (Firestore limita cada documento a 1 MiB).
//
// Decisión (26-10-03): no migrar todavía a subcolección. Medición real: el peor
// documento pesaba 105 KB (10 %) y ningún análisis tenía un mismo formato dos veces;
// llegar al 60 % exige ~4-5 regeneraciones con edición de CADA uno de los 5 formatos.
// Mientras tanto, esta alerta avisa antes de que el guardado empiece a fallar.
// Solución de fondo y su disparador: CLAUDE.md → Deuda Técnica, "Informes E7 dentro del
// documento pestel_analyses". Importante: si el versionado del Grupo 2 guarda UNA
// ENTRADA POR EDICIÓN, la subcolección deja de ser opcional y debe ser parte de ese diseño.
//
// Módulo puro (solo `reportarTamano` escribe en consola).

/** Límite de Firestore por documento (1 MiB). */
export const LIMITE_DOCUMENTO_BYTES = 1_048_576;
/** Aviso temprano. */
export const UMBRAL_AVISO = 0.6;
/** Señal de prioridad alta: hay que migrar a subcolección. */
export const UMBRAL_PRIORIDAD = 0.8;

export type NivelTamano = "ok" | "aviso" | "prioridad";

export interface EvaluacionTamano {
  bytes: number;
  /** 0..1 respecto del límite. */
  porcentaje: number;
  nivel: NivelTamano;
}

/**
 * Tamaño aproximado: JSON en UTF-8. Firestore cuenta distinto (nombres de campo + valores
 * con su propia codificación), pero el JSON lo sobrestima ligeramente (comillas y `\n`
 * escapados), así que la alerta es conservadora: avisa un poco antes de lo real.
 */
export function estimarBytes(valor: unknown): number {
  return Buffer.byteLength(JSON.stringify(valor ?? null), "utf8");
}

export function evaluarTamano(bytes: number): EvaluacionTamano {
  const porcentaje = bytes / LIMITE_DOCUMENTO_BYTES;
  const nivel: NivelTamano =
    porcentaje >= UMBRAL_PRIORIDAD ? "prioridad" : porcentaje >= UMBRAL_AVISO ? "aviso" : "ok";
  return { bytes, porcentaje, nivel };
}

/** Evalúa el documento tal como quedaría tras escribir `agregado` (p. ej. un informe nuevo). */
export function evaluarTamanoDocumento(doc: object, agregado?: unknown): EvaluacionTamano {
  return evaluarTamano(estimarBytes(doc) + (agregado === undefined ? 0 : estimarBytes(agregado)));
}

/**
 * Deja rastro en los logs del servidor según el nivel. Etiqueta fija `[informes][limite-1MB]`
 * para poder buscarla; el nivel de prioridad usa console.error para que destaque.
 */
export function reportarTamano(analysisId: string, ev: EvaluacionTamano, contexto: string): void {
  if (ev.nivel === "ok") return;
  const pct = (ev.porcentaje * 100).toFixed(0);
  const kb = (ev.bytes / 1024).toFixed(0);
  if (ev.nivel === "prioridad") {
    console.error(
      `[informes][limite-1MB] PRIORIDAD ALTA: pestel_analyses/${analysisId} al ${pct}% del límite ` +
        `(${kb} KB) tras ${contexto}. Migrar los informes a subcolección (CLAUDE.md, Deuda Técnica).`
    );
  } else {
    console.warn(
      `[informes][limite-1MB] aviso temprano: pestel_analyses/${analysisId} al ${pct}% del límite ` +
        `(${kb} KB) tras ${contexto}.`
    );
  }
}

/** ¿El error de Firestore es "documento demasiado grande"? Se reconoce por su mensaje. */
export function esErrorDocumentoLleno(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const mensaje = typeof (err as { message?: unknown }).message === "string"
    ? (err as { message: string }).message
    : "";
  return /exceeds the maximum|maximum (document )?size|too large/i.test(mensaje);
}
