// lib/fontana/ingesta/transparencyInternational.ts
// Adaptador de F4-7 (Índice de Percepción de Corrupción, Transparencia
// Internacional) — Familia 4.
//
// Verificado 2026-08-21: el catálogo original documentaba "descarga
// directa con parseo manual XML" — el mecanismo real disponible hoy es
// XLSX, no XML (drift confirmado en vivo, corregido aquí):
// https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx
// (307 redirect a files.transparencycdn.org, `fetch` lo sigue solo).
// Sigue siendo descarga directa reproducible, solo cambia el formato de
// parseo (xlsx, ya dependencia directa del proyecto — ver coneval.ts).
//
// Hoja "CPI 2024", encabezados en la fila 3 (índice 2, 0-based):
// "Country / Territory", "ISO3", "Region", "CPI 2024 score", "Rank", ...
// Datos desde la fila 4. Confirmado con descarga real (Dinamarca 90/1,
// Finlandia 88/2, Singapur 84/3).
//
// Sin caché en Storage — XLSX completo cacheado en memoria de proceso
// (TTL 24h, single-flight), mismo patrón que pnudHdr.ts/rsf.ts.
//
// SERIE HISTÓRICA de F4-7 (2026-09-07) — el MISMO workbook trae la hoja
// "CPI Historical" en formato largo/tidy: una fila por país-año, columnas
// con nombre exacto "ISO3" / "Year" / "CPI score" / "Rank" (encabezados en
// la fila 3, índice 2), rango 2012-2024. Se elige esa hoja y no la ancha
// "CPI Timeseries 2012 - 2024" porque esta última tiene una inconsistencia
// real de mayúsculas entre años ("CPI score 2014".."CPI score 2024" pero
// "CPI Score 2013" / "CPI Score 2012") y 50 columnas que parsear.
// Verificado en vivo 2026-09-07: MX + COL/CHL/BRA/ARG con los 13 años
// completos 2012-2024 (MEX 2024=26, 2012=34); último punto (2024) idéntico
// al valor de la celda (hoja "CPI 2024"). NO hay quiebre metodológico
// interno: la revisión de TI de 2012 es la razón de que la serie arranque
// ese año — la hoja se titula "Score timeseries since 2012" y los datos
// pre-2012 (metodología vieja) no están en el archivo. A diferencia de
// F4-2 (CEPAL marca 2014/2016 no comparable), TODO el rango disponible es
// una sola serie comparable: sin anioMinimo, sin nota de tramo.
// Caché de serie propia (separada de la de celda: otra hoja, otro shape).

import * as XLSX from "xlsx";
import type {
  CeldaComparativaPais,
  PaisComparativoCompleto,
  SeriePaisComparativa,
} from "@/lib/fontana/tablaComparativaInternacional";

const CPI_XLSX_URL = "https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx";
const HOJA = "CPI 2024";
const HOJA_SERIE = "CPI Historical";

interface FilaCpi {
  iso3: string;
  nombre: string;
  score: number;
  rank: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: { filas: Map<string, FilaCpi>; expira: number } | null = null;
let enVuelo: Promise<Map<string, FilaCpi>> | null = null;

function parsearXlsx(buffer: ArrayBuffer): Map<string, FilaCpi> {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[HOJA];
  if (!ws) throw new Error(`Hoja "${HOJA}" no encontrada en el XLSX de CPI`);
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  const encabezados = (filas[2] ?? []) as string[];
  const idxIso3 = encabezados.indexOf("ISO3");
  const idxNombre = encabezados.indexOf("Country / Territory");
  const idxScore = encabezados.findIndex((h) => typeof h === "string" && h.includes("CPI") && h.includes("score"));
  const idxRank = encabezados.indexOf("Rank");

  const porPais = new Map<string, FilaCpi>();
  for (let i = 3; i < filas.length; i++) {
    const fila = filas[i] as (string | number | null)[];
    const iso3 = fila[idxIso3];
    const nombre = fila[idxNombre];
    const score = fila[idxScore];
    const rank = fila[idxRank];
    if (typeof iso3 !== "string" || iso3.length !== 3) continue;
    if (typeof score !== "number" || typeof rank !== "number") continue;
    porPais.set(iso3, { iso3, nombre: typeof nombre === "string" ? nombre : iso3, score, rank });
  }
  return porPais;
}

async function fetchTablaCpi(): Promise<Map<string, FilaCpi>> {
  if (cache && cache.expira > Date.now()) return cache.filas;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const res = await fetch(CPI_XLSX_URL);
    if (!res.ok) throw new Error(`Transparencia Internacional respondió ${res.status}`);
    const buffer = await res.arrayBuffer();
    return parsearXlsx(buffer);
  })();
  try {
    const filas = await enVuelo;
    cache = { filas, expira: Date.now() + CACHE_TTL_MS };
    return filas;
  } finally {
    enVuelo = null;
  }
}

function celdaDesdeFila(iso3: string, fila: FilaCpi | undefined): CeldaComparativaPais {
  if (!fila) return { iso3, estadoConsulta: "sin_datos_confirmado", motivo: "Transparencia Internacional no tiene dato para este país" };
  return {
    iso3,
    valor: fila.score,
    unidad: "índice (0-100)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: `Transparencia Internacional, CPI 2024 (rank global ${fila.rank})`,
    estadoConsulta: "ok",
    rankOficial: fila.rank,
  };
}

export async function resolverTransparencyInternational(isos3: string[]): Promise<Map<string, CeldaComparativaPais>> {
  const porPais = new Map<string, CeldaComparativaPais>();

  let tabla: Map<string, FilaCpi>;
  try {
    tabla = await fetchTablaCpi();
  } catch {
    for (const iso3 of isos3) {
      porPais.set(iso3, { iso3, estadoConsulta: "error_conexion", motivo: "Error de conexión con Transparencia Internacional" });
    }
    return porPais;
  }

  for (const iso3 of isos3) {
    porPais.set(iso3, celdaDesdeFila(iso3, tabla.get(iso3)));
  }
  return porPais;
}

// Todos los países con dato — para el modal "Ver resto de países".
export async function resolverTransparencyInternationalTodos(): Promise<PaisComparativoCompleto[]> {
  const tabla = await fetchTablaCpi();
  return [...tabla.entries()].map(([iso3, fila]) => ({ iso3, nombre: fila.nombre, celda: celdaDesdeFila(iso3, fila) }));
}

// ─── SERIE HISTÓRICA (F4-7) ───────────────────────────────────────────────

interface PuntoCpi {
  periodo: string;
  valor: number | null;
  rank: number | null;
}

let cacheSerie: { porPais: Map<string, PuntoCpi[]>; expira: number } | null = null;
let enVueloSerie: Promise<Map<string, PuntoCpi[]>> | null = null;

function parsearSerieCpi(buffer: ArrayBuffer): Map<string, PuntoCpi[]> {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[HOJA_SERIE];
  if (!ws) throw new Error(`Hoja "${HOJA_SERIE}" no encontrada en el XLSX de CPI`);
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  const encabezados = (filas[2] ?? []) as string[];
  const idxIso3 = encabezados.indexOf("ISO3");
  const idxYear = encabezados.indexOf("Year");
  const idxScore = encabezados.indexOf("CPI score");
  const idxRank = encabezados.indexOf("Rank");
  if (idxIso3 === -1 || idxYear === -1 || idxScore === -1) {
    throw new Error(
      `Columnas esperadas no encontradas en la hoja "${HOJA_SERIE}" (ISO3=${idxIso3}, Year=${idxYear}, "CPI score"=${idxScore})`
    );
  }

  const porPais = new Map<string, PuntoCpi[]>();
  for (let i = 3; i < filas.length; i++) {
    const fila = filas[i] as (string | number | null)[];
    const iso3 = fila[idxIso3];
    const year = fila[idxYear];
    if (typeof iso3 !== "string" || iso3.length !== 3) continue;
    if (typeof year !== "number") continue;
    const score = fila[idxScore];
    const rank = idxRank === -1 ? null : fila[idxRank];
    const punto: PuntoCpi = {
      periodo: String(year),
      valor: typeof score === "number" && Number.isFinite(score) ? score : null,
      rank: typeof rank === "number" && Number.isFinite(rank) ? rank : null,
    };
    const lista = porPais.get(iso3) ?? [];
    lista.push(punto);
    porPais.set(iso3, lista);
  }
  for (const lista of porPais.values()) {
    lista.sort((a, b) => Number(a.periodo) - Number(b.periodo));
  }
  return porPais;
}

async function fetchSerieCpi(): Promise<Map<string, PuntoCpi[]>> {
  if (cacheSerie && cacheSerie.expira > Date.now()) return cacheSerie.porPais;
  if (enVueloSerie) return enVueloSerie;

  enVueloSerie = (async () => {
    const res = await fetch(CPI_XLSX_URL);
    if (!res.ok) throw new Error(`Transparencia Internacional respondió ${res.status}`);
    const buffer = await res.arrayBuffer();
    return parsearSerieCpi(buffer);
  })();
  try {
    const porPais = await enVueloSerie;
    cacheSerie = { porPais, expira: Date.now() + CACHE_TTL_MS };
    return porPais;
  } finally {
    enVueloSerie = null;
  }
}

function serieDesdeFila(iso3: string, puntos: PuntoCpi[] | undefined): SeriePaisComparativa {
  const conDato = (puntos ?? []).filter((p) => p.valor !== null);
  if (!puntos || conDato.length === 0) {
    return {
      iso3,
      estadoConsulta: "sin_datos_confirmado",
      motivo: "Transparencia Internacional no tiene serie para este país",
      puntos: [],
    };
  }
  const ultimoConRank = [...puntos].reverse().find((p) => p.valor !== null && p.rank !== null);
  return {
    iso3,
    estadoConsulta: "ok",
    unidad: "índice (0-100)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: "Transparencia Internacional, CPI",
    rankOficialUltimo: ultimoConRank?.rank ?? undefined,
    puntos: puntos.map((p) => ({ periodo: p.periodo, valor: p.valor })),
  };
}

// F4-7 es el único indicador TI con serie — no recibe indicadorId (igual
// que resolverSerieHdr, pnudHdr.ts).
export async function resolverSerieTransparency(isos3: string[]): Promise<Map<string, SeriePaisComparativa>> {
  const porPais = new Map<string, SeriePaisComparativa>();
  let tabla: Map<string, PuntoCpi[]>;
  try {
    tabla = await fetchSerieCpi();
  } catch {
    for (const iso3 of isos3) {
      porPais.set(iso3, { iso3, estadoConsulta: "error_conexion", motivo: "Error de conexión con Transparencia Internacional", puntos: [] });
    }
    return porPais;
  }
  for (const iso3 of isos3) porPais.set(iso3, serieDesdeFila(iso3, tabla.get(iso3)));
  return porPais;
}
