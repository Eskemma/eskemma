// lib/moddulo/dimensionPriority.ts
// Pesos del escaneo PESTEL por tipo de proyecto (FAT 2.0, Fase 2 · M1).
// 3 dimensiones "prioritarias" reciben tratamiento pleno; 3 "de seguimiento"
// reciben tratamiento más ligero por defecto — salvo que el contexto local
// las vuelva relevantes (ver escaladaPorRelevanciaLocal en F2DimensionPESTEL).
// Es diferencia de PROFUNDIDAD, no de inclusión: las 6 dimensiones siempre
// se generan en cualquier proyecto.
//
// SINCRONIZACIÓN OBLIGATORIA: existe una copia idéntica en
// functions/src/pestel/dimensionPriority.ts (Cloud Functions no puede
// importar de lib/ — ver CLAUDE.md, tabla "Lógica duplicada"). Cualquier
// cambio aquí debe replicarse ahí con los mismos valores.

import type { ProjectType } from "@/types/moddulo.types";

export type DimensionCode = "P" | "E" | "S" | "T" | "Ec" | "L";

export interface DimensionPriorityConfig {
  prioritarias: DimensionCode[];
  seguimiento: DimensionCode[];
}

// Verificado 2026-07-19 contra FAT 2.0, Fase 2 · M1, "Pesos del escaneo por
// tipo de proyecto" (docs/specs/FAT_2_v2_0.md).
export const DIMENSION_PRIORITY_BY_TYPE: Record<ProjectType, DimensionPriorityConfig> = {
  electoral: { prioritarias: ["P", "S", "L"], seguimiento: ["E", "T", "Ec"] },
  gubernamental: { prioritarias: ["S", "E", "L"], seguimiento: ["P", "T", "Ec"] },
  legislativo: { prioritarias: ["P", "L", "T"], seguimiento: ["S", "E", "Ec"] },
  ciudadano: { prioritarias: ["S", "P", "T"], seguimiento: ["Ec", "L", "E"] },
};

export function isDimensionPrioritaria(tipo: ProjectType, dim: DimensionCode): boolean {
  return DIMENSION_PRIORITY_BY_TYPE[tipo].prioritarias.includes(dim);
}
