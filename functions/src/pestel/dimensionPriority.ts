// functions/src/pestel/dimensionPriority.ts
// Pesos del escaneo PESTEL por tipo de proyecto (FAT 2.0, Fase 2 · M1).
// 3 dimensiones "prioritarias" reciben tratamiento pleno; 3 "de seguimiento"
// reciben tratamiento más ligero por defecto — salvo que el contexto local
// las vuelva relevantes (ver escaladaPorRelevanciaLocal en
// DimensionAnalysisResult).
// Es diferencia de PROFUNDIDAD, no de inclusión: las 6 dimensiones siempre
// se generan en cualquier proyecto.
//
// SINCRONIZACIÓN OBLIGATORIA: existe una copia idéntica en
// lib/moddulo/dimensionPriority.ts (esta Cloud Function no puede importar
// de lib/ del proyecto raíz — ver CLAUDE.md, tabla "Lógica duplicada").
// Cualquier cambio aquí debe replicarse ahí con los mismos valores.

import type {DimensionCode} from "./classifier/claudePESTL";

export type TipoProyectoPESTL =
  | "electoral"
  | "gubernamental"
  | "legislativo"
  | "ciudadano";

export interface DimensionPriorityConfig {
  prioritarias: DimensionCode[];
  seguimiento: DimensionCode[];
}

// Verificado 2026-07-19 contra FAT 2.0, Fase 2 · M1, "Pesos del escaneo por
// tipo de proyecto" (docs/specs/FAT_2_v2_0.md).
export const DIMENSION_PRIORITY_BY_TYPE:
  Record<TipoProyectoPESTL, DimensionPriorityConfig> = {
    electoral: {
      prioritarias: ["P", "S", "L"], seguimiento: ["E", "T", "Ec"],
    },
    gubernamental: {
      prioritarias: ["S", "E", "L"], seguimiento: ["P", "T", "Ec"],
    },
    legislativo: {
      prioritarias: ["P", "L", "T"], seguimiento: ["S", "E", "Ec"],
    },
    ciudadano: {
      prioritarias: ["S", "P", "T"], seguimiento: ["Ec", "L", "E"],
    },
  };

/**
 * Resolves the priority config for a project type, falling back to
 * "ciudadano" for unknown/legacy values — same default already used
 * elsewhere in the pipeline for unrecognized project types.
 * @param {string} tipo Project type as stored in Firestore.
 * @return {DimensionPriorityConfig} Priority config for the type.
 */
export function getDimensionPriorityConfig(
  tipo: string
): DimensionPriorityConfig {
  const key = tipo as TipoProyectoPESTL;
  return DIMENSION_PRIORITY_BY_TYPE[key] ??
    DIMENSION_PRIORITY_BY_TYPE.ciudadano;
}

/**
 * Whether a given dimension is "prioritaria" for a project type.
 * @param {string} tipo Project type as stored in Firestore.
 * @param {DimensionCode} dim Dimension code to check.
 * @return {boolean} True if the dimension is prioritaria for this type.
 */
export function isDimensionPrioritaria(
  tipo: string, dim: DimensionCode
): boolean {
  return getDimensionPriorityConfig(tipo).prioritarias.includes(dim);
}
