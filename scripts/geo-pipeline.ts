#!/usr/bin/env npx tsx
/**
 * scripts/geo-pipeline.ts
 *
 * Converts INE/INEGI SHP files → WGS84 GeoJSON → TopoJSON → Firebase Storage.
 * Reads projection from the SHP's companion .prj file and reprojects with proj4.
 *
 * INE layers (electoral):
 *   npx tsx scripts/geo-pipeline.ts --layer entidades [--upload]
 *   npx tsx scripts/geo-pipeline.ts --layer municipios [--upload]
 *   npx tsx scripts/geo-pipeline.ts --layer distritos_fed [--upload]
 *   npx tsx scripts/geo-pipeline.ts --layer distritos_loc [--upload]
 *   npx tsx scripts/geo-pipeline.ts --layer secciones --estado 01 [--upload]
 *   npx tsx scripts/geo-pipeline.ts --layer secciones --all-estados [--upload]
 *
 * INEGI layers (geostatistical):
 *   npx tsx scripts/geo-pipeline.ts --layer ageb_urbana --estado 14 [--upload]
 *   npx tsx scripts/geo-pipeline.ts --layer ageb_urbana --all-estados [--upload]
 *
 *   npx tsx scripts/geo-pipeline.ts --dry-run --layer entidades
 *
 * Output in Firebase Storage:
 *   sefix/geo/ine/nacional/entidades.topojson
 *   sefix/geo/ine/nacional/municipios.topojson
 *   sefix/geo/ine/nacional/distritos_fed.topojson
 *   sefix/geo/ine/nacional/distritos_loc.topojson
 *   sefix/geo/ine/estados/{ID}/secciones.topojson
 *   sefix/geo/inegi/estados/{ID}/ageb_urbana.topojson
 */

import fs from "fs";
import path from "path";
import os from "os";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import dotenv from "dotenv";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const shapefile = require("shapefile");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const topojson = require("topojson-server");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const topojsonSimplify = require("topojson-simplify");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const proj4 = require("proj4");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const INFO_GEO = path.resolve(__dirname, "../info_geo_eske");
const MGS_NACIONAL = path.join(INFO_GEO, "mgs_2025_INE/nacional/mgs_nacional_2025_INE");
const MGS_ESTADOS  = path.join(INFO_GEO, "mgs_2025_INE/estados");
const MG_INEGI_ESTADOS = path.join(INFO_GEO, "mg_2025_INEGI_estados");

const STORAGE_BUCKET        = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX_INE    = "sefix/geo/ine";
const STORAGE_PREFIX_INEGI  = "sefix/geo/inegi";

/**
 * Finds the per-state directory in MGS_ESTADOS by matching the numeric prefix
 * (e.g. "14" matches "14_mgs_jalisco_2025_INE"). Returns null if not found.
 * This avoids maintaining a hardcoded name map — works regardless of accents
 * or double underscores in the INE directory names.
 */
function findEstadoDir(estadoId: string): string | null {
  const prefix = `${estadoId}_`;
  const entries = fs.readdirSync(MGS_ESTADOS);
  const match = entries.find((e) => e.startsWith(prefix));
  if (!match) return null;
  const fullPath = path.join(MGS_ESTADOS, match);
  return fs.statSync(fullPath).isDirectory() ? fullPath : null;
}

// Simplification thresholds (area in square degrees, smaller = more simplified)
const SIMPLIFY_THRESHOLD: Record<string, number> = {
  entidades:    1e-9,
  municipios:   5e-11,
  distritos_fed: 5e-11,
  distritos_loc: 5e-11,
  secciones:    1e-11,
  ageb_urbana:  1e-11,
};

// Column mapping: source SHP column (uppercase) → target output column name
// Source names are the same in both national (uppercase) and per-state (lowercase,
// normalized to uppercase) SHP files.
interface ColMap { src: string; dest: string; pad?: number }
const COLUMN_MAP: Record<string, ColMap[]> = {
  entidades:    [
    { src: "ENTIDAD", dest: "CVE_ENT", pad: 2 },
    { src: "NOMBRE",  dest: "NOMBRE_ENT" },
  ],
  municipios:   [
    { src: "ENTIDAD",   dest: "CVE_ENT", pad: 2 },
    { src: "MUNICIPIO", dest: "CVE_MUN", pad: 3 },
    { src: "NOMBRE",    dest: "NOMGEO" },
  ],
  distritos_fed: [
    { src: "ENTIDAD",    dest: "CVE_ENT", pad: 2 },
    { src: "DISTRITO_F", dest: "DISTRITO_FED", pad: 3 },
  ],
  distritos_loc: [
    { src: "ENTIDAD",    dest: "CVE_ENT", pad: 2 },
    { src: "DISTRITO_L", dest: "DISTRITO_LOC", pad: 3 },
  ],
  secciones: [
    { src: "ENTIDAD",    dest: "CVE_ENT",     pad: 2 },
    { src: "MUNICIPIO",  dest: "CVE_MUN",     pad: 3 },
    { src: "SECCION",    dest: "CVE_SECCION", pad: 4 },
    { src: "DISTRITO_F", dest: "DISTRITO_FED", pad: 3 },
    { src: "DISTRITO_L", dest: "DISTRITO_LOC", pad: 3 },
  ],
  // INEGI Marco Geoestadístico 2025 — AGEB urbana ({id}a.shp)
  ageb_urbana: [
    { src: "CVE_ENT",  dest: "CVE_ENT",  pad: 2 },
    { src: "CVE_MUN",  dest: "CVE_MUN",  pad: 3 },
    { src: "CVE_LOC",  dest: "CVE_LOC",  pad: 4 },
    { src: "CVE_AGEB", dest: "CVE_AGEB", pad: 4 },
    { src: "CVEGEO",   dest: "CVEGEO" },
  ],
};

// SHP layer name inside each directory
const LAYER_FILE: Record<string, string> = {
  entidades:    "ENTIDAD",
  municipios:   "MUNICIPIO",
  distritos_fed: "DISTRITO_FEDERAL",
  distritos_loc: "DISTRITO_LOCAL",
  secciones:    "SECCION",
};

// All state IDs
const ALL_ESTADO_IDS = Array.from({ length: 32 }, (_, i) =>
  String(i + 1).padStart(2, "0")
);

// ─────────────────────────────────────────────────────────────────────────────
// Projection
// ─────────────────────────────────────────────────────────────────────────────

const WGS84 = "WGS84";

/**
 * Reads the .prj file and returns a proj4 converter function from that CRS
 * to WGS84 geographic coordinates [lng, lat].
 */
function buildReprojector(prjPath: string): (coord: number[]) => number[] {
  if (!fs.existsSync(prjPath)) {
    // Assume WGS84 already
    return (c) => c;
  }
  const wkt = fs.readFileSync(prjPath, "utf-8").trim();
  // If it's already a geographic CRS (no PROJCS), coordinates are already lon/lat
  if (!wkt.startsWith("PROJCS")) {
    return (c) => c;
  }
  const converter = proj4(wkt, WGS84);
  return ([x, y]: number[]) => converter.forward([x, y]);
}

/**
 * Reprojects a GeoJSON geometry's coordinates from src CRS to WGS84.
 * Modifies the geometry in-place for performance.
 */
function reprojectGeometry(
  geometry: GeoJSONGeometry,
  reproject: (c: number[]) => number[]
): void {
  if (!geometry) return;
  switch (geometry.type) {
    case "Point":
      geometry.coordinates = reproject(geometry.coordinates as number[]);
      break;
    case "MultiPoint":
    case "LineString":
      geometry.coordinates = (geometry.coordinates as number[][]).map(reproject);
      break;
    case "MultiLineString":
    case "Polygon":
      geometry.coordinates = (geometry.coordinates as number[][][]).map(
        (ring) => ring.map(reproject)
      );
      break;
    case "MultiPolygon":
      geometry.coordinates = (geometry.coordinates as number[][][][]).map(
        (poly) => poly.map((ring) => ring.map(reproject))
      );
      break;
  }
}

interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHP reading
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}
interface Feature {
  type: "Feature";
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
}

/**
 * Reads all features from a SHP file, reprojects to WGS84, and maps
 * SHP column names to standardized output property names.
 */
async function readShp(
  shpPath: string,
  layer: string,
  filterFn?: (rawProps: Record<string, unknown>) => boolean
): Promise<FeatureCollection> {
  const prjPath = shpPath.replace(/\.shp$/i, ".prj");
  const reproject = buildReprojector(prjPath);
  const colMap = COLUMN_MAP[layer];

  const features: Feature[] = [];
  const source = await shapefile.open(shpPath);

  while (true) {
    const result = await source.read();
    if (result.done) break;

    const raw = result.value as Feature;
    if (!raw || !raw.geometry) continue;

    // Normalize source property keys to uppercase
    const rawProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw.properties ?? {})) {
      rawProps[k.toUpperCase()] = v;
    }

    if (filterFn && !filterFn(rawProps)) continue;

    // Map source columns to standardized output names
    const props: Record<string, string> = {};
    for (const { src, dest, pad } of colMap) {
      const val = rawProps[src];
      if (val !== undefined && val !== null) {
        const str = String(val).trim();
        props[dest] = pad ? str.padStart(pad, "0") : str;
      }
    }

    // Reproject geometry in-place
    reprojectGeometry(raw.geometry, reproject);

    features.push({ type: "Feature", geometry: raw.geometry, properties: props });
  }

  return { type: "FeatureCollection", features };
}

// ─────────────────────────────────────────────────────────────────────────────
// TopoJSON conversion + simplification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a GeoJSON FeatureCollection to a simplified TopoJSON Buffer.
 *
 * IMPORTANT: presimplify marks arc endpoints with z=Infinity. JSON.stringify
 * serializes Infinity as null, which corrupts the arc data and causes
 * topojson-client to produce null coordinates. We strip z values before
 * serializing so arcs contain only clean [x, y] pairs.
 */
function toTopoJSON(
  geojson: FeatureCollection,
  layerName: string,
  threshold: number
): Buffer {
  const topo = topojson.topology({ [layerName]: geojson });
  topojsonSimplify.presimplify(topo);
  topojsonSimplify.simplify(topo, threshold);
  // Strip z weights: JSON.stringify turns Infinity → null, corrupting arc endpoints.
  for (const arc of topo.arcs as number[][][]) {
    for (let i = 0; i < arc.length; i++) {
      if (arc[i].length > 2) arc[i] = [arc[i][0], arc[i][1]];
    }
  }
  return Buffer.from(JSON.stringify(topo), "utf-8");
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

async function uploadBuffer(app: App, storagePath: string, buf: Buffer): Promise<void> {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET);
  const file = bucket.file(storagePath);
  await file.save(buf, {
    contentType: "application/json",
    metadata: { cacheControl: "public, max-age=86400" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-layer processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a national-level layer (entidades, municipios, distritos_fed,
 * distritos_loc). Reads from MGS_NACIONAL directory.
 */
async function processNacionalLayer(
  layer: string,
  dryRun: boolean,
  app: App | null
): Promise<void> {
  const fileName = LAYER_FILE[layer];
  const shpPath = path.join(MGS_NACIONAL, `${fileName}.shp`);

  if (!fs.existsSync(shpPath)) {
    throw new Error(`SHP not found: ${shpPath}`);
  }

  process.stdout.write(`Reading ${shpPath}…\n`);
  const geojson = await readShp(shpPath, layer);
  process.stdout.write(`  → ${geojson.features.length} features\n`);

  const buf = toTopoJSON(geojson, layer, SIMPLIFY_THRESHOLD[layer]);
  const sizeMB = (buf.length / 1e6).toFixed(2);
  process.stdout.write(`  → TopoJSON: ${sizeMB} MB\n`);

  const storagePath = `${STORAGE_PREFIX_INE}/nacional/${layer}.topojson`;

  if (dryRun) {
    const outPath = path.join(os.tmpdir(), `geo_${layer}.topojson`);
    fs.writeFileSync(outPath, buf);
    process.stdout.write(`  [dry-run] Written to ${outPath}\n`);
  } else {
    process.stdout.write(`  ↑ Uploading to ${storagePath}…\n`);
    await uploadBuffer(app!, storagePath, buf);
    process.stdout.write(`  ✓ Done\n`);
  }
}

/**
 * Builds a CVE_MUN → NOMGEO lookup from the MUNICIPIO.shp of a state directory,
 * falling back to the national MUNICIPIO.shp filtered by estado when unavailable.
 */
async function buildMunNombreMap(
  estadoId: string,
  estadoDir: string | null
): Promise<Map<string, string>> {
  const perState = estadoDir ? path.join(estadoDir, "MUNICIPIO.shp") : null;
  const shpPath = perState && fs.existsSync(perState)
    ? perState
    : path.join(MGS_NACIONAL, "MUNICIPIO.shp");

  const filterFn = (props: Record<string, unknown>) =>
    String(props["ENTIDAD"] ?? "").padStart(2, "0") === estadoId;

  const fc = await readShp(shpPath, "municipios", filterFn);
  const map = new Map<string, string>();
  for (const f of fc.features) {
    const cve = String(f.properties["CVE_MUN"] ?? "").padStart(3, "0");
    const nom = String(f.properties["NOMGEO"] ?? "");
    if (cve && nom) map.set(cve, nom);
  }
  return map;
}

/**
 * Processes secciones for a single estado using its own per-state SHP file.
 * Enriches each sección with NOMGEO (municipality name) from the MUNICIPIO.shp.
 */
async function processEstadoSecciones(
  estadoId: string,
  dryRun: boolean,
  app: App | null
): Promise<void> {
  const estadoDir = findEstadoDir(estadoId);
  if (!estadoDir) {
    throw new Error(`No per-state directory found for estado ${estadoId} in ${MGS_ESTADOS}`);
  }
  const shpPath = path.join(estadoDir, "SECCION.shp");
  if (!fs.existsSync(shpPath)) {
    throw new Error(`SHP not found: ${shpPath}`);
  }

  process.stdout.write(`Estado ${estadoId}: reading ${shpPath}…\n`);
  const geojson = await readShp(shpPath, "secciones");
  process.stdout.write(`  → ${geojson.features.length} secciones\n`);

  // Enrich secciones with municipality name
  const munNombres = await buildMunNombreMap(estadoId, estadoDir);
  for (const f of geojson.features) {
    const cve = String(f.properties["CVE_MUN"] ?? "").padStart(3, "0");
    const nom = munNombres.get(cve);
    if (nom) f.properties["NOMGEO"] = nom;
  }

  if (geojson.features.length === 0) {
    process.stdout.write(`  [skip] No features found for estado ${estadoId}\n`);
    return;
  }

  const buf = toTopoJSON(geojson, "secciones", SIMPLIFY_THRESHOLD["secciones"]);
  const sizeMB = (buf.length / 1e6).toFixed(2);
  process.stdout.write(`  → TopoJSON: ${sizeMB} MB\n`);

  const storagePath = `${STORAGE_PREFIX_INE}/estados/${estadoId}/secciones.topojson`;

  if (dryRun) {
    const outPath = path.join(os.tmpdir(), `geo_secciones_${estadoId}.topojson`);
    fs.writeFileSync(outPath, buf);
    process.stdout.write(`  [dry-run] Written to ${outPath}\n`);
  } else {
    process.stdout.write(`  ↑ Uploading to ${storagePath}…\n`);
    await uploadBuffer(app!, storagePath, buf);
    process.stdout.write(`  ✓ Done\n`);
  }
}

/**
 * Processes municipios, distritos_fed, and distritos_loc for a single estado
 * using its per-state SHP file when available, falling back to the national SHP.
 */
async function processEstadoLayer(
  layer: string,
  estadoId: string,
  dryRun: boolean,
  app: App | null
): Promise<void> {
  // Prefer per-state SHP; fall back to national if the layer isn't in that directory
  const estadoDir = findEstadoDir(estadoId);
  const perStateCandidate = estadoDir
    ? path.join(estadoDir, `${LAYER_FILE[layer]}.shp`)
    : null;

  const shpPath =
    perStateCandidate && fs.existsSync(perStateCandidate)
      ? perStateCandidate
      : path.join(MGS_NACIONAL, `${LAYER_FILE[layer]}.shp`);

  const filterFn = (props: Record<string, unknown>) =>
    String(props["ENTIDAD"] ?? "").padStart(2, "0") === estadoId;

  process.stdout.write(`Estado ${estadoId} / ${layer}: reading…\n`);
  const geojson = await readShp(shpPath, layer, filterFn);
  process.stdout.write(`  → ${geojson.features.length} features\n`);

  if (geojson.features.length === 0) {
    process.stdout.write(`  [skip] No features for estado ${estadoId} layer ${layer}\n`);
    return;
  }

  const buf = toTopoJSON(geojson, layer, SIMPLIFY_THRESHOLD[layer]);
  const sizeMB = (buf.length / 1e6).toFixed(2);
  process.stdout.write(`  → TopoJSON: ${sizeMB} MB\n`);

  const storagePath = `${STORAGE_PREFIX_INE}/estados/${estadoId}/${layer}.topojson`;

  if (dryRun) {
    const outPath = path.join(os.tmpdir(), `geo_${layer}_${estadoId}.topojson`);
    fs.writeFileSync(outPath, buf);
    process.stdout.write(`  [dry-run] Written to ${outPath}\n`);
  } else {
    process.stdout.write(`  ↑ Uploading to ${storagePath}…\n`);
    await uploadBuffer(app!, storagePath, buf);
    process.stdout.write(`  ✓ Done\n`);
  }
}

/**
 * Reads the national SECCION.shp a single time and splits features by
 * CVE_ENT, generating one TopoJSON per estado. Used for states 10-32 which
 * don't have their own SHP files.
 */
async function processSeccionesNacionalBatch(
  estadoIds: string[],
  dryRun: boolean,
  app: App | null
): Promise<void> {
  const shpPath = path.join(MGS_NACIONAL, "SECCION.shp");
  if (!fs.existsSync(shpPath)) {
    throw new Error(`SHP not found: ${shpPath}`);
  }

  process.stdout.write(`Batch: reading ${shpPath} for estados ${estadoIds.join(", ")}…\n`);

  const prjPath = shpPath.replace(/\.shp$/i, ".prj");
  const reproject = buildReprojector(prjPath);
  const colMap = COLUMN_MAP["secciones"];

  // Accumulate features per estado
  const byEstado = new Map<string, Feature[]>();
  for (const id of estadoIds) byEstado.set(id, []);

  const source = await shapefile.open(shpPath);
  let total = 0;

  while (true) {
    const result = await source.read();
    if (result.done) break;

    const raw = result.value as Feature;
    if (!raw || !raw.geometry) continue;

    const rawProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw.properties ?? {})) {
      rawProps[k.toUpperCase()] = v;
    }

    const cve = String(rawProps["ENTIDAD"] ?? "").padStart(2, "0");
    if (!byEstado.has(cve)) continue; // skip estados not requested

    const props: Record<string, string> = {};
    for (const { src, dest, pad } of colMap) {
      const val = rawProps[src];
      if (val !== undefined && val !== null) {
        const str = String(val).trim();
        props[dest] = pad ? str.padStart(pad, "0") : str;
      }
    }

    reprojectGeometry(raw.geometry, reproject);
    byEstado.get(cve)!.push({ type: "Feature", geometry: raw.geometry, properties: props });
    total++;
  }

  process.stdout.write(`  → ${total} total features read\n`);

  for (const id of estadoIds) {
    const features = byEstado.get(id)!;
    if (features.length === 0) {
      process.stdout.write(`  [skip] Estado ${id}: no features\n`);
      continue;
    }

    const fc: FeatureCollection = { type: "FeatureCollection", features };
    const buf = toTopoJSON(fc, "secciones", SIMPLIFY_THRESHOLD["secciones"]);
    const sizeMB = (buf.length / 1e6).toFixed(2);
    const storagePath = `${STORAGE_PREFIX_INE}/estados/${id}/secciones.topojson`;

    process.stdout.write(`  Estado ${id}: ${features.length} secciones → ${sizeMB} MB\n`);

    if (dryRun) {
      const outPath = path.join(os.tmpdir(), `geo_secciones_${id}.topojson`);
      fs.writeFileSync(outPath, buf);
      process.stdout.write(`    [dry-run] Written to ${outPath}\n`);
    } else {
      process.stdout.write(`    ↑ Uploading to ${storagePath}…\n`);
      await uploadBuffer(app!, storagePath, buf);
      process.stdout.write(`    ✓ Done\n`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INEGI processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds the per-state directory in MG_INEGI_ESTADOS by matching the numeric
 * prefix (e.g. "09" matches "09_ciudaddemexico"). Returns null if not found.
 */
function findInegEstadoDir(estadoId: string): string | null {
  const prefix = `${estadoId}_`;
  const entries = fs.readdirSync(MG_INEGI_ESTADOS);
  const match = entries.find((e) => e.startsWith(prefix));
  if (!match) return null;
  const fullPath = path.join(MG_INEGI_ESTADOS, match);
  return fs.statSync(fullPath).isDirectory() ? fullPath : null;
}

/**
 * Processes AGEB urbana for a single estado from the INEGI Marco Geoestadístico
 * 2025. Reads {id}a.shp from conjunto_de_datos/, reprojects to WGS84, and
 * uploads to sefix/geo/inegi/estados/{id}/ageb_urbana.topojson.
 */
async function processInegEstadoAgebUrbana(
  estadoId: string,
  dryRun: boolean,
  app: App | null
): Promise<void> {
  const estadoDir = findInegEstadoDir(estadoId);
  if (!estadoDir) {
    throw new Error(`No INEGI directory found for estado ${estadoId} in ${MG_INEGI_ESTADOS}`);
  }

  const shpPath = path.join(estadoDir, "conjunto_de_datos", `${estadoId}a.shp`);
  if (!fs.existsSync(shpPath)) {
    throw new Error(`AGEB urbana SHP not found: ${shpPath}`);
  }

  process.stdout.write(`Estado ${estadoId}: reading ${shpPath}…\n`);
  const geojson = await readShp(shpPath, "ageb_urbana");
  process.stdout.write(`  → ${geojson.features.length} AGEB urbanas\n`);

  if (geojson.features.length === 0) {
    process.stdout.write(`  [skip] No features found for estado ${estadoId}\n`);
    return;
  }

  const buf = toTopoJSON(geojson, "ageb_urbana", SIMPLIFY_THRESHOLD["ageb_urbana"]);
  const sizeMB = (buf.length / 1e6).toFixed(2);
  process.stdout.write(`  → TopoJSON: ${sizeMB} MB\n`);

  const storagePath = `${STORAGE_PREFIX_INEGI}/estados/${estadoId}/ageb_urbana.topojson`;

  if (dryRun) {
    const outPath = path.join(os.tmpdir(), `geo_ageb_urbana_${estadoId}.topojson`);
    fs.writeFileSync(outPath, buf);
    process.stdout.write(`  [dry-run] Written to ${outPath}\n`);
  } else {
    process.stdout.write(`  ↑ Uploading to ${storagePath}…\n`);
    await uploadBuffer(app!, storagePath, buf);
    process.stdout.write(`  ✓ Done\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const upload = args.includes("--upload");
  const allEstados = args.includes("--all-estados");

  const layerIdx = args.indexOf("--layer");
  const layer = layerIdx >= 0 ? args[layerIdx + 1] : null;

  const estadoIdx = args.indexOf("--estado");
  const estadoArg = estadoIdx >= 0 ? args[estadoIdx + 1]?.padStart(2, "0") : null;

  const inegiLayers = ["ageb_urbana"];

  if (!layer) {
    process.stderr.write(
      "Usage: npx tsx scripts/geo-pipeline.ts --layer <layer> [--estado <id>] [--all-estados] [--upload] [--dry-run]\n" +
      "INE layers:   entidades, municipios, distritos_fed, distritos_loc, secciones\n" +
      "INEGI layers: ageb_urbana\n"
    );
    process.exit(1);
  }

  if (!dryRun && !upload) {
    process.stderr.write("Specify --upload to write to Firebase Storage, or --dry-run to test locally.\n");
    process.exit(1);
  }

  const app = (!dryRun && upload) ? initFirebase() : null;

  // INEGI per-state layers
  if (inegiLayers.includes(layer)) {
    const estados = allEstados ? ALL_ESTADO_IDS : estadoArg ? [estadoArg] : [];
    if (estados.length === 0) {
      process.stderr.write("Specify --estado <id> or --all-estados for INEGI layers.\n");
      process.exit(1);
    }
    if (layer === "ageb_urbana") {
      for (const id of estados) {
        await processInegEstadoAgebUrbana(id, dryRun, app);
      }
    }
    return;
  }

  const nationalLayers = ["entidades", "municipios", "distritos_fed", "distritos_loc"];

  if (nationalLayers.includes(layer) && !estadoArg && !allEstados) {
    // Process as a single national file
    await processNacionalLayer(layer, dryRun, app);
    return;
  }

  if (layer === "secciones" || estadoArg || allEstados) {
    const estados = allEstados ? ALL_ESTADO_IDS : estadoArg ? [estadoArg] : [];

    if (estados.length === 0) {
      process.stderr.write("Specify --estado <id> or --all-estados for per-state processing.\n");
      process.exit(1);
    }

    if (layer === "secciones") {
      for (const id of estados) {
        await processEstadoSecciones(id, dryRun, app);
      }
    } else {
      for (const id of estados) {
        await processEstadoLayer(layer, id, dryRun, app);
      }
    }
    return;
  }

  process.stderr.write(`Unknown combination of arguments.\n`);
  process.exit(1);
}

main().catch((e: Error) => {
  process.stderr.write(`Error: ${e.message}\n${e.stack ?? ""}\n`);
  process.exit(1);
});
