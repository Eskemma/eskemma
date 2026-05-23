// lib/sefix/storage.ts
// Utilidades para leer y procesar los CSV de Sefix desde Firebase Storage
import { adminApp } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { createInterface } from "readline";
import { PARTIDOS_MAPPING } from "@/lib/sefix/eleccionesConstants";

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;

// ==========================================
// CACHÉ EN MEMORIA (TTL 30 min)
// ==========================================

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// Raw row cache: avoids re-downloading the same CSV from Firebase Storage within the TTL.
// Shared across all callers (getResultadosByEstado, getGanadorPorFeature, etc.) so a single
// download serves multiple query paths within the same server process.
const rowsCache = new Map<string, { rows: Record<string, string>[]; headers: string[]; expiresAt: number }>();

// Deduplicates concurrent downloads of the same file — only one HTTP fetch runs at a time.
const ongoingDownloads = new Map<string, Promise<{ rows: Record<string, string>[]; headers: string[] }>>();

// ==========================================
// LECTURA STREAMING DE CSV
// ==========================================

function getBucket() {
  return getStorage(adminApp).bucket(BUCKET);
}

/** Downloads and parses a CSV file from Firebase Storage, storing all rows in rowsCache. */
async function downloadAndParseRows(
  storagePath: string
): Promise<{ rows: Record<string, string>[]; headers: string[] }> {
  const file = getBucket().file(storagePath);
  const stream = file.createReadStream();
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] = [];
  let isFirst = true;
  const allRows: Record<string, string>[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isFirst) {
      headers = line.split(",").map((h) => {
        const t = h.trim();
        return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
      });
      isFirst = false;
      continue;
    }
    const values = line.split(",");
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const raw = (values[i] ?? "").trim();
      // Strip RFC 4180 quoting: "" → empty string, "value" → value
      row[headers[i]] = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    }
    allRows.push(row);
  }

  const result = { rows: allRows, headers };
  rowsCache.set(storagePath, { ...result, expiresAt: Date.now() + CACHE_TTL });
  return result;
}

/** Lee un CSV de Storage línea por línea.
 *  - Rows are cached in memory for CACHE_TTL to avoid re-downloading the same file.
 *  - Concurrent calls for the same uncached file share a single download promise (no stampede). */
async function streamCsvRows(
  storagePath: string,
  onRow: (row: Record<string, string>, headers: string[]) => void
): Promise<string[]> {
  const now = Date.now();
  const cached = rowsCache.get(storagePath);

  if (cached && now < cached.expiresAt) {
    for (const row of cached.rows) onRow(row, cached.headers);
    return cached.headers;
  }

  // Deduplicate: if another call is already downloading this file, wait for that promise.
  let promise = ongoingDownloads.get(storagePath);
  if (!promise) {
    promise = downloadAndParseRows(storagePath);
    ongoingDownloads.set(storagePath, promise);
    promise.finally(() => ongoingDownloads.delete(storagePath));
  }

  const { rows, headers } = await promise;
  for (const row of rows) onRow(row, headers);
  return headers;
}

/** Lista los archivos CSV en un prefijo de Storage (con caché) */
export async function listStorageFiles(prefix: string): Promise<string[]> {
  const cacheKey = `list:${prefix}`;
  const cached = getCached<string[]>(cacheKey);
  if (cached) return cached;

  const [files] = await getBucket().getFiles({ prefix });
  const paths = files
    .map((f) => f.name)
    .filter((n) => n.endsWith(".csv") && !n.endsWith("/"));

  setCache(cacheKey, paths);
  return paths;
}

// ==========================================
// NORMALIZACIÓN DE ESTADO
// ==========================================

/**
 * Mapeo del nombre corto (usado en ESTADOS_LIST/UI) al nombre exacto que
 * aparece en la columna nombre_entidad de los CSVs de DERFE/INE.
 * Los cuatro estados listados tienen nombres constitucionales largos en sus
 * archivos de datos; los demás coinciden con el nombre corto.
 */
/**
 * Maps the UI short name to the canonical storage key name.
 * Michoacán, Veracruz and Coahuila are stored with their short names in the
 * pre-generated JSON files (both old "DE OCAMPO" CSVs and new short-name CSVs
 * are normalized to the short name by the pregenerate script).
 * "ESTADO DE MEXICO" uses "MEXICO" because DERFE uses that in its CSV column.
 */
/**
 * Maps UI short names to the exact nombre_entidad value in DERFE CSV files.
 * Used for filtering rows in semanal CSVs and other CSV-based lookups.
 * The four states below use constitutional long names in older CSV files.
 */
const DERFE_NOMBRE_MAP: Record<string, string> = {
  "ESTADO DE MEXICO":  "MEXICO",
  "COAHUILA":          "COAHUILA DE ZARAGOZA",
  "MICHOACAN":         "MICHOACAN DE OCAMPO",
  "VERACRUZ":          "VERACRUZ DE IGNACIO DE LA LLAVE",
};

/**
 * Maps UI entidad name to the storage key used for pre-generated historico JSON files.
 * Different from toDerfeNombre: pregenerate-sefix.ts normalizes constitutional long names
 * (e.g. "MICHOACAN DE OCAMPO") to their short forms, so JSON files use short names.
 * Only Estado de México needs remapping because DERFE CSVs store it as "MEXICO".
 */
function toHistoricoStorageKey(entidad: string): string {
  if (entidad === "__EXTRANJERO__") return "__EXTRANJERO__";
  if (entidad === "ESTADO DE MEXICO") return toStorageKey("MEXICO");
  return toStorageKey(entidad);
}

/** Traduce el nombre UI corto al nombre_entidad real del CSV de DERFE. */
function toDerfeNombre(nombre: string): string {
  return DERFE_NOMBRE_MAP[nombre] ?? nombre;
}

/**
 * Maps UI state name to the estado value used in electoral result CSVs (pef_dip/sen/pdte).
 * Only ESTADO DE MEXICO needs remapping (CSV stores "MEXICO").
 * Coahuila/Michoacán/Veracruz are stored with their short UI names in electoral CSVs,
 * unlike the NB/LNE weekly CSVs which use full constitutional names (handled by toDerfeNombre).
 */
function toElectoralEstado(nombre: string): string {
  if (nombre === "ESTADO DE MEXICO") return "MEXICO";
  return nombre;
}

const ESTADO_MAP: Record<string, string> = {
  aguascalientes: "AGUASCALIENTES",
  baja_california: "BAJA CALIFORNIA",
  baja_california_sur: "BAJA CALIFORNIA SUR",
  campeche: "CAMPECHE",
  chiapas: "CHIAPAS",
  chihuahua: "CHIHUAHUA",
  coahuila: "COAHUILA",
  colima: "COLIMA",
  cdmx: "CIUDAD DE MEXICO",
  ciudad_de_mexico: "CIUDAD DE MEXICO",
  df: "CIUDAD DE MEXICO",
  durango: "DURANGO",
  estado_de_mexico: "ESTADO DE MEXICO",
  edomex: "ESTADO DE MEXICO",
  guanajuato: "GUANAJUATO",
  guerrero: "GUERRERO",
  hidalgo: "HIDALGO",
  jalisco: "JALISCO",
  michoacan: "MICHOACAN",
  morelos: "MORELOS",
  nayarit: "NAYARIT",
  nuevo_leon: "NUEVO LEON",
  oaxaca: "OAXACA",
  puebla: "PUEBLA",
  queretaro: "QUERETARO",
  quintana_roo: "QUINTANA ROO",
  san_luis_potosi: "SAN LUIS POTOSI",
  sinaloa: "SINALOA",
  sonora: "SONORA",
  tabasco: "TABASCO",
  tamaulipas: "TAMAULIPAS",
  tlaxcala: "TLAXCALA",
  veracruz: "VERACRUZ",
  yucatan: "YUCATAN",
  zacatecas: "ZACATECAS",
};

export function normalizeEstado(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function resolveEstadoName(input: string): string | null {
  return ESTADO_MAP[normalizeEstado(input)] ?? null;
}

// ==========================================
// RESULTADOS ELECTORALES
// ==========================================

// Columnas de metadatos que NO son votos de partido
const RESULTS_META_COLS = new Set([
  "id", "anio", "cve_ambito", "ambito", "cve_cargo", "cargo",
  "cve_principio", "principio", "cve_tipo", "tipo",
  "cve_circunscripcion", "circunscripcion", "cve_estado", "estado",
  "cve_def", "cabecera", "cve_mun", "municipio", "seccion",
  "total_votos", "lne", "part_ciud",
]);

// Clave de cargo → prefijo de archivo
const CARGO_TO_KEY: Record<string, string> = {
  diputados: "dip",
  diputado: "dip",
  dip: "dip",
  senadores: "sen",
  senador: "sen",
  sen: "sen",
  presidente: "pdte",
  presidencia: "pdte",
  pdte: "pdte",
};

export interface ResultadosEstado {
  estado: string;
  cargo: string;
  anio: number;
  totalVotos: number;
  lne: number;
  participacion: number;
  votosNulos: number;
  votosExtranjero?: number;
  partidos: { partido: string; votos: number; porcentaje: number }[];
  coaliconesIncluidas: string[];
  fuente: string;
}

export async function getResultadosByEstado(
  estadoInput: string,
  cargoInput: string,
  anioInput?: number
): Promise<ResultadosEstado | null> {
  // Empty string or "nacional" → aggregate all states
  const isNacional = !estadoInput || estadoInput.toLowerCase() === "nacional";
  const estadoNombre = isNacional ? null : resolveEstadoName(estadoInput);
  if (!isNacional && !estadoNombre) return null;

  const cargoKey = CARGO_TO_KEY[cargoInput.toLowerCase()] ?? "dip";

  // Listar archivos disponibles para este cargo
  const allFiles = await listStorageFiles("sefix/results/federals/");
  const cargoFiles = allFiles
    .filter((f) => f.includes(`/pef_${cargoKey}_`))
    .sort();

  if (cargoFiles.length === 0) return null;

  // Seleccionar año: el más reciente si no se especifica
  let targetFile: string;
  if (anioInput) {
    const match = cargoFiles.find((f) => f.includes(`_${anioInput}.csv`));
    if (!match) return null;
    targetFile = match;
  } else {
    targetFile = cargoFiles[cargoFiles.length - 1];
  }

  const anio = parseInt(targetFile.match(/_(\d{4})\.csv$/)?.[1] ?? "0");
  const cacheKey = `resultados:${estadoNombre ?? "NACIONAL"}:${cargoKey}:${anio}`;
  const cached = getCached<ResultadosEstado>(cacheKey);
  if (cached) return cached;

  // Streaming y agregación
  const totals: Record<string, number> = {};
  let totalVotos = 0;
  let lne = 0;
  let votosNulos = 0;
  let votosExtranjero = 0;
  let partidoHeaders: string[] = [];

  const headers = await streamCsvRows(targetFile, (row) => {
    if (estadoNombre && row.estado !== estadoNombre) return;

    // Skip aggregate rows, but keep "VOTO EN EL EXTRANJERO" rows (seccion=0, municipio especial)
    const rowSeccion = row.seccion?.trim();
    const rowMun = row.municipio?.trim().toUpperCase();
    const isExtranjero = rowMun === "VOTO EN EL EXTRANJERO";
    if (!isExtranjero && (!rowSeccion || rowSeccion === "0" || rowSeccion === "00")) return;

    const tv = parseInt(row.total_votos ?? "0");
    const lneRow = parseInt(row.lne ?? "0");
    const vn = parseInt(row.vot_nul ?? "0");
    const tvSafe = isNaN(tv) ? 0 : tv;

    if (isExtranjero) votosExtranjero += tvSafe;

    totalVotos += tvSafe;
    lne += isNaN(lneRow) ? 0 : lneRow;
    votosNulos += isNaN(vn) ? 0 : vn;

    for (const [col, val] of Object.entries(row)) {
      if (!RESULTS_META_COLS.has(col.toLowerCase())) {
        const v = parseInt(val ?? "0");
        if (!isNaN(v)) totals[col] = (totals[col] ?? 0) + v;
      }
    }
  });

  // Todas las columnas de partido/coalición/candidatura (case-insensitive meta exclusion)
  partidoHeaders = headers.filter((h) => !RESULTS_META_COLS.has(h.toLowerCase()));
  const coaliconesIncluidas = headers.filter(
    (h) => !RESULTS_META_COLS.has(h.toLowerCase()) && h.includes("_")
  );

  // Construir ranking completo (partidos, coaliciones, candidaturas, nulos)
  const partidos = partidoHeaders
    .map((p) => ({
      partido: p,
      votos: totals[p] ?? 0,
      porcentaje: totalVotos > 0 ? +((totals[p] ?? 0) / totalVotos * 100).toFixed(2) : 0,
    }))
    .filter((p) => p.votos > 0)
    .sort((a, b) => b.votos - a.votos);

  const result: ResultadosEstado = {
    estado: estadoNombre ?? "NACIONAL",
    cargo: cargoKey === "dip" ? "DIPUTADOS FEDERALES" : cargoKey === "sen" ? "SENADORES" : "PRESIDENTE",
    anio,
    totalVotos,
    lne,
    participacion: lne > 0 ? +((totalVotos / lne) * 100).toFixed(2) : 0,
    votosNulos,
    votosExtranjero: votosExtranjero > 0 ? votosExtranjero : undefined,
    partidos,
    coaliconesIncluidas,
    fuente: `INE — Sistema de Consulta de la Estadística de las Elecciones Federales ${anio}`,
  };

  setCache(cacheKey, result);
  return result;
}

// ==========================================
// PADRÓN Y LISTA NOMINAL
// ==========================================

export interface PadronEstado {
  estado: string;
  corte: string;
  tipo: "historico" | "semanal";
  padronElectoral: number;
  listaNominal: number;
  padronHombres: number;
  padronMujeres: number;
  padronNoBinario: number;
  fuente: string;
}

/** Devuelve el path del archivo semanal _sexo más reciente */
async function getLatestSemanalPath(): Promise<string | null> {
  const files = await listStorageFiles("sefix/pdln/semanal/");
  const sexoFiles = files.filter((f) => f.endsWith("_sexo.csv")).sort();
  return sexoFiles[sexoFiles.length - 1] ?? null;
}

/** Devuelve el path del archivo histórico _base más reciente */
async function getLatestHistoricoPath(): Promise<string | null> {
  const files = await listStorageFiles("sefix/pdln/historico/");
  const baseFiles = files.filter((f) => f.endsWith("_base.csv")).sort();
  return baseFiles[baseFiles.length - 1] ?? null;
}

/** Extrae la fecha del nombre de archivo DERFE (YYYYMMDD → YYYY-MM-DD) */
function extractFecha(storagePath: string): string {
  const m = storagePath.match(/(\d{8})_/);
  if (!m) return "desconocida";
  const d = m[1];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

export async function getPadronByEstado(
  estadoInput: string
): Promise<PadronEstado | null> {
  const estadoNombre = resolveEstadoName(estadoInput);
  if (!estadoNombre) return null;

  const cacheKey = `padron:${estadoNombre}`;
  const cached = getCached<PadronEstado>(cacheKey);
  if (cached) return cached;

  // Preferir semanal (más reciente) sobre histórico
  const semanalPath = await getLatestSemanalPath();
  const targetPath = semanalPath ?? (await getLatestHistoricoPath());
  if (!targetPath) return null;

  const isSemanal = targetPath.includes("/semanal/");
  const fecha = extractFecha(targetPath);

  let padronElectoral = 0;
  let listaNominal = 0;
  let padronHombres = 0;
  let padronMujeres = 0;
  let padronNoBinario = 0;

  if (isSemanal) {
    // Semanal _sexo: nombre_entidad, padron_hombres, padron_mujeres, padron_no_binario, padron_electoral, lista_hombres, lista_mujeres, lista_no_binario, lista_nominal
    await streamCsvRows(targetPath, (row) => {
      if (row.nombre_entidad !== estadoNombre) return;
      padronElectoral += parseInt(row.padron_electoral ?? "0") || 0;
      listaNominal += parseInt(row.lista_nominal ?? "0") || 0;
      padronHombres += parseInt(row.padron_hombres ?? "0") || 0;
      padronMujeres += parseInt(row.padron_mujeres ?? "0") || 0;
      padronNoBinario += parseInt(row.padron_no_binario ?? "0") || 0;
    });
  } else {
    // Histórico _base: nombre_entidad, padron_nacional_hombres, padron_nacional_mujeres, padron_nacional_no_binario, padron_nacional, lista_nacional
    await streamCsvRows(targetPath, (row) => {
      if (row.nombre_entidad !== estadoNombre) return;
      padronElectoral += parseInt(row.padron_nacional ?? "0") || 0;
      listaNominal += parseInt(row.lista_nacional ?? "0") || 0;
      padronHombres += parseInt(row.padron_nacional_hombres ?? "0") || 0;
      padronMujeres += parseInt(row.padron_nacional_mujeres ?? "0") || 0;
      padronNoBinario += parseInt(row.padron_nacional_no_binario ?? "0") || 0;
    });
  }

  if (padronElectoral === 0 && listaNominal === 0) return null;

  const result: PadronEstado = {
    estado: estadoNombre,
    corte: fecha,
    tipo: isSemanal ? "semanal" : "historico",
    padronElectoral,
    listaNominal,
    padronHombres,
    padronMujeres,
    padronNoBinario,
    fuente: `DERFE — Padrón Electoral al ${fecha}`,
  };

  setCache(cacheKey, result);
  return result;
}

// ==========================================
// SERIES HISTÓRICAS AGREGADAS (G1 / G2 / G3)
// ==========================================

export interface HistoricoMes {
  fecha: string;     // YYYY-MM-DD
  year: number;
  month: number;
  padronNacional: number;
  listaNacional: number;
  padronExtranjero: number;
  listaExtranjero: number;
  padronHombres: number;
  padronMujeres: number;
  padronNoBinario: number;
  listaNoBinario: number;
  // Extranjero sex breakdown (available 2020+; pre-2020 via R Shiny transform)
  padronExtranjeroHombres: number;
  padronExtranjeroMujeres: number;
  padronExtranjeroNoBinario: number;
  listaExtranjeroHombres: number;
  listaExtranjeroMujeres: number;
  listaExtranjeroNoBinario: number;
}

/** Agrega un archivo histórico _base a sus totales nacional y extranjero */
async function processHistoricoFile(
  storagePath: string
): Promise<HistoricoMes | null> {
  const fecha = extractFecha(storagePath);
  if (fecha === "desconocida") return null;

  const year = parseInt(fecha.slice(0, 4));
  const month = parseInt(fecha.slice(5, 7));

  let padronNacional = 0;
  let listaNacional = 0;
  let padronExtranjero = 0;
  let listaExtranjero = 0;
  let padronHombres = 0;
  let padronMujeres = 0;
  let padronNoBinario = 0;
  let listaNoBinario = 0;
  let padronExtranjeroHombres = 0;
  let padronExtranjeroMujeres = 0;
  let padronExtranjeroNoBinario = 0;
  let listaExtranjeroHombres = 0;
  let listaExtranjeroMujeres = 0;
  let listaExtranjeroNoBinario = 0;

  await streamCsvRows(storagePath, (row) => {
    // Excluir fila TOTALES (cve_entidad vacío o "NA")
    const cve = row.cve_entidad?.trim();
    if (!cve || cve === "" || cve.toUpperCase() === "NA") return;

    const isExt = row.cabecera_distrital?.toUpperCase().includes("RESIDENTES EXTRANJERO");
    const padron = parseInt(row.padron_nacional ?? "0") || 0;
    const lista = parseInt(row.lista_nacional ?? "0") || 0;
    const h   = parseInt(row.padron_nacional_hombres      ?? "0") || 0;
    const m   = parseInt(row.padron_nacional_mujeres      ?? "0") || 0;
    const nb  = parseInt(row.padron_nacional_no_binario   ?? "0") || 0;
    const lh  = parseInt(row.lista_nacional_hombres       ?? "0") || 0;
    const lm  = parseInt(row.lista_nacional_mujeres       ?? "0") || 0;
    const lnb = parseInt(row.lista_nacional_no_binario    ?? "0") || 0;
    // Extranjero sex columns (2020+)
    const peh  = parseInt(row.padron_extranjero_hombres    ?? "0") || 0;
    const pem  = parseInt(row.padron_extranjero_mujeres    ?? "0") || 0;
    const penb = parseInt(row.padron_extranjero_no_binario ?? "0") || 0;
    const leh  = parseInt(row.lista_extranjero_hombres     ?? "0") || 0;
    const lem  = parseInt(row.lista_extranjero_mujeres     ?? "0") || 0;
    const lenb = parseInt(row.lista_extranjero_no_binario  ?? "0") || 0;
    const has2020Cols = "padron_extranjero" in row;

    if (isExt) {
      padronExtranjero += has2020Cols
        ? parseInt(row.padron_extranjero ?? "0") || 0
        : padron;
      listaExtranjero += has2020Cols
        ? parseInt(row.lista_extranjero ?? "0") || 0
        : lista;
      // Sex: use extranjero columns (2020+) or nacional columns as fallback (pre-2020 R Shiny transform)
      padronExtranjeroHombres   += peh  || h;
      padronExtranjeroMujeres   += pem  || m;
      padronExtranjeroNoBinario += penb || nb;
      listaExtranjeroHombres    += leh  || lh;
      listaExtranjeroMujeres    += lem  || lm;
      listaExtranjeroNoBinario  += lenb || lnb;
    } else {
      padronNacional += padron;
      listaNacional += lista;
      padronHombres += h;
      padronMujeres += m;
      padronNoBinario += nb;
      listaNoBinario += lnb;
      if (has2020Cols) {
        padronExtranjero += parseInt(row.padron_extranjero ?? "0") || 0;
        listaExtranjero  += parseInt(row.lista_extranjero  ?? "0") || 0;
      }
    }
  });

  if (padronNacional === 0 && padronExtranjero === 0) return null;

  return {
    fecha,
    year,
    month,
    padronNacional,
    listaNacional,
    padronExtranjero,
    listaExtranjero,
    padronHombres,
    padronMujeres,
    padronNoBinario,
    listaNoBinario,
    padronExtranjeroHombres,
    padronExtranjeroMujeres,
    padronExtranjeroNoBinario,
    listaExtranjeroHombres,
    listaExtranjeroMujeres,
    listaExtranjeroNoBinario,
  };
}

/** Devuelve los años disponibles para un cargo en resultados federales */
export async function getResultadosAvailableYears(
  cargoInput: string
): Promise<number[]> {
  const cargoKey = CARGO_TO_KEY[cargoInput.toLowerCase()] ?? "dip";
  const allFiles = await listStorageFiles("sefix/results/federals/");
  const years = allFiles
    .filter((f) => f.includes(`/pef_${cargoKey}_`))
    .map((f) => parseInt(f.match(/_(\d{4})\.csv$/)?.[1] ?? "0"))
    .filter((y) => y > 0);
  return [...new Set(years)].sort();
}

/** Devuelve resultados para todos los años disponibles de un cargo/estado */
export async function getResultadosAllYears(
  estadoInput: string,
  cargoInput: string
): Promise<ResultadosEstado[]> {
  const years = await getResultadosAvailableYears(cargoInput);
  const results = await Promise.allSettled(
    years.map((y) => getResultadosByEstado(estadoInput, cargoInput, y))
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<ResultadosEstado> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value)
    .sort((a, b) => a.anio - b.anio);
}

// ==========================================
// FILTRO GEOGRÁFICO PARA SERIES HISTÓRICAS
// Arquitectura: archivos JSON pre-generados por entidad en Firebase Storage.
// Se generan offline con scripts/pregenerate-sefix.ts, no en tiempo de consulta.
// ==========================================

export interface HistoricoGeoFilter {
  /** Nombre de entidad tal como aparece en nombre_entidad del CSV (e.g., "JALISCO") */
  entidad?: string;
  /**
   * Nombre del distrito tal como aparece en cabecera_distrital del CSV
   * (e.g., "1513 ECATEPEC DE MORELOS"). Usado solo como fallback si no hay cveDistrito.
   */
  distritoNombre?: string;
  /**
   * CVE numérico del distrito (cve_distrito del CSV, e.g., "2" o "03").
   * Preferir sobre distritoNombre: es estable entre redistritaciones.
   */
  cveDistrito?: string;
  /**
   * Nombre del municipio tal como aparece en nombre_municipio del CSV
   * (e.g., "ECATEPEC DE MORELOS"). Usado solo como fallback si no hay cveMunicipio.
   */
  municipioNombre?: string;
  /**
   * CVE numérico del municipio (cve_municipio del CSV, e.g., "039").
   * Preferir sobre municipioNombre: es estable entre redistritaciones.
   */
  cveMunicipio?: string;
  /** Números de sección como aparecen en seccion del CSV (e.g., ["1431", "1432"]) */
  secciones?: string[];
}

/** Datos de una sección electoral en el JSON pre-generado (columnar format) */
interface SeccionData {
  s: string;    // seccion
  m: string;    // nombre_municipio
  d: string;    // cabecera_distrital
  cvm: string;  // cve_municipio
  cvd: string;  // cve_distrito
  p:   number[]; // padronNacional per period index
  l:   number[]; // listaNacional per period index
  ph:  number[]; // padronHombres per period index
  pm:  number[]; // padronMujeres per period index
  pnb: number[]; // padronNoBinario per period index
  pe:  number[]; // padronExtranjero per period index
  le:  number[]; // listaExtranjero per period index
  // Extranjero sex breakdown (optional — 0 in JSONs generated before this schema update)
  peh?: number[];  // padronExtranjeroHombres per period index
  pem?: number[];  // padronExtranjeroMujeres per period index
  penb?: number[]; // padronExtranjeroNoBinario per period index
  leh?: number[];  // listaExtranjeroHombres per period index
  lem?: number[];  // listaExtranjeroMujeres per period index
  lenb?: number[]; // listaExtranjeroNoBinario per period index
}

/** JSON pre-generado con todos los meses de un año para una entidad */
interface EntidadYearCache {
  entidad: string;
  year: number;
  months: number[];
  secciones: SeccionData[];
}

/** JSON pre-generado con el último mes de cada año (para G2/G3) */
interface EntidadAnualCache {
  entidad: string;
  years: number[];
  /** Actual last available month per year (e.g. 7 for July 2025). Optional for backward compat with old files. */
  lastMonths?: number[];
  secciones: SeccionData[];
}

/** Caches en módulo — persisten por lifetime del proceso (warm Vercel instance) */
const entidadYearMemCache = new Map<string, EntidadYearCache>();
const entidadAnualMemCache = new Map<string, EntidadAnualCache>();

/**
 * Convierte nombre de entidad DERFE al key usado en Storage.
 * "ESTADO DE MEXICO" (DERFE: "MEXICO") → "MEXICO"
 * "JALISCO" → "JALISCO"
 * Espacios → _, quita acentos.
 */
export function toStorageKey(derfeNombre: string): string {
  if (derfeNombre === "__EXTRANJERO__") return "__EXTRANJERO__";
  return derfeNombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

/** Descarga el archivo anual de una entidad desde Storage */
async function loadEntidadAnual(storageKey: string): Promise<EntidadAnualCache | null> {
  const memKey = `${storageKey}_anual`;
  if (entidadAnualMemCache.has(memKey)) return entidadAnualMemCache.get(memKey)!;
  try {
    const path = `sefix/pdln/historico_entidad/${storageKey}_anual.json`;
    const file = getBucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    const data = JSON.parse(contents.toString("utf-8")) as EntidadAnualCache;
    entidadAnualMemCache.set(memKey, data);
    return data;
  } catch {
    return null;
  }
}

/** Descarga el archivo mensual de una entidad+año desde Storage */
async function loadEntidadYear(storageKey: string, year: number): Promise<EntidadYearCache | null> {
  const memKey = `${storageKey}_${year}`;
  if (entidadYearMemCache.has(memKey)) return entidadYearMemCache.get(memKey)!;
  try {
    const path = `sefix/pdln/historico_entidad/${storageKey}_${year}.json`;
    const file = getBucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    const data = JSON.parse(contents.toString("utf-8")) as EntidadYearCache;
    entidadYearMemCache.set(memKey, data);
    return data;
  } catch {
    return null;
  }
}

/** Normaliza número de sección eliminando ceros iniciales */
const normSec = (s: string | undefined): string =>
  (s?.trim() ?? "").replace(/^0+/, "") || "0";


/**
 * Devuelve la serie mensual histórica filtrada por ámbito geográfico.
 *
 * Usa JSON pre-generados offline (scripts/pregenerate-sefix.ts) en Firebase Storage:
 * - {ENTIDAD}_anual.json → último mes de cada año (para G2/G3)
 * - {ENTIDAD}_{year}.json → todos los meses del año seleccionado (para G1)
 *
 * Ambos archivos se descargan en paralelo (~300-800ms) y se filtran en memoria.
 * No hay lazy building ni polling.
 */
export async function getHistoricoSeriesGeo(
  geo: HistoricoGeoFilter,
  selectedYear?: number
): Promise<HistoricoMes[]> {
  if (!geo.entidad) return getHistoricoSeries();

  // Use the historico storage key (short names, as stored by pregenerate-sefix.ts)
  // which differs from toDerfeNombre (long constitutional names used in CSV columns).
  const storageKey = toHistoricoStorageKey(geo.entidad);
  const year = selectedYear ?? new Date().getFullYear();

  const secKey = (geo.secciones ?? []).slice().sort().join(",");
  const cacheKey = `historico:geo4:${storageKey}:${year}:${geo.cveDistrito ?? geo.distritoNombre ?? ""}:${geo.cveMunicipio ?? geo.municipioNombre ?? ""}:${secKey}`;
  const cached = getCached<HistoricoMes[]>(cacheKey);
  if (cached) return cached;

  // Detect whether any sub-entidad filter is active.
  // When a district, municipality, or explicit section filter is present, district names
  // in the pre-generated _anual.json may not match those in each year's JSON (district
  // names changed across electoral periods, e.g. "ENSENADA" → "0203 ENSENADA").
  // To replicate R Shiny's per-year filtering, we load each year's JSON individually and
  // apply the same geo filter to it — the same approach R uses in datos_anuales_completos.
  const isGeoFiltered = !!(geo.cveDistrito || geo.distritoNombre || geo.cveMunicipio || geo.municipioNombre || geo.secciones?.length);

  // Always load the selected year's JSON (all months → G1).
  const yearData = await loadEntidadYear(storageKey, year);

  // For geo-filtered queries, discover available years from the anual JSON header only
  // (no section data needed), then load each year's JSON individually.
  // For unfiltered entidad queries, use the pre-aggregated _anual.json (fast path).
  const anualData = await loadEntidadAnual(storageKey);

  if (!anualData && !yearData) {
    console.warn(`[sefix/geo] No pre-generated cache for ${storageKey}. Run scripts/pregenerate-sefix.ts.`);
    return [];
  }

  const filtSecciones = geo.secciones?.length
    ? new Set(geo.secciones.map(normSec))
    : null;

  /**
   * Aggregate the sections of a single year JSON into a HistoricoMes entry.
   *
   * @param data       - Pre-generated year JSON (EntidadYearCache)
   * @param targetYear - The year this data represents
   * @param months     - Month indices to include (all for G1; [lastMonth] for G2/G3)
   */
  function aggregateYear(
    data: EntidadYearCache,
    targetYear: number,
    months: number[]
  ): Map<string, HistoricoMes> {
    const byPeriod = new Map<string, HistoricoMes>();

    for (const sec of data.secciones) {
      // Apply geo filters.
      // CVE-based filtering (stable across redistrictings) takes precedence over name-based.
      if (!filtSecciones) {
        if (geo.cveDistrito) {
          if (sec.cvd !== geo.cveDistrito) continue;
        } else if (geo.distritoNombre) {
          if (sec.d !== geo.distritoNombre) continue;
        }
        if (geo.cveMunicipio) {
          if (sec.cvm !== geo.cveMunicipio) continue;
        } else if (geo.municipioNombre) {
          if (sec.m !== geo.municipioNombre) continue;
        }
      } else {
        if (!filtSecciones.has(normSec(sec.s))) continue;
      }

      for (let i = 0; i < data.months.length; i++) {
        const mo = data.months[i];
        if (!months.includes(mo)) continue;

        const periodKey = `${targetYear}-${String(mo).padStart(2, "0")}`;
        if (!byPeriod.has(periodKey)) {
          byPeriod.set(periodKey, {
            fecha: periodKey, year: targetYear, month: mo,
            padronNacional: 0, listaNacional: 0,
            padronExtranjero: 0, listaExtranjero: 0,
            padronHombres: 0, padronMujeres: 0, padronNoBinario: 0, listaNoBinario: 0,
            padronExtranjeroHombres: 0, padronExtranjeroMujeres: 0, padronExtranjeroNoBinario: 0,
            listaExtranjeroHombres: 0, listaExtranjeroMujeres: 0, listaExtranjeroNoBinario: 0,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const agg = byPeriod.get(periodKey)!;
        agg.padronNacional    += sec.p[i]    ?? 0;
        agg.listaNacional     += sec.l[i]    ?? 0;
        agg.padronHombres     += sec.ph[i]   ?? 0;
        agg.padronMujeres     += sec.pm[i]   ?? 0;
        agg.padronNoBinario   += sec.pnb[i]  ?? 0;
        agg.padronExtranjero  += sec.pe[i]   ?? 0;
        agg.listaExtranjero   += sec.le[i]   ?? 0;
        agg.padronExtranjeroHombres   += sec.peh?.[i]  ?? 0;
        agg.padronExtranjeroMujeres   += sec.pem?.[i]  ?? 0;
        agg.padronExtranjeroNoBinario += sec.penb?.[i] ?? 0;
        agg.listaExtranjeroHombres    += sec.leh?.[i]  ?? 0;
        agg.listaExtranjeroMujeres    += sec.lem?.[i]  ?? 0;
        agg.listaExtranjeroNoBinario  += sec.lenb?.[i] ?? 0;
      }
    }
    return byPeriod;
  }

  /**
   * Fast path for unfiltered (entidad-level) queries: use pre-aggregated _anual.json.
   * Period key uses actual last month to avoid phantom December spikes.
   */
  function aggregateAnual(data: EntidadAnualCache): Map<string, HistoricoMes> {
    const byPeriod = new Map<string, HistoricoMes>();
    for (const sec of data.secciones) {
      for (let i = 0; i < data.years.length; i++) {
        const actualMonth = data.lastMonths?.[i] ?? 12;
        const periodYear = data.years[i];
        const periodKey = `${periodYear}-${String(actualMonth).padStart(2, "0")}`;
        if (!byPeriod.has(periodKey)) {
          byPeriod.set(periodKey, {
            fecha: periodKey, year: periodYear, month: actualMonth,
            padronNacional: 0, listaNacional: 0,
            padronExtranjero: 0, listaExtranjero: 0,
            padronHombres: 0, padronMujeres: 0, padronNoBinario: 0, listaNoBinario: 0,
            padronExtranjeroHombres: 0, padronExtranjeroMujeres: 0, padronExtranjeroNoBinario: 0,
            listaExtranjeroHombres: 0, listaExtranjeroMujeres: 0, listaExtranjeroNoBinario: 0,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const agg = byPeriod.get(periodKey)!;
        agg.padronNacional    += sec.p[i]    ?? 0;
        agg.listaNacional     += sec.l[i]    ?? 0;
        agg.padronHombres     += sec.ph[i]   ?? 0;
        agg.padronMujeres     += sec.pm[i]   ?? 0;
        agg.padronNoBinario   += sec.pnb[i]  ?? 0;
        agg.padronExtranjero  += sec.pe[i]   ?? 0;
        agg.listaExtranjero   += sec.le[i]   ?? 0;
        agg.padronExtranjeroHombres   += sec.peh?.[i]  ?? 0;
        agg.padronExtranjeroMujeres   += sec.pem?.[i]  ?? 0;
        agg.padronExtranjeroNoBinario += sec.penb?.[i] ?? 0;
        agg.listaExtranjeroHombres    += sec.leh?.[i]  ?? 0;
        agg.listaExtranjeroMujeres    += sec.lem?.[i]  ?? 0;
        agg.listaExtranjeroNoBinario  += sec.lenb?.[i] ?? 0;
      }
    }
    return byPeriod;
  }

  const combined = new Map<string, HistoricoMes>();

  if (isGeoFiltered) {
    // R Shiny approach: load each year's JSON individually and apply the same geo filter.
    // This ensures district/municipality names are matched against their own year's data,
    // avoiding mismatches from district renaming across electoral periods.
    const historicYears = anualData
      ? anualData.years.filter((y) => y < year)
      : [];

    // Load all prior years in parallel (all are memory-cached after first load)
    const priorYearData = await Promise.all(
      historicYears.map((y) => loadEntidadYear(storageKey, y))
    );

    for (let i = 0; i < historicYears.length; i++) {
      const priorData = priorYearData[i];
      if (!priorData || priorData.months.length === 0) continue;
      // For each prior year: take only the LAST available month (same as R's max(fecha))
      const lastMonth = Math.max(...priorData.months);
      const entries = aggregateYear(priorData, historicYears[i], [lastMonth]);
      for (const [k, v] of entries) combined.set(k, v);
    }
  } else {
    // Fast path: no sub-entidad filter — use pre-aggregated _anual.json for all prior years
    if (anualData) {
      const annualEntries = aggregateAnual(anualData);
      for (const [k, v] of annualEntries) combined.set(k, v);
    }
  }

  // Selected year: all months (for G1) — overrides any annual entry for that year
  if (yearData) {
    const yearEntries = aggregateYear(yearData, year, yearData.months);
    for (const [k, v] of yearEntries) combined.set(k, v);
  }

  const series = Array.from(combined.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (series.length > 0) setCache(cacheKey, series);
  return series;
}

/**
 * Devuelve la serie mensual completa (2017-presente) con totales
 * nacional y extranjero. Procesa archivos en paralelo y cachea 30 min.
 */
export async function getHistoricoSeries(): Promise<HistoricoMes[]> {
  const cacheKey = "historico:series:all";
  const cached = getCached<HistoricoMes[]>(cacheKey);
  if (cached) return cached;

  const allFiles = await listStorageFiles("sefix/pdln/historico/");
  const baseFiles = allFiles.filter((f) => f.endsWith("_base.csv")).sort();

  // Procesamos en lotes de 8 para no abrir cientos de conexiones simultáneas
  // a Firebase Storage (causa de saturación de memoria y bloqueo del servidor)
  const BATCH_SIZE = 8;
  const accumulated: HistoricoMes[] = [];

  for (let i = 0; i < baseFiles.length; i += BATCH_SIZE) {
    const batch = baseFiles.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((f) => processHistoricoFile(f))
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value !== null) {
        accumulated.push(r.value);
      }
    }
  }

  const series = accumulated.sort((a, b) => a.fecha.localeCompare(b.fecha));

  setCache(cacheKey, series);
  return series;
}

// ==========================================
// DATOS SEMANALES — CORTE ÚNICO (por ámbito y fecha)
// ==========================================

export type SemanalTipo = "sexo" | "edad" | "origen";

export interface SemanalCorteResult {
  fecha: string;
  tipo: SemanalTipo;
  /** Agregado por entidad (o total) */
  rows: Record<string, string | number>[];
}

/** Devuelve los paths semanales disponibles para un tipo dado, ordenados desc */
export async function getSemanalPaths(tipo: SemanalTipo): Promise<string[]> {
  const all = await listStorageFiles("sefix/pdln/semanal/");
  return all.filter((f) => f.endsWith(`_${tipo}.csv`)).sort().reverse();
}

/** Devuelve las fechas disponibles (YYYY-MM-DD) para un tipo semanal */
export async function getSemanalFechas(tipo: SemanalTipo): Promise<string[]> {
  const paths = await getSemanalPaths(tipo);
  return paths
    .map((p) => extractFecha(p))
    .filter((f) => f !== "desconocida");
}

// ==========================================
// PRE-GENERATED SEMANAL — GEO + AGG (fast paths)
// ==========================================

interface SemanalGeoDistrito { cve: string; nombre: string }
interface SemanalGeoStateData {
  distritos: SemanalGeoDistrito[];
  municipios: Record<string, SemanalGeoDistrito[]>;
  secciones:  Record<string, string[]>;
}
type SemanalGeoData = Record<string, SemanalGeoStateData>;

interface SemanalAggAmbito { nacional: Record<string, number>; extranjero: Record<string, number> }
interface SemanalAggData {
  fecha:       string;
  nacional:    Record<string, number>;
  extranjero:  Record<string, number>;
  por_entidad: Record<string, SemanalAggAmbito>;
}

// Module-level in-memory caches (survive request lifetime, evicted on server restart)
let semanalGeoCache: SemanalGeoData | null = null;
const semanalAggCache = new Map<string, SemanalAggData>(); // tipo → data

// ──────────────────────────────────────────────────────────────────────────
// SECTION-LEVEL SERIES (pre-generated per entity)
// Storage: sefix/pdln/semanal_agg/secciones_{ENTIDAD}_{tipo}.json
// ──────────────────────────────────────────────────────────────────────────

interface SemanalSeccionEntry {
  s:   string;
  cvd: string;
  cvm: string;
  nacional: Record<string, (number | null)[]>;
}

interface SemanalSeccionesSerie {
  entidad:   string;
  tipo:      SemanalTipo;
  fechas:    string[];
  secciones: SemanalSeccionEntry[];
}

const semanalSeccionesCache = new Map<string, SemanalSeccionesSerie>();

async function loadSemanalSecciones(
  entidad: string,
  tipo: SemanalTipo
): Promise<SemanalSeccionesSerie | null> {
  const key = `${entidad}_${tipo}`;
  if (semanalSeccionesCache.has(key)) return semanalSeccionesCache.get(key)!;
  try {
    const storagePath = `sefix/pdln/semanal_agg/secciones_${entidad}_${tipo}.json`;
    const file = getBucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    const data = JSON.parse(contents.toString("utf-8")) as SemanalSeccionesSerie;
    semanalSeccionesCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

export interface SemanalGeoFilter {
  cveDistrito?:  string;
  cveMunicipio?: string;
  secciones?:    string[];
}

function matchesSemanalGeo(sec: SemanalSeccionEntry, geo: SemanalGeoFilter): boolean {
  const filtSecs = geo.secciones?.length
    ? new Set(geo.secciones.map(normSec))
    : null;
  if (filtSecs) return filtSecs.has(normSec(sec.s));
  if (geo.cveMunicipio && sec.cvm !== geo.cveMunicipio) return false;
  if (geo.cveDistrito  && sec.cvd !== geo.cveDistrito)  return false;
  return true;
}

/**
 * Returns a single-week snapshot aggregated from the section-level series JSON.
 * Only nacional ambito is supported (sections belong to the national hierarchy).
 */
export async function getSemanalSeccionSnapshot(
  entidad: string,
  tipo: SemanalTipo,
  ambito: "nacional" | "extranjero",
  geo: SemanalGeoFilter,
  corte?: string
): Promise<{ data: Record<string, number>; fecha: string } | null> {
  if (ambito === "extranjero") return null;

  const serieData = await loadSemanalSecciones(entidad, tipo);
  if (!serieData) return null;

  let wi = serieData.fechas.length - 1;
  if (corte) {
    const normalized = corte.replace(/-/g, "");
    const idx = serieData.fechas.findIndex((f) => f.replace(/-/g, "") === normalized);
    if (idx !== -1) wi = idx;
  }

  const fecha = serieData.fechas[wi];
  if (!fecha) return null;

  const relevant = serieData.secciones.filter((s) => matchesSemanalGeo(s, geo));
  if (relevant.length === 0) return null;

  const agg: Record<string, number> = {};
  for (const sec of relevant) {
    for (const [col, arr] of Object.entries(sec.nacional)) {
      const val = arr[wi];
      if (val !== null && val !== undefined) {
        agg[col] = (agg[col] ?? 0) + val;
      }
    }
  }
  return { data: agg, fecha };
}

/**
 * Returns a full time-series aggregated from section-level data for a geo filter.
 * Only nacional ambito is supported.
 */
export async function getSemanalSeccionesSerie(
  entidad: string,
  tipo: SemanalTipo,
  ambito: "nacional" | "extranjero",
  geo: SemanalGeoFilter
): Promise<{ serie: Record<string, number | string>[]; availableFechas: string[] } | null> {
  if (ambito === "extranjero") return null;

  const serieData = await loadSemanalSecciones(entidad, tipo);
  if (!serieData) return null;

  const relevant = serieData.secciones.filter((s) => matchesSemanalGeo(s, geo));
  if (relevant.length === 0) return null;

  const serie = serieData.fechas.map((fecha, wi) => {
    const row: Record<string, number | string> = { fecha };
    for (const sec of relevant) {
      for (const [col, arr] of Object.entries(sec.nacional)) {
        const val = arr[wi];
        if (val !== null && val !== undefined) {
          row[col] = ((row[col] as number | undefined) ?? 0) + val;
        }
      }
    }
    return row;
  });
  return { serie, availableFechas: [...serieData.fechas].reverse() };
}

async function getSemanalGeo(): Promise<SemanalGeoData | null> {
  if (semanalGeoCache) return semanalGeoCache;
  try {
    const [contents] = await getBucket().file("sefix/pdln/semanal_geo/geo.json").download();
    semanalGeoCache = JSON.parse(contents.toString("utf-8")) as SemanalGeoData;
    return semanalGeoCache;
  } catch {
    return null;
  }
}

async function getSemanalAgg(tipo: SemanalTipo): Promise<SemanalAggData | null> {
  if (semanalAggCache.has(tipo)) return semanalAggCache.get(tipo)!;
  try {
    const [contents] = await getBucket().file(`sefix/pdln/semanal_agg/${tipo}.json`).download();
    const data = JSON.parse(contents.toString("utf-8")) as SemanalAggData;
    semanalAggCache.set(tipo, data);
    return data;
  } catch {
    return null;
  }
}

export async function getSemanalOrigenMatriz(): Promise<{
  fecha: string;
  por_entidad: Record<string, { nacional: Record<string, number>; extranjero: Record<string, number> }>;
} | null> {
  const agg = await getSemanalAgg("origen");
  if (!agg) return null;
  return {
    fecha: agg.fecha,
    por_entidad: agg.por_entidad as Record<string, { nacional: Record<string, number>; extranjero: Record<string, number> }>,
  };
}

/**
 * Fast geo cascade using pre-generated geo.json.
 * Falls back to streaming the raw CSV if geo.json is not available.
 */
export async function getDistritosPorEntidadSemanal(entidad: string): Promise<GeoOpcion[]> {
  const geo = await getSemanalGeo();
  if (geo) {
    const state = geo[entidad];
    if (state?.distritos?.length) return state.distritos;
  }
  return getDistritosPorEntidad(entidad);
}

export async function getMunicipiosPorDistritoSemanal(
  entidad: string,
  cvDistrito: string
): Promise<GeoOpcion[]> {
  const geo = await getSemanalGeo();
  if (geo) {
    const state = geo[entidad];
    if (state) {
      const result = state.municipios[cvDistrito] ?? [];
      if (result.length > 0) return result;
    }
  }
  return getMunicipiosPorDistrito(entidad, cvDistrito);
}

export async function getSeccionesPorMunicipioSemanal(
  entidad: string,
  cvMunicipio: string
): Promise<string[]> {
  const geo = await getSemanalGeo();
  if (geo) {
    const state = geo[entidad];
    if (state) {
      const result = state.secciones[cvMunicipio] ?? [];
      if (result.length > 0) return result;
    }
  }
  return getSeccionesPorMunicipio(entidad, cvMunicipio);
}

/**
 * Agrega el archivo semanal de un tipo y corte dado.
 * Si entidad=null devuelve totales nacionales/extranjero.
 * Si entidad!=null filtra las filas de esa entidad.
 */
export async function getSemanalAgregado(
  tipo: SemanalTipo,
  corte?: string,
  entidad?: string | null
): Promise<{
  fecha: string;
  ambitos: { nacional: Record<string, number>; extranjero: Record<string, number> };
  rows: Record<string, string | number>[];
} | null> {
  // ── Fast path: use pre-generated aggregate JSON ──────────────────────────
  const agg = await getSemanalAgg(tipo);
  if (agg) {
    const aggFechaNorm = agg.fecha.replace(/-/g, "");
    const corteNorm    = corte?.replace(/-/g, "");
    if (!corteNorm || corteNorm === aggFechaNorm) {
      if (entidad) {
        const entData = agg.por_entidad[entidad];
        if (entData) {
          return {
            fecha: agg.fecha,
            ambitos: { nacional: entData.nacional, extranjero: entData.extranjero },
            rows: [],
          };
        }
      } else {
        return {
          fecha: agg.fecha,
          ambitos: { nacional: agg.nacional, extranjero: agg.extranjero },
          rows: [],
        };
      }
    }
  }

  // ── Slow path: stream raw CSV ─────────────────────────────────────────────
  const paths = await getSemanalPaths(tipo);
  if (paths.length === 0) return null;

  let targetPath: string;
  if (corte) {
    const normalized = corte.replace(/-/g, "");
    const match = paths.find((p) => p.includes(normalized));
    if (!match) return null;
    targetPath = match;
  } else {
    targetPath = paths[0]; // más reciente
  }

  const fecha = extractFecha(targetPath);
  const cacheKey = `semanal:${tipo}:${fecha}:${entidad ?? "all"}:v3`;
  const cached = getCached<ReturnType<typeof getSemanalAgregado> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached as Awaited<ReturnType<typeof getSemanalAgregado>>;

  const nacional: Record<string, number> = {};
  const extranjero: Record<string, number> = {};

  const SKIP_COLS = new Set(["cve_entidad", "cve_distrito", "cve_municipio", "seccion"]);
  // Convert UI name to the DERFE CSV name for filtering
  const derfeEntidad = entidad ? toDerfeNombre(entidad) : null;

  await streamCsvRows(targetPath, (row) => {
    const cve = row.cve_entidad?.trim();
    if (!cve || cve.toUpperCase() === "NA") return;
    if (derfeEntidad && row.nombre_entidad !== derfeEntidad) return;

    // Skip aggregate/subtotal rows (district or state totals) which have no
    // valid section number. Including them alongside section-level rows causes
    // double-counting (each section value would appear twice).
    const sec = row.seccion?.trim();
    if (!sec || sec === "0" || sec === "00") return;

    const isExt = row.cabecera_distrital?.toUpperCase().includes("RESIDENTES EXTRANJERO");
    const target = isExt ? extranjero : nacional;

    for (const [col, val] of Object.entries(row)) {
      if (SKIP_COLS.has(col)) continue;
      const num = parseFloat(val as string);
      if (!isNaN(num)) target[col] = (target[col] ?? 0) + num;
    }
  });

  const result = { fecha, ambitos: { nacional, extranjero }, rows: [] as Record<string, string | number>[] };
  setCache(cacheKey, result);
  return result;
}

// ==========================================
// JERARQUÍA GEOGRÁFICA (cascade)
// ==========================================

export interface GeoOpcion {
  cve: string;
  nombre: string;
}

/**
 * Devuelve los distritos disponibles para una entidad dada.
 * Usa el archivo semanal _sexo más reciente (más liviano, 15 cols).
 */
export async function getDistritosPorEntidad(
  entidad: string
): Promise<GeoOpcion[]> {
  const cacheKey = `geo:distritos:${entidad}`;
  const cached = getCached<GeoOpcion[]>(cacheKey);
  if (cached) return cached;

  const paths = await getSemanalPaths("sexo");
  if (paths.length === 0) return [];
  const targetPath = paths[0];

  const derfeNombre = toDerfeNombre(entidad);
  const set = new Map<string, string>();
  await streamCsvRows(targetPath, (row) => {
    if (row.nombre_entidad !== derfeNombre) return;
    if (row.cabecera_distrital?.toUpperCase().includes("RESIDENTES EXTRANJERO")) return;
    const cve = row.cve_distrito?.trim();
    const nombre = row.cabecera_distrital?.trim();
    if (cve && nombre) set.set(cve, nombre);
  });

  const result = Array.from(set.entries())
    .map(([cve, nombre]) => ({ cve, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  setCache(cacheKey, result);
  return result;
}

/**
 * Devuelve los municipios para una entidad + distrito dados.
 */
export async function getMunicipiosPorDistrito(
  entidad: string,
  cvDistrito: string
): Promise<GeoOpcion[]> {
  const cacheKey = `geo:municipios:${entidad}:${cvDistrito}`;
  const cached = getCached<GeoOpcion[]>(cacheKey);
  if (cached) return cached;

  const paths = await getSemanalPaths("sexo");
  if (paths.length === 0) return [];

  const derfeNombre = toDerfeNombre(entidad);
  const set = new Map<string, string>();
  await streamCsvRows(paths[0], (row) => {
    if (row.nombre_entidad !== derfeNombre) return;
    if (row.cve_distrito?.trim() !== cvDistrito) return;
    const cve = row.cve_municipio?.trim();
    const nombre = row.nombre_municipio?.trim();
    if (cve && nombre) set.set(cve, nombre);
  });

  const result = Array.from(set.entries())
    .map(([cve, nombre]) => ({ cve, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  setCache(cacheKey, result);
  return result;
}

/**
 * Devuelve las secciones electorales para una entidad + municipio dados.
 */
export async function getSeccionesPorMunicipio(
  entidad: string,
  cvMunicipio: string
): Promise<string[]> {
  const cacheKey = `geo:secciones:${entidad}:${cvMunicipio}`;
  const cached = getCached<string[]>(cacheKey);
  if (cached) return cached;

  const paths = await getSemanalPaths("sexo");
  if (paths.length === 0) return [];

  const derfeNombre = toDerfeNombre(entidad);
  const secciones = new Set<string>();
  await streamCsvRows(paths[0], (row) => {
    if (row.nombre_entidad !== derfeNombre) return;
    if (row.cve_municipio?.trim() !== cvMunicipio) return;
    const sec = row.seccion?.trim();
    if (sec) secciones.add(sec);
  });

  const result = Array.from(secciones).sort((a, b) => parseInt(a) - parseInt(b));
  setCache(cacheKey, result);
  return result;
}

// ==========================================
// CASCADE GEO POR AÑO (usa JSON pre-generados)
// ==========================================

/**
 * Distritos para una entidad en un año específico.
 * Lee el JSON pre-generado {ENTIDAD}_{year}.json; fallback al semanal si no existe.
 */
export async function getDistritosPorEntidadYear(
  entidad: string,
  year: number
): Promise<GeoOpcion[]> {
  const storageKey = toHistoricoStorageKey(entidad);
  const cache = await loadEntidadYear(storageKey, year);
  if (!cache) return getDistritosPorEntidad(entidad);
  const map = new Map<string, string>();
  for (const sec of cache.secciones) {
    if (sec.cvd && sec.d) map.set(sec.cvd, sec.d);
  }
  return Array.from(map.entries())
    .map(([cve, nombre]) => ({ cve, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Municipios para una entidad + distrito en un año específico.
 */
export async function getMunicipiosPorDistritoYear(
  entidad: string,
  cvDistrito: string,
  year: number
): Promise<GeoOpcion[]> {
  const storageKey = toHistoricoStorageKey(entidad);
  const cache = await loadEntidadYear(storageKey, year);
  if (!cache) return getMunicipiosPorDistrito(entidad, cvDistrito);
  const map = new Map<string, string>();
  for (const sec of cache.secciones) {
    if (sec.cvd === cvDistrito && sec.cvm && sec.m) map.set(sec.cvm, sec.m);
  }
  return Array.from(map.entries())
    .map(([cve, nombre]) => ({ cve, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Secciones para una entidad + municipio en un año específico.
 */
export async function getSeccionesPorMunicipioYear(
  entidad: string,
  cvMunicipio: string,
  year: number
): Promise<string[]> {
  const storageKey = toHistoricoStorageKey(entidad);
  const cache = await loadEntidadYear(storageKey, year);
  if (!cache) return getSeccionesPorMunicipio(entidad, cvMunicipio);
  const secciones = new Set<string>();
  for (const sec of cache.secciones) {
    if (sec.cvm === cvMunicipio && sec.s) secciones.add(sec.s);
  }
  return Array.from(secciones).sort((a, b) => parseInt(a) - parseInt(b));
}

// ==========================================
// DATOS NO BINARIO POR FILTRO GEO (semanal)
// ==========================================

export interface NbGeoResult {
  padron: number;
  lista: number;
}

/**
 * Devuelve los totales No Binario del último corte semanal _sexo.csv
 * filtrados por entidad, municipio (CVE) y/o secciones.
 *
 * Retorna null si no hay datos NB para el filtro indicado.
 */
export async function getSemanalNbGeo(
  entidad: string,
  cveMunicipio?: string,
  secciones?: string[]
): Promise<NbGeoResult | null> {
  const paths = await getSemanalPaths("sexo");
  if (paths.length === 0) return null;

  const derfeNombre = toDerfeNombre(entidad.toUpperCase().trim());
  const filtSecciones = secciones?.length
    ? new Set(secciones.map(normSec))
    : null;

  let padron = 0;
  let lista = 0;

  await streamCsvRows(paths[0], (row) => {
    if (row.nombre_entidad !== derfeNombre) return;
    if (row.cabecera_distrital?.toUpperCase().includes("RESIDENTES EXTRANJERO")) return;
    if (cveMunicipio && row.cve_municipio?.trim() !== cveMunicipio) return;
    if (filtSecciones && !filtSecciones.has(normSec(row.seccion))) return;

    padron += parseInt(row.padron_no_binario ?? "0") || 0;
    lista  += parseInt(row.lista_no_binario  ?? "0") || 0;
  });

  if (padron === 0 && lista === 0) return null;
  return { padron, lista };
}

// ==========================================
// TABLA DE DATOS — filas por sección/year
// ==========================================

export interface TablaRow {
  year: number;
  entidad: string;
  cabecera: string;
  municipio: string;
  seccion: string;
  padron: number;
  padronH: number;
  padronM: number;
  padronNB: number;
  lista: number;
  listaH: number;
  listaM: number;
  listaNB: number;
}

function seccionToTablaRow(
  entidad: string,
  sec: SeccionData,
  yearIdx: number,
  year: number,
  ambito: "nacional" | "extranjero"
): TablaRow {
  if (ambito === "nacional") {
    const padron  = sec.p[yearIdx]   ?? 0;
    const lista   = sec.l[yearIdx]   ?? 0;
    const padronH  = sec.ph[yearIdx]  ?? 0;
    const padronM  = sec.pm[yearIdx]  ?? 0;
    const padronNB = sec.pnb[yearIdx] ?? 0;
    return {
      year, entidad, cabecera: sec.d, municipio: sec.m, seccion: sec.s,
      padron, padronH, padronM, padronNB, lista,
      listaH:  padron > 0 ? Math.round(lista * padronH  / padron) : 0,
      listaM:  padron > 0 ? Math.round(lista * padronM  / padron) : 0,
      listaNB: padron > 0 ? Math.round(lista * padronNB / padron) : 0,
    };
  }
  return {
    year, entidad, cabecera: sec.d, municipio: sec.m, seccion: sec.s,
    padron:  sec.pe[yearIdx]    ?? 0,
    padronH: sec.peh?.[yearIdx] ?? 0,
    padronM: sec.pem?.[yearIdx] ?? 0,
    padronNB: sec.penb?.[yearIdx] ?? 0,
    lista:   sec.le[yearIdx]    ?? 0,
    listaH:  sec.leh?.[yearIdx] ?? 0,
    listaM:  sec.lem?.[yearIdx] ?? 0,
    listaNB: sec.lenb?.[yearIdx] ?? 0,
  };
}

/**
 * Devuelve filas por sección del año seleccionado para la Tabla de Datos.
 * Usa los JSON pre-generados anuales (mismo origen que G2/G3).
 */
export async function getHistoricoTablaRows(params: {
  ambito: "nacional" | "extranjero";
  entidad?: string;
  year: number;
  distritoNombre?: string;
  municipioNombre?: string;
  secciones?: string[];
}): Promise<TablaRow[]> {
  const { ambito, year } = params;
  const isNacionalView = !params.entidad || params.entidad === "Nacional";

  // Extranjero nacional: usa el agregado __EXTRANJERO__
  if (ambito === "extranjero" && isNacionalView) {
    const cacheKey = `tabla:extranjero:${year}`;
    const cached = getCached<TablaRow[]>(cacheKey);
    if (cached) return cached;
    const data = await loadEntidadAnual("__EXTRANJERO__");
    if (!data) return [];
    const yearIdx = data.years.indexOf(year);
    if (yearIdx === -1) return [];
    const rows = data.secciones
      .map((sec) => seccionToTablaRow(sec.m || "Extranjero", sec, yearIdx, year, "extranjero"))
      .filter((r) => r.padron > 0 || r.lista > 0);
    if (rows.length > 0) setCache(cacheKey, rows);
    return rows;
  }

  // Entidad específica
  if (!isNacionalView && params.entidad) {
    const storageKey = toHistoricoStorageKey(params.entidad);
    const data = await loadEntidadAnual(storageKey);
    if (!data) return [];
    const yearIdx = data.years.indexOf(year);
    if (yearIdx === -1) return [];
    const filtSec = params.secciones?.length
      ? new Set(params.secciones.map(normSec))
      : null;
    return data.secciones
      .filter((sec) => {
        if (filtSec) return filtSec.has(normSec(sec.s));
        if (params.municipioNombre && sec.m !== params.municipioNombre) return false;
        // Skip district filter for anual (names evolved between years)
        return true;
      })
      .map((sec) => seccionToTablaRow(params.entidad!, sec, yearIdx, year, ambito))
      // Extranjero: omit sections with no foreign-registry data (padron/lista = 0)
      // Nacional: omit the RESIDENTES EXTRANJERO row (padron = 0 for national view)
      .filter((r) => r.padron > 0 || r.lista > 0);
  }

  // Nacional: carga los JSON anuales de todos los estados usando la lista
  // conocida de ESTADO_MAP. No usamos listStorageFiles porque esa función
  // filtra exclusivamente archivos .csv y no retornaría los .json de estados.
  const cacheKey = `tabla:nacional:${year}`;
  const cached = getCached<TablaRow[]>(cacheKey);
  if (cached) return cached;

  // Claves únicas de estado (ESTADO_MAP ya normaliza alias como "edomex" → "ESTADO DE MEXICO")
  const stateNames = [...new Set(Object.values(ESTADO_MAP))];

  const rows: TablaRow[] = [];
  const BATCH = 8;
  for (let i = 0; i < stateNames.length; i += BATCH) {
    const batch = stateNames.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (name) => {
        const key = toHistoricoStorageKey(name);
        const data = await loadEntidadAnual(key);
        if (!data) return [] as TablaRow[];
        const yearIdx = data.years.indexOf(year);
        if (yearIdx === -1) return [] as TablaRow[];
        return data.secciones
          .map((sec) => seccionToTablaRow(data.entidad, sec, yearIdx, year, "nacional"))
          // Omit RESIDENTES EXTRANJERO rows (padron=0 for nacional ambito)
          .filter((r) => r.padron > 0 || r.lista > 0);
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") rows.push(...r.value);
    }
  }

  const sorted = rows.sort(
    (a, b) => a.entidad.localeCompare(b.entidad) || a.seccion.localeCompare(b.seccion)
  );
  // Solo cachear si hay filas; evita que un año sin datos bloquee queries futuras
  if (sorted.length > 0) setCache(cacheKey, sorted);
  return sorted;
}

// ==========================================
// NB ANUAL — último corte por año, NB only
// ==========================================

export interface NBAnualPoint {
  year: number;
  padronNB: number;
  listaNB: number;
}

/**
 * Devuelve un punto NB por año (último mes disponible) para Nacional o Extranjero.
 *
 * ==========================================
 * TABLA DE DATOS SEMANAL
 * ==========================================

/**
 * Devuelve filas para la tabla de datos de la vista Semanal.
 * Usa getSemanalAgregado para obtener el agregado nacional/extranjero
 * y lo descompone en filas según el tipo de desglose.
 *
 * tipo=sexo   → 3 filas (Hombres, Mujeres, No Binario)
 * tipo=edad   → 12 filas (una por rango etario)
 * tipo=origen → hasta 34 filas (32 estados + LN87 + LN88)
 */
export async function getSemanalTablaRows(params: {
  tipo: SemanalTipo;
  ambito: "nacional" | "extranjero";
  corte?: string;
  entidad?: string;
  geo?: SemanalGeoFilter;
}): Promise<{ rows: Record<string, string | number>[]; fecha: string }> {
  const { tipo, ambito, corte, entidad, geo } = params;

  // When sub-state geo filter active, use section-level snapshot for accuracy
  let data: Record<string, number>;
  let fecha: string;

  // For tipo="sexo" the DataTable needs per-range sex breakdown (lista_18_hombres,
  // etc.) which only exists in the "edad" raw CSV, not in the "sexo" snapshot.
  const tipoAgg: SemanalTipo = tipo === "sexo" ? "edad" : tipo;

  if (entidad && geo && (geo.cveDistrito || geo.cveMunicipio || geo.secciones?.length)) {
    const snapshot = await getSemanalSeccionSnapshot(entidad, tipoAgg, ambito, geo, corte);
    if (snapshot) {
      data  = snapshot.data;
      fecha = snapshot.fecha;
    } else {
      // Section-series not pre-generated for this tipo — fall back to entity-level aggregate
      const agg = await getSemanalAgregado(tipoAgg, corte, entidad ?? null);
      if (!agg) return { rows: [], fecha: "" };
      data  = agg.ambitos[ambito] ?? {};
      fecha = agg.fecha;
    }
  } else {
    const agg = await getSemanalAgregado(tipoAgg, corte, entidad ?? null);
    if (!agg) return { rows: [], fecha: "" };
    data  = agg.ambitos[ambito] ?? {};
    fecha = agg.fecha;
  }

  const RANGOS = ["18","19","20_24","25_29","30_34","35_39","40_44","45_49","50_54","55_59","60_64","65_y_mas"];
  const ETIQ_R: Record<string, string> = {
    "18":"18 años","19":"19 años","20_24":"20–24 años","25_29":"25–29 años",
    "30_34":"30–34 años","35_39":"35–39 años","40_44":"40–44 años","45_49":"45–49 años",
    "50_54":"50–54 años","55_59":"55–59 años","60_64":"60–64 años","65_y_mas":"65+ años",
  };

  const ESTADOS_ORIGEN: Record<string, string> = {
    aguascalientes:"Aguascalientes", baja_california:"Baja California",
    baja_california_sur:"Baja California Sur", campeche:"Campeche",
    chiapas:"Chiapas", chihuahua:"Chihuahua", ciudad_de_mexico:"Ciudad de México",
    coahuila:"Coahuila", colima:"Colima", durango:"Durango",
    estado_de_mexico:"Estado de México", guanajuato:"Guanajuato",
    guerrero:"Guerrero", hidalgo:"Hidalgo", jalisco:"Jalisco",
    michoacan:"Michoacán", morelos:"Morelos", nayarit:"Nayarit",
    nuevo_leon:"Nuevo León", oaxaca:"Oaxaca", puebla:"Puebla",
    queretaro:"Querétaro", quintana_roo:"Quintana Roo",
    san_luis_potosi:"San Luis Potosí", sinaloa:"Sinaloa", sonora:"Sonora",
    tabasco:"Tabasco", tamaulipas:"Tamaulipas", tlaxcala:"Tlaxcala",
    veracruz:"Veracruz", yucatan:"Yucatán", zacatecas:"Zacatecas",
  };

  function tasa(pad: number, lst: number): string {
    return pad > 0 ? (lst / pad * 100).toFixed(2) + "%" : "—";
  }

  let rows: Record<string, string | number>[] = [];

  if (tipo === "sexo") {
    rows = RANGOS.map((r) => {
      const lH = (data[`lista_${r}_hombres`]    as number) ?? 0;
      const lM = (data[`lista_${r}_mujeres`]    as number) ?? 0;
      const lN = (data[`lista_${r}_no_binario`] as number) ?? 0;
      const pH = (data[`padron_${r}_hombres`]   as number) ?? 0;
      const pM = (data[`padron_${r}_mujeres`]   as number) ?? 0;
      const pN = (data[`padron_${r}_no_binario`] as number) ?? 0;
      return {
        rango:       ETIQ_R[r] ?? r,
        padron_h:    pH,
        padron_m:    pM,
        padron_nb:   pN,
        lne_hombres: lH,
        lne_mujeres: lM,
        lne_nb:      lN,
        tasa_h:      tasa(pH, lH),
        tasa_m:      tasa(pM, lM),
        tasa_nb:     tasa(pN, lN),
      };
    });
  } else if (tipo === "edad") {
    rows = RANGOS.map((r) => {
      // Handle both formats: series CSV (padron_18) and raw agg (padron_18_hombres + ...)
      const padDirect = (data[`padron_${r}`] as number) ?? 0;
      const pad = padDirect > 0 ? padDirect :
        ((data[`padron_${r}_hombres`] as number) ?? 0) +
        ((data[`padron_${r}_mujeres`] as number) ?? 0) +
        ((data[`padron_${r}_no_binario`] as number) ?? 0);
      const lstDirect = (data[`lista_${r}`] as number) ?? 0;
      const lst = lstDirect > 0 ? lstDirect :
        ((data[`lista_${r}_hombres`] as number) ?? 0) +
        ((data[`lista_${r}_mujeres`] as number) ?? 0) +
        ((data[`lista_${r}_no_binario`] as number) ?? 0);
      return { rango: ETIQ_R[r] ?? r, padron: pad, lista: lst, tasa: tasa(pad, lst) };
    });
  } else {
    // origen
    const estadoRows = Object.entries(ESTADOS_ORIGEN).map(([key, nombre]) => {
      const lne = (data[`ln_${key}`]  as number) ?? 0;
      const pad = (data[`pad_${key}`] as number) ?? 0;
      return { origen: nombre, lne, padron: pad, diferencia: pad - lne };
    });
    const ln87 = (data["ln87"] as number) ?? 0;
    const ln88 = (data["ln88"] as number) ?? 0;
    const pad87 = (data["pad87"] as number) ?? 0;
    const pad88 = (data["pad88"] as number) ?? 0;
    estadoRows.push(
      { origen: "Nacidos en el Extranjero (LN87)", lne: ln87, padron: pad87, diferencia: pad87 - ln87 },
      { origen: "Naturalizados (LN88)", lne: ln88, padron: pad88, diferencia: pad88 - ln88 }
    );
    rows = estadoRows.sort((a, b) => (b.lne as number) - (a.lne as number));
  }

  // Añadir campos base vacíos para compatibilidad con el API route
  rows = rows.map((r) => ({ entidad: entidad ?? "Nacional", municipio: "—", seccion: "—", ...r }));

  return { rows, fecha };
}

// ==========================================
// ELECCIONES FEDERALES — FILTRADO EXTENDIDO
// ==========================================

export interface ParticipacionPorNivel {
  nacional?: number;
  estatal?: number;
  distrital?: number;
  municipal?: number;
  seccional?: number;
}

export interface ResultadosEleccionesFiltered {
  estado: string;
  cargo: string;
  anio: number;
  totalVotos: number;
  lne: number;
  participacion: number;
  votosNulos: number;
  votosExtranjero?: number;
  partidos: { partido: string; votos: number; porcentaje: number; votosTotal: number }[];
  fuente: string;
  participacionPorNivel: ParticipacionPorNivel;
  /** Set when the target geo scope was found in a different district this year (redistricting). */
  distritoRedistritado?: string;
  /** Indicates whether the redistricting affected a municipio or selected secciones. */
  redistritadoScope?: "municipio" | "secciones";
}

export interface EleccionesMetadata {
  tipos: string[];
  principios: string[];
  hasExtranjero: boolean;
}

export interface GeoEleccionesOpcion {
  cve: string;
  nombre: string;
}

/** Resuelve el path del CSV electoral para año + cargo */
async function resolveEleccionesPath(
  anio: number,
  cargoKey: string
): Promise<string | null> {
  const allFiles = await listStorageFiles("sefix/results/federals/");
  const match = allFiles.find((f) => f.includes(`/pef_${cargoKey}_${anio}.csv`));
  return match ?? null;
}

/** Detecta tipos de elección y principios disponibles para una combinación */
export async function getEleccionesMetadata(
  anio: number,
  cargoKey: string,
  estadoNombre?: string,
  cabecera?: string
): Promise<EleccionesMetadata> {
  const isVotoExtranjeroEstado = estadoNombre?.toUpperCase() === "VOTO EN EL EXTRANJERO";
  const isVotoExtrajeroCabecera = cabecera?.toUpperCase().includes("VOTO EN EL EXTRANJERO") ?? false;
  // Normalize to electoral CSV name (only ESTADO DE MEXICO → "MEXICO"; others unchanged)
  const csvEstado = estadoNombre && !isVotoExtranjeroEstado ? toElectoralEstado(estadoNombre) : estadoNombre;
  // Cache key uses normalized name so stale entries from pre-fix code don't mask results
  const cacheKey = `elec:meta:${anio}:${cargoKey}:${csvEstado ?? "NAC"}:${cabecera ?? ""}`;
  const cached = getCached<EleccionesMetadata>(cacheKey);
  if (cached) return cached;

  const path = await resolveEleccionesPath(anio, cargoKey);
  if (!path) return { tipos: ["ORDINARIA"], principios: ["MAYORIA RELATIVA"], hasExtranjero: false };

  const tipos = new Set<string>();
  const principios = new Set<string>();
  let hasExtranjero = false;

  await streamCsvRows(path, (row) => {
    const rowMun = row.municipio?.trim().toUpperCase();
    const isExtranjero = rowMun === "VOTO EN EL EXTRANJERO";
    if (isExtranjero) {
      hasExtranjero = true;
      // Collect tipos from extranjero rows when the query targets extranjero data
      if (isVotoExtranjeroEstado || isVotoExtrajeroCabecera) {
        if (estadoNombre && !isVotoExtranjeroEstado && row.estado !== csvEstado) return;
        if (isVotoExtrajeroCabecera && row.cabecera?.trim() !== cabecera) return;
        if (row.tipo) tipos.add(row.tipo.trim().toUpperCase());
        if (row.principio) principios.add(row.principio.trim().toUpperCase());
      }
      return;
    }
    // Skip regular rows when the query is purely for extranjero scope
    if (isVotoExtranjeroEstado || isVotoExtrajeroCabecera) return;
    if (estadoNombre && row.estado !== csvEstado) return;
    if (cabecera && row.cabecera?.trim() !== cabecera) return;
    if (row.tipo) tipos.add(row.tipo.trim().toUpperCase());
    if (row.principio) principios.add(row.principio.trim().toUpperCase());
  });

  const result: EleccionesMetadata = {
    tipos: Array.from(tipos).sort(),
    principios: Array.from(principios).sort(),
    hasExtranjero,
  };
  setCache(cacheKey, result);
  return result;
}

/** Devuelve opciones geográficas para la cascada electoral */
export async function getEleccionesGeo(
  nivel: "distritos" | "municipios" | "secciones",
  anio: number,
  cargoKey: string,
  estadoNombre: string,
  cabecera?: string,
  municipio?: string
): Promise<GeoEleccionesOpcion[]> {
  const isExtranjeroEstado = estadoNombre === "VOTO EN EL EXTRANJERO";
  // Normalize to CSV name (e.g. "ESTADO DE MEXICO" → "MEXICO", "COAHUILA" → "COAHUILA DE ZARAGOZA")
  // Normalize to electoral CSV name (only ESTADO DE MEXICO → "MEXICO"; others unchanged)
  const csvEstado = isExtranjeroEstado ? estadoNombre : toElectoralEstado(estadoNombre);
  // Cache key uses the normalized name so stale entries from pre-fix code don't mask results
  const cacheKey = `elec:geo:${nivel}:${anio}:${cargoKey}:${csvEstado}:${cabecera ?? ""}:${municipio ?? ""}`;
  const cached = getCached<GeoEleccionesOpcion[]>(cacheKey);
  if (cached) return cached;

  const path = await resolveEleccionesPath(anio, cargoKey);
  if (!path) return [];

  const seen = new Map<string, string>();

  await streamCsvRows(path, (row) => {
    const rowMun = row.municipio?.trim();
    const rowMunUpper = rowMun?.toUpperCase();
    const isExtranjero = rowMunUpper === "VOTO EN EL EXTRANJERO";

    // Special case: when filtering to "VOTO EN EL EXTRANJERO" as the estado,
    // collect all extranjero cabeceras (nivel=distritos) across all states
    if (isExtranjeroEstado) {
      if (!isExtranjero) return;
      if (nivel === "distritos") {
        const cab = row.cabecera?.trim();
        if (cab) seen.set(cab, cab);
      }
      return;
    }

    if (row.estado !== csvEstado) return;

    // For distritos: include extranjero cabecera for this state
    if (nivel === "distritos" && isExtranjero) {
      const cab = row.cabecera?.trim();
      if (cab) seen.set(cab, cab);
      return;
    }

    // For municipios: include extranjero municipio value for this state (e.g. 2021/DIP LNERE)
    if (nivel === "municipios" && isExtranjero) {
      if (cabecera && row.cabecera?.trim() !== cabecera) return;
      if (rowMun) seen.set(rowMun, rowMun);
      return;
    }

    // Skip aggregate rows (seccion=0 or empty)
    const sec = row.seccion?.trim();
    if (!sec || sec === "0" || sec === "00") return;

    if (nivel === "distritos") {
      const cab = row.cabecera?.trim();
      if (cab && cab.toLowerCase() !== "nacional") {
        seen.set(cab, cab);
      }
    } else if (nivel === "municipios") {
      if (cabecera && row.cabecera?.trim() !== cabecera) return;
      if (rowMun) seen.set(rowMun, rowMun);
    } else {
      if (cabecera && row.cabecera?.trim() !== cabecera) return;
      if (municipio && row.municipio?.trim() !== municipio) return;
      if (sec) seen.set(sec, sec);
    }
  });

  let result: GeoEleccionesOpcion[];
  if (nivel === "secciones") {
    result = Array.from(seen.keys())
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((s) => ({ cve: s, nombre: s }));
  } else {
    result = Array.from(seen.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((s) => ({ cve: s, nombre: s }));
  }

  setCache(cacheKey, result);
  return result;
}

/** Versión extendida de getResultadosByEstado con todos los filtros */
export async function getResultadosFiltered(params: {
  estadoInput: string;
  cargoInput: string;
  anioInput: number;
  tipoEleccion?: string;
  principio?: string;
  cabecera?: string;
  municipio?: string;
  secciones?: string[];
  partidos?: string[];
  incluirExtranjero?: boolean;
}): Promise<ResultadosEleccionesFiltered | null> {
  const {
    estadoInput, cargoInput, anioInput,
    tipoEleccion, principio, cabecera, municipio, secciones, partidos,
    incluirExtranjero = true,
  } = params;

  const isVotoExtranjeroFiltro = estadoInput?.toUpperCase() === "VOTO EN EL EXTRANJERO";
  const isNacional = !estadoInput || estadoInput.toLowerCase() === "nacional" || isVotoExtranjeroFiltro;
  const estadoNombreResolved = isVotoExtranjeroFiltro ? null
    : (isNacional ? null : resolveEstadoName(estadoInput));
  // Normalize to electoral CSV name (only ESTADO DE MEXICO → "MEXICO"; others unchanged)
  const estadoNombre = estadoNombreResolved ? toElectoralEstado(estadoNombreResolved) : null;
  if (!isVotoExtranjeroFiltro && !isNacional && !estadoNombre) return null;

  const cargoKey = CARGO_TO_KEY[cargoInput.toLowerCase()] ?? "dip";
  const path = await resolveEleccionesPath(anioInput, cargoKey);
  if (!path) return null;

  const secFilter = secciones?.length
    ? new Set(secciones.map((s) => s.trim()))
    : null;

  const partidoFilter =
    partidos && !partidos.includes("Todos")
      ? new Set(partidos)
      : null;

  // Accumulators for main filter
  const totals: Record<string, number> = {};
  let totalVotos = 0;
  let lne = 0;
  let votosNulos = 0;
  let votosExtranjero = 0;

  // Accumulators for tasa global (totalVotos/lne) per geographic level
  let votosNac = 0; let lneNac = 0;
  let votosEst = 0; let lneEst = 0;
  let votosDist = 0; let lneDist = 0;
  let votosMun = 0; let lneMun = 0;
  let votosSec = 0; let lneSec = 0;

  // Redistricting detection: only flagged when ZERO rows for the municipio matched the
  // requested district AND all non-matching rows are in exactly one other district.
  const redistritacionCabeceras = new Set<string>();
  let districtMatchFound = false;

  let partidoHeaders: string[] = [];

  const headers = await streamCsvRows(path, (row) => {
    const rowTipo = row.tipo?.trim().toUpperCase();
    const rowPrincipio = row.principio?.trim().toUpperCase();
    const rowEstado = row.estado?.trim();
    const rowCabecera = row.cabecera?.trim();
    const rowMunicipio = row.municipio?.trim();
    const rowSeccion = row.seccion?.trim();

    // Skip aggregate rows, but keep "VOTO EN EL EXTRANJERO" rows (seccion=0, municipio especial)
    const isExtranjero = rowMunicipio?.toUpperCase() === "VOTO EN EL EXTRANJERO";

    // Exclude extranjero rows if the user explicitly unchecked them (and we're not filtering to extranjero only)
    if (isExtranjero && !incluirExtranjero && !isVotoExtranjeroFiltro) return;

    if (!isExtranjero && (!rowSeccion || rowSeccion === "0" || rowSeccion === "00")) return;

    // When filtering to VOTO EN EL EXTRANJERO, skip non-extranjero rows entirely
    // so that the national accumulation only counts extranjero votes
    if (isVotoExtranjeroFiltro && !isExtranjero) return;

    // Parse votes and LNE early — needed at multiple accumulation points
    const tv = parseInt(row.total_votos ?? "0");
    const lneRow = parseInt(row.lne ?? "0");
    const tvSafe = isNaN(tv) ? 0 : tv;
    const lneSafe = isNaN(lneRow) ? 0 : lneRow;

    // Nacional: accumulate all rows that passed the isVotoExtranjeroFiltro guard above
    votosNac += tvSafe; lneNac += lneSafe;

    // Apply estado filter (isVotoExtranjeroFiltro already handled above)
    if (estadoNombre && rowEstado !== estadoNombre) return;

    // Accumulate state-level totals (after estado filter, before tipo/principio/geo)
    votosEst += tvSafe; lneEst += lneSafe;

    // Apply tipo and principio filters
    if (tipoEleccion && tipoEleccion !== "AMBAS" && rowTipo !== tipoEleccion) return;
    if (principio && rowPrincipio !== principio) return;

    // Track extranjero subtotal at current scope (after estado+tipo+principio, before geo)
    if (isExtranjero) votosExtranjero += tvSafe;

    // Apply cabecera filter + accumulate district totals
    // Use numeric-prefix matching so districts that changed name between elections
    // (e.g. "0402 CARMEN" vs "0402 CIUDAD DEL CARMEN") still match correctly.
    // Fall back to exact match when either side lacks a numeric prefix (e.g. extranjero).
    if (cabecera) {
      const reqCode = cabecera.match(/^(\d+)/)?.[1];
      const rowCode = rowCabecera?.match(/^(\d+)/)?.[1];
      const matches = reqCode && rowCode ? rowCode === reqCode : rowCabecera === cabecera;
      if (!matches) {
        // Strict skip when neither municipio nor secciones scopes the query.
        if (!municipio && !secFilter) return;
        // Skip rows outside the target section selection (secciones take precedence over municipio).
        if (secFilter && !secFilter.has(rowSeccion)) return;
        // Track redistricting ONLY for the target geo rows (secciones > municipio in precedence).
        // Rows from other municipios/sections in the same district must NOT influence these flags.
        const isTarget = secFilter ? secFilter.has(rowSeccion) : rowMunicipio === municipio;
        if (rowCabecera && isTarget) redistritacionCabeceras.add(rowCabecera);
      } else {
        votosDist += tvSafe; lneDist += lneSafe;
        // Mark district match only for the target geo rows so that other municipios/sections
        // in the same district do not mask a redistricted target municipio or section.
        if (municipio) { if (rowMunicipio === municipio) districtMatchFound = true; }
        else if (secFilter) { if (secFilter.has(rowSeccion)) districtMatchFound = true; }
        else { districtMatchFound = true; }
      }
    }

    // Apply municipio filter + accumulate municipal totals
    if (municipio) {
      if (rowMunicipio !== municipio) return;
      votosMun += tvSafe; lneMun += lneSafe;
    }

    // Apply secciones filter + accumulate sectional totals
    if (secFilter) {
      if (!secFilter.has(rowSeccion)) return;
      votosSec += tvSafe; lneSec += lneSafe;
    }

    const vn = parseInt(row.vot_nul ?? "0");

    totalVotos += tvSafe;
    lne += lneSafe;
    votosNulos += isNaN(vn) ? 0 : vn;

    for (const [col, val] of Object.entries(row)) {
      if (!RESULTS_META_COLS.has(col.toLowerCase())) {
        const v = parseInt(val ?? "0");
        if (!isNaN(v)) totals[col] = (totals[col] ?? 0) + v;
      }
    }
  });

  // All columns that are partido votes (case-insensitive meta exclusion)
  const allPartidoCols = headers.filter((h) => !RESULTS_META_COLS.has(h.toLowerCase()));
  partidoHeaders = allPartidoCols;

  // Build partido list, applying filter if present
  const colsToShow = partidoFilter
    ? allPartidoCols.filter((h) => partidoFilter.has(h))
    : allPartidoCols;

  // Denominador: suma de total_votos (igual que R Shiny: sum(total_votos))
  const denominator = totalVotos > 0 ? totalVotos : 1;

  const partidos_result = colsToShow
    .map((p) => ({
      partido: p,
      votos: totals[p] ?? 0,
      porcentaje: +((totals[p] ?? 0) / denominator * 100).toFixed(2),
      votosTotal: denominator,
    }))
    .filter((p) => p.votos > 0)
    .sort((a, b) => b.votos - a.votos);

  void partidoHeaders;

  const cargoLabel =
    cargoKey === "dip" ? "DIPUTADOS FEDERALES"
    : cargoKey === "sen" ? "SENADORES"
    : "PRESIDENTE";

  // Only report redistricting when: (1) none of the target geo rows matched the requested
  // district, and (2) all non-matching rows landed in exactly one other district (unambiguous).
  const distritoRedistritado =
    !districtMatchFound && redistritacionCabeceras.size === 1
      ? (redistritacionCabeceras.values().next().value as string)
      : undefined;
  const redistritadoScope: "municipio" | "secciones" | undefined =
    distritoRedistritado ? (secFilter ? "secciones" : "municipio") : undefined;

  const result: ResultadosEleccionesFiltered = {
    estado: estadoNombre ?? "NACIONAL",
    cargo: cargoLabel,
    anio: anioInput,
    totalVotos,
    lne,
    participacion: lne > 0 ? +((totalVotos / lne) * 100).toFixed(2) : 0,
    votosNulos,
    votosExtranjero: votosExtranjero > 0 ? votosExtranjero : undefined,
    partidos: partidos_result,
    fuente: `INE — Sistema de Consulta de la Estadística de las Elecciones Federales ${anioInput}`,
    participacionPorNivel: {
      nacional: lneNac > 0 ? +((votosNac / lneNac) * 100).toFixed(2) : undefined,
      estatal: estadoNombre && lneEst > 0 ? +((votosEst / lneEst) * 100).toFixed(2) : undefined,
      distrital: cabecera && lneDist > 0 ? +((votosDist / lneDist) * 100).toFixed(2) : undefined,
      municipal: municipio && lneMun > 0 ? +((votosMun / lneMun) * 100).toFixed(2) : undefined,
      seccional: secFilter && lneSec > 0 ? +((votosSec / lneSec) * 100).toFixed(2) : undefined,
    },
    distritoRedistritado,
    redistritadoScope,
  };

  return result;
}

export interface EleccionesTablaRow {
  anio: number;
  cargo: string;
  estado: string;
  cabecera: string;
  municipio: string;
  seccion: string;
  tipo: string;
  principio: string;
  total_votos: number;
  lne: number;
  part_ciud: number;
  [key: string]: string | number;
}

/** Devuelve filas del DataTable de Elecciones con paginación opcional */
export async function getEleccionesTablaRows(params: {
  anio: number;
  cargoKey: string;
  estadoNombre?: string | null;
  tipoEleccion?: string;
  principio?: string;
  cabecera?: string;
  municipio?: string;
  secciones?: string[];
  columnas?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ rows: EleccionesTablaRow[]; total: number }> {
  const {
    anio, cargoKey, estadoNombre, tipoEleccion, principio,
    cabecera, municipio, secciones, columnas, page, pageSize,
  } = params;

  const path = await resolveEleccionesPath(anio, cargoKey);
  if (!path) return { rows: [], total: 0 };

  const secFilter = secciones?.length
    ? new Set(secciones.map((s) => s.trim()))
    : null;

  const cargoLabel =
    cargoKey === "dip" ? "DIPUTADOS FEDERALES"
    : cargoKey === "sen" ? "SENADORES"
    : "PRESIDENTE";

  // Normalize to electoral CSV name (only ESTADO DE MEXICO → "MEXICO"; others unchanged)
  const csvEstadoNombre = estadoNombre ? toElectoralEstado(estadoNombre) : estadoNombre;

  const allRows: EleccionesTablaRow[] = [];

  await streamCsvRows(path, (row) => {
    const rowSeccion = row.seccion?.trim();
    if (!rowSeccion || rowSeccion === "0" || rowSeccion === "00") return;
    if (csvEstadoNombre && row.estado?.trim() !== csvEstadoNombre) return;
    if (tipoEleccion && tipoEleccion !== "AMBAS" && row.tipo?.trim().toUpperCase() !== tipoEleccion) return;
    if (principio && row.principio?.trim().toUpperCase() !== principio) return;
    if (cabecera && row.cabecera?.trim() !== cabecera) return;
    if (municipio && row.municipio?.trim() !== municipio) return;
    if (secFilter && !secFilter.has(rowSeccion)) return;

    const tableRow: EleccionesTablaRow = {
      anio: parseInt(row.anio ?? String(anio)),
      cargo: row.cargo?.trim() ?? cargoLabel,
      estado: row.estado?.trim() ?? estadoNombre ?? "NACIONAL",
      cabecera: row.cabecera?.trim() ?? "",
      municipio: row.municipio?.trim() ?? "",
      seccion: rowSeccion,
      tipo: row.tipo?.trim() ?? "",
      principio: row.principio?.trim() ?? "",
      total_votos: parseInt(row.total_votos ?? "0") || 0,
      lne: parseInt(row.lne ?? "0") || 0,
      part_ciud: parseFloat(row.part_ciud ?? "0") || 0,
    };

    // Add partido columns
    for (const col of (columnas ?? [])) {
      if (!RESULTS_META_COLS.has(col)) {
        tableRow[col] = parseInt(row[col] ?? "0") || 0;
      }
    }

    allRows.push(tableRow);
  });

  const total = allRows.length;

  if (page !== undefined && pageSize !== undefined) {
    const start = (page - 1) * pageSize;
    return { rows: allRows.slice(start, start + pageSize), total };
  }

  return { rows: allRows, total };
}

// ==========================================
// NB ANUAL
// ==========================================

/**
 * Nacional: lee los _base.csv via getHistoricoSeries() (cacheada 30 min) que
 *   contiene padronNoBinario y listaNoBinario reales desde las columnas CSV.
 *   Esto garantiza que los valores sean exactos (no estimados por ratio).
 *
 * Extranjero: lee el JSON __EXTRANJERO___anual.json que contiene penb/lenb por sección.
 */
export async function getNBAnual(ambito: "nacional" | "extranjero"): Promise<NBAnualPoint[]> {
  const cacheKey = `nb:anual:${ambito}`;
  const cached = getCached<NBAnualPoint[]>(cacheKey);
  if (cached) return cached;

  let result: NBAnualPoint[] = [];

  if (ambito === "extranjero") {
    const data = await loadEntidadAnual("__EXTRANJERO__");
    if (data) {
      for (let i = 0; i < data.years.length; i++) {
        const penb = data.secciones.reduce((s, sec) => s + (sec.penb?.[i] ?? 0), 0);
        const lenb = data.secciones.reduce((s, sec) => s + (sec.lenb?.[i] ?? 0), 0);
        if (penb > 0 || lenb > 0) {
          result.push({ year: data.years[i], padronNB: penb, listaNB: lenb });
        }
      }
    }
  } else {
    // Nacional: use getHistoricoSeries() which processes _base.csv files
    // and correctly aggregates padronNoBinario + listaNoBinario per month.
    const series = await getHistoricoSeries();
    // Last available month per year
    const byYear = new Map<number, HistoricoMes>();
    for (const m of series) {
      const ex = byYear.get(m.year);
      if (!ex || m.month > ex.month) byYear.set(m.year, m);
    }
    result = Array.from(byYear.entries())
      .filter(([, m]) => m.padronNoBinario > 0)
      .sort(([a], [b]) => a - b)
      .map(([year, m]) => ({ year, padronNB: m.padronNoBinario, listaNB: m.listaNoBinario }));
  }

  if (result.length > 0) setCache(cacheKey, result);
  return result;
}

// ==========================================
// ELECCIONES LOCALES — FILTRADO EXTENDIDO
// ==========================================

const RESULTS_META_COLS_LOC = new Set([
  "id", "anio", "cve_ambito", "ambito", "cve_cargo", "cargo",
  "cve_principio", "principio", "cve_tipo", "tipo",
  "cve_estado", "estado", "cve_del", "cabecera",
  "cve_mun", "municipio", "seccion",
  "total_votos", "lne", "part_ciud",
  "num_votos_validos",
]);

/**
 * Maps UI estado names to one or more file prefix keys used in PEL CSVs.
 * CDMX has two keys: "cdmx" (2021+) and "df" (2015), both tried in order.
 */
const ESTADO_TO_LOC_KEYS: Record<string, string[]> = {
  "AGUASCALIENTES":        ["ags"],
  "BAJA CALIFORNIA":       ["bc"],
  "BAJA CALIFORNIA SUR":   ["bcs"],
  "CAMPECHE":              ["camp"],
  "CHIAPAS":               ["chis"],
  "CHIHUAHUA":             ["chih"],
  "COAHUILA":              ["coah"],
  "COLIMA":                ["col"],
  "CIUDAD DE MEXICO":      ["cdmx", "df"],  // 2021=cdmx, 2015=df
  "DISTRITO FEDERAL":      ["df"],
  "DURANGO":               ["dgo"],
  "GUANAJUATO":            ["gto"],
  "GUERRERO":              ["gro"],
  "HIDALGO":               ["hgo"],
  "JALISCO":               ["jal"],
  "MEXICO":                ["mex"],
  "ESTADO DE MEXICO":      ["mex"],
  "MICHOACAN":             ["mich"],
  "MORELOS":               ["mor"],
  "NAYARIT":               ["nay"],
  "NUEVO LEON":            ["nl"],
  "OAXACA":                ["oax"],
  "PUEBLA":                ["pue"],
  "QUERETARO":             ["qro"],
  "QUINTANA ROO":          ["qroo"],
  "SAN LUIS POTOSI":       ["slp"],
  "SINALOA":               ["sin"],
  "SONORA":                ["son"],
  "TABASCO":               ["tab"],
  "TAMAULIPAS":            ["tams"],
  "TLAXCALA":              ["tlax"],
  "VERACRUZ":              ["ver"],
  "YUCATAN":               ["yuc"],
  "ZACATECAS":             ["zac"],
};
function getLocKeys(estadoNombre: string): string[] {
  return ESTADO_TO_LOC_KEYS[estadoNombre.toUpperCase().trim()] ?? [];
}
function getLocKey(estadoNombre: string): string | undefined {
  return getLocKeys(estadoNombre)[0];
}

// Returns the set of possible `estado` column values for a UI state name.
// CDMX appears as "CIUDAD DE MEXICO" in 2021 CSVs and "DISTRITO FEDERAL" in 2015.
// EdoMex appears as "MEXICO" in INE CSVs regardless of year.
function possibleCsvEstados(uiName: string): string[] {
  const upper = uiName.toUpperCase().trim();
  if (upper === "CIUDAD DE MEXICO" || upper === "DISTRITO FEDERAL")
    return ["CIUDAD DE MEXICO", "DISTRITO FEDERAL"];
  if (upper === "ESTADO DE MEXICO" || upper === "MEXICO")
    return ["MEXICO"];
  return [upper];
}

/** Resolves the Storage path for a local election CSV, trying all locKeys. */
async function resolveEleccionesLocalesPath(
  anio: number,
  cargoKey: string,
  locKeys: string[]
): Promise<string | null> {
  const allFiles = await listStorageFiles("sefix/results/locals/");
  for (const locKey of locKeys) {
    const pattern = `/${locKey}_pel_${cargoKey}_${anio}.csv`;
    const match = allFiles.find((f) => f.endsWith(pattern));
    if (match) return match;
  }
  return null;
}

/** Detects available election types and principios for a local combination */
export async function getEleccionesLocalesMetadata(
  anio: number,
  cargoKey: string,
  estadoNombre: string,
  cabecera?: string
): Promise<EleccionesMetadata> {
  const locKeys = getLocKeys(estadoNombre);
  if (!locKeys.length) return { tipos: ["ORDINARIA"], principios: ["MAYORIA RELATIVA"], hasExtranjero: false };

  const cacheKey = `elec_loc:meta:${anio}:${cargoKey}:${estadoNombre}:${cabecera ?? ""}`;
  const cached = getCached<EleccionesMetadata>(cacheKey);
  if (cached) return cached;

  const path = await resolveEleccionesLocalesPath(anio, cargoKey, locKeys);
  if (!path) return { tipos: ["ORDINARIA"], principios: ["MAYORIA RELATIVA"], hasExtranjero: false };

  const tipos = new Set<string>();
  const principios = new Set<string>();

  const csvEstados = possibleCsvEstados(estadoNombre);
  await streamCsvRows(path, (row) => {
    if (!csvEstados.includes(row.estado?.trim() ?? "")) return;
    if (cabecera && row.cabecera?.trim() !== cabecera) return;
    if (row.tipo) tipos.add(row.tipo.trim().toUpperCase());
    if (row.principio) principios.add(row.principio.trim().toUpperCase());
  });

  const result: EleccionesMetadata = {
    tipos: Array.from(tipos).sort(),
    principios: Array.from(principios).sort(),
    hasExtranjero: false,
  };
  setCache(cacheKey, result);
  return result;
}

/** Strips literal '?' characters introduced by encoding issues in INE source files */
function cleanGeoName(s: string): string {
  return s.replace(/\?/g, "").replace(/\s{2,}/g, " ").trim();
}

/** Returns geographic cascade options for local elections */
export async function getEleccionesLocalesGeo(
  nivel: "distritos" | "municipios" | "secciones",
  anio: number,
  cargoKey: string,
  estadoNombre: string,
  cabecera?: string,
  municipio?: string
): Promise<GeoEleccionesOpcion[]> {
  const locKeys = getLocKeys(estadoNombre);
  if (!locKeys.length) return [];

  const cacheKey = `elec_loc:geo:${nivel}:${anio}:${cargoKey}:${estadoNombre}:${cabecera ?? ""}:${municipio ?? ""}`;
  const cached = getCached<GeoEleccionesOpcion[]>(cacheKey);
  if (cached) return cached;

  const path = await resolveEleccionesLocalesPath(anio, cargoKey, locKeys);
  if (!path) return [];

  const seen = new Map<string, string>();
  const csvEstados = possibleCsvEstados(estadoNombre);

  await streamCsvRows(path, (row) => {
    if (!csvEstados.includes(row.estado?.trim() ?? "")) return;

    const sec = row.seccion?.trim();
    if (!sec || sec === "0" || sec === "00") return;

    if (nivel === "distritos") {
      const cab = cleanGeoName(row.cabecera?.trim() ?? "");
      if (cab) seen.set(cab, cab);
    } else if (nivel === "municipios") {
      if (cabecera && row.cabecera?.trim() !== cabecera) return;
      const mun = cleanGeoName(row.municipio?.trim() ?? "");
      if (mun) seen.set(mun, mun);
    } else {
      if (cabecera && row.cabecera?.trim() !== cabecera) return;
      if (municipio && row.municipio?.trim() !== municipio) return;
      if (sec) seen.set(sec, sec);
    }
  });

  let result: GeoEleccionesOpcion[];
  if (nivel === "secciones") {
    result = Array.from(seen.keys())
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((s) => ({ cve: s, nombre: s }));
  } else {
    result = Array.from(seen.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((s) => ({ cve: s, nombre: s }));
  }

  setCache(cacheKey, result);
  return result;
}

const LOC_FIXED_COLS = new Set([
  "id",
  "anio", "cve_ambito", "ambito",
  "cve_tipo", "tipo",
  "cve_principio", "principio",
  "cve_cargo", "cargo",
  "cve_estado", "estado",
  "cve_del", "cabecera",
  "cve_mun", "municipio",
  "seccion",
  "total_votos", "lne", "part_ciud",
  "num_votos_validos",
]);

/** Returns only the party column names from the CSV header for a local election */
export async function getEleccionesLocalesPartidos(
  anio: number, cargoKey: string, estadoNombre: string
): Promise<string[]> {
  const locKeys = getLocKeys(estadoNombre);
  if (!locKeys.length) return [];
  const path = await resolveEleccionesLocalesPath(anio, cargoKey, locKeys);
  if (!path) return [];

  const cacheKey = `elec_loc:partidos:${anio}:${cargoKey}:${estadoNombre}`;
  const cached = getCached<string[]>(cacheKey);
  if (cached) return cached;

  const fileStream = getBucket().file(path).createReadStream();
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let result: string[] = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const headers = line.split(",").map((h) => {
      const t = h.trim();
      return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
    });
    result = headers.filter((h) => !LOC_FIXED_COLS.has(h.toLowerCase()));
    break;
  }
  rl.close();
  fileStream.destroy();

  setCache(cacheKey, result);
  return result;
}

/** Extended filter for local election results */
export async function getResultadosLocalesFiltered(params: {
  estadoNombre: string;
  cargoKey: string;
  anioInput: number;
  tipoEleccion?: string;
  principio?: string;
  cabecera?: string;
  municipio?: string;
  secciones?: string[];
  partidos?: string[];
}): Promise<ResultadosEleccionesFiltered | null> {
  const {
    estadoNombre, cargoKey, anioInput,
    tipoEleccion, principio, cabecera, municipio, secciones, partidos,
  } = params;

  const locKeys = getLocKeys(estadoNombre);
  if (!locKeys.length) return null;

  const path = await resolveEleccionesLocalesPath(anioInput, cargoKey, locKeys);
  if (!path) return null;

  const secFilter = secciones?.length
    ? new Set(secciones.map((s) => s.trim()))
    : null;

  const partidoFilter =
    partidos && !partidos.includes("Todos") ? new Set(partidos) : null;

  const totals: Record<string, number> = {};
  let totalVotos = 0;
  let lne = 0;
  let votosNulos = 0;
  let votosEst = 0; let lneEst = 0;
  let votosDist = 0; let lneDist = 0;
  let votosMun = 0; let lneMun = 0;
  let votosSec = 0; let lneSec = 0;

  const redistritacionCabeceras = new Set<string>();
  let districtMatchFound = false;

  const csvEstados = possibleCsvEstados(estadoNombre);
  const headers = await streamCsvRows(path, (row) => {
    const rowSeccion = row.seccion?.trim();
    if (!rowSeccion || rowSeccion === "0" || rowSeccion === "00") return;
    if (!csvEstados.includes(row.estado?.trim() ?? "")) return;

    const tv = parseInt(row.total_votos ?? "0");
    const lneRow = parseInt(row.lne ?? "0");
    const tvSafe = isNaN(tv) ? 0 : tv;
    const lneSafe = isNaN(lneRow) ? 0 : lneRow;

    votosEst += tvSafe; lneEst += lneSafe;

    const rowTipo = row.tipo?.trim().toUpperCase();
    const rowPrincipio = row.principio?.trim().toUpperCase();
    if (tipoEleccion && tipoEleccion !== "AMBAS" && rowTipo !== tipoEleccion) return;
    if (principio && rowPrincipio !== principio) return;

    const rowCabecera = row.cabecera?.trim();
    const rowMunicipio = row.municipio?.trim();

    if (cabecera) {
      const reqCode = cabecera.match(/^(\d+)/)?.[1];
      const rowCode = rowCabecera?.match(/^(\d+)/)?.[1];
      const matches = reqCode && rowCode ? rowCode === reqCode : rowCabecera === cabecera;
      if (!matches) {
        // Row belongs to a different district.
        // Redistritacion only applies at section level: a specific section that moved
        // districts between elections. Municipality filters must NOT allow cross-district
        // rows because municipalities naturally span multiple districts.
        if (!secFilter) return;
        if (!secFilter.has(rowSeccion)) return;
        // This exact section was requested and found in a different district → redistritacion.
        if (rowCabecera) redistritacionCabeceras.add(rowCabecera);
        districtMatchFound = true;
        // Continue to accumulate this redistributed section.
      } else {
        votosDist += tvSafe; lneDist += lneSafe;
        if (municipio) { if (rowMunicipio === municipio) districtMatchFound = true; }
        else if (secFilter) { if (secFilter.has(rowSeccion)) districtMatchFound = true; }
        else { districtMatchFound = true; }
      }
    }

    if (municipio) {
      if (rowMunicipio !== municipio) return;
      votosMun += tvSafe; lneMun += lneSafe;
    }

    if (secFilter) {
      if (!secFilter.has(rowSeccion)) return;
      votosSec += tvSafe; lneSec += lneSafe;
    }

    const vn = parseInt(row.vot_nul ?? "0");
    totalVotos += tvSafe;
    lne += lneSafe;
    votosNulos += isNaN(vn) ? 0 : vn;

    for (const [col, val] of Object.entries(row)) {
      if (!RESULTS_META_COLS_LOC.has(col.toLowerCase())) {
        const v = parseInt(val ?? "0");
        if (!isNaN(v)) totals[col] = (totals[col] ?? 0) + v;
      }
    }
  });

  const allPartidoCols = headers.filter((h) => !RESULTS_META_COLS_LOC.has(h.toLowerCase()));
  const colsToShow = partidoFilter
    ? allPartidoCols.filter((h) => partidoFilter.has(h))
    : allPartidoCols;

  const denominator = totalVotos > 0 ? totalVotos : 1;
  const partidos_result = colsToShow
    .map((p) => ({
      partido: p,
      votos: totals[p] ?? 0,
      porcentaje: +((totals[p] ?? 0) / denominator * 100).toFixed(2),
      votosTotal: denominator,
    }))
    .filter((p) => p.votos > 0)
    .sort((a, b) => b.votos - a.votos);

  const distritoRedistritado =
    !districtMatchFound && redistritacionCabeceras.size === 1
      ? (redistritacionCabeceras.values().next().value as string)
      : undefined;
  const redistritadoScope: "municipio" | "secciones" | undefined =
    distritoRedistritado ? (secFilter ? "secciones" : "municipio") : undefined;

  return {
    estado: estadoNombre,
    cargo: cargoKey.toUpperCase(),
    anio: anioInput,
    totalVotos,
    lne,
    participacion: lne > 0 ? +((totalVotos / lne) * 100).toFixed(2) : 0,
    votosNulos,
    partidos: partidos_result,
    fuente: `INE — Sistema de Consulta de la Estadística de las Elecciones Locales ${anioInput}`,
    participacionPorNivel: {
      estatal: lneEst > 0 ? +((votosEst / lneEst) * 100).toFixed(2) : undefined,
      distrital: cabecera && lneDist > 0 ? +((votosDist / lneDist) * 100).toFixed(2) : undefined,
      municipal: municipio && lneMun > 0 ? +((votosMun / lneMun) * 100).toFixed(2) : undefined,
      seccional: secFilter && lneSec > 0 ? +((votosSec / lneSec) * 100).toFixed(2) : undefined,
    },
    distritoRedistritado,
    redistritadoScope,
  };
}

/**
 * Returns available election years for a given estado.
 * Used for the estado→año step of the local elections cascade.
 */
export async function getResultadosLocalesAvailableYears(
  estadoNombre: string
): Promise<number[]> {
  const locKeys = getLocKeys(estadoNombre);
  if (!locKeys.length) return [];
  const allFiles = await listStorageFiles("sefix/results/locals/");
  const years = allFiles
    .filter((f) => {
      const name = f.split("/").pop() ?? "";
      return locKeys.some((k) => name.startsWith(`${k}_pel_`));
    })
    .map((f) => parseInt(f.match(/_(\d{4})\.csv$/)?.[1] ?? "0"))
    .filter((y) => y > 0);
  return [...new Set(years)].sort();
}

/**
 * Returns available cargo keys for a given estado + año combination.
 * Used for the año→cargo step of the local elections cascade.
 */
export async function getResultadosLocalesAvailableCargos(
  estadoNombre: string,
  anio: number
): Promise<string[]> {
  const locKeys = getLocKeys(estadoNombre);
  if (!locKeys.length) return [];
  const allFiles = await listStorageFiles("sefix/results/locals/");
  const suffix = `_${anio}.csv`;
  return allFiles
    .map((f) => f.split("/").pop() ?? "")
    .filter((name) => locKeys.some((k) => name.startsWith(`${k}_pel_`)) && name.endsWith(suffix))
    .map((name) => {
      for (const k of locKeys) {
        if (name.startsWith(`${k}_pel_`)) return name.slice(`${k}_pel_`.length, -suffix.length);
      }
      return "";
    })
    .filter(Boolean)
    .sort();
}

/** Returns available years for a local cargo across all states (used for historico G3). */
export async function getResultadosLocalesYearsForCargo(
  cargoKey: string
): Promise<number[]> {
  const allFiles = await listStorageFiles("sefix/results/locals/");
  const years = allFiles
    .filter((f) => f.includes(`_pel_${cargoKey}_`))
    .map((f) => parseInt(f.match(/_(\d{4})\.csv$/)?.[1] ?? "0"))
    .filter((y) => y > 0);
  return [...new Set(years)].sort();
}

/** Returns DataTable rows for local elections with optional pagination */
export async function getEleccionesLocalesTablaRows(params: {
  anio: number;
  cargoKey: string;
  estadoNombre: string;
  tipoEleccion?: string;
  principio?: string;
  cabecera?: string;
  municipio?: string;
  secciones?: string[];
  columnas?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ rows: EleccionesTablaRow[]; total: number }> {
  const {
    anio, cargoKey, estadoNombre, tipoEleccion, principio,
    cabecera, municipio, secciones, columnas, page, pageSize,
  } = params;

  const locKeys = getLocKeys(estadoNombre);
  if (!locKeys.length) return { rows: [], total: 0 };

  const path = await resolveEleccionesLocalesPath(anio, cargoKey, locKeys);
  if (!path) return { rows: [], total: 0 };

  const secFilter = secciones?.length
    ? new Set(secciones.map((s) => s.trim()))
    : null;

  const allRows: EleccionesTablaRow[] = [];

  const csvEstados = possibleCsvEstados(estadoNombre);
  await streamCsvRows(path, (row) => {
    const rowSeccion = row.seccion?.trim();
    if (!rowSeccion || rowSeccion === "0" || rowSeccion === "00") return;
    if (!csvEstados.includes(row.estado?.trim() ?? "")) return;
    if (tipoEleccion && tipoEleccion !== "AMBAS" && row.tipo?.trim().toUpperCase() !== tipoEleccion) return;
    if (principio && row.principio?.trim().toUpperCase() !== principio) return;
    if (cabecera && row.cabecera?.trim() !== cabecera) return;
    if (municipio && row.municipio?.trim() !== municipio) return;
    if (secFilter && !secFilter.has(rowSeccion)) return;

    const tableRow: EleccionesTablaRow = {
      anio: parseInt(row.anio ?? String(anio)),
      cargo: row.cargo?.trim() ?? cargoKey,
      estado: row.estado?.trim() ?? estadoNombre,
      cabecera: row.cabecera?.trim() ?? "",
      municipio: row.municipio?.trim() ?? "",
      seccion: rowSeccion,
      tipo: row.tipo?.trim() ?? "",
      principio: row.principio?.trim() ?? "",
      total_votos: parseInt(row.total_votos ?? "0") || 0,
      lne: parseInt(row.lne ?? "0") || 0,
      part_ciud: parseFloat(row.part_ciud ?? "0") || 0,
    };

    for (const col of (columnas ?? [])) {
      if (!RESULTS_META_COLS_LOC.has(col)) {
        tableRow[col] = parseInt(row[col] ?? "0") || 0;
      }
    }

    allRows.push(tableRow);
  });

  const total = allRows.length;
  if (page !== undefined && pageSize !== undefined) {
    const start = (page - 1) * pageSize;
    return { rows: allRows.slice(start, start + pageSize), total };
  }
  return { rows: allRows, total };
}

// ==========================================
// GANADORES POR FEATURE (para mapa coroplético electoral)
// ==========================================

export interface GanadorFeature {
  ganador: string;
  top3: { partido: string; votos: number; pct: number }[];
  totalVotos: number;
  label: string;
}

/**
 * Retorna el partido ganador (top3) por cada unidad geográfica para colorear el mapa.
 * nivel="entidades"   → featureKey = cve_estado (2 chars, ej. "14")
 * nivel="distritos_fed" → featureKey = cve_estado + cve_def (5 chars, ej. "14010")
 * nivel="secciones"   → featureKey = cve_estado + seccion (6 chars, ej. "140123")
 */
export async function getGanadorPorFeature(params: {
  nivel: "entidades" | "distritos_fed" | "secciones";
  cargo: string;
  anio: number;
  estadoNombre?: string;
  cveDistrito?: string;
  municipio?: string;
}): Promise<Record<string, GanadorFeature>> {
  const { nivel, cargo, anio, estadoNombre, cveDistrito, municipio } = params;

  const csvEstado = estadoNombre ? toElectoralEstado(estadoNombre) : undefined;
  const cacheKey = `geo-ganador:${nivel}:${cargo}:${anio}:${csvEstado ?? "NAC"}:${cveDistrito ?? ""}:${municipio ?? ""}`;
  const cached = getCached<Record<string, GanadorFeature>>(cacheKey);
  if (cached) return cached;

  const path = await resolveEleccionesPath(anio, cargo);
  if (!path) return {};

  // Use only known party columns to avoid BOM-prefixed "id" or metadata columns being treated as parties
  const validPartidoCols = new Set(
    (PARTIDOS_MAPPING[`${anio}_${cargo}`] ?? []).filter((c) => c !== "vot_nul" && c !== "no_reg")
  );

  // partidoVotos[featureKey][partido] = totalVotos
  const acum = new Map<string, { votos: Map<string, number>; label: string }>();

  await streamCsvRows(path, (row) => {
    const rowSeccion = row.seccion?.trim();
    if (!rowSeccion || rowSeccion === "0" || rowSeccion === "00") return;

    const rowMunUpper = row.municipio?.trim().toUpperCase();
    if (rowMunUpper === "VOTO EN EL EXTRANJERO") return;
    if (row.tipo?.trim().toUpperCase() !== "ORDINARIA") return;
    if (row.principio?.trim().toUpperCase() !== "MAYORIA RELATIVA") return;

    if (csvEstado && row.estado?.trim() !== csvEstado) return;
    // cveDistrito is the full cabecera string (e.g. "1405 PUERTO VALLARTA")
    if (cveDistrito && row.cabecera?.trim() !== cveDistrito) return;
    if (municipio && row.municipio?.trim() !== municipio) return;

    const cveEnt = (row.cve_estado ?? "").trim().padStart(2, "0");
    const secPad = rowSeccion.padStart(4, "0");
    // Extract the state-local district number from cabecera (format: "SSDDD NAME" where SS=state, DDD=local dist)
    const cabCode = (row.cabecera ?? "").trim().match(/^(\d+)/)?.[1] ?? "";
    const localDist = cabCode.substring(2).padStart(3, "0");

    let featureKey: string;
    let label: string;
    if (nivel === "entidades") {
      featureKey = cveEnt;
      label = row.estado?.trim() ?? cveEnt;
    } else if (nivel === "distritos_fed") {
      featureKey = cveEnt + localDist;
      label = row.cabecera?.trim() ?? `Distrito ${localDist}`;
    } else {
      featureKey = cveEnt + secPad;
      label = `Sección ${rowSeccion} · ${row.municipio?.trim() ?? row.estado?.trim() ?? ""}`;
    }

    if (!acum.has(featureKey)) {
      acum.set(featureKey, { votos: new Map(), label });
    }
    const entry = acum.get(featureKey)!;

    for (const col of validPartidoCols) {
      const n = parseInt(row[col] ?? "0") || 0;
      if (n <= 0) continue;
      entry.votos.set(col, (entry.votos.get(col) ?? 0) + n);
    }
  });

  const result: Record<string, GanadorFeature> = {};
  for (const [featureKey, { votos, label }] of acum) {
    if (votos.size === 0) continue;
    const sorted = [...votos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const totalVotos = [...votos.values()].reduce((s, v) => s + v, 0);
    result[featureKey] = {
      ganador: sorted[0][0],
      top3: sorted.map(([partido, v]) => ({
        partido,
        votos: v,
        pct: totalVotos > 0 ? Math.round((v / totalVotos) * 1000) / 10 : 0,
      })),
      totalVotos,
      label,
    };
  }

  setCache(cacheKey, result);
  return result;
}
