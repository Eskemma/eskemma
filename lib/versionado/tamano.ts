// lib/versionado/tamano.ts
// Vigilancia del tamaño de los documentos del historial (límite de Firestore: 1 MiB por documento, H13).
// Los umbrales (60 % aviso, 80 % prioridad) son los de lib/pestel/informesTamano.ts, DUPLICADOS a propósito
// para no acoplar este módulo a PESTEL. Módulo puro (solo `reportarTamano` escribe en consola): importable
// desde cliente.

import { LIMITE_CONTENIDO_BYTES, LIMITE_DOCUMENTO_BYTES, UMBRAL_AVISO, UMBRAL_PRIORIDAD } from "./tipos";

export type NivelTamano = "ok" | "aviso" | "prioridad";

export interface EvaluacionTamano {
  bytes: number;
  /** 0..1 respecto del límite de 1 MiB. */
  porcentaje: number;
  nivel: NivelTamano;
}

/** JSON en UTF-8: sobrestima ligeramente lo que cuenta Firestore, así que la alerta es conservadora. */
export function estimarBytes(valor: unknown): number {
  return Buffer.byteLength(JSON.stringify(valor ?? null), "utf8");
}

export function evaluarTamanoVersion(bytes: number): EvaluacionTamano {
  const porcentaje = bytes / LIMITE_DOCUMENTO_BYTES;
  const nivel: NivelTamano =
    porcentaje >= UMBRAL_PRIORIDAD ? "prioridad" : porcentaje >= UMBRAL_AVISO ? "aviso" : "ok";
  return { bytes, porcentaje, nivel };
}

/** ¿Se guarda el contenido de la versión? Por encima del límite solo se guarda la huella (no restaurable). */
export function decidirContenido(bytes: number): { guardarContenido: boolean } {
  return { guardarContenido: bytes <= LIMITE_CONTENIDO_BYTES };
}

/** Deja rastro en los logs del servidor; etiqueta fija `[versionado][limite-1MB]` para poder buscarla. */
export function reportarTamano(ruta: string, ev: EvaluacionTamano): void {
  if (ev.nivel === "ok") return;
  const pct = (ev.porcentaje * 100).toFixed(0);
  const kb = (ev.bytes / 1024).toFixed(0);
  if (ev.nivel === "prioridad") {
    console.error(`[versionado][limite-1MB] PRIORIDAD ALTA: ${ruta} pesa ${kb} KB (${pct} % del límite de 1 MiB).`);
  } else {
    console.warn(`[versionado][limite-1MB] aviso temprano: ${ruta} pesa ${kb} KB (${pct} % del límite de 1 MiB).`);
  }
}
