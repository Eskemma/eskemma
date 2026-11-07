// lib/centinela/pestel/contenidoOrigen.ts
// T4: UNA sola regla de «qué cuenta como contenido» de un análisis de Centinela para Moddulo F2. Pura (sin
// crypto): la comparten la huella de origen (`huellaOrigen.ts`, servidor) y la nota de T3 («ajustes que F2 aún
// no refleja», `ajustesSinReflejar.ts`).
//
// Se calcula sobre el análisis CRUDO (dimensions + adjustments), no sobre el mapa transformado: un cambio futuro
// en `transformToMapaPESTEL` no invalida las huellas ya guardadas. Aun así, TODO lo que `transformToMapaPESTEL`
// copia del análisis y F2 consume está aquí o en `CAMPOS_MAPA` con su razón; una prueba lo exige (si se agrega un
// campo al mapa sin clasificarlo, falla).
//
// ENTRA (por dimensión, ordenada por código): code, classification (la de la IA), narrative, confidence y las
// tres listas de señales EN SU ORDEN (descripcion, fuente, fechaCorte, nivelConfianza, origenInternacional; null
// y ausente son lo mismo, como en `toF2Senal`). Por ajuste (el último de cada dimensión que existe en el
// análisis, como en la transformación): dimensionCode, originalClassification, newClassification,
// justification recortada y adjustedAt (como ISO, igual que `ajustadoEn`: F2 lo muestra).
//
// v2 (T7 C3) agrega la NOTA DE APROBACIÓN (`notaAprobacion.ts`: confianza + justificación recortada, solo si el análisis
// está APPROVED con confianza baja); la fecha de la aprobación no entra. v1 no la incluye.
//
// NO ENTRA: status, vigente, version, analyzedAt, approvedAt/By, aprobacion* salvo la nota de v2 (estado de revisión);
// biasAlerts, impactChains, informes (F2 no los usa); globalConfidence (F2 no la importa; la nota de confianza
// baja entra solo como la nota de v2); trend, intensity, mainSignal (F2 no los lee); adjustedBy y updatedAt; originalPosition y
// newPosition (ninguna pantalla ni prompt las lee).
//
// Cambiar esta regla exige subir VERSION_HUELLA_ORIGEN (una prueba fija un hash literal).

import { aMillis } from "./aprobacion";
import { notaParaHuella, type NotaAprobacion } from "./notaAprobacion";

/**
 * Versión VIGENTE de la regla (la que se guarda al importar). La regla v1 sigue viva para COMPARAR las importaciones
 * hechas con ella (`VERSIONES_COMPARABLES`): una importación v1 se compara con la regla v1 —sin la nota de aprobación—
 * y nunca aparece como «cambió» por la nota.
 */
export const VERSION_HUELLA_ORIGEN = 2;
export const VERSIONES_COMPARABLES: readonly number[] = [1, 2];

type SenalCruda = {
  descripcion?: string;
  fuente?: string | null;
  fechaCorte?: string | null;
  nivelConfianza?: string | null;
  origenInternacional?: boolean | null;
};

export type DimensionCruda = {
  code: string;
  classification?: string;
  narrative?: string;
  confidence?: number;
  senalesFavorables?: SenalCruda[];
  senalesAdversas?: SenalCruda[];
  senalesInciertas?: SenalCruda[];
};

export type AjusteCrudo = {
  dimensionCode?: string;
  originalClassification?: string;
  newClassification?: string;
  justification?: string;
  adjustedAt?: unknown;
};

/** Texto de una justificación tal como se compara (T3 y huella): sin espacios ni saltos en los extremos. */
export function recortarJustificacion(texto: unknown): string {
  return typeof texto === "string" ? texto.trim() : "";
}

/**
 * ¿El ajuste que F2 importó (clasificación ajustada + justificación) es el mismo que tiene el análisis ahora?
 * Es lo que compara la nota de T3; la huella incluye además la clasificación original y la fecha.
 */
export function ajusteEquivalente(
  importado: { clasificacionAjustada?: string; justificacion?: string } | null | undefined,
  actual: { newClassification?: string; justification?: string }
): boolean {
  return (
    !!importado &&
    importado.clasificacionAjustada === actual.newClassification &&
    recortarJustificacion(importado.justificacion) === recortarJustificacion(actual.justification)
  );
}

function normalizarSenal(s: SenalCruda): Record<string, unknown> {
  const out: Record<string, unknown> = { descripcion: s.descripcion ?? "" };
  if (s.fuente != null) out.fuente = s.fuente;
  if (s.fechaCorte != null) out.fechaCorte = s.fechaCorte;
  if (s.nivelConfianza != null) out.nivelConfianza = s.nivelConfianza;
  if (s.origenInternacional != null) out.origenInternacional = s.origenInternacional;
  return out;
}

function normalizarAjuste(adj: AjusteCrudo): Record<string, unknown> {
  const out: Record<string, unknown> = {
    dimensionCode: adj.dimensionCode,
    justification: recortarJustificacion(adj.justification),
  };
  if (adj.originalClassification != null) out.originalClassification = adj.originalClassification;
  if (adj.newClassification != null) out.newClassification = adj.newClassification;
  const ms = aMillis(adj.adjustedAt);
  if (ms !== null && Number.isFinite(ms)) out.adjustedAt = new Date(ms).toISOString();
  return out;
}

/** Objeto canónico del contenido de un análisis para F2 (se serializa con `serializacionEstable` y se hashea). */
export function contenidoDeOrigen(
  dimensions: DimensionCruda[] | null | undefined,
  adjustments: AjusteCrudo[] | null | undefined,
  opts?: { version?: number; nota?: NotaAprobacion | null }
): Record<string, unknown> {
  const dims = [...(dimensions ?? [])].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const codigos = new Set(dims.map((d) => d.code));
  const dimensiones = dims.map((d) => {
    const o: Record<string, unknown> = { code: d.code };
    if (d.classification != null) o.classification = d.classification;
    if (d.narrative != null) o.narrative = d.narrative;
    if (d.confidence != null) o.confidence = d.confidence;
    o.senalesFavorables = (d.senalesFavorables ?? []).map(normalizarSenal);
    o.senalesAdversas = (d.senalesAdversas ?? []).map(normalizarSenal);
    o.senalesInciertas = (d.senalesInciertas ?? []).map(normalizarSenal);
    return o;
  });
  // Un ajuste por dimensión (el último, como `transformToMapaPESTEL`) y solo de dimensiones que existen.
  const ultimo = new Map<string, AjusteCrudo>();
  for (const a of adjustments ?? []) {
    if (a?.dimensionCode && codigos.has(a.dimensionCode)) ultimo.set(a.dimensionCode, a);
  }
  const ajustes = [...ultimo.keys()].sort().map((c) => normalizarAjuste(ultimo.get(c)!));
  const nota = (opts?.version ?? VERSION_HUELLA_ORIGEN) >= 2 ? notaParaHuella(opts?.nota) : null;
  return { dimensiones, ajustes, ...(nota ? { nota } : {}) };
}

/**
 * Clasificación de CADA campo del mapa que F2 recibe: `"huella"` = entra en la huella; cualquier otro texto =
 * excluido, con su razón. Los tipos obligan a clasificar un campo nuevo de `F2DimensionPESTEL`, `F2Senal` o
 * `AjusteAnalistaF2`; la prueba de completitud compara además con lo que `transformToMapaPESTEL` produce.
 */
export const CAMPOS_MAPA = {
  dimension: {
    code: "huella",
    label: "excluido: se deriva de code (DIMENSION_META), no del análisis",
    clasificacion: "huella",
    senalesFavorables: "huella",
    senalesAdversas: "huella",
    senalesInciertas: "huella",
    narrativa: "huella",
    confidence: "huella",
    escaladaPorRelevanciaLocal: "excluido: no lo copia el análisis de Centinela (solo lo escribe el flujo express)",
    ajuste: "huella",
  },
  senal: {
    descripcion: "huella",
    fuente: "huella",
    fechaCorte: "huella",
    nivelConfianza: "huella",
    origenInternacional: "huella",
  },
  ajuste: {
    clasificacionOriginal: "huella",
    clasificacionAjustada: "huella",
    justificacion: "huella",
    ajustadoEn: "huella",
    posiciones: "excluido: ninguna pantalla ni prompt de F2 las lee",
  },
} as const;
