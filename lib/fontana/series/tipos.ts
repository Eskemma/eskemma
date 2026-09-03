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
  formato: "conteo" | "moneda" | "porcentaje" | "indice";
  puntos: PuntoSerie[];
}

export type ResultadoSerie = ResultadoSerieOk | { ok: false; motivo: string };

/**
 * Nivel al que se resuelve la serie según el territorio del proyecto:
 * proyecto nacional → serie nacional (si el indicador la tiene);
 * cualquier otro nivel → serie estatal (del estado del proyecto, o del
 * estado que contiene al municipio/distrito). Ningún indicador de la 1ª
 * ola tiene serie municipal.
 */
export function nivelObjetivoSerie(
  territorio: Territorio,
  niveles: NivelTablaFontana[]
): "nacional" | "estatal" {
  if (territorio.nivel === "nacional" && niveles.includes("nacional")) return "nacional";
  return "estatal";
}
