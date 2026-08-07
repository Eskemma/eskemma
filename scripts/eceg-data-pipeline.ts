#!/usr/bin/env npx tsx
/**
 * scripts/eceg-data-pipeline.ts
 *
 * Converts ECEG 2020 XLSX files → JSON per state → Firebase Storage.
 * Also produces a national.json with aggregated state-level values.
 *
 * Run per state:
 *   npx tsx scripts/eceg-data-pipeline.ts --estado 01 [--upload] [--dry-run]
 *
 * Run all states + national:
 *   npx tsx scripts/eceg-data-pipeline.ts --all-estados [--upload] [--dry-run]
 *
 * Output in Firebase Storage:
 *   sefix/eceg_2020/secciones/{01..32}.json  → { [CVE_ENT+CVE_SECCION]: { POBTOT: n, ... } }
 *   sefix/eceg_2020/municipios/{01..32}.json → { [CVE_ENT+CVE_MUN]:     { POBTOT: n, ... } }
 *   sefix/eceg_2020/national.json            → { [CVE_ENT]:             { POBTOT: n, ... } }
 *
 * Prerequisite:
 *   npm install --save-dev xlsx
 */

import fs from "fs";
import path from "path";
import os from "os";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import dotenv from "dotenv";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shapefile = require("shapefile");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const ECEG_NACIONAL_DIR = path.resolve(
  __dirname,
  "../info_geo_eske/eceg_2020/ECEG_2020_nacional"
);
const ECEG_ESTADOS_DIR = path.resolve(
  __dirname,
  "../info_geo_eske/eceg_2020/ECEG_2020_estados"
);
// INE electoral sections (per-state) — used as fallback for district mapping
// when ECEG shapefiles lack the DISTRITO field (most states only have MUNICIPIO+SECCION).
const INE_ESTADOS_DIR = path.resolve(
  __dirname,
  "../info_geo_eske/mgs_2025_INE/estados"
);
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX = "sefix/eceg_2020";

// Curated indicators — all 10 thematic groups
const CURATED_COLUMNS = [
  // Demografía
  "POBTOT", "POB0_14", "POB15_64", "POB65_MAS", "P3YM_HLI", "POB_AFRO", "REL_H_M",
  "POBMAS", "POBFEM", "P_60YMAS", "P_15A49_F", "P_18YMAS", "PROM_HNV", "POB_EDADNE", "PNACOE",
  // Educación
  "GRAPROES", "P15YM_AN",
  "P15YM_SE", "P18YM_PB", "P15PRI_IN", "P15PRI_CO", "P15SEC_IN", "P15SEC_CO", "P15A17A", "P18A24A",
  // Economía y Empleo
  "PEA", "PDESOCUP", "PSINDER", "POCUPADA",
  "PE_INAC", "PDER_SS", "PDER_IMSS", "PDER_ISTE", "PDER_ISTEE", "PDER_SEGP",
  // Vivienda
  "VPH_PISODT", "VPH_PISOTI", "VPH_AGUADV", "VPH_SINRTV",
  "VPH_S_ELEC", "VPH_DRENAJ", "VPH_NODREN", "VPH_EXCSA", "VPH_TINACO", "VPH_CISTER",
  "VPH_1CUART", "VPH_NDEAED", "VPH_SNBIEN", "VPH_C_SERV",
  // Estado civil (F1-12, Fontana) — verificado 2026-08-02 vía Diccionario
  // de Datos ECEG: P12YM_CASA incluye unión libre; P12YM_SEPA cubre
  // separadas/divorciadas/viudas — las 3 cubren el 100% de 12+ años.
  "P12YM_SOLT", "P12YM_CASA", "P12YM_SEPA",
  // Conectividad
  "VPH_INTER", "VPH_CEL", "VPH_PC", "VPH_SINCIN",
  "VPH_TELEF", "VPH_SINLTC", "VPH_SINTIC",
  // Hogar
  "TOTHOG", "VIVPAR_DES", "OCUPVIVPAR", "PRO_OCUP_C",
  "HOGJEF_F", "HOGJEF_M", "VIVPAR_HAB", "TVIVPAR",
  // Población Indígena y Afrodescendiente
  "P3HLINHE", "PHOG_IND",
  // Discapacidad y Salud
  "PCON_DISC", "PCDISC_MOT", "PCDISC_VIS", "PCDISC_AUD", "PCDISC_MEN", "PCON_LIMI",
  // Bienes Duraderos
  "VPH_REFRI", "VPH_LAVAD", "VPH_AUTOM", "VPH_MOTO", "VPH_BICI", "VPH_TV",
  // Religión
  "PCATOLICA", "PRO_CRIEVA", "PSIN_RELIG",
] as const;

type CuratedColumn = typeof CURATED_COLUMNS[number];
type DataRecord = Partial<Record<CuratedColumn, number>>;

// Mapping: estado number (1-32) → XLSX filename prefix "ECEG NN"
// The XLSX files are named "ECEG 01 Aguascalientes.xlsx" etc.
// We match by the NN prefix.
function findXlsxForEstado(estadoId: string): string | null {
  const prefix = `ECEG ${estadoId}`;
  const entries = fs.readdirSync(ECEG_NACIONAL_DIR);
  const match = entries.find(
    (e) => e.startsWith(prefix) && e.endsWith(".xlsx")
  );
  return match ? path.join(ECEG_NACIONAL_DIR, match) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shapefile: SECCION → MUNICIPIO mapping
// ─────────────────────────────────────────────────────────────────────────────

/** Finds the per-state directory in ECEG_ESTADOS by numeric prefix. */
function findEcegEstadoDir(estadoId: string): string | null {
  const prefix = `${estadoId}_`;
  const entries = fs.readdirSync(ECEG_ESTADOS_DIR);
  const match = entries.find((e) => e.startsWith(prefix));
  if (!match) return null;
  const fullPath = path.join(ECEG_ESTADOS_DIR, match);
  return fs.statSync(fullPath).isDirectory() ? fullPath : null;
}

/** Finds the per-state directory in INE_ESTADOS_DIR by numeric prefix. */
function findIneEstadoDir(estadoId: string): string | null {
  if (!fs.existsSync(INE_ESTADOS_DIR)) return null;
  const prefix = `${estadoId}_`;
  const entries = fs.readdirSync(INE_ESTADOS_DIR);
  const match = entries.find((e) => e.startsWith(prefix));
  if (!match) return null;
  const fullPath = path.join(INE_ESTADOS_DIR, match);
  return fs.statSync(fullPath).isDirectory() ? fullPath : null;
}

/**
 * Reads SECCION.shp for one state and returns a Map:
 *   seccion_number → padded CVE_MUN (3-digit string)
 *
 * @param estadoId zero-padded state ID e.g. "01"
 */
async function buildSeccionMunMap(estadoId: string): Promise<Map<number, string>> {
  const estadoDir = findEcegEstadoDir(estadoId);
  if (!estadoDir) return new Map();

  const shpPath = path.join(estadoDir, "SECCION.shp");
  if (!fs.existsSync(shpPath)) return new Map();

  const map = new Map<number, string>();
  const src = await shapefile.open(shpPath);
  while (true) {
    const result = await src.read();
    if (result.done) break;
    const p = result.value?.properties as Record<string, unknown>;
    if (!p) continue;
    const sec = Number(p["SECCION"]);
    const mun = String(p["MUNICIPIO"] ?? "").padStart(3, "0");
    if (sec && mun) map.set(sec, mun);
  }
  return map;
}

// Guerrero, Michoacán y Veracruz: el shapefile propio de ECEG (censo
// 2020, geografía electoral vigente 2017-2020) tiene 1 distrito MÁS que
// mgs_2025_INE en cada uno (12: 9 vs 8, 16: 12 vs 11, 30: 20 vs 19) —
// verificado 2026-08-03 comparando el conjunto EXACTO de números de
// distrito (no solo el total) contra los 11 estados que usan este
// atajo: la redistritación 2022 fusionó/eliminó un distrito en cada uno
// de estos 3 estados; ECEG, por ser censo 2020, todavía refleja el
// distrito eliminado (ej. Guerrero 12009 — POBTOT 405,907 — ya no
// existe en la cartografía vigente). El atajo daba cobertura 100% con
// máxima confianza sobre un dato territorialmente equivocado — peor que
// el gap de cobertura que el atajo pretendía evitar. Los otros 8
// estados con este atajo (01, 03, 04, 06, 10, 13, 17, 18) SÍ coinciden
// exactamente, número por número, contra mgs_2025_INE — confirmado, no
// asumido.
const ESTADOS_ECEG_DISTRITO_DESACTUALIZADO = new Set(["12", "16", "30"]);

/**
 * Reads SECCION.shp for one state and returns a Map:
 *   seccion_number → padded DISTRITO_FED (3-digit string)
 *
 * Verificado 2026-08-03 (los 32 estados, no solo inspección de código):
 * 11 de 32 shapefiles propios de ECEG SÍ traen el campo DISTRITO
 * (01, 03, 04, 06, 10, 12, 13, 16, 17, 18, 30) — para esos estados,
 * Federal obtiene cobertura 100% sin depender de mgs_2025_INE. Los
 * otros 21 caen al fallback INE (campo DISTRITO_F) — mismo origen y
 * mismo gap de cobertura que Local (ver buildSeccionDistLocalMap), que
 * nunca tiene este atajo porque ECEG jamás publica distrito LOCAL.
 * Excepción dentro de esos 11: 12, 16 y 30 se fuerzan al fallback INE
 * pese a tener el campo DISTRITO — ver ESTADOS_ECEG_DISTRITO_DESACTUALIZADO.
 *
 * @param estadoId zero-padded state ID e.g. "01"
 */
async function buildSeccionDistMap(estadoId: string): Promise<Map<number, string>> {
  // 1. Try ECEG shapefile (field "DISTRITO", uppercase) — salvo los 3
  // estados con geografía desactualizada, forzados al fallback INE.
  const ecegDir = ESTADOS_ECEG_DISTRITO_DESACTUALIZADO.has(estadoId) ? null : findEcegEstadoDir(estadoId);
  if (ecegDir) {
    const shpPath = path.join(ecegDir, "SECCION.shp");
    if (fs.existsSync(shpPath)) {
      const map = new Map<number, string>();
      const src = await shapefile.open(shpPath);
      while (true) {
        const result = await src.read();
        if (result.done) break;
        const p = result.value?.properties as Record<string, unknown>;
        if (!p) continue;
        const sec  = Number(p["SECCION"]);
        const dist = String(p["DISTRITO"] ?? "").padStart(3, "0");
        if (sec && dist && dist !== "000") map.set(sec, dist);
      }
      if (map.size > 0) return map;
    }
  }

  // 2. Fall back to INE electoral sections (field "DISTRITO_F", may be lowercase)
  const ineDir = findIneEstadoDir(estadoId);
  if (!ineDir) return new Map();

  const shpPath = path.join(ineDir, "SECCION.shp");
  if (!fs.existsSync(shpPath)) return new Map();

  const map = new Map<number, string>();
  const src = await shapefile.open(shpPath);
  while (true) {
    const result = await src.read();
    if (result.done) break;
    const p = result.value?.properties as Record<string, unknown>;
    if (!p) continue;
    // Normalize keys to uppercase to handle lowercase field names
    const raw: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) raw[k.toUpperCase()] = v;
    const sec  = Number(raw["SECCION"]);
    const dist = String(raw["DISTRITO_F"] ?? "").padStart(3, "0");
    if (sec && dist && dist !== "000") map.set(sec, dist);
  }
  return map;
}

/**
 * Reads SECCION.shp for one state and returns a Map:
 *   seccion_number → padded DISTRITO_LOC (3-digit string)
 *
 * Sin el paso 1 de buildSeccionDistMap (ECEG propio) — ECEG nunca
 * publica distrito local, así que Local depende SIEMPRE de
 * mgs_2025_INE, para los 32 estados sin excepción (confirmado en vivo,
 * 2026-08-03: distrito_l poblado al 100% en los 32 estados).
 *
 * @param estadoId zero-padded state ID e.g. "01"
 */
async function buildSeccionDistLocalMap(estadoId: string): Promise<Map<number, string>> {
  const ineDir = findIneEstadoDir(estadoId);
  if (!ineDir) return new Map();

  const shpPath = path.join(ineDir, "SECCION.shp");
  if (!fs.existsSync(shpPath)) return new Map();

  const map = new Map<number, string>();
  const src = await shapefile.open(shpPath);
  while (true) {
    const result = await src.read();
    if (result.done) break;
    const p = result.value?.properties as Record<string, unknown>;
    if (!p) continue;
    const raw: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) raw[k.toUpperCase()] = v;
    const sec  = Number(raw["SECCION"]);
    const dist = String(raw["DISTRITO_L"] ?? "").padStart(3, "0");
    if (sec && dist && dist !== "000") map.set(sec, dist);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// XLSX reading
// ─────────────────────────────────────────────────────────────────────────────

interface EcegRow {
  ENTIDAD: number;
  SECCION?: number;
  [key: string]: unknown;
}

/**
 * Reads the ECEG XLSX for one state and returns an array of row objects.
 * Keeps ENTIDAD, SECCION, and the curated columns.
 */
function readXlsx(filePath: string): EcegRow[] {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
    defval: null,
  });

  return raw.map((row) => {
    const normalized: EcegRow = {
      ENTIDAD: Number(row["ENTIDAD"] ?? row["entidad"] ?? 0),
      SECCION: row["SECCION"] != null ? Number(row["SECCION"]) : undefined,
    };
    for (const col of CURATED_COLUMNS) {
      const val = row[col] ?? row[col.toLowerCase()];
      if (val != null && !isNaN(Number(val))) {
        normalized[col] = Number(val);
      }
    }
    return normalized;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Data aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds secciones JSON: { [CVE_ENT+CVE_SECCION]: DataRecord }
 * Key: 2-digit ENTIDAD + 4-digit SECCION
 */
function buildSeccionesData(rows: EcegRow[]): Record<string, DataRecord> {
  const out: Record<string, DataRecord> = {};
  for (const row of rows) {
    if (row.SECCION == null) continue;
    const key =
      String(row.ENTIDAD).padStart(2, "0") +
      String(row.SECCION).padStart(4, "0");
    const rec: DataRecord = {};
    for (const col of CURATED_COLUMNS) {
      const v = row[col];
      if (typeof v === "number") rec[col] = v;
    }
    out[key] = rec;
  }
  return out;
}

const AVERAGE_COLS = new Set<string>(["GRAPROES", "REL_H_M", "OCUPVIVPAR", "PRO_OCUP_C", "PROM_HNV"]);

/**
 * Builds municipios JSON: { [CVE_ENT+CVE_MUN]: DataRecord }
 * Uses seccionMunMap (from SECCION.shp) to derive CVE_MUN for each row.
 * Sums count-type indicators; averages ratio/index fields.
 *
 * @param seccionMunMap SECCION number → padded CVE_MUN (3-digit)
 */
function buildMunicipiosData(
  rows: EcegRow[],
  seccionMunMap: Map<number, string>
): Record<string, DataRecord> {
  const sums: Record<string, Record<string, number>> = {};
  const counts: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    if (row.SECCION == null) continue;
    const cveMun = seccionMunMap.get(row.SECCION);
    if (!cveMun) continue;

    const key = String(row.ENTIDAD).padStart(2, "0") + cveMun;
    if (!sums[key]) { sums[key] = {}; counts[key] = {}; }

    for (const col of CURATED_COLUMNS) {
      const v = row[col];
      if (typeof v !== "number") continue;
      sums[key][col] = (sums[key][col] ?? 0) + v;
      counts[key][col] = (counts[key][col] ?? 0) + 1;
    }
  }

  const out: Record<string, DataRecord> = {};
  for (const key of Object.keys(sums)) {
    const rec: DataRecord = {};
    for (const col of CURATED_COLUMNS) {
      const s = sums[key][col];
      if (s == null) continue;
      rec[col as CuratedColumn] = AVERAGE_COLS.has(col)
        ? Math.round((s / counts[key][col]) * 100) / 100
        : s;
    }
    out[key] = rec;
  }
  return out;
}

/**
 * Builds distritos JSON: { [CVE_ENT+CVE_DISTRITO]: DataRecord }
 * Uses seccionDistMap (from SECCION.shp) to derive DISTRITO_FED for each row.
 * Sums count-type indicators; averages ratio/index fields.
 *
 * @param seccionDistMap SECCION number → padded DISTRITO_FED (3-digit)
 */
function buildDistritosData(
  rows: EcegRow[],
  seccionDistMap: Map<number, string>
): Record<string, DataRecord> {
  const sums: Record<string, Record<string, number>> = {};
  const counts: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    if (row.SECCION == null) continue;
    const cveDist = seccionDistMap.get(row.SECCION);
    if (!cveDist) continue;

    const key = String(row.ENTIDAD).padStart(2, "0") + cveDist;
    if (!sums[key]) { sums[key] = {}; counts[key] = {}; }

    for (const col of CURATED_COLUMNS) {
      const v = row[col];
      if (typeof v !== "number") continue;
      sums[key][col] = (sums[key][col] ?? 0) + v;
      counts[key][col] = (counts[key][col] ?? 0) + 1;
    }
  }

  const out: Record<string, DataRecord> = {};
  for (const key of Object.keys(sums)) {
    const rec: DataRecord = {};
    for (const col of CURATED_COLUMNS) {
      const s = sums[key][col];
      if (s == null) continue;
      rec[col as CuratedColumn] = AVERAGE_COLS.has(col)
        ? Math.round((s / counts[key][col]) * 100) / 100
        : s;
    }
    out[key] = rec;
  }
  return out;
}

interface DistritosMunicipiosData {
  composicion: Record<string, Record<string, number>>; // { [CVE_DISTRITO]: { [CVE_MUN]: pctPOBTOT } }
  coberturaDistritos: Record<string, number>; // { [CVE_DISTRITO]: pctCobertura }
  coberturaMunicipios: Record<string, number>; // { [CVE_MUN]: pctCobertura }
}

/**
 * Builds distritos_municipios JSON — composición municipio↔distrito
 * para Fontana (modal de desglose municipal, T10) — % del POBTOT total
 * de cada municipio que cae en cada distrito, MÁS % de cobertura
 * (cuánta población de cada municipio/distrito sí logró vincularse a
 * una sección con distrito asignado — ver nota de cobertura abajo).
 * Reutiliza seccionMunMap/seccionDistMap y las filas ya cargadas en
 * memoria por processEstado — no relee ningún shapefile adicional.
 *
 * ⚠️ NOTA DE COBERTURA (hallazgo real, 2026-08-02): buildSeccionDistMap
 * resuelve sección→distrito desde mgs_2025_INE (cartografía electoral
 * 2025), pero las filas agregadas aquí son del censo 2020 (ECEG) — una
 * fracción de las secciones 2020 no tiene correspondencia en la
 * cartografía 2025 y queda sin distrito asignado (gap medido: 0% en
 * Aguascalientes hasta 17.83% en Jalisco). Diagnóstico geográfico
 * (investigación de este mismo incremento): el gap NO se reparte
 * uniforme dentro de cada municipio — se concentra en secciones "mega"
 * específicas de la periferia de zonas metropolitanas en crecimiento
 * explosivo (ej. Zapopan/Tonalá/Tlajomulco en Jalisco, secciones de
 * 27,000-42,000 habitantes cada una, muy por encima del tamaño típico).
 * La fórmula de coberturaDistritos de abajo SÍ asume reparto uniforme
 * dentro de cada municipio contribuyente (para poder estimar una
 * "población esperada" sin más información) — es una aproximación
 * razonable dado lo que sabemos, NO una medición exacta: si el hueco
 * real está concentrado en 1-2 secciones grandes de un municipio, el
 * número de cobertura puede sub/sobre-estimar el efecto en distritos
 * específicos de ese municipio. Ver investigación completa en el plan
 * de este incremento para la vía de corrección de raíz (CSV DERFE 2023,
 * no implementada — decisión pendiente, fuera de este fix).
 */
function buildDistritosMunicipiosData(
  rows: EcegRow[],
  seccionMunMap: Map<number, string>,
  seccionDistMap: Map<number, string>
): DistritosMunicipiosData {
  const pobtotPorMun: Record<string, number> = {};
  const pobtotPorMunDist: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    if (row.SECCION == null) continue;
    const mun = seccionMunMap.get(row.SECCION);
    if (!mun) continue;
    const pob = typeof row.POBTOT === "number" ? row.POBTOT : 0;
    pobtotPorMun[mun] = (pobtotPorMun[mun] ?? 0) + pob;

    const dist = seccionDistMap.get(row.SECCION);
    if (!dist) continue;
    if (!pobtotPorMunDist[dist]) pobtotPorMunDist[dist] = {};
    pobtotPorMunDist[dist][mun] = (pobtotPorMunDist[dist][mun] ?? 0) + pob;
  }

  // Cobertura por municipio: % de su POBTOT total que sí resolvió a
  // ALGÚN distrito (exacta, sin supuestos — suma directa).
  const coberturaMunicipios: Record<string, number> = {};
  for (const [mun, total] of Object.entries(pobtotPorMun)) {
    let resuelto = 0;
    for (const porMun of Object.values(pobtotPorMunDist)) {
      resuelto += porMun[mun] ?? 0;
    }
    coberturaMunicipios[mun] = total > 0 ? Math.round((resuelto / total) * 1000) / 10 : 0;
  }

  const composicion: Record<string, Record<string, number>> = {};
  const coberturaDistritos: Record<string, number> = {};
  for (const [dist, porMun] of Object.entries(pobtotPorMunDist)) {
    composicion[dist] = {};
    let actual = 0;
    let estimado = 0;
    for (const [mun, pob] of Object.entries(porMun)) {
      const total = pobtotPorMun[mun];
      composicion[dist][mun] = total > 0 ? Math.round((pob / total) * 1000) / 10 : 0;
      actual += pob;
      const coberturaMun = coberturaMunicipios[mun];
      estimado += coberturaMun > 0 ? pob / (coberturaMun / 100) : pob;
    }
    coberturaDistritos[dist] = estimado > 0 ? Math.round((actual / estimado) * 1000) / 10 : 0;
  }

  return { composicion, coberturaDistritos, coberturaMunicipios };
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase
// ─────────────────────────────────────────────────────────────────────────────

function initFirebase(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_PROJECT_ID, " +
      "FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env"
    );
  }
  if (!STORAGE_BUCKET) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env");
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function uploadJson(
  app: App,
  storagePath: string,
  data: unknown
): Promise<void> {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET);
  const file = bucket.file(storagePath);
  const buf = Buffer.from(JSON.stringify(data), "utf-8");
  await file.save(buf, {
    contentType: "application/json",
    metadata: { cacheControl: "public, max-age=1800" }, // 30 min
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-state processing
// ─────────────────────────────────────────────────────────────────────────────

const ALL_ESTADO_IDS = Array.from({ length: 32 }, (_, i) =>
  String(i + 1).padStart(2, "0")
);

/**
 * Processes ECEG data for one state: reads XLSX, builds secciones + municipios
 * JSON, and uploads or writes to disk.
 *
 * @return municipios data (used by national aggregation)
 */
async function processEstado(
  estadoId: string,
  dryRun: boolean,
  app: App | null
): Promise<Record<string, DataRecord>> {
  const xlsxPath = findXlsxForEstado(estadoId);
  if (!xlsxPath) {
    process.stdout.write(`[skip] No XLSX found for estado ${estadoId}\n`);
    return {};
  }

  process.stdout.write(`Estado ${estadoId}: reading ${path.basename(xlsxPath)}…\n`);
  const rows = readXlsx(xlsxPath);
  process.stdout.write(`  → ${rows.length} rows\n`);

  // Build sección→municipio and sección→distrito mappings from shapefile
  const [seccionMunMap, seccionDistMap, seccionDistLocalMap] = await Promise.all([
    buildSeccionMunMap(estadoId),
    buildSeccionDistMap(estadoId),
    buildSeccionDistLocalMap(estadoId),
  ]);
  process.stdout.write(
    `  → ${seccionMunMap.size} sección→municipio, ${seccionDistMap.size} sección→distrito federal, ` +
    `${seccionDistLocalMap.size} sección→distrito local pairs\n`
  );

  const seccionesData = buildSeccionesData(rows);
  const municipiosData = buildMunicipiosData(rows, seccionMunMap);
  const distritosData  = buildDistritosData(rows, seccionDistMap);
  const { composicion, coberturaDistritos, coberturaMunicipios } =
    buildDistritosMunicipiosData(rows, seccionMunMap, seccionDistMap);
  const distritosMunicipiosData = { composicion, coberturaDistritos, coberturaMunicipios };

  const distritosLocalesData = buildDistritosData(rows, seccionDistLocalMap);
  const localComposicion = buildDistritosMunicipiosData(rows, seccionMunMap, seccionDistLocalMap);
  const distritosLocalesMunicipiosData = {
    composicion: localComposicion.composicion,
    coberturaDistritos: localComposicion.coberturaDistritos,
    coberturaMunicipios: localComposicion.coberturaMunicipios,
  };

  // Cobertura por distrito, embebida directamente en distritosData/
  // distritosLocalesData — verificado seguro (app/api/sefix/eceg-datos/route.ts
  // solo hace rec[variable] contra una whitelist estática, nunca
  // Object.entries de un registro completo) — ver nota de cobertura en
  // buildDistritosMunicipiosData.
  for (const key of Object.keys(distritosData)) {
    const cveDistrito = key.slice(2); // key = CVE_ENT(2) + CVE_DISTRITO(3)
    const cobertura = coberturaDistritos[cveDistrito];
    if (cobertura != null) {
      (distritosData[key] as DataRecord & { _coberturaPct?: number })._coberturaPct = cobertura;
    }
  }
  for (const key of Object.keys(distritosLocalesData)) {
    const cveDistrito = key.slice(2);
    const cobertura = localComposicion.coberturaDistritos[cveDistrito];
    if (cobertura != null) {
      (distritosLocalesData[key] as DataRecord & { _coberturaPct?: number })._coberturaPct = cobertura;
    }
  }

  process.stdout.write(
    `  → ${Object.keys(seccionesData).length} secciones, ` +
    `${Object.keys(municipiosData).length} municipios, ` +
    `${Object.keys(distritosData).length} distritos federales, ` +
    `${Object.keys(distritosLocalesData).length} distritos locales\n`
  );

  const secPath  = `${STORAGE_PREFIX}/secciones/${estadoId}.json`;
  const munPath  = `${STORAGE_PREFIX}/municipios/${estadoId}.json`;
  const distPath = `${STORAGE_PREFIX}/distritos/${estadoId}.json`;
  const distMunPath = `${STORAGE_PREFIX}/distritos_municipios/${estadoId}.json`;
  const distLocPath = `${STORAGE_PREFIX}/distritos_locales/${estadoId}.json`;
  const distLocMunPath = `${STORAGE_PREFIX}/distritos_locales_municipios/${estadoId}.json`;

  if (dryRun) {
    const secOut  = path.join(os.tmpdir(), `eceg_secciones_${estadoId}.json`);
    const munOut  = path.join(os.tmpdir(), `eceg_municipios_${estadoId}.json`);
    const distOut = path.join(os.tmpdir(), `eceg_distritos_${estadoId}.json`);
    const distMunOut = path.join(os.tmpdir(), `eceg_distritos_municipios_${estadoId}.json`);
    const distLocOut = path.join(os.tmpdir(), `eceg_distritos_locales_${estadoId}.json`);
    const distLocMunOut = path.join(os.tmpdir(), `eceg_distritos_locales_municipios_${estadoId}.json`);
    fs.writeFileSync(secOut,  JSON.stringify(seccionesData));
    fs.writeFileSync(munOut,  JSON.stringify(municipiosData));
    fs.writeFileSync(distOut, JSON.stringify(distritosData));
    fs.writeFileSync(distMunOut, JSON.stringify(distritosMunicipiosData));
    fs.writeFileSync(distLocOut, JSON.stringify(distritosLocalesData));
    fs.writeFileSync(distLocMunOut, JSON.stringify(distritosLocalesMunicipiosData));
    process.stdout.write(`  [dry-run] → ${secOut}\n`);
    process.stdout.write(`  [dry-run] → ${munOut}\n`);
    process.stdout.write(`  [dry-run] → ${distOut}\n`);
    process.stdout.write(`  [dry-run] → ${distMunOut}\n`);
    process.stdout.write(`  [dry-run] → ${distLocOut}\n`);
    process.stdout.write(`  [dry-run] → ${distLocMunOut}\n`);
  } else {
    process.stdout.write(`  ↑ ${secPath}…\n`);
    await uploadJson(app!, secPath, seccionesData);
    process.stdout.write(`  ↑ ${munPath}…\n`);
    await uploadJson(app!, munPath, municipiosData);
    process.stdout.write(`  ↑ ${distPath}…\n`);
    await uploadJson(app!, distPath, distritosData);
    process.stdout.write(`  ↑ ${distMunPath}…\n`);
    await uploadJson(app!, distMunPath, distritosMunicipiosData);
    process.stdout.write(`  ↑ ${distLocPath}…\n`);
    await uploadJson(app!, distLocPath, distritosLocalesData);
    process.stdout.write(`  ↑ ${distLocMunPath}…\n`);
    await uploadJson(app!, distLocMunPath, distritosLocalesMunicipiosData);
    process.stdout.write(`  ✓ Done\n`);
  }

  return municipiosData;
}

// ─────────────────────────────────────────────────────────────────────────────
// National aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds national.json by aggregating all municipios data up to state level.
 * Result: { [CVE_ENT (2-digit)]: DataRecord }
 */
function buildNationalData(
  allMunicipios: Record<string, Record<string, DataRecord>>
): Record<string, DataRecord> {
  const sums: Record<string, Record<string, number>> = {};
  const counts: Record<string, Record<string, number>> = {};

  for (const [_estadoId, munData] of Object.entries(allMunicipios)) {
    for (const [munKey, rec] of Object.entries(munData)) {
      const cveEnt = munKey.slice(0, 2);
      if (!sums[cveEnt]) { sums[cveEnt] = {}; counts[cveEnt] = {}; }
      for (const [col, val] of Object.entries(rec)) {
        if (typeof val !== "number") continue;
        sums[cveEnt][col] = (sums[cveEnt][col] ?? 0) + val;
        counts[cveEnt][col] = (counts[cveEnt][col] ?? 0) + 1;
      }
    }
  }

  const out: Record<string, DataRecord> = {};
  for (const cveEnt of Object.keys(sums)) {
    const rec: DataRecord = {};
    for (const col of CURATED_COLUMNS) {
      const s = sums[cveEnt][col];
      if (s == null) continue;
      rec[col as CuratedColumn] = AVERAGE_COLS.has(col)
        ? Math.round((s / counts[cveEnt][col]) * 100) / 100
        : s;
    }
    out[cveEnt] = rec;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const upload = args.includes("--upload");
  const allEstados = args.includes("--all-estados");

  const estadoIdx = args.indexOf("--estado");
  const estadoArg = estadoIdx >= 0 ? args[estadoIdx + 1]?.padStart(2, "0") : null;

  if (!dryRun && !upload) {
    process.stderr.write(
      "Usage: npx tsx scripts/eceg-data-pipeline.ts --estado <id>|--all-estados [--upload|--dry-run]\n"
    );
    process.exit(1);
  }

  const estados = allEstados ? ALL_ESTADO_IDS : estadoArg ? [estadoArg] : [];
  if (estados.length === 0) {
    process.stderr.write("Specify --estado <id> or --all-estados.\n");
    process.exit(1);
  }

  const app = (!dryRun && upload) ? initFirebase() : null;
  const allMunicipios: Record<string, Record<string, DataRecord>> = {};

  for (const id of estados) {
    const munData = await processEstado(id, dryRun, app);
    allMunicipios[id] = munData;
  }

  // Upload national.json only when processing all states
  if (allEstados) {
    process.stdout.write(`Building national.json…\n`);
    const national = buildNationalData(allMunicipios);
    process.stdout.write(`  → ${Object.keys(national).length} entidades\n`);

    const nationalPath = `${STORAGE_PREFIX}/national.json`;
    if (dryRun) {
      const outPath = path.join(os.tmpdir(), "eceg_national.json");
      fs.writeFileSync(outPath, JSON.stringify(national));
      process.stdout.write(`  [dry-run] → ${outPath}\n`);
    } else {
      process.stdout.write(`  ↑ ${nationalPath}…\n`);
      await uploadJson(app!, nationalPath, national);
      process.stdout.write(`  ✓ Done\n`);
    }
  }
}

main().catch((e: Error) => {
  process.stderr.write(`Error: ${e.message}\n${e.stack ?? ""}\n`);
  process.exit(1);
});
