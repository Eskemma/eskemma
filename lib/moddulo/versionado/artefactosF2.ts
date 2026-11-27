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
// NO se versiona como estado vivo (declarado): `draftDVS`, `motorAprobaciones`, `dvs` (tiene `dvsVersiones`), `rda`,
// la marca de generación y la de finalización. Lo descartado al aprobar se NOMBRA en el evento (`detalle`); desde
// C4c-0a, cuando un acto DESTRUYE un borrador de motores, además se guarda una COPIA PUNTUAL en el artefacto
// `f2Motores` (ver abajo): no es un estado vivo (sin `vivo`, sin `estadoPrevio`), es una foto de lo que se perdió.
//
// C4c-0a — `origen` (H-V42/H-V97): la identidad del vínculo (`componente`, `sourceId`, `sourceAnalysisId`,
// `huellaFuente`, `aprobacionOrigen`; NUNCA el `payload`, que ya es `mapa`) vive SOLO en `contenido`, no en la
// proyección viva: `ESQUEMA_F2` no cambia y no hay deriva. Se omite la clave si no hay vínculo (nunca `undefined`).
//
// C1b-2 — DESVINCULAR (`unlink-pestel`): el estado NUEVO es «sin M1» (`contenido {kind: null, mapa: null,
// ediciones: {}}`, la misma función de siempre sobre el documento sin `linkedSource` ni `m1`) con `aprobacion
// {aprobado: false, por, en}` como constancia; el motivo `desvinculacion` y `kind: null` lo distinguen en el lector.

import type { M1Datos } from "@/types/moddulo.types";
import type { DetalleEvento, EstadoArtefacto } from "@/lib/versionado/tipos";
import { decidirContenido, estimarBytes } from "@/lib/versionado/tamano";

export const AMBITO_F2 = "moddulo";
export const FASE_F2 = "exploracion";
/** Puntero embebido en el proyecto. Hermano de `m1`, `dvs`, `draftDVS`, `data` y `motorAprobaciones`: ninguna ruta lo solapa. */
export const PUNTERO_F2 = "phases.exploracion.revision";
export const NOMBRE_F2_M1 = "f2M1";
/** C4c-0a — copia PUNTUAL del borrador de motores (M2–M5) que un acto destruye. Un solo artefacto por proyecto. */
export const NOMBRE_F2_MOTORES = "f2Motores";

/**
 * Versión de la FORMA de la proyección viva. Si el constructor cambia (se agrega o quita un campo), súbela: cada
 * artefacto mostrará UNA deriva y luego se estabiliza (límite declarado, no un defecto).
 */
export const ESQUEMA_F2 = 1;

/** El pedazo de `phases.exploracion` (documento crudo) que lee este módulo. */
export interface ExploracionCruda {
  linkedSource?: {
    kind?: unknown;
    payload?: unknown;
    componente?: unknown;
    sourceId?: unknown;
    sourceAnalysisId?: unknown;
    huellaFuente?: unknown;
    aprobacionOrigen?: unknown;
  };
  m1?: M1Datos;
  /** Borrador de motores M2–M5 (solo lo lee `estadoF2Motores`). */
  draftDVS?: unknown;
  motorAprobaciones?: unknown;
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

/** Copia superficial de un objeto plano sin claves `undefined` (el Admin SDK las rechaza). */
function sinUndefined(o: unknown): Record<string, unknown> | undefined {
  if (o === null || typeof o !== "object" || Array.isArray(o)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) if (v !== undefined) out[k] = v;
  return out;
}

/**
 * C4c-0a — identidad del vínculo (sin el `payload`). Solo los campos presentes y bien formados; `undefined` si no hay
 * ninguno (sin vínculo): la clave `origen` se omite entonces del contenido.
 */
export function origenDe(ls: ExploracionCruda["linkedSource"]): Record<string, unknown> | undefined {
  if (!ls) return undefined;
  const o: Record<string, unknown> = {};
  if (typeof ls.componente === "string") o.componente = ls.componente;
  if (typeof ls.sourceId === "string") o.sourceId = ls.sourceId;
  if (typeof ls.sourceAnalysisId === "string") o.sourceAnalysisId = ls.sourceAnalysisId;
  const hf = ls.huellaFuente as { v?: unknown; h?: unknown } | undefined;
  if (hf && typeof hf.v === "number" && typeof hf.h === "string") o.huellaFuente = { v: hf.v, h: hf.h };
  const ao = sinUndefined(ls.aprobacionOrigen);
  if (ao && Object.keys(ao).length > 0) o.aprobacionOrigen = ao;
  return Object.keys(o).length > 0 ? o : undefined;
}

/** Lo que define la proyección VIVA (sin `origen`: C4c-0a no cambia el vivo, así que no hay deriva). */
const contenidoBase = (exp: ExploracionCruda | undefined) => ({
  kind: typeof exp?.linkedSource?.kind === "string" ? exp.linkedSource.kind : null,
  mapa: exp?.linkedSource?.payload ?? null,
  ediciones: exp?.m1?.ediciones ?? {},
});

/** Lo que se guarda en la VERSIÓN: el contenido base más `origen` (solo si hay vínculo). */
const contenidoDe = (exp: ExploracionCruda | undefined) => {
  const origen = origenDe(exp?.linkedSource);
  return { ...contenidoBase(exp), ...(origen ? { origen } : {}) };
};

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
    ...contenidoBase(exp),
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
export function detalleMotoresDescartados(i: {
  motoresAprobados: readonly string[];
  hayBorrador: boolean;
  /** C4c-0a — `true` si la copia de los motores quedó guardada; `false` si había borrador pero la copia se omitió por tamaño; `undefined` (sin borrador) omite la clave. */
  copiaMotores?: boolean;
}): DetalleEvento {
  return {
    motoresAprobadosDescartados: [...i.motoresAprobados],
    borradorDescartado: i.hayBorrador,
    ...(i.copiaMotores !== undefined ? { copiaMotores: i.copiaMotores } : {}),
  };
}

/**
 * C4c-0a — copia PUNTUAL del borrador de motores que un acto va a destruir. `null` si no hay borrador (nada que
 * copiar). `contenido = {draftDVS, motorAprobaciones, m1Huella}`: `m1Huella` es la huella del M1 con el que se
 * generó el borrador (`m1.generacion.huella`; `null` si no la hay) y es lo que permitirá emparejar la copia con una
 * versión del análisis. Sin `aprobacion`, sin `vivo` y sin `estadoPrevio` (es una foto, no un estado vivo): no hay
 * deriva ni versión previa. El llamador DEBE pasar el documento leído DENTRO de su transacción.
 */
export function estadoF2Motores(exp: ExploracionCruda | undefined): EstadoArtefacto | null {
  const borrador = exp?.draftDVS;
  if (borrador === null || typeof borrador !== "object" || Array.isArray(borrador)) return null;
  const huella = exp?.m1?.generacion?.huella;
  return {
    contenido: {
      draftDVS: borrador,
      motorAprobaciones: sinUndefined(exp?.motorAprobaciones) ?? {},
      m1Huella: typeof huella === "string" ? huella : null,
    },
  };
}

/** ¿La copia se guardaría con su contenido (≤ `LIMITE_CONTENIDO_BYTES`)? Si no, el núcleo guarda solo la huella: no restaurable. */
export function copiaMotoresRestaurable(estado: EstadoArtefacto): boolean {
  return decidirContenido(estimarBytes(estado.contenido)).guardarContenido;
}

/** Motores cuyo nombre puede aparecer en un `detalle` de evento (nunca texto libre). */
const MOTORES_DETALLE = ["M2", "M3", "M4", "M5"] as const;

/**
 * C1b-2 — ¿hay algo que versionar al DESVINCULAR? Sí si existe CUALQUIERA de: el payload (el mapa del análisis), el
 * registro `m1`, el borrador de motores o aprobaciones de motores con contenido (pueden existir sin M1: «sin M1 con
 * restos»). Solo un T22 realmente vacío en esos cuatro puntos se desvincula sin versión (no se destruye nada).
 */
export function hayAlgoQueVersionarAlDesvincular(exp: {
  linkedSource?: { payload?: unknown };
  m1?: unknown;
  draftDVS?: unknown;
  motorAprobaciones?: unknown;
} | undefined): boolean {
  const lleno = (v: unknown) => v !== null && typeof v === "object" && Object.keys(v as object).length > 0;
  return lleno(exp?.linkedSource?.payload) || lleno(exp?.m1) || !!exp?.draftDVS || lleno(exp?.motorAprobaciones);
}

/**
 * C1b-2 — `detalle` de AUDITORÍA del evento de desvinculación. «Descartado» al desvincular es INCONDICIONAL: se van el
 * borrador de motores, sus aprobaciones y el registro `m1` completo (aprobación y su copia congelada, ediciones, marcas
 * de generación y finalización); el `dvs` (Reporte F2 finalizado) se conserva y queda sin su M1 de origen. Solo
 * booleanos, números y nombres de motor (M2..M5): nunca texto del usuario ni ids de proyecto o de PESTEL. Sin
 * aprobación: `teniaAprobacion: false`, `categoriasEditadas: 0`, `totalCategorias: 0`.
 */
export function detalleDesvinculacion(i: {
  aprobacion?: { categoriasEditadas?: unknown; total?: unknown } | null;
  motoresAprobados: readonly string[];
  hayBorrador: boolean;
  hayReporteF2: boolean;
  /** C4c-0a — ver `detalleMotoresDescartados`: omitido cuando no había borrador. */
  copiaMotores?: boolean;
}): DetalleEvento {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    teniaAprobacion: !!i.aprobacion,
    categoriasEditadas: i.aprobacion ? num(i.aprobacion.categoriasEditadas) : 0,
    totalCategorias: i.aprobacion ? num(i.aprobacion.total) : 0,
    motoresAprobadosDescartados: MOTORES_DETALLE.filter((m) => i.motoresAprobados.includes(m)),
    borradorDescartado: i.hayBorrador,
    reporteF2Conservado: i.hayReporteF2,
    ...(i.copiaMotores !== undefined ? { copiaMotores: i.copiaMotores } : {}),
  };
}
