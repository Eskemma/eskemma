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
  // Coeficiente de variación (%) que la propia fuente ya cuantifica para
  // estimaciones modeladas (ej. F2-18 ICMM, small-area estimation SEBLUP)
  // — señal de confiabilidad distinta de coberturaPct (esa mide cobertura
  // geográfica de Fontana, esta mide precisión estadística de la fuente).
  // No se expone visualmente todavía (2026-08-09) — se carga para tenerla
  // disponible si se decide usarla como señal de calidad por territorio.
  coeficienteVariacionPct?: number;
  // Solo F5-7 (sun.ts) — el valor es de la Ciudad/Zona Metropolitana
  // completa a la que pertenece el municipio, no exclusivo de él.
  // `prorrateo` presente solo en la celda Estatal de las ZM que cruzan
  // más de un estado (Grupo F, Ronda 11, 2026-08-23) — ver
  // CoberturaAdvertencia.tsx variante "zona_metropolitana".
  zonaMetropolitana?: {
    nombre: string;
    numMunicipios: number;
    prorrateo?: { pctEstado: number; numEstados: number };
  };
}

export interface CeldaNoDisponible {
  nivel: NivelFontanaF1;
  motivo: string;
}

export type CeldaFontana = ValorIndicadorFontana | CeldaNoDisponible;

export function esValorDisponible(celda: CeldaFontana): celda is ValorIndicadorFontana {
  return "valor" in celda;
}

// MITIGACIÓN DE EMERGENCIA (2026-08-23) — incidente de integridad de
// datos: resolveMunicipioCve()/getMunicipiosOptions() (lib/geo/municipios.ts)
// usa el topojson de cartografía electoral de INE, cuyo CVE_MUN diverge
// del oficial INEGI en ~55-63% de los municipios (confirmado con 2
// fuentes independientes — ver docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md).
// El nivel Municipal de coneval.ts (F2-1/F2-2/F2-3/F2-14, incluyendo
// desgloses "Ver municipios"), conapoMarginacion.ts (F2-4) y
// bienestar.ts (F2-7/F2-8) queda deshabilitado con este motivo hasta
// completar el Paso 4 (eliminar resolveMunicipioCve como mecanismo de
// join, reemplazarlo por join-por-nombre ya usado en icmm.ts/pnud.ts) y
// verificarlo con muestra amplia. NUNCA remover este mensaje sin haber
// corrido esa verificación primero — un dato incorrecto sin señal
// visual es peor que un dato ausente con explicación.
export const MOTIVO_MUNICIPAL_EN_VALIDACION =
  "En validación — se detectó un problema de datos en este nivel, corrigiendo.";