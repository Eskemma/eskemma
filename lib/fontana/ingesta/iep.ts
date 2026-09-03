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
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ResultadoSerie } from "@/lib/fontana/series/tipos";
import { nivelObjetivoSerie } from "@/lib/fontana/series/tipos";

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

// ==========================================
// SERIE TEMPORAL (T10, 1ª ola 2026-09-01) — F3-17.
// El XLSX ya contiene overall score 2015-2025 por geocode/año; el resolver
// de celda descarta todo menos ANIO_REFERENCIA (2025). Este lee todos los
// años. El IEP solo publica años cerrados (2026 es el año de EDICIÓN, no
// tiene fila de datos), así que no hay año parcial que excluir.
// ==========================================

const UNIDAD_IEP = "índice de paz (1-5, 1 = más pacífico)";

const CVE_ESTADO_NOMBRE_IEP: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

interface SerieIepCache {
  porEstado: Map<string, Record<string, number>>; // estadoNorm -> { año -> score }
  nacional: Record<string, number>;
  expira: number;
}
let serieCache: SerieIepCache | null = null;
let serieEnVuelo: Promise<Omit<SerieIepCache, "expira">> | null = null;

function parsearSerieXlsx(buffer: ArrayBuffer): Omit<SerieIepCache, "expira"> {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[HOJA];
  if (!ws) throw new Error(`Hoja "${HOJA}" no encontrada en el XLSX del IEP`);
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const enc = (filas[4] ?? []) as string[];
  const iG = enc.indexOf("geocode");
  const iS = enc.indexOf("state");
  const iY = enc.indexOf("year");
  const iI = enc.indexOf("indicator");
  const iSc = enc.indexOf("banded score");

  const porEstado = new Map<string, Record<string, number>>();
  const nacional: Record<string, number> = {};
  for (let i = 5; i < filas.length; i++) {
    const f = filas[i] as (string | number | null)[];
    if (f[iI] !== INDICADOR) continue;
    const year = f[iY];
    const score = f[iSc];
    if (typeof year !== "number" || typeof score !== "number") continue;
    const periodo = String(year);
    if (f[iG] === "National") {
      nacional[periodo] = score;
      continue;
    }
    if (typeof f[iS] !== "string") continue;
    const clave = normalizeGeoName(f[iS] as string);
    const rec = porEstado.get(clave) ?? {};
    rec[periodo] = score;
    porEstado.set(clave, rec);
  }
  return { porEstado, nacional };
}

async function cargarSerieIep(): Promise<Omit<SerieIepCache, "expira">> {
  if (serieCache && serieCache.expira > Date.now()) {
    return { porEstado: serieCache.porEstado, nacional: serieCache.nacional };
  }
  if (serieEnVuelo) return serieEnVuelo;
  serieEnVuelo = (async () => {
    const res = await fetch(IEP_XLSX_URL);
    if (!res.ok) throw new Error(`IEP respondió ${res.status}`);
    return parsearSerieXlsx(await res.arrayBuffer());
  })();
  try {
    const datos = await serieEnVuelo;
    serieCache = { ...datos, expira: Date.now() + CACHE_TTL_MS };
    return datos;
  } finally {
    serieEnVuelo = null;
  }
}

export async function resolverSerieIep(territorio: Territorio): Promise<ResultadoSerie> {
  let datos: Omit<SerieIepCache, "expira">;
  try {
    datos = await cargarSerieIep();
  } catch {
    return { ok: false, motivo: "Error de conexión con el Índice de Paz México (indicedepazmexico.org)" };
  }

  const nivel = nivelObjetivoSerie(territorio, ["nacional", "estatal"]);
  let porAno: Record<string, number> | undefined;
  let territorioLabel: string;
  if (nivel === "nacional") {
    porAno = datos.nacional;
    territorioLabel = "Nacional";
  } else {
    if (!territorio.estado) return { ok: false, motivo: "El proyecto no tiene un estado definido en su territorio" };
    const clave = normalizeGeoName(territorio.estado);
    porAno = datos.porEstado.get(clave);
    const cve = ESTADO_CVE_MAP[clave];
    territorioLabel = (cve && CVE_ESTADO_NOMBRE_IEP[cve]) ?? territorio.estado;
  }
  if (!porAno || Object.keys(porAno).length === 0) {
    return { ok: false, motivo: `El IEP no reportó una serie para "${territorioLabel}"` };
  }

  const puntos = Object.keys(porAno)
    .sort()
    .map((periodo) => ({ periodo, valor: Math.round(porAno![periodo] * 100000) / 100000 }));

  return {
    ok: true,
    nivel,
    territorioLabel,
    unidad: UNIDAD_IEP,
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_IEP,
    formato: "indice",
    puntos,
  };
}
