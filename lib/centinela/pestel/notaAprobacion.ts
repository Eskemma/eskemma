// lib/centinela/pestel/notaAprobacion.ts
// T7 C3: la NOTA DE APROBACIÓN de un análisis de Centinela — lo que el analista dijo al aprobarlo con confianza global
// baja (< 50). Pura (sin firebase ni crypto): la comparten las rutas que importan (guardan `linkedSource.aprobacionOrigen`),
// la huella de origen v2, el estado `cambio_nota`, el aviso de Centinela y los textos de F2.
//
// La nota NO viaja en el mapa de trabajo de F2 ni en ningún prompt: es un hermano de `linkedSource`, solo para pantalla
// y descargas, atribuida «según el analista» (sin uid).
//
// Cuándo existe (la «nota actual» de un análisis): el análisis está APPROVED y su confianza global es insuficiente.
//  - `confianza`     = globalConfidence (siempre disponible; así el caso aprobado con 39 ANTES de T6-9a, sin justificación
//                      guardada, también se puede describir: «no hay justificación registrada»).
//  - `justificacion` = la que guardó /approve (recortada); se omite si no existe. Nunca una cadena vacía.
//  - `aprobadoEn`    = fecha de la aprobación (ISO); solo se muestra, NO entra en la huella.
// Un ajuste retira la aprobación (status → REVIEWED): la nota actual deja de existir.

import { aMillis, confianzaInsuficiente } from "./aprobacion";

export interface NotaAprobacion {
  confianza: number;
  justificacion?: string;
  aprobadoEn?: string;
}

export interface AnalisisConNota {
  status?: unknown;
  globalConfidence?: unknown;
  aprobacionJustificacion?: unknown;
  approvedAt?: unknown;
}

export function notaDeAprobacion(a: AnalisisConNota | null | undefined): NotaAprobacion | null {
  if (!a || a.status !== "APPROVED" || !confianzaInsuficiente(a.globalConfidence)) return null;
  const j = typeof a.aprobacionJustificacion === "string" ? a.aprobacionJustificacion.trim() : "";
  const ms = aMillis(a.approvedAt);
  return {
    confianza: a.globalConfidence as number,
    ...(j ? { justificacion: j } : {}),
    ...(ms !== null && Number.isFinite(ms) ? { aprobadoEn: new Date(ms).toISOString() } : {}),
  };
}

/** Lee `linkedSource.aprobacionOrigen` sin confiar en su forma; null si no cuadra. */
export function leerNotaGuardada(x: unknown): NotaAprobacion | null {
  if (!x || typeof x !== "object") return null;
  const o = x as { confianza?: unknown; justificacion?: unknown; aprobadoEn?: unknown };
  if (typeof o.confianza !== "number" || !Number.isFinite(o.confianza)) return null;
  const j = typeof o.justificacion === "string" ? o.justificacion.trim() : "";
  return {
    confianza: o.confianza,
    ...(j ? { justificacion: j } : {}),
    ...(typeof o.aprobadoEn === "string" && o.aprobadoEn ? { aprobadoEn: o.aprobadoEn } : {}),
  };
}

/** Misma nota para F2: ambas ausentes, o misma confianza y misma justificación recortada (la fecha no cuenta). */
export function notaEquivalente(a: NotaAprobacion | null | undefined, b: NotaAprobacion | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.confianza === b.confianza && (a.justificacion ?? "").trim() === (b.justificacion ?? "").trim();
}

/** Parte de la nota que entra en la huella v2 (sin la fecha). */
export function notaParaHuella(n: NotaAprobacion | null | undefined): { confianza: number; justificacion?: string } | null {
  const j = typeof n?.justificacion === "string" ? n.justificacion.trim() : "";
  return n ? { confianza: n.confianza, ...(j ? { justificacion: j } : {}) } : null;
}

/**
 * ¿La importación guardó la nota? Solo las importaciones con huella v2 (T7 C3). Las anteriores (v1 o sin huella) NUNCA
 * la tienen, ni siquiera reimportando el mismo análisis sin cambios (la regla v1 lo trata como idéntico).
 */
export function importacionConNota(huella: { v?: unknown } | null | undefined): boolean {
  return !!huella && huella.v === 2;
}

export const TEXTO_NOTA_NO_DISPONIBLE = "No disponible para esta importación (se hizo antes de que F2 guardara la nota de aprobación).";

/** Texto de la nota tal como la ve F2 (pantalla y descargas), atribuida al analista. null = no hay nada que decir. */
export function textoNotaAprobacion(
  huella: { v?: unknown } | null | undefined,
  nota: NotaAprobacion | null | undefined
): { tipo: "no_disponible" | "sin_justificacion" | "con_justificacion"; texto: string } | null {
  if (!importacionConNota(huella)) return { tipo: "no_disponible", texto: TEXTO_NOTA_NO_DISPONIBLE };
  if (!nota) return null;
  if (!nota.justificacion) {
    return {
      tipo: "sin_justificacion",
      texto: `El análisis se aprobó con una confianza global de ${Math.round(nota.confianza)} %, por debajo del 50 % recomendado; no hay justificación registrada.`,
    };
  }
  return {
    tipo: "con_justificacion",
    texto: `Según el analista, que aprobó el análisis con una confianza global de ${Math.round(nota.confianza)} %: «${nota.justificacion}»`,
  };
}

/** Lo que el resumen de Centinela sabe de la nota que F2 importó (`GET project/[id]?ajustesImportados=1`). */
export interface NotaImportadaResumen {
  v: number | null;
  nota: NotaAprobacion | null;
  sourceAnalysisId: string | null;
}

/**
 * ¿Debe Centinela avisar «Moddulo F2 aún no refleja la nota de aprobación»? Solo si es ACCIONABLE: el vínculo es v2
 * (las importaciones v1 o sin huella nunca adquieren la nota, ni reimportando: avisar sería inaccionable), F2 importó
 * ESTE análisis, el análisis tiene nota ahora y no es equivalente a la importada. Derivado del dato, no de un contador.
 */
export function notaSinReflejarEnF2(
  analisisId: string | undefined,
  notaActual: NotaAprobacion | null,
  importada: NotaImportadaResumen | null | undefined
): boolean {
  if (!importada || importada.v !== 2 || !analisisId || importada.sourceAnalysisId !== analisisId) return false;
  if (!notaActual) return false;
  return !notaEquivalente(notaActual, importada.nota);
}

export const TEXTO_NOTA_SIN_REFLEJAR_F2 =
  "Moddulo F2 todavía no incluye la nota de aprobación de este análisis. Para llevarla, usa «Regresar a Moddulo F2 con resultados» (en las pantallas de Análisis o Monitoreo).";

/**
 * Frase para la línea de trazabilidad y las descargas de F2 (T7 C3). Solo para un análisis de Centinela importado
 * (T22 con análisis): importación anterior (huella v1 o sin huella) → «no disponible»; v2 con nota → la nota
 * atribuida al analista; v2 sin nota → nada. Derivada del dato, nunca inventa una justificación.
 */
export function fraseNotaParaTrazabilidad(
  ls: { kind?: string; sourceAnalysisId?: string; huellaFuente?: { v?: unknown }; aprobacionOrigen?: unknown } | undefined
): string | null {
  if (!ls || ls.kind !== "T22" || !ls.sourceAnalysisId) return null;
  const t = textoNotaAprobacion(ls.huellaFuente, leerNotaGuardada(ls.aprobacionOrigen));
  if (!t) return null;
  return t.tipo === "no_disponible" ? `Nota de aprobación del analista: ${t.texto.charAt(0).toLowerCase()}${t.texto.slice(1)}` : t.texto;
}

/** Agrega la frase de la nota al final de una línea de trazabilidad (que ya termina en punto). null se queda null. */
export function anexarNotaALinea(
  linea: string | null,
  ls: Parameters<typeof fraseNotaParaTrazabilidad>[0]
): string | null {
  if (!linea) return null;
  const f = fraseNotaParaTrazabilidad(ls);
  return f ? `${linea} ${f}` : linea;
}
