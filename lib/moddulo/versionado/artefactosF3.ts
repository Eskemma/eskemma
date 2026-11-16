// lib/moddulo/versionado/artefactosF3.ts
// C3a — REGISTRO de artefactos de la Fase 3 (Investigación) para el historial unificado (`lib/versionado/`).
// Módulo PURO (sin Firestore ni red): define el nombre de cada artefacto y construye, a partir de un documento
// vivo, (1) el ESTADO que se guarda en la versión y (2) la PROYECCIÓN VIVA que sirve para detectar deriva.
//
// Dos artefactos:
//   · `f3Resultado:{resultadoId}`    → el documento `moddulo_projects/{id}/f3Resultados/{resultadoId}`.
//   · `f3Asignacion:{asignacionId}`  → una asignación del tablero (`phases.investigacion.f3TareasPIP[].asignaciones[]`),
//                                      versionada SOLO cuando la ruta la cambia.
//
// Decisión §6: el SELLO de una aprobación (quién/cuándo) vive SOLO en la versión (`aprobacion {por, en, huella}`),
// NO en el documento vivo de `f3Resultados`: la síntesis M3 serializa ese documento completo al prompt del
// modelo y no debe recibir uids ni fechas. Por eso el estado construido desde el vivo trae `aprobacion` SIN
// sello (`por: null`), y la deriva se detecta con la proyección viva, no con la tupla (ver `vivo` en tipos.ts).
//
// `dependeDe` va VACÍO en ambos artefactos (decisión de Raúl): resultado y asignación cambian en la MISMA
// revisión, y esa co-versión deja la trazabilidad (manifiesto y evento guardan ambos `versionId`). La
// propagación hacia la síntesis y el veredicto vendrá con `dependeDe` en cortes posteriores.

import type { AsignacionCanal } from "@/types/moddulo.types";
import type { EstadoArtefacto } from "@/lib/versionado/tipos";

export const AMBITO_F3 = "moddulo";
export const FASE_F3 = "investigacion";
/** Puntero embebido en el proyecto. Hermano de `f3TareasPIP`, `fontanaPendiente` y `data`: ninguna ruta lo solapa. */
export const PUNTERO_F3 = "phases.investigacion.revision";

/**
 * Versión de la FORMA de la proyección viva. Si el constructor cambia (se agrega o quita un campo), súbela:
 * cada artefacto mostrará UNA deriva (la proyección ya no coincide con la huella guardada) y luego se estabiliza.
 * Es un límite declarado, no un defecto: sin este campo el cambio sería indistinguible de un cambio de datos.
 */
export const ESQUEMA_F3 = 1;

export const nombreResultado = (resultadoId: string) => `f3Resultado:${resultadoId}`;
export const nombreAsignacion = (asignacionId: string) => `f3Asignacion:${asignacionId}`;

/** Campos del documento vivo que NO forman parte del contenido ni de la proyección (volátiles). */
const CAMPOS_VOLATILES = ["createdAt"] as const;
/** Campos del documento vivo que son la APROBACIÓN, no el contenido. */
const CAMPOS_APROBACION = ["aprobado", "notasUsuario"] as const;

type DocVivo = Record<string, unknown>;

/** Copia superficial sin las claves indicadas ni valores `undefined` (el Admin SDK los rechaza). */
function sinClaves(doc: DocVivo, claves: readonly string[]): DocVivo {
  const salida: DocVivo = {};
  for (const [k, v] of Object.entries(doc)) {
    if (claves.includes(k) || v === undefined) continue;
    salida[k] = v;
  }
  return salida;
}

/** Sello de una aprobación: lo escribe SOLO la versión (nunca el documento vivo). */
export interface SelloAprobacion {
  por: string | null;
  en: unknown;
  huella?: string;
}

/**
 * Estado de un resultado de F3 tal como se guarda en una versión.
 * Sin `sello` (estado leído del vivo) la aprobación queda «sin autoría registrada» (`por: null`).
 */
export function estadoResultado(doc: DocVivo, sello?: SelloAprobacion): EstadoArtefacto {
  const contenido = sinClaves(doc, [...CAMPOS_VOLATILES, ...CAMPOS_APROBACION]);
  if (typeof doc.aprobado !== "boolean") return { contenido };
  return {
    contenido,
    aprobacion: {
      aprobado: doc.aprobado,
      por: sello?.por ?? null,
      en: sello?.en ?? null,
      ...(sello?.huella ? { huella: sello.huella } : {}),
      ...(typeof doc.notasUsuario === "string" ? { notas: doc.notasUsuario } : {}),
    },
  };
}

/** Proyección viva de un resultado: el documento SIN lo volátil, más `esquema`. Es lo que se hashea para la deriva. */
export function vivoResultado(doc: DocVivo): unknown {
  return { esquema: ESQUEMA_F3, ...sinClaves(doc, CAMPOS_VOLATILES) };
}

/** Estado de una asignación del tablero tal como se guarda en una versión (la asignación completa, sin aprobación). */
export function estadoAsignacion(a: AsignacionCanal): EstadoArtefacto {
  return { contenido: sinClaves(a as unknown as DocVivo, []) };
}

/** Proyección viva de una asignación: la asignación completa más `esquema`. */
export function vivoAsignacion(a: AsignacionCanal): unknown {
  return { esquema: ESQUEMA_F3, ...sinClaves(a as unknown as DocVivo, []) };
}
