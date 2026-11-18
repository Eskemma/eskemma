// lib/moddulo/versionado/artefactosF2.ts
// C1b-1 — REGISTRO de artefactos de la Fase 2 (Exploración) para el historial unificado (`lib/versionado/`).
// Módulo PURO (sin Firestore ni red): define el nombre del artefacto y construye, a partir del documento vivo
// (`phases.exploracion` crudo), (1) el ESTADO que se guarda en la versión y (2) la PROYECCIÓN VIVA que sirve
// para detectar deriva.
//
// Un artefacto: `f2M1` = el análisis M1 (PESTEL) que el usuario revisa, edita, aprueba y reabre.
//   · contenido  = { kind, mapa (linkedSource.payload), ediciones }
//   · aprobacion = { aprobado, por, en (ISO), huella, categoriasEditadas, total }  — SIN `mapa`: el mapa aprobado ya
//     está en `contenido.mapa` (misma huella) y duplicarlo costaría ~25 KB por versión. LÍMITE declarado: en una
//     aprobación OBSOLETA (el payload cambió después de aprobar; huella distinta) la copia congelada de ese momento
//     (`m1.aprobacion.mapa`) NO se conserva en la versión previa; solo el payload vigente.
//
// Un solo instante por operación (H-V25): el documento vivo lleva `Timestamp.fromDate(instante)` y la versión
// `instante.toISOString()`; así `aprobacion.en` de la versión y `m1.aprobacion.en`/`m1.reabiertoEn` del vivo son
// el MISMO momento. `aprobacion.en` es un valor CONCRETO (ISO), nunca un FieldValue: entra en la tupla y su huella.
//
// NO se versiona (declarado): `draftDVS`, `motorAprobaciones`, `dvs` (tiene `dvsVersiones`), `rda`, la marca de
// generación y la de finalización. Lo descartado al aprobar solo se NOMBRA en el evento (`detalle`), no se guarda.

import type { M1Datos } from "@/types/moddulo.types";
import type { DetalleEvento, EstadoArtefacto } from "@/lib/versionado/tipos";

export const AMBITO_F2 = "moddulo";
export const FASE_F2 = "exploracion";
/** Puntero embebido en el proyecto. Hermano de `m1`, `dvs`, `draftDVS`, `data` y `motorAprobaciones`: ninguna ruta lo solapa. */
export const PUNTERO_F2 = "phases.exploracion.revision";
export const NOMBRE_F2_M1 = "f2M1";

/**
 * Versión de la FORMA de la proyección viva. Si el constructor cambia (se agrega o quita un campo), súbela: cada
 * artefacto mostrará UNA deriva y luego se estabiliza (límite declarado, no un defecto).
 */
export const ESQUEMA_F2 = 1;

/** El pedazo de `phases.exploracion` (documento crudo) que lee este módulo. */
export interface ExploracionCruda {
  linkedSource?: { kind?: unknown; payload?: unknown };
  m1?: M1Datos;
}

/** Sello de la operación que se registra: quién y cuándo (ISO concreto). */
export type SelloF2 =
  | { aprobado: true; por: string; en: string; huella: string; categoriasEditadas: number; total: number }
  | { aprobado: false; por: string; en: string };

/**
 * Convierte la marca de tiempo del vivo a ISO 8601 SIN lanzar excepción (se usa DENTRO de una transacción).
 * Acepta Date, Timestamp de Firestore (`toDate()`), su forma serializada (`_seconds`/`seconds`) y un texto con
 * fecha válida (datos legados). Cualquier otra cosa —null, undefined, un FieldValue pendiente, un texto que no es
 * fecha, un número— da `null` = «sin fecha registrada».
 */
export function enAIso(en: unknown): string | null {
  try {
    if (en instanceof Date) return Number.isNaN(en.getTime()) ? null : en.toISOString();
    if (en !== null && typeof en === "object") {
      const o = en as { toDate?: unknown; _seconds?: unknown; _nanoseconds?: unknown; seconds?: unknown; nanoseconds?: unknown };
      if (typeof o.toDate === "function") {
        const d = (o.toDate as () => unknown).call(en);
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
      }
      const s = typeof o._seconds === "number" ? o._seconds : typeof o.seconds === "number" ? o.seconds : null;
      if (s === null || !Number.isFinite(s)) return null; // p. ej. el sentinela de serverTimestamp(): aún no tiene valor
      const ns = typeof o._nanoseconds === "number" ? o._nanoseconds : typeof o.nanoseconds === "number" ? o.nanoseconds : 0;
      const d = new Date(s * 1000 + Math.floor((Number.isFinite(ns) ? ns : 0) / 1e6));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof en === "string") {
      const t = Date.parse(en);
      return Number.isNaN(t) ? null : new Date(t).toISOString();
    }
  } catch {
    /* una marca de tiempo rara nunca debe romper la transacción */
  }
  return null;
}

const contenidoDe = (exp: ExploracionCruda | undefined) => ({
  kind: typeof exp?.linkedSource?.kind === "string" ? exp.linkedSource.kind : null,
  mapa: exp?.linkedSource?.payload ?? null,
  ediciones: exp?.m1?.ediciones ?? {},
});

/**
 * Estado del M1 tal como se guarda en una versión. Con `sello` es el estado DESPUÉS de la operación (aprobar o
 * reabrir). Sin `sello` se lee del vivo: aprobado (con su autor y fecha, `en` convertida a ISO), reabierto
 * (`aprobacion {aprobado:false}` con quien reabrió y cuándo) o sin revisar (sin `aprobacion`).
 * Nunca lleva valores `undefined`: se omite la clave (el Admin SDK los rechaza).
 */
export function estadoF2M1(exp: ExploracionCruda | undefined, sello?: SelloF2): EstadoArtefacto {
  const contenido = contenidoDe(exp);
  if (sello) {
    return {
      contenido,
      aprobacion: sello.aprobado
        ? { aprobado: true, por: sello.por, en: sello.en, huella: sello.huella, categoriasEditadas: sello.categoriasEditadas, total: sello.total }
        : { aprobado: false, por: sello.por, en: sello.en },
    };
  }
  const ap = exp?.m1?.aprobacion;
  if (ap) {
    return {
      contenido,
      aprobacion: {
        aprobado: true,
        por: typeof ap.por === "string" ? ap.por : null,
        en: enAIso(ap.en),
        ...(typeof ap.huella === "string" ? { huella: ap.huella } : {}),
        ...(typeof ap.categoriasEditadas === "number" ? { categoriasEditadas: ap.categoriasEditadas } : {}),
        ...(typeof ap.total === "number" ? { total: ap.total } : {}),
      },
    };
  }
  if (exp?.m1?.reabiertoEn) {
    return {
      contenido,
      aprobacion: {
        aprobado: false,
        por: typeof exp.m1.reabiertoPor === "string" ? exp.m1.reabiertoPor : null,
        en: enAIso(exp.m1.reabiertoEn),
      },
    };
  }
  return { contenido };
}

/**
 * Proyección viva: el contenido más la parte de la revisión que SÍ vive en el documento (huella aprobada y si está
 * reabierto), SIN el autor ni la fecha (el sello es de la versión; compararlo daría una falsa deriva), más `esquema`.
 */
export function vivoF2M1(exp: ExploracionCruda | undefined): unknown {
  return {
    esquema: ESQUEMA_F2,
    ...contenidoDe(exp),
    aprobacionHuella: typeof exp?.m1?.aprobacion?.huella === "string" ? exp.m1.aprobacion.huella : null,
    reabierto: !!exp?.m1?.reabiertoEn,
  };
}

/**
 * Detalle de AUDITORÍA del evento cuando aprobar DESCARTA el trabajo de los motores M2–M5 (contenido distinto al que
 * generó el borrador). «Descartado» = se borran `draftDVS` (el borrador completo de M2–M5), `motorAprobaciones` y la
 * marca de generación, en la misma escritura. El contenido descartado NO se versiona (H-V28): solo se nombran los
 * motores que estaban aprobados y si había borrador. Nunca lleva contenido del usuario.
 */
export function detalleMotoresDescartados(i: { motoresAprobados: readonly string[]; hayBorrador: boolean }): DetalleEvento {
  return { motoresAprobadosDescartados: [...i.motoresAprobados], borradorDescartado: i.hayBorrador };
}
