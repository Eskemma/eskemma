// lib/moddulo/versionado/artefactosCierre.ts
// C1b-3b — REGISTRO del CIERRE de una fase para el historial unificado (`lib/versionado/`). Módulo PURO (sin
// Firestore ni red): construye, a partir de `phases.<fase>` (documento crudo), el ESTADO que se guarda en la versión
// y la PROYECCIÓN VIVA que sirve para detectar deriva.
//
// Un artefacto por fase: `cierre:{fase}` (p. ej. `cierre:exploracion`). Misma forma en las 9 fases; F2 añade dos campos.
//   · contenido  = { fase, estado: "cerrada" | "abierta", completedAt, reportText, [F2: aprobadoEn, m1HuellaAprobada] }
//   · aprobacion = { aprobado: true, por, en (ISO) } — el SELLO del cierre vive SOLO en la versión (mismo criterio de
//     C3a: el documento vivo no lleva autor). Un cierre legado (sin historial) se reconstruye con `por: null`
//     («sin autoría registrada») y `en` = `completedAt`.
//
// Un solo instante por operación (H-V25): `completedAt` del vivo es un texto ISO y la versión lleva ese MISMO texto
// (`aprobacion.en` y `contenido.completedAt`); la ruta toma UN solo `new Date()`.
//
// NO se versiona (declarado): el RDA (derivado y acumulativo; se reconcilia en cada cierre y solo se NOMBRA en el
// evento cuántos ítems trajo), el `dvs`/`draftDVS`/`motorAprobaciones` de F2, el contenido de F1 (`data`, `xpcto`,
// dictamen) y `fasesCompletadas`/`faseActual`/`currentPhase`/`status` del proyecto (derivables de los cierres).
// El borrador de `reportText` que el cierre PISA queda en la versión PREVIA («abierta»).
//
// `estadoCierre` también reconstruye el estado «cerrada» de una fase ya cerrada SIN historial: es lo que la futura
// ruta de «reabrir fase cerrada» (H-V27) pasará como `estadoPrevio` (con `tipoCambio: "reapertura"`).

import type { PhaseId } from "@/types/moddulo.types";
import type { DetalleEvento, EstadoArtefacto } from "@/lib/versionado/tipos";
import { enAIso } from "@/lib/moddulo/versionado/artefactosF2";

export const AMBITO_CIERRE = "moddulo";
/** Motivo del evento de cierre. («reapertura_fase» queda reservado para H-V27: sin ruta todavía.) */
export const MOTIVO_CIERRE = "cierre_fase";

/** Versión de la FORMA de la proyección viva (súbela si el constructor cambia: cada artefacto mostrará UNA deriva). */
export const ESQUEMA_CIERRE = 1;

export const nombreCierre = (fase: PhaseId): string => `cierre:${fase}`;
/** Puntero embebido en el proyecto, hermano de `status`, `data`, `reportText`…: ninguna ruta lo solapa. */
export const punteroFase = (fase: PhaseId): string => `phases.${fase}.revision`;

/** El pedazo de `phases.<fase>` (crudo) que lee este módulo. */
export interface FaseCruda {
  status?: unknown;
  completedAt?: unknown;
  reportText?: unknown;
  data?: { aprobadoEn?: unknown };
  m1?: { aprobacion?: { huella?: unknown } };
}

const textoOnull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
/** `reportText` puede ser texto (normal) o un objeto legado de Firestore: se conserva tal cual; ausente = null. */
const reporteDe = (f: FaseCruda | undefined): unknown => {
  const r = f?.reportText;
  return r === undefined || r === null || r === "" ? null : r;
};

/** Sello del cierre: quién y cuándo (ISO concreto, el mismo `completedAt` del vivo). */
export interface SelloCierre {
  por: string;
  en: string;
}

function contenidoCerrada(fase: PhaseId, f: FaseCruda | undefined) {
  return {
    fase,
    estado: "cerrada" as const,
    completedAt: textoOnull(f?.completedAt) ?? enAIso(f?.completedAt),
    reportText: reporteDe(f),
    ...(fase === "exploracion"
      ? { aprobadoEn: textoOnull(f?.data?.aprobadoEn) ?? enAIso(f?.data?.aprobadoEn), m1HuellaAprobada: textoOnull(f?.m1?.aprobacion?.huella) }
      : {}),
  };
}

/**
 * Estado «cerrada» de la fase. Con `sello` es el estado DESPUÉS del cierre (autor y fecha reales). Sin `sello` se
 * reconstruye de una fase ya cerrada sin historial: `por: null` («sin autoría registrada») y `en` = `completedAt`.
 * Nunca lleva valores `undefined`.
 */
export function estadoCierre(fase: PhaseId, f: FaseCruda | undefined, sello?: SelloCierre): EstadoArtefacto {
  const contenido = contenidoCerrada(fase, f);
  return {
    contenido,
    aprobacion: sello
      ? { aprobado: true, por: sello.por, en: sello.en }
      : { aprobado: true, por: null, en: contenido.completedAt },
  };
}

/** Estado «abierta» (la versión PREVIA al cierre): conserva el borrador de `reportText` que el cierre pisa. */
export function estadoAbierto(fase: PhaseId, f: FaseCruda | undefined): EstadoArtefacto {
  return { contenido: { fase, estado: "abierta" as const, reportText: reporteDe(f) } };
}

/** Proyección viva: lo que cambia entre «abierta» y «cerrada» en el documento, SIN el autor (el sello es de la versión). */
export function vivoCierre(fase: PhaseId, f: FaseCruda | undefined): unknown {
  return {
    esquema: ESQUEMA_CIERRE,
    fase,
    estado: f?.status === "completed" ? "cerrada" : "abierta",
    completedAt: textoOnull(f?.completedAt) ?? enAIso(f?.completedAt),
    reportText: reporteDe(f),
    ...(fase === "exploracion"
      ? { aprobadoEn: textoOnull(f?.data?.aprobadoEn) ?? enAIso(f?.data?.aprobadoEn), m1HuellaAprobada: textoOnull(f?.m1?.aprobacion?.huella) }
      : {}),
  };
}

/**
 * `detalle` del evento de cierre: SOLO banderas y números (nunca texto del reporte ni ids).
 * `reporteSustituido`: el cierre trajo un `reportText` que reemplaza a un borrador distinto ya guardado.
 */
export function detalleCierre(a: {
  reporteNuevo: boolean;
  reporteSustituido: boolean;
  rdaNuevos: number;
  rdaResueltos: number;
  proyectoCompletado: boolean;
}): DetalleEvento {
  return {
    reporteNuevo: a.reporteNuevo,
    reporteSustituido: a.reporteSustituido,
    rdaNuevos: a.rdaNuevos,
    rdaResueltos: a.rdaResueltos,
    proyectoCompletado: a.proyectoCompletado,
  };
}
