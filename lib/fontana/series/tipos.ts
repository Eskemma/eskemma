// lib/fontana/series/tipos.ts
// Shape normalizada que devuelven TODOS los resolvers de serie temporal
// (uno por familia de fuente) y que consume el dispatcher
// resolverSerieTemporal + el route GET /api/fontana/serie-temporal.

import type { NaturalezaDato } from "@/lib/fontana/indicatorRegistry";
import type { NivelTablaFontana } from "@/lib/fontana/tablaColumnas";
import type { Territorio } from "@/types/shared.types";

export interface PuntoSerie {
  periodo: string; // año, ej. "2022"
  valor: number | null;
  ranking?: number | null; // solo IMCO (F2-17)
  nivelCompetitividad?: string; // solo IMCO
  nota?: string; // aclaración honesta cuando aplica (ej. año parcial)
}

export interface ResultadoSerieOk {
  ok: true;
  nivel: NivelTablaFontana; // nivel REAL de la serie devuelta (nacional | estatal | ...)
  territorioLabel: string; // "Nacional" | "Jalisco" | …
  unidad?: string;
  naturaleza?: NaturalezaDato;
  fuenteEtiqueta: string;
  // Precisión de display por escala (ver fmt() en FontanaCanvasItemCard):
  //   indice → 0-100, 2 dec (ICE)        coeficiente → 0-1 y negativos, 4 dec (Gini, IDH, rezago social)
  //   puntaje → 1-5, 3 dec (Índice de Paz)
  formato: "conteo" | "moneda" | "porcentaje" | "indice" | "coeficiente" | "puntaje";
  puntos: PuntoSerie[];
}

export type ResultadoSerie = ResultadoSerieOk | { ok: false; motivo: string };

/**
 * Nivel al que se resuelve la serie según el territorio del proyecto y los
 * niveles a los que el indicador publica serie:
 * - proyecto nacional → "nacional" si el indicador lo tiene, si no `null`.
 * - proyecto municipal, distrito, distrito_federal o distrito_local →
 *   "municipal" si el indicador lo tiene (municipal gana sobre estatal:
 *   un dato del municipio/alcaldía específico del proyecto es siempre más
 *   útil que uno de todo el estado); si no, "estatal" (serie del estado
 *   que contiene al municipio) si lo tiene; si no `null`. Los 4 tipos se
 *   tratan igual porque los 4 tienen (o resuelven, vía
 *   resolverNombreMunicipio/extraerCiudadCabecera en cada adaptador) un
 *   municipio concreto — un distrito_local/federal SIEMPRE representa la
 *   alcaldía/municipio de su cabecera, nunca "todo el estado" (26-09-06,
 *   incidente Iztapalapa: antes esta función nunca intentaba "municipal"
 *   para distrito_*, aunque el indicador SÍ lo publicara y el nombre del
 *   municipio resolviera perfecto — devolvía el motivo genérico de "no
 *   existe a este nivel" sin haberlo intentado, o silenciosamente daba el
 *   dato de TODO el estado en vez de preguntarse por el municipio).
 * - proyecto estatal puro → "estatal" si el indicador lo tiene, si no
 *   `null` (nunca intenta "municipal" — un proyecto estatal no tiene un
 *   municipio específico que resolver).
 * `null` = el indicador no publica serie a ningún nivel aplicable al
 * territorio del proyecto (ej. IDH municipal en un proyecto estatal).
 */
export function nivelObjetivoSerie(
  territorio: Territorio,
  niveles: NivelTablaFontana[]
): "nacional" | "estatal" | "municipal" | null {
  if (territorio.nivel === "nacional") {
    return niveles.includes("nacional") ? "nacional" : null;
  }
  const tieneMunicipioResoluble =
    territorio.nivel === "municipal" ||
    territorio.nivel === "distrito" ||
    territorio.nivel === "distrito_federal" ||
    territorio.nivel === "distrito_local";
  if (tieneMunicipioResoluble) {
    if (niveles.includes("municipal")) return "municipal";
    return niveles.includes("estatal") ? "estatal" : null;
  }
  // estatal puro
  return niveles.includes("estatal") ? "estatal" : null;
}
