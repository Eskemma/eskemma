// lib/fontana/ingesta/iep.ts
// F3-17 (Índice de Paz México) — Institute for Economics and Peace (IEP).
//
// Verificado en vivo 2026-08-26: el sitio oficial
// (https://indicedepazmexico.org/) publica un Excel de datos abiertos en
// https://indicedepazmexico.org/data/MPI_PublicReleaseData_2026.xlsx
// (edición 2026, HTTP 200, content-type xlsx, ~123KB). Formato largo,
// hoja "MPI" (A1:E2183): columnas `geocode, state, year, indicator,
// banded score`. 33 geocodes (32 entidades + "National"), 6 indicadores
// por geocode/año ("fear of violence", "firearms crime", "homicide",
// "organized crime", "overall score", "violent crime"), años 2015-2025.
// Se usa `indicator === "overall score"` (índice compuesto, banded score
// 1-5, 1 = más pacífico) del año más reciente disponible (2025 — 2026 no
// tiene fila propia, es el AÑO DE EDICIÓN del reporte, no un año de
// datos). Confirmado con datos reales: Zacatecas 2025 overall score
// 2.31529834982811, Yucatán 2025 1.27892337864916 (Yucatán consistentemente
// el estado más pacífico de México en ediciones previas del IEP — pasa el
// control de plausibilidad).
//
// Nivel: nacional (geocode "National") y estatal (`state`, nombres en
// español estándar — join por nombre, mismo protocolo por defecto).
// No hay nivel municipal ni distrital — el MPI es exclusivamente estatal.
//
// Sin caché en Storage — XLSX completo (33 geocodes × 6 indicadores × 11
// años, ~123KB) cacheado en memoria de proceso (TTL 24h, single-flight),
// mismo patrón que transparencyInternational.ts/pnudHdr.ts/rsf.ts.

import * as XLSX from "xlsx";
import { normalizeGeoName } from "@/lib/geo/municipios";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_IEP = "Institute for Economics and Peace (Índice de Paz México 2026)";

const IEP_XLSX_URL = "https://indicedepazmexico.org/data/MPI_PublicReleaseData_2026.xlsx";
const HOJA = "MPI";
const INDICADOR = "overall score";
const ANIO_REFERENCIA = 2025; // año de datos más reciente en la edición 2026 — ver header.

interface FilaMpi {
  geocode: string;
  state: string;
  year: number;
  indicator: string;
  score: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: { porEstado: Map<string, number>; nacional: number | null; expira: number } | null = null;
let enVuelo: Promise<{ porEstado: Map<string, number>; nacional: number | null }> | null = null;

function parsearXlsx(buffer: ArrayBuffer): { porEstado: Map<string, number>; nacional: number | null } {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[HOJA];
  if (!ws) throw new Error(`Hoja "${HOJA}" no encontrada en el XLSX del IEP`);
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  const encabezados = (filas[4] ?? []) as string[];
  const idxGeocode = encabezados.indexOf("geocode");
  const idxState = encabezados.indexOf("state");
  const idxYear = encabezados.indexOf("year");
  const idxIndicator = encabezados.indexOf("indicator");
  const idxScore = encabezados.indexOf("banded score");

  const porEstado = new Map<string, number>();
  let nacional: number | null = null;
  for (let i = 5; i < filas.length; i++) {
    const fila = filas[i] as (string | number | null)[];
    const geocode = fila[idxGeocode];
    const state = fila[idxState];
    const year = fila[idxYear];
    const indicator = fila[idxIndicator];
    const score = fila[idxScore];
    if (indicator !== INDICADOR || year !== ANIO_REFERENCIA) continue;
    if (typeof score !== "number") continue;
    if (geocode === "National") {
      nacional = score;
      continue;
    }
    if (typeof state !== "string") continue;
    porEstado.set(normalizeGeoName(state), score);
  }
  return { porEstado, nacional };
}

async function fetchTablaIep(): Promise<{ porEstado: Map<string, number>; nacional: number | null }> {
  if (cache && cache.expira > Date.now()) return { porEstado: cache.porEstado, nacional: cache.nacional };
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const res = await fetch(IEP_XLSX_URL);
    if (!res.ok) throw new Error(`IEP respondió ${res.status}`);
    const buffer = await res.arrayBuffer();
    return parsearXlsx(buffer);
  })();
  try {
    const datos = await enVuelo;
    cache = { ...datos, expira: Date.now() + CACHE_TTL_MS };
    return datos;
  } finally {
    enVuelo = null;
  }
}

export async function resolverIndicePazMexico(territorio: Territorio): Promise<CeldaFontana[]> {
  let datos: { porEstado: Map<string, number>; nacional: number | null };
  try {
    datos = await fetchTablaIep();
  } catch {
    const motivo = "Error de conexión con el Índice de Paz México (indicedepazmexico.org)";
    return [
      { nivel: "nacional", motivo },
      { nivel: "estatal", motivo },
      { nivel: "distrital", motivo: "El Índice de Paz México no tiene desagregación por distrito electoral" },
      { nivel: "municipal", motivo: "El Índice de Paz México no tiene desagregación municipal" },
    ];
  }

  const nacional: CeldaFontana = datos.nacional != null
    ? { nivel: "nacional", valor: datos.nacional, unidad: "índice de paz (1-5, 1 = más pacífico)", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_IEP }
    : { nivel: "nacional", motivo: "El IEP no reportó el índice nacional para el año de referencia" };

  let estatal: CeldaFontana;
  if (!territorio.estado) {
    estatal = { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" };
  } else {
    const score = datos.porEstado.get(normalizeGeoName(territorio.estado));
    estatal = score != null
      ? { nivel: "estatal", valor: score, unidad: "índice de paz (1-5, 1 = más pacífico)", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_IEP }
      : { nivel: "estatal", motivo: `El IEP no reportó el índice para "${territorio.estado}"` };
  }

  return [
    nacional,
    estatal,
    { nivel: "distrital", motivo: "El Índice de Paz México no tiene desagregación por distrito electoral" },
    { nivel: "municipal", motivo: "El Índice de Paz México no tiene desagregación municipal" },
  ];
}
