// lib/fontana/series/seriesDisponibles.ts
// Fuente ÚNICA de verdad de "qué indicadores de Fontana tienen serie
// histórica consultable y con qué resolver". Config independiente de
// `disponibilidadTemporal.categoria` del registry (esa es clasificación de
// auditoría sobre la fuente — no cambia al cablear un indicador).
//
// Agregar un indicador a la serie = una entrada aquí. No hay `enum` en el
// schema de la tool consultar_serie_temporal — se valida contra este config.
//
// 1ª ola (2026-09-01): los 7 nac/est cuya serie ya viene en la descarga
// actual + F2-17 (piloto, se incorpora aquí para que `tieneSerie` sea la
// única fuente de verdad; su resolver `resolverSerieCompetitividadEstatal`
// no cambia).

import type { NivelTablaFontana } from "@/lib/fontana/tablaColumnas";

export type FuenteSerieId =
  | "imco"
  | "enigh"
  | "stps_huelgas"
  | "iep"
  | "inegi_pm_bise";

export interface ConfigSerie {
  fuenteId: FuenteSerieId;
  /** Niveles geográficos a los que aplica la serie de este indicador. */
  niveles: NivelTablaFontana[];
}

export const SERIES_DISPONIBLES: Record<string, ConfigSerie> = {
  "F2-17": { fuenteId: "imco", niveles: ["estatal"] },
  "F2-6": { fuenteId: "enigh", niveles: ["nacional", "estatal"] },
  "F2-12": { fuenteId: "enigh", niveles: ["nacional", "estatal"] },
  "F3-16": { fuenteId: "stps_huelgas", niveles: ["nacional", "estatal"] },
  "F3-17": { fuenteId: "iep", niveles: ["nacional", "estatal"] },
  "F2-1": { fuenteId: "inegi_pm_bise", niveles: ["nacional", "estatal"] },
  "F2-2": { fuenteId: "inegi_pm_bise", niveles: ["nacional", "estatal"] },
  "F2-14": { fuenteId: "inegi_pm_bise", niveles: ["nacional", "estatal"] },
};

export function tieneSerie(indicadorId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SERIES_DISPONIBLES, indicadorId);
}
