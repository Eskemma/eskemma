// lib/fontana/ingesta/envipe.ts
// F3-3 (Victimización, ENVIPE) — INEGI, Encuesta Nacional de Victimización
// y Percepción sobre Seguridad Pública.
//
// Verificado en vivo 2026-08-27: la ENVIPE no publica un dataset CKAN/API
// consultable — el indicador oficial ("Tasa de víctimas de delito por cada
// 100 mil habitantes", conocida como prevalencia delictiva) se publica una
// vez al año en el "Reporte de Resultados" (PDF), Cuadro 2, con los 32
// valores estatales + nacional del año más reciente y el anterior. Se
// extrajo ese cuadro UNA sola vez (regex sobre texto de PDF, 33/33 valores
// confirmados exactos contra las cifras citadas en prensa oficial de
// INEGI: México 34,851, Ciudad de México 30,804, Tlaxcala 30,498, Chiapas
// 15,576) y se guardó como catálogo estático en
// data/fontana/envipe_tasa_victimizacion.json — igual criterio que
// zap.ts (F3-8): snapshot anual manual, nunca se reparsea el PDF en cada
// request. Fuente: inegi.org.mx/contenidos/saladeprensa/boletines/2025/
// ENVIPE/ENVIPE_25_RR.pdf.
//
// Nivel: SOLO estatal (y nacional, publicado directo en el mismo cuadro)
// — la ENVIPE tiene diseño muestral con representatividad estatal, sin
// desagregación municipal ni distrital (mismo criterio ya documentado en
// el catálogo original de Familia 3: "Bodega propia, nivel estatal").
//
// agregacionPlural: "no_agregable" — es una tasa estimada por encuesta
// (no un conteo con numerador/denominador propios disponibles para
// Fontana), mismo criterio que otros índices/tasas de encuesta sin
// desglose reconstruible (F2-3/F2-4).

import envipeData from "@/data/fontana/envipe_tasa_victimizacion.json";
import { normalizeGeoName } from "@/lib/geo/municipios";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_ENVIPE = "INEGI (ENVIPE 2025, Reporte de Resultados 33/25)";

const DATA = envipeData as { _anioReferencia: number; tasas: Record<string, number> };

// Índice por nombre normalizado — construido una sola vez (33 entradas,
// trivial), nunca por request.
let indice: Map<string, number> | null = null;
function obtenerIndice(): Map<string, number> {
  if (indice) return indice;
  indice = new Map(Object.entries(DATA.tasas).map(([nombre, valor]) => [normalizeGeoName(nombre), valor]));
  return indice;
}

export async function resolverVictimizacionEnvipe(territorio: Territorio): Promise<CeldaFontana[]> {
  const idx = obtenerIndice();
  const anio = DATA._anioReferencia;

  // naturaleza: "estimacion_modelada" (NUNCA "dato_directo") — la ENVIPE es
  // una encuesta probabilística con expansión por factores de ponderación
  // muestral y margen de error propio (~7% promedio, hasta 10% según el
  // Reporte de Resultados), no un censo ni un registro administrativo.
  // "dato_directo" (badge verde, "alta confiabilidad" en
  // NaturalezaBadge.tsx) comunicaría una certeza que esta fuente no tiene
  // — "estimacion_modelada" (badge ámbar, "media confiabilidad") es la
  // categoría que ya define el prontuario para "metodología de estimación
  // propia de la fuente, no un conteo directo" (lib/fontana/naturalezaDato.ts),
  // que es exactamente este caso.
  const NATURALEZA_ENVIPE = "estimacion_modelada" as const;

  const nacional: CeldaFontana = (() => {
    const valor = idx.get(normalizeGeoName("NACIONAL"));
    return valor != null
      ? { nivel: "nacional", valor, unidad: `víctimas por cada 100,000 habitantes (${anio})`, naturaleza: NATURALEZA_ENVIPE, fuenteEtiqueta: FUENTE_ETIQUETA_ENVIPE }
      : { nivel: "nacional", motivo: "ENVIPE no reportó el valor nacional para el año de referencia" };
  })();

  const distrital: CeldaFontana = { nivel: "distrital", motivo: "ENVIPE no tiene representatividad muestral a nivel distrito electoral — diseño muestral de la encuesta" };
  const municipal: CeldaFontana = { nivel: "municipal", motivo: "ENVIPE no tiene representatividad muestral a nivel municipal — diseño muestral de la encuesta" };

  if (!territorio.estado) {
    return [nacional, { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" }, distrital, municipal];
  }

  const valorEstatal = idx.get(normalizeGeoName(territorio.estado));
  const estatal: CeldaFontana = valorEstatal != null
    ? { nivel: "estatal", valor: valorEstatal, unidad: `víctimas por cada 100,000 habitantes (${anio})`, naturaleza: NATURALEZA_ENVIPE, fuenteEtiqueta: FUENTE_ETIQUETA_ENVIPE }
    : { nivel: "estatal", motivo: `ENVIPE no reportó el valor para "${territorio.estado}"` };

  return [nacional, estatal, distrital, municipal];
}
