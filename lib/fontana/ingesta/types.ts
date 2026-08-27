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
  // Solo F3-4 (ensu.ts) — el valor es del Área Urbana de Interés de la
  // ENSU completa a la que pertenece el municipio/distrito, no exclusivo
  // de él. Campo DISTINTO de zonaMetropolitana a propósito (2026-08-27,
  // decisión explícita): las áreas ENSU son el marco muestral propio de
  // la encuesta INEGI, no necesariamente la misma definición SEDATU/
  // CONAPO de Zona Metropolitana que usa F5-7 — no se verificó que
  // coincidan exactamente en los 24 casos multi-municipio reales, así que
  // el chip de UI (CoberturaAdvertencia, variante "area_ensu") nunca
  // menciona "Zona Metropolitana" ni SEDATU/CONAPO. `prorrateo` presente
  // solo en las 2 áreas que cruzan estado (La Laguna, Tampico — únicos
  // casos reales confirmados en 2026-T2).
  areaEnsu?: {
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

// Familia 3, Bloque 2 (2026-08-26) — 8 indicadores (F3-5/6/9-14) dependen
// de Sefix-AI (T06, Investigación del electorado), app del ecosistema
// Eskemma en pausa de desarrollo — NO del dashboard Sefix, que sí existe y
// sí se consume hoy (ver ECEG). Motivo propio y distinto de
// MOTIVO_CONECTOR_PENDIENTE (eceg.ts) a propósito: ese texto implica "en
// el siguiente incremento de Fontana", que sería engañoso aquí — la
// disponibilidad depende de que otra app retome desarrollo, sin fecha.
export const MOTIVO_PENDIENTE_SEFIX_AI =
  "Pendiente — se habilitará cuando Sefix-AI esté disponible";

// F3-15 (Presencia de organizaciones sociales, RFOSC/CLUNI) — verificado
// en vivo 2026-08-26: corresponsabilidad.gob.mx (connection refused) y
// sii.bienestar.gob.mx/portal (HTTP 500) siguen caídos. Motivo propio,
// visualmente distinto de MOTIVO_PENDIENTE_SEFIX_AI — aquí SÍ es la fuente
// externa correcta y definitiva (no depende de otra app del ecosistema),
// solo que su infraestructura está caída; reintentar en una próxima ronda.
export const MOTIVO_RFOSC_CAIDO =
  "Fuente no disponible — infraestructura de RFOSC/CLUNI caída, reintentar en una próxima ronda";

// F3-4 (ENSU) — nivel Distrital: cuando los municipios que componen el
// distrito pertenecen a MÁS de un área urbana de interés de la ENSU (o
// mezclan municipios dentro y fuera de alguna), no hay un único valor
// asignable sin mezclar territorios distintos. Motivo propio y explícito
// — nunca "sin dato" silencioso ni el motivo genérico de nivel no
// cubierto (aquí SÍ hay mecanismo, solo que este distrito en particular
// no cae limpio dentro de una sola área).
export const MOTIVO_ENSU_CRUZA_AREAS =
  "Este distrito cruza más de un área de cobertura de la ENSU — no se puede asignar un único valor sin mezclar territorios distintos";

// F3-4 (ENSU) — variante para conjuntos plurales de municipios (ZMG y
// similares), mismo espíritu que MOTIVO_ENSU_CRUZA_AREAS pero con
// redacción propia de "conjunto de municipios" en vez de "distrito".
export const MOTIVO_ENSU_CRUZA_AREAS_PLURAL =
  "Este conjunto de municipios cruza más de un área de cobertura de la ENSU — no se puede asignar un único valor sin mezclar territorios distintos";

// F3-4 — caso DISTINTO del anterior (2026-08-27, gap autodetectado):
// ningún municipio del conjunto/distrito está cubierto por ninguna de las
// 90 áreas de la ENSU — no es que "crucen" varias áreas, es que ninguno
// tiene cobertura. Mismo criterio ya aplicado a nivel Distrital
// (lib/fontana/ingesta/ensu.ts) — se replica aquí para plural, en vez de
// reutilizar el motivo de cruce para una causa distinta.
export const MOTIVO_ENSU_SIN_COBERTURA_PLURAL =
  "Ninguno de los municipios de este conjunto está dentro de las 90 áreas urbanas de interés de la ENSU";