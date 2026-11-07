// lib/centinela/pestel/estadoOrigen.ts
// T4: ¿qué tan al día está el análisis de Centinela que Moddulo F2 importó? Decisión PURA (sin lecturas ni crypto):
// `verificarOrigen.ts` junta los datos y esta función decide.
//
//  - version_nueva    existe un análisis VIGENTE distinto del importado y más reciente (no necesita huella: compara
//                     el id y las fechas; no los números de versión, que en un proyecto real están desordenados).
//  - cambio_contenido el mismo análisis cambió de contenido desde que se importó (huella guardada ≠ huella actual).
//  - cambio_nota      (T7 C3, solo importaciones con huella v2) el contenido es el mismo pero la NOTA DE APROBACIÓN cambió o
//                     se retiró (p. ej. se volvió a aprobar con otra justificación). Se distingue sin guardar nada nuevo:
//                     la huella actual calculada con la nota GUARDADA coincide con la guardada.
//  - igual            la huella guardada coincide con la actual.
//  - no_verificable   no hay con qué comparar: importación anterior a T4 (sin huella o con otra versión de la
//                     regla), origen ilegible, ajeno o de otro proyecto. NUNCA equivale a «cambió».
//
// Precedencia: version_nueva > cambio_contenido > cambio_nota > igual > no_verificable.

import { aMillis } from "./aprobacion";
import { huellaComparable } from "./huellaOrigen";

export type EstadoOrigen = "igual" | "cambio_contenido" | "cambio_nota" | "version_nueva" | "no_verificable";

export type RazonNoVerificable =
  | "sin_vinculo"
  | "origen_ajeno"
  | "origen_otro_proyecto"
  | "origen_no_disponible"
  | "sin_huella"
  | "error_lectura";

/** Lo que se le entrega al cliente: sin ids ni contenido, solo número de versión y fecha. */
export interface ResultadoOrigen {
  estado: EstadoOrigen;
  razon?: RazonNoVerificable;
  importada?: { version?: number; fecha?: string };
  vigente?: { version?: number; fecha?: string };
}

export interface DatosOrigen {
  huellaGuardada: { v?: unknown; h?: unknown } | null | undefined;
  /**
   * Huella del análisis importado tal como está ahora, calculada con la VERSIÓN de la huella guardada (v1 → regla v1,
   * sin nota; v2 → con la nota actual); null si no se pudo leer.
   */
  huellaActual: { v: number; h: string } | null;
  /** v2: la misma huella pero con la nota GUARDADA en lugar de la actual (solo para distinguir `cambio_nota`). */
  huellaActualConNotaGuardada?: { v: number; h: string } | null;
  importado: { id: string; version?: number; analizadoEn?: unknown } | null;
  vigente: { id: string; version?: number; analizadoEn?: unknown } | null;
}

const iso = (v: unknown): string | undefined => {
  const ms = aMillis(v);
  return ms !== null && Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
};

export function decidirEstadoOrigen(d: DatosOrigen): ResultadoOrigen {
  if (!d.importado) return { estado: "no_verificable", razon: "origen_no_disponible" };
  const importada = { ...(d.importado.version != null ? { version: d.importado.version } : {}), ...(iso(d.importado.analizadoEn) ? { fecha: iso(d.importado.analizadoEn) } : {}) };

  if (d.vigente && d.vigente.id !== d.importado.id) {
    const msVigente = aMillis(d.vigente.analizadoEn);
    const msImportado = aMillis(d.importado.analizadoEn);
    if (msVigente !== null && msImportado !== null && msVigente > msImportado) {
      const vigente = { ...(d.vigente.version != null ? { version: d.vigente.version } : {}), ...(iso(d.vigente.analizadoEn) ? { fecha: iso(d.vigente.analizadoEn) } : {}) };
      return { estado: "version_nueva", importada, vigente };
    }
  }

  if (!huellaComparable(d.huellaGuardada)) return { estado: "no_verificable", razon: "sin_huella", importada };
  if (!d.huellaActual) return { estado: "no_verificable", razon: "origen_no_disponible", importada };
  if (d.huellaGuardada.h === d.huellaActual.h) return { estado: "igual", importada };
  if (d.huellaGuardada.v === 2 && d.huellaActualConNotaGuardada?.h === d.huellaGuardada.h) return { estado: "cambio_nota", importada };
  return { estado: "cambio_contenido", importada };
}
