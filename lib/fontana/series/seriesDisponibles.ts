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
// 2ª ola (2026-09-03): series MUNICIPALES — F2-3 (CONEVAL Rezago Social,
// est+mun) y F2-5/20/21/22 (PNUD IDH/sub-índices, mun). El route usa
// municipiosDelTerritorio para preguntar a cuál municipio si el proyecto
// abarca varios (`multiMunicipio`, espejo de `multiEstado`).

import type { NivelTablaFontana } from "@/lib/fontana/tablaColumnas";

export type FuenteSerieId =
  | "imco"
  | "enigh"
  | "stps_huelgas"
  | "iep"
  | "inegi_pm_bise"
  | "coneval"
  | "pnud";

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
  // 2ª ola (2026-09-03) — series MUNICIPALES. Requieren municipiosDelTerritorio
  // en el route (proyecto plural con >1 municipio → preguntar a cuál).
  "F2-3": { fuenteId: "coneval", niveles: ["estatal", "municipal"] }, // Índice de Rezago Social
  "F2-5": { fuenteId: "pnud", niveles: ["municipal"] }, // IDH municipal
  "F2-20": { fuenteId: "pnud", niveles: ["municipal"] }, // Sub-índice Educación
  "F2-21": { fuenteId: "pnud", niveles: ["municipal"] }, // Sub-índice Ingreso
  "F2-22": { fuenteId: "pnud", niveles: ["municipal"] }, // Sub-índice Salud
};

export function tieneSerie(indicadorId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SERIES_DISPONIBLES, indicadorId);
}
