// lib/fontana/ingesta/types.ts
// Tipo compartido por todos los adaptadores de ingesta de Fontana
// (eceg.ts, iter.ts, compendio.ts, conapo.ts, banxico.ts) — antes vivía
// duplicado en cada archivo; se extrae aquí para que el dispatcher
// (lib/fontana/ingesta/index.ts) tenga un único contrato de retorno.

import type { NaturalezaDato } from "@/lib/fontana/indicatorRegistry";

export type NivelFontanaF1 = "estatal" | "municipal";

export interface ValorIndicadorFontana {
  nivel: NivelFontanaF1;
  valor: number;
  // Solo indicadores de distribución (ej. F1-2, pirámide de edades):
  // desglose adicional que la tabla comparativa no consume todavía
  // (queda disponible para Canvas/gráfica — ver plan de Familia 1).
  distribucion?: Record<string, number>;
  unidad?: string;
  naturaleza: NaturalezaDato;
  fuenteEtiqueta: string;
}

export interface CeldaNoDisponible {
  nivel: NivelFontanaF1;
  motivo: string;
}

export type CeldaFontana = ValorIndicadorFontana | CeldaNoDisponible;

export function esValorDisponible(celda: CeldaFontana): celda is ValorIndicadorFontana {
  return "valor" in celda;
}