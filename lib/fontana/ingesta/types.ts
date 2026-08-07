// lib/fontana/ingesta/types.ts
// Tipo compartido por todos los adaptadores de ingesta de Fontana
// (eceg.ts, iter.ts, compendio.ts, conapo.ts, banxico.ts) — antes vivía
// duplicado en cada archivo; se extrae aquí para que el dispatcher
// (lib/fontana/ingesta/index.ts) tenga un único contrato de retorno.

import type { NaturalezaDato } from "@/lib/fontana/indicatorRegistry";

// "nacional"/"distrital" se agregaron en el cierre de Familia 1
// (2026-08-02) — solo ECEG los resuelve hoy; el resto de adaptadores
// (iter/compendio/banxico/conapo) siguen regresando solo estatal/
// municipal, subset válido del mismo tipo.
export type NivelFontanaF1 = "nacional" | "estatal" | "distrital" | "municipal";

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
  // Solo nivel "distrital" de ECEG — % de la población del distrito que
  // sí logró vincularse a una sección con distrito asignado (cartografía
  // 2025 vs. censo 2020, ver nota de cobertura en
  // scripts/eceg-data-pipeline.ts). < 100 cuando el valor puede
  // subestimar la cifra real.
  coberturaPct?: number;
}

export interface CeldaNoDisponible {
  nivel: NivelFontanaF1;
  motivo: string;
}

export type CeldaFontana = ValorIndicadorFontana | CeldaNoDisponible;

export function esValorDisponible(celda: CeldaFontana): celda is ValorIndicadorFontana {
  return "valor" in celda;
}