// lib/versionado/tipos.ts
// Tipos y constantes del historial unificado (C1a). Módulo AGNÓSTICO de app: la `raiz` (documento dueño:
// moddulo_projects/{id}, fontana_sesiones/{id}…) y el `ambito` los pone el llamador.
//
// SEGURO PARA CLIENTE: este archivo no importa nada en tiempo de ejecución (solo constantes y tipos), así que
// puede importarse desde un componente de cliente. `huella.ts`, `registrar.ts` y `serializacion.ts` usan
// `node:crypto`/Admin SDK y son SOLO SERVIDOR: nunca importarlos desde el cliente (lo vigila una prueba).

/** Causa TÉCNICA del cambio (qué mecanismo lo produjo). NO resuelve la regla 4.5.b del documento de patrones
 *  (qué efecto tiene cada tipo de ajuste sobre lo aprobado): eso es una clasificación de efecto, aparte. */
export type TipoCambio =
  | "ajuste_manual"
  | "regeneracion_ia"
  | "reentrega"
  // C3a — primera entrega de un resultado (Canal 1 de Fontana, vinculación de una fuente externa): aún no hay
  // nada que «reentregar». Sigue siendo una causa técnica, no un efecto sobre lo aprobado.
  | "entrega"
  | "reapertura"
  | "restauracion"
  | "previo_sin_historial";

export type EstadoVersion = "vigente" | "propuesta" | "reemplazada" | "descartada";

export type FuenteEvento = "usuario" | "ia" | "propagacion";

/** Aprobación tal como quedó EN esa versión (copia congelada de lo decidido). */
export interface AprobacionVersion {
  aprobado: boolean;
  /** uid de quien aprobó; `null` = «sin autoría registrada» (la aprobación existía antes del historial). */
  por: string | null;
  /** Marca de tiempo de la aprobación original (ISO o Timestamp, tal como la guardó el llamador). */
  en: unknown;
  huella?: string;
  /** Copia congelada de lo aprobado (p. ej. el mapa del M1). */
  mapa?: unknown;
  /** Notas de quien aprobó o rechazó (p. ej. `notasUsuario` de un resultado de F3). */
  notas?: string;
}

export interface DependeDe {
  artefacto: string;
  versionId: string;
  huella: string;
}

export interface Insumos {
  huella?: string;
  dependeDe: DependeDe[];
}

/** El estado COMPLETO de un artefacto en un momento: lo que se compara para deduplicar y lo que se restaura. */
export interface EstadoArtefacto {
  contenido: unknown;
  aprobacion?: AprobacionVersion;
  insumos?: Insumos;
  /** Por defecto "vigente". */
  estado?: EstadoVersion;
}

/** Una entrada de la lista de versiones retenidas de un artefacto (vive en el manifiesto de la revisión). */
export interface RetenidaRef {
  id: string;
  n: number;
  aprobada: boolean;
  /** Protegida de la poda: citada por un `dependeDe` vigente o por un cierre. */
  protegida: boolean;
}

/** Lo que el manifiesto de una revisión guarda por artefacto. */
export interface EntradaManifiesto {
  versionId: string;
  n: number;
  /** Huella de la tupla completa (contenido + aprobación + insumos + estado) de la versión vigente. */
  tupla: string;
  dependeDe: DependeDe[];
  retenidas: RetenidaRef[];
  /**
   * C3a — huella de la PROYECCIÓN VIVA del artefacto tal como quedó en el documento vivo al registrar esta
   * versión. Existe porque el sello de una aprobación (quién/cuándo) vive solo en la versión y NO en el
   * documento vivo: comparar el estado vivo contra `tupla` daría una falsa deriva tras cada aprobación. La
   * deriva se detecta comparando la proyección viva actual contra esta huella. No cambia `tupla`.
   */
  vivo?: string;
}

export interface Puntero {
  n: number;
  huella: string;
  por: string;
  en: unknown;
}

// ---- Constantes ----

/** Versiones retenidas por artefacto (además de las aprobadas, referenciadas, cierres y la vigente). */
export const TOPE_VERSIONES = 20;
/** Máximo de borrados de poda por escritura (acota el costo de cada acción). */
export const MAX_BORRADOS_POR_ESCRITURA = 2;
/** Por encima de este tamaño (JSON UTF-8) el contenido de una versión NO se guarda: solo su huella. */
export const LIMITE_CONTENIDO_BYTES = 900_000;
/** Límite de Firestore por documento (1 MiB). */
export const LIMITE_DOCUMENTO_BYTES = 1_048_576;
export const UMBRAL_AVISO = 0.6;
export const UMBRAL_PRIORIDAD = 0.8;

// ---- Errores ----

/** El puntero del documento dueño y el manifiesto de la revisión no coinciden: NO se crea nada desde cero. */
export class HistorialInconsistenteError extends Error {
  constructor(detalle: string) {
    super(`Historial inconsistente: ${detalle}`);
    this.name = "HistorialInconsistenteError";
  }
}

/** Una escritura `create` chocó con un documento existente (revisión, versión o evento ya creados). */
export class ColisionHistorialError extends Error {
  constructor(detalle: string) {
    super(`Colisión en el historial: ${detalle}`);
    this.name = "ColisionHistorialError";
  }
}

export class AutorizacionIARequeridaError extends Error {
  constructor() {
    super("Una regeneración con IA exige autorizadoPor y autorizadoEn (toda llamada al modelo la autoriza la persona).");
    this.name = "AutorizacionIARequeridaError";
  }
}

export class CambioInvalidoError extends Error {
  constructor(detalle: string) {
    super(`Cambio de historial inválido: ${detalle}`);
    this.name = "CambioInvalidoError";
  }
}
