#!/usr/bin/env npx tsx
/**
 * scripts/pregenerate-semanal.ts
 *
 * Offline script: uploads pre-processed semanal files to Firebase Storage.
 *
 * Usage:
 *   npx tsx scripts/pregenerate-semanal.ts --upload-raw      # upload raw semanal CSVs to semanal/
 *   npx tsx scripts/pregenerate-semanal.ts --update-series  # append new date row to data/series files
 *   npx tsx scripts/pregenerate-semanal.ts --series         # upload series CSVs to semanal_series/
 *   npx tsx scripts/pregenerate-semanal.ts --geo            # build + upload geo.json
 *   npx tsx scripts/pregenerate-semanal.ts --agg            # build + upload aggregate JSONs per state
 *   npx tsx scripts/pregenerate-semanal.ts --entity-series  # build + upload entity time-series JSONs
 *   npx tsx scripts/pregenerate-semanal.ts --section-series # build + upload section-level series JSONs
 *   npx tsx scripts/pregenerate-semanal.ts --all            # all seven actions
 *
 * Input files (local):
 *   data/series/serie_{nacional|extranjero}_{edad|sexo|origen}.csv  → pre-aggregated weekly series
 *   data/pdln/semanal/derfe_pdln_{YYYYMMDD}_{edad|sexo|origen}.csv  → raw section-level semanal data
 *
 * Output in Firebase Storage:
 *   sefix/pdln/semanal_series/{filename}.csv         → series CSVs (consumed by serie-semanal route)
 *   sefix/pdln/semanal_geo/geo.json                  → geo hierarchy (fast cascade)
 *   sefix/pdln/semanal_agg/{tipo}.json               → per-state aggregates (fast corte-único queries)
 *   sefix/pdln/semanal_agg/serie_entidades_{tipo}.json → entity time-series
 *   sefix/pdln/semanal_agg/secciones_{ENTIDAD}_{tipo}.json → section-level series per entity
 *
 * CSV structure note:
 *   DERFE semanal CSVs include a final row with nombre_entidad="TOTALES" and cve_entidad="".
 *   All build functions skip it via the !cveEnt guard. Rows with seccion="" or seccion="0"
 *   belong to RESIDENTES EXTRANJERO districts and are handled via the isExt flag.
 */

import fs from "fs";
import path from "path";
import { createInterface } from "readline";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const SERIES_DIR   = path.resolve(__dirname, "../data/series");
const SEMANAL_DIR  = path.resolve(__dirname, "../data/pdln/semanal");
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;

const SERIES_PREFIX = "sefix/pdln/semanal_series";
const GEO_PATH      = "sefix/pdln/semanal_geo/geo.json";
const AGG_PREFIX    = "sefix/pdln/semanal_agg";

const CSV_ENTIDAD_NORMALIZER: Record<string, string> = {
  "COAHUILA DE ZARAGOZA":             "COAHUILA",
  "MICHOACAN DE OCAMPO":              "MICHOACAN",
  "VERACRUZ DE IGNACIO DE LA LLAVE":  "VERACRUZ",
  "MEXICO":                           "ESTADO DE MEXICO",
};

function normalizeEntidadName(raw: string): string {
  const key = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return CSV_ENTIDAD_NORMALIZER[key] ?? key;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface GeoDistrito {
  cve: string;
  nombre: string;
}

interface StateGeoData {
  distritos: GeoDistrito[];
  municipios: Record<string, GeoDistrito[]>;
  secciones:  Record<string, string[]>;
}

type SemanalGeo = Record<string, StateGeoData>;

interface AmbRadix {
  nacional:   Record<string, number>;
  extranjero: Record<string, number>;
}

interface AggOutput {
  fecha:       string;
  nacional:    Record<string, number>;
  extranjero:  Record<string, number>;
  por_entidad: Record<string, AmbRadix>;
}

// ─────────────────────────────────────────────
// Firebase Admin
// ─────────────────────────────────────────────

function initFirebase(): App {
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env"
    );
  }
  if (!STORAGE_BUCKET) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env");
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

// ─────────────────────────────────────────────
// CSV helpers
// ─────────────────────────────────────────────

async function streamLocal(
  filePath: string,
  onRow: (row: Record<string, string>, headers: string[]) => void
): Promise<string[]> {
  const stream = fs.createReadStream(filePath);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] = [];
  let isFirst = true;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isFirst) {
      headers = trimmed.split(",").map((h) => {
        const t = h.trim();
        return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
      });
      isFirst = false;
      continue;
    }
    const values = trimmed.split(",");
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const raw = (values[i] ?? "").trim();
      // Strip RFC 4180 quoting: "" → empty string, "value" → value
      row[headers[i]] = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    }
    onRow(row, headers);
  }

  return headers;
}

function latestFile(dir: string, suffix: string): string | null {
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort();
  return files.length > 0 ? path.join(dir, files[files.length - 1]) : null;
}

function fechaFromFilename(filename: string): string {
  const match = path.basename(filename).match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

// ─────────────────────────────────────────────
// Step 1: Upload series CSVs
// ─────────────────────────────────────────────

async function uploadSeriesFiles(app: App): Promise<void> {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET);

  const files = fs.readdirSync(SERIES_DIR).filter((f) => f.endsWith(".csv"));
  if (files.length === 0) {
    console.warn("  [series] No CSV files found in", SERIES_DIR);
    return;
  }

  for (const filename of files) {
    const localPath   = path.join(SERIES_DIR, filename);
    const storagePath = `${SERIES_PREFIX}/${filename}`;
    console.log(`  Uploading ${filename} → ${storagePath}`);
    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: { contentType: "text/csv" },
    });
  }
  console.log(`  ✓ Uploaded ${files.length} series CSVs`);
}

// ─────────────────────────────────────────────
// Step 2: Build and upload geo.json
// ─────────────────────────────────────────────

async function buildAndUploadGeo(app: App): Promise<void> {
  const sexoFile = latestFile(SEMANAL_DIR, "_sexo.csv");
  if (!sexoFile) throw new Error("No _sexo.csv found in " + SEMANAL_DIR);

  console.log(`  Reading geo from: ${path.basename(sexoFile)}`);

  const geo: SemanalGeo = {};
  let rowCount = 0;

  await streamLocal(sexoFile, (row) => {
    const nombreRaw = row.nombre_entidad?.trim();
    const cveEnt    = row.cve_entidad?.trim();
    const cveDist   = row.cve_distrito?.trim();
    const nombreDist = row.cabecera_distrital?.trim();
    const cveMun    = row.cve_municipio?.trim();
    const nombreMun = row.nombre_municipio?.trim();
    const seccion   = row.seccion?.trim();

    // Skip TOTALES row (cve_entidad empty) and invalid rows
    if (!nombreRaw || nombreRaw === "NA" || !cveEnt || cveEnt === "NA") return;
    // Skip rows without valid section (includes RESIDENTES EXTRANJERO aggregate rows)
    if (!seccion || seccion === "NA" || seccion === "0" || seccion === "00") return;
    // Skip extranjero districts
    if (nombreDist?.toUpperCase().includes("RESIDENTES EXTRANJERO")) return;
    if (!cveDist || !nombreDist || !cveMun || !nombreMun) return;

    const nombre = normalizeEntidadName(nombreRaw);

    if (!geo[nombre]) geo[nombre] = { distritos: [], municipios: {}, secciones: {} };
    const ent = geo[nombre];

    if (!ent.municipios[cveDist]) {
      ent.distritos.push({ cve: cveDist, nombre: nombreDist });
      ent.municipios[cveDist] = [];
    }

    if (!ent.secciones[cveMun]) {
      ent.municipios[cveDist].push({ cve: cveMun, nombre: nombreMun });
      ent.secciones[cveMun] = [];
    }

    if (!ent.secciones[cveMun].includes(seccion)) {
      ent.secciones[cveMun].push(seccion);
    }

    rowCount++;
  });

  for (const ent of Object.values(geo)) {
    ent.distritos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    for (const muns of Object.values(ent.municipios)) {
      muns.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    for (const secs of Object.values(ent.secciones)) {
      secs.sort((a, b) => parseInt(a) - parseInt(b));
    }
  }

  const json = JSON.stringify(geo);
  await getStorage(app).bucket(STORAGE_BUCKET).file(GEO_PATH)
    .save(json, { metadata: { contentType: "application/json" } });

  console.log(`  ✓ geo.json → ${GEO_PATH} (${Object.keys(geo).length} estados, ${rowCount.toLocaleString()} rows, ${Math.round(json.length / 1024)} KB)`);
}

// ─────────────────────────────────────────────
// Step 3: Build and upload aggregate JSONs
// ─────────────────────────────────────────────

const TIPOS = ["edad", "sexo", "origen"] as const;
type Tipo = typeof TIPOS[number];

const SKIP_COLS = new Set([
  "cve_entidad", "cve_distrito", "cve_municipio", "seccion",
  "nombre_entidad", "cabecera_distrital", "nombre_municipio",
]);

async function buildAndUploadAgg(app: App): Promise<void> {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET);

  for (const tipo of TIPOS) {
    const csvFile = latestFile(SEMANAL_DIR, `_${tipo}.csv`);
    if (!csvFile) { console.warn(`  [agg] No _${tipo}.csv found, skipping`); continue; }

    const fecha = fechaFromFilename(csvFile);
    console.log(`  Reading ${tipo} agg from: ${path.basename(csvFile)} (fecha ${fecha})`);

    const output: AggOutput = { fecha, nacional: {}, extranjero: {}, por_entidad: {} };
    let rowCount = 0;

    await streamLocal(csvFile, (row) => {
      const nombreRaw = row.nombre_entidad?.trim();
      const cveEnt    = row.cve_entidad?.trim();
      // Skip TOTALES row (cve_entidad empty) and invalid rows
      if (!nombreRaw || nombreRaw === "NA" || !cveEnt || cveEnt === "NA") return;

      const nombre  = normalizeEntidadName(nombreRaw);
      // Detect extranjero rows via cabecera_distrital (section-level CSVs like edad/origen)
      // OR via nombre_entidad (state-level CSVs like sexo that lack cabecera_distrital).
      const isExt   =
        row.cabecera_distrital?.toUpperCase().includes("RESIDENTES EXTRANJERO") ||
        row.nombre_entidad?.toUpperCase().includes("RESIDENTES EXTRANJERO");

      if (!output.por_entidad[nombre]) {
        output.por_entidad[nombre] = { nacional: {}, extranjero: {} };
      }

      const globalTarget = isExt ? output.extranjero               : output.nacional;
      const entTarget    = isExt ? output.por_entidad[nombre].extranjero : output.por_entidad[nombre].nacional;

      for (const [col, val] of Object.entries(row)) {
        if (SKIP_COLS.has(col)) continue;
        const num = parseFloat(val);
        if (isNaN(num)) continue;
        globalTarget[col] = (globalTarget[col] ?? 0) + num;
        entTarget[col]    = (entTarget[col]    ?? 0) + num;
      }

      rowCount++;
    });

    const storagePath = `${AGG_PREFIX}/${tipo}.json`;
    const json = JSON.stringify(output);
    await bucket.file(storagePath).save(json, { metadata: { contentType: "application/json" } });

    console.log(`  ✓ ${tipo}.json → ${storagePath} (${Object.keys(output.por_entidad).length} entidades, ${rowCount.toLocaleString()} rows, ${Math.round(json.length / 1024)} KB)`);
  }
}

// ─────────────────────────────────────────────
// Step 4: Build and upload entity time-series JSONs
// ─────────────────────────────────────────────

const RANGOS_EDAD_KEYS = [
  "18", "19", "20_24", "25_29", "30_34", "35_39",
  "40_44", "45_49", "50_54", "55_59", "60_64", "65_y_mas",
];
const SEXOS = ["hombres", "mujeres", "no_binario"];

function deriveTotals(agg: Record<string, number>, tipo: Tipo): void {
  if (tipo === "edad") {
    let padronTotal = 0, listaTotal = 0;
    for (const r of RANGOS_EDAD_KEYS) {
      const pad = SEXOS.reduce((s, sx) => s + (agg[`padron_${r}_${sx}`] ?? 0), 0);
      const lst = SEXOS.reduce((s, sx) => s + (agg[`lista_${r}_${sx}`]  ?? 0), 0);
      if (pad > 0) { agg[`padron_${r}`] = pad; padronTotal += pad; }
      if (lst > 0) { agg[`lista_${r}`]  = lst; listaTotal  += lst; }
    }
    if (padronTotal > 0) agg["padron_total"] = padronTotal;
    if (listaTotal  > 0) agg["lista_total"]  = listaTotal;
  } else if (tipo === "sexo") {
    const padH  = agg["padron_hombres"]    ?? 0;
    const padM  = agg["padron_mujeres"]    ?? 0;
    const padNB = agg["padron_no_binario"] ?? 0;
    const lstH  = agg["lista_hombres"]     ?? 0;
    const lstM  = agg["lista_mujeres"]     ?? 0;
    const lstNB = agg["lista_no_binario"]  ?? 0;
    if (padH + padM + padNB > 0) agg["padron_total"] = padH + padM + padNB;
    if (lstH + lstM + lstNB > 0) agg["lista_total"]  = lstH + lstM + lstNB;
  } else {
    let padTotal = 0, lstTotal = 0;
    for (const [k, v] of Object.entries(agg)) {
      if (k.startsWith("pad_")) padTotal += v;
      if (k.startsWith("ln_"))  lstTotal += v;
    }
    if (padTotal > 0) agg["padron_total"] = padTotal;
    if (lstTotal > 0) agg["lista_total"]  = lstTotal;
  }
}

type EntitySeriesOutput = Record<
  string,
  { nacional: Record<string, number | string>[]; extranjero: Record<string, number | string>[] }
>;

async function buildAndUploadEntitySeries(app: App): Promise<void> {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET);

  for (const tipo of TIPOS) {
    const files = fs.readdirSync(SEMANAL_DIR)
      .filter((f) => f.endsWith(`_${tipo}.csv`))
      .sort();

    if (files.length === 0) { console.warn(`  [entity-series] No _${tipo}.csv files found, skipping`); continue; }

    console.log(`  [entity-series] ${tipo}: processing ${files.length} weekly files…`);

    const entitySeries: EntitySeriesOutput = {};

    for (const filename of files) {
      const filePath = path.join(SEMANAL_DIR, filename);
      const fecha    = fechaFromFilename(filename);
      if (!fecha) continue;

      const entAgg: Record<string, { nacional: Record<string, number>; extranjero: Record<string, number> }> = {};

      await streamLocal(filePath, (row) => {
        const nombreRaw = row.nombre_entidad?.trim();
        const cveEnt    = row.cve_entidad?.trim();
        // Skip TOTALES row (cve_entidad empty) and invalid rows
        if (!nombreRaw || nombreRaw === "NA" || !cveEnt || cveEnt === "NA") return;

        const nombre = normalizeEntidadName(nombreRaw);
        const isExt  = row.cabecera_distrital?.toUpperCase().includes("RESIDENTES EXTRANJERO");

        if (!entAgg[nombre]) entAgg[nombre] = { nacional: {}, extranjero: {} };
        const target = isExt ? entAgg[nombre].extranjero : entAgg[nombre].nacional;

        for (const [col, val] of Object.entries(row)) {
          if (SKIP_COLS.has(col)) continue;
          const num = parseFloat(val);
          if (isNaN(num)) continue;
          target[col] = (target[col] ?? 0) + num;
        }
      });

      for (const [nombre, ambs] of Object.entries(entAgg)) {
        if (!entitySeries[nombre]) entitySeries[nombre] = { nacional: [], extranjero: [] };
        for (const ambKey of ["nacional", "extranjero"] as const) {
          const agg = ambs[ambKey];
          if (Object.keys(agg).length === 0) continue;
          deriveTotals(agg, tipo);
          entitySeries[nombre][ambKey].push({ fecha, ...agg });
        }
      }
    }

    const storagePath = `${AGG_PREFIX}/serie_entidades_${tipo}.json`;
    const json = JSON.stringify(entitySeries);
    await bucket.file(storagePath).save(json, { metadata: { contentType: "application/json" } });

    console.log(`  ✓ serie_entidades_${tipo}.json → ${storagePath} (${Object.keys(entitySeries).length} entidades, ${files.length} fechas, ${Math.round(json.length / 1024)} KB)`);
  }
}

// ─────────────────────────────────────────────
// Step 5: Build and upload section-level series JSONs (per entity)
//
// Memory strategy: process ONE entity at a time. Peak memory bounded to
// ~200MB for the largest state (Estado de México, ~16K sections).
//
// Note: for tipo="edad", derived columns (padron_18, lista_18, etc.) are
// computed by summing sex breakdown per row. Raw sex×age columns are NOT
// stored to keep file sizes manageable (~3× smaller). This means section
// snapshots for "edad" contain per-range totals only, not sex×age breakdown.
// ─────────────────────────────────────────────

function computeDerivedSemanalRow(
  row: Record<string, string>,
  tipo: Tipo
): Record<string, number> {
  const result: Record<string, number> = {};

  if (tipo === "edad") {
    let padronTotal = 0, listaTotal = 0;
    for (const r of RANGOS_EDAD_KEYS) {
      let pad = 0, lst = 0;
      for (const sx of SEXOS) {
        // Alias: CSV may use "nobinario" instead of "no_binario"
        const csvSx = (sx === "no_binario" && row[`padron_${r}_${sx}`] === undefined)
          ? "nobinario" : sx;
        const pv = parseFloat(row[`padron_${r}_${csvSx}`] ?? "0");
        const lv = parseFloat(row[`lista_${r}_${csvSx}`]  ?? "0");
        if (!isNaN(pv)) pad += pv;
        if (!isNaN(lv)) lst += lv;
        // Always store under canonical key (sx), so "no_binario" is consistent
        if (!isNaN(pv) && pv > 0) result[`padron_${r}_${sx}`] = pv;
        if (!isNaN(lv) && lv > 0) result[`lista_${r}_${sx}`]  = lv;
      }
      if (pad > 0) { result[`padron_${r}`] = pad; padronTotal += pad; }
      if (lst > 0) { result[`lista_${r}`]  = lst; listaTotal  += lst; }
    }
    if (padronTotal > 0) result["padron_total"] = padronTotal;
    if (listaTotal  > 0) result["lista_total"]  = listaTotal;

  } else if (tipo === "sexo") {
    for (const sx of ["hombres", "mujeres", "no_binario"]) {
      const pad = parseFloat(row[`padron_${sx}`] ?? "0") || 0;
      const lst = parseFloat(row[`lista_${sx}`]  ?? "0") || 0;
      if (pad > 0) result[`padron_${sx}`] = pad;
      if (lst > 0) result[`lista_${sx}`]  = lst;
    }
    const padTotal = (result["padron_hombres"] ?? 0) + (result["padron_mujeres"] ?? 0) + (result["padron_no_binario"] ?? 0);
    const lstTotal = (result["lista_hombres"]  ?? 0) + (result["lista_mujeres"]  ?? 0) + (result["lista_no_binario"]  ?? 0);
    if (padTotal > 0) result["padron_total"] = padTotal;
    if (lstTotal > 0) result["lista_total"]  = lstTotal;

  } else {
    for (const [col, val] of Object.entries(row)) {
      if (SKIP_COLS.has(col)) continue;
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) result[col] = num;
    }
    let padTotal = 0, lstTotal = 0;
    for (const [k, v] of Object.entries(result)) {
      if (k.startsWith("pad_")) padTotal += v;
      if (k.startsWith("ln_"))  lstTotal += v;
    }
    if (padTotal > 0) result["padron_total"] = padTotal;
    if (lstTotal > 0) result["lista_total"]  = lstTotal;
  }

  return result;
}

async function buildAndUploadSectionSeries(app: App): Promise<void> {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET);

  for (const tipo of TIPOS) {
    const files = fs.readdirSync(SEMANAL_DIR)
      .filter((f) => f.endsWith(`_${tipo}.csv`))
      .sort();

    if (files.length === 0) { console.warn(`  [section-series] No _${tipo}.csv found, skipping`); continue; }

    const fechas = files
      .map((f) => fechaFromFilename(path.join(SEMANAL_DIR, f)))
      .filter(Boolean);

    // Discover entities from the latest file
    const latestCsv = path.join(SEMANAL_DIR, files[files.length - 1]);
    const entidades: string[] = [];
    await streamLocal(latestCsv, (row) => {
      const nombreRaw = row.nombre_entidad?.trim();
      const cveEnt    = row.cve_entidad?.trim();
      if (!nombreRaw || nombreRaw === "NA" || !cveEnt || cveEnt === "NA") return;
      if (row.cabecera_distrital?.toUpperCase().includes("RESIDENTES EXTRANJERO")) return;
      const nombre = normalizeEntidadName(nombreRaw);
      if (!entidades.includes(nombre)) entidades.push(nombre);
    });

    console.log(`  [section-series] ${tipo}: ${files.length} files, ${fechas.length} fechas, ${entidades.length} entidades`);

    let uploaded = 0;
    for (const entidad of entidades) {
      type ColArrays = Record<string, (number | null)[]>;
      type SecEntry  = { cvd: string; cvm: string; cols: ColArrays };
      const secMap: Record<string, SecEntry> = {};

      for (let wi = 0; wi < files.length; wi++) {
        const filePath = path.join(SEMANAL_DIR, files[wi]);
        await streamLocal(filePath, (row) => {
          const nombreRaw = row.nombre_entidad?.trim();
          const cveEnt    = row.cve_entidad?.trim();
          if (!nombreRaw || nombreRaw === "NA" || !cveEnt || cveEnt === "NA") return;
          if (normalizeEntidadName(nombreRaw) !== entidad) return;
          if (row.cabecera_distrital?.toUpperCase().includes("RESIDENTES EXTRANJERO")) return;

          const seccion = row.seccion?.trim();
          const cvd     = row.cve_distrito?.trim();
          const cvm     = row.cve_municipio?.trim();
          if (!seccion || seccion === "NA" || seccion === "0" || seccion === "00" || !cvd || !cvm) return;

          if (!secMap[seccion]) secMap[seccion] = { cvd, cvm, cols: {} };
          const entry   = secMap[seccion];
          const derived = computeDerivedSemanalRow(row, tipo);

          for (const [col, val] of Object.entries(derived)) {
            if (!entry.cols[col]) {
              entry.cols[col] = new Array(files.length).fill(null) as (number | null)[];
            }
            entry.cols[col][wi] = ((entry.cols[col][wi] ?? 0) as number) + val;
          }
        });
      }

      const colSet = new Set<string>();
      for (const e of Object.values(secMap)) {
        for (const col of Object.keys(e.cols)) colSet.add(col);
      }

      const secciones = Object.entries(secMap).map(([s, entry]) => {
        const nacional: Record<string, (number | null)[]> = {};
        for (const col of colSet) {
          nacional[col] = entry.cols[col] ?? new Array(files.length).fill(null);
        }
        return { s, cvd: entry.cvd, cvm: entry.cvm, nacional };
      });

      const output      = { entidad, tipo, fechas, secciones };
      const storagePath = `${AGG_PREFIX}/secciones_${entidad}_${tipo}.json`;
      const json        = JSON.stringify(output);

      await bucket.file(storagePath).save(json, { metadata: { contentType: "application/json" } });
      uploaded++;
      process.stdout.write(
        `    [${uploaded}/${entidades.length}] ${entidad}: ${secciones.length} secciones, ${Math.round(json.length / 1024)} KB\n`
      );
    }

    console.log(`  ✓ [section-series] ${tipo}: ${uploaded} entidades`);
  }
}

// ─────────────────────────────────────────────
// Step 0a: Upload raw semanal CSVs to Storage
// ─────────────────────────────────────────────

async function uploadRawSemanalFiles(app: App): Promise<void> {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET);
  const files = fs.readdirSync(SEMANAL_DIR).filter((f) => f.endsWith(".csv")).sort();
  if (files.length === 0) {
    console.warn("  [upload-raw] No CSV files found in", SEMANAL_DIR);
    return;
  }
  for (const filename of files) {
    const localPath   = path.join(SEMANAL_DIR, filename);
    const storagePath = `sefix/pdln/semanal/${filename}`;
    console.log(`  Uploading ${filename} → ${storagePath}`);
    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: { contentType: "text/csv" },
    });
  }
  console.log(`  ✓ Uploaded ${files.length} raw semanal CSVs`);
}

// ─────────────────────────────────────────────
// Step 0b: Update data/series/ with the latest date row
// ─────────────────────────────────────────────

const SERIE_EDAD_COLS = [
  "18", "19", "20_24", "25_29", "30_34", "35_39",
  "40_44", "45_49", "50_54", "55_59", "60_64", "65_y_mas",
] as const;

function readSerieLastDate(serieFile: string): string {
  if (!fs.existsSync(serieFile)) return "";
  const content = fs.readFileSync(serieFile, "utf-8");
  const lines   = content.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return "";
  return lines[lines.length - 1].split(",")[0].trim();
}

async function updateSeriesFiles(): Promise<void> {
  // Build row builders — defined once, reused across all files
  const buildEdadRow = (agg: Record<string, number>): string => {
    const vals: number[] = [];
    let padTotal = 0;
    let lstTotal = 0;
    for (const r of SERIE_EDAD_COLS) {
      // Alias: CSV may use "nobinario" instead of "no_binario"
      const padNB = agg[`padron_${r}_no_binario`] ?? agg[`padron_${r}_nobinario`] ?? 0;
      const lstNB = agg[`lista_${r}_no_binario`]  ?? agg[`lista_${r}_nobinario`]  ?? 0;
      const pad   = (agg[`padron_${r}_hombres`] ?? 0) + (agg[`padron_${r}_mujeres`] ?? 0) + padNB;
      const lst   = (agg[`lista_${r}_hombres`]  ?? 0) + (agg[`lista_${r}_mujeres`]  ?? 0) + lstNB;
      vals.push(pad, lst);
      padTotal += pad;
      lstTotal += lst;
    }
    vals.push(padTotal, lstTotal);
    return vals.join(",");
  };

  const buildSexoRow = (agg: Record<string, number>): string => {
    const cols = [
      "padron_hombres", "padron_mujeres", "padron_no_binario",
      "lista_hombres",  "lista_mujeres",  "lista_no_binario",
    ];
    return cols.map((c) => agg[c] ?? 0).join(",");
  };

  const buildOrigenRow = (serieFile: string, agg: Record<string, number>): string => {
    // DERFE releases may rename columns (e.g. ln_cdmx → ln_distrito_federal).
    // Map known aliases so series columns always resolve to a value.
    const COL_ALIASES: Record<string, string> = {
      ln_cdmx:  "ln_distrito_federal",
      pad_cdmx: "pad_distrito_federal",
    };
    const lookup = (col: string): number =>
      agg[col] ?? agg[COL_ALIASES[col] ?? ""] ?? 0;
    const headers = fs.readFileSync(serieFile, "utf-8").split("\n")[0].split(",");
    return headers
      .slice(1) // skip "fecha"
      .map((col) => lookup(col.trim()))
      .join(",");
  };

  for (const tipo of TIPOS) {
    const files = fs.readdirSync(SEMANAL_DIR)
      .filter((f) => f.endsWith(`_${tipo}.csv`))
      .sort(); // alphabetical = chronological

    if (files.length === 0) { console.warn(`  [update-series] No _${tipo}.csv found, skipping`); continue; }

    const nacFile = path.join(SERIES_DIR, `serie_nacional_${tipo}.csv`);
    const extFile = path.join(SERIES_DIR, `serie_extranjero_${tipo}.csv`);

    // Collect all dates already present in both series files
    const existingDates = new Set<string>();
    for (const sf of [nacFile, extFile]) {
      if (!fs.existsSync(sf)) continue;
      const lines = fs.readFileSync(sf, "utf-8").trim().split(/\r?\n/).filter(Boolean).slice(1);
      for (const line of lines) {
        const d = line.split(",")[0].trim();
        if (d) existingDates.add(d);
      }
    }

    // Process every file in chronological order — skip already-present dates
    for (const filename of files) {
      const csvPath = path.join(SEMANAL_DIR, filename);
      const fecha   = fechaFromFilename(csvPath);
      if (!fecha) continue;

      if (existingDates.has(fecha)) {
        console.log(`  [update-series] ${tipo}: ${fecha} already present, skipping`);
        continue;
      }

      console.log(`  [update-series] ${tipo}: processing ${fecha} (${filename})`);

      const nacAgg: Record<string, number> = {};
      const extAgg: Record<string, number> = {};

      await streamLocal(csvPath, (row) => {
        const nombreRaw = row.nombre_entidad?.trim();
        const cveEnt    = row.cve_entidad?.trim();
        if (!nombreRaw || nombreRaw === "NA" || !cveEnt || cveEnt === "NA") return;

        const isExt = row.cabecera_distrital?.toUpperCase().includes("RESIDENTES EXTRANJERO");
        const target = isExt ? extAgg : nacAgg;

        for (const [col, val] of Object.entries(row)) {
          if (SKIP_COLS.has(col)) continue;
          const num = parseFloat(val);
          if (isNaN(num)) continue;
          target[col] = (target[col] ?? 0) + num;
        }
      });

      for (const [serieFile, agg] of [[nacFile, nacAgg], [extFile, extAgg]] as const) {
        let rowData: string;
        if (tipo === "edad") {
          rowData = buildEdadRow(agg);
        } else if (tipo === "sexo") {
          rowData = buildSexoRow(agg);
        } else {
          rowData = buildOrigenRow(serieFile, agg);
        }

        // Ensure exactly one newline between the existing last row and the new row.
        const existing = fs.readFileSync(serieFile, "utf-8");
        const sep = existing.endsWith("\n") ? "" : "\n";
        fs.appendFileSync(serieFile, `${sep}${fecha},${rowData}\n`, "utf-8");
        console.log(`    ✓ Appended ${fecha} to ${path.basename(serieFile)}`);
      }

      existingDates.add(fecha);
    }
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const doUploadRaw     = args.includes("--upload-raw")     || args.includes("--all");
  const doUpdateSeries  = args.includes("--update-series")  || args.includes("--all");
  const doSeries        = args.includes("--series")         || args.includes("--all");
  const doGeo           = args.includes("--geo")            || args.includes("--all");
  const doAgg           = args.includes("--agg")            || args.includes("--all");
  const doEntitySeries  = args.includes("--entity-series")  || args.includes("--all");
  const doSectionSeries = args.includes("--section-series") || args.includes("--all");

  if (!doUploadRaw && !doUpdateSeries && !doSeries && !doGeo && !doAgg && !doEntitySeries && !doSectionSeries) {
    console.error(
      "Usage: npx tsx scripts/pregenerate-semanal.ts [--upload-raw] [--update-series] [--series] [--geo] [--agg] [--entity-series] [--section-series] [--all]"
    );
    process.exit(1);
  }

  // --update-series reads local files only — Firebase not needed
  if (doUpdateSeries && !doUploadRaw && !doSeries && !doGeo && !doAgg && !doEntitySeries && !doSectionSeries) {
    console.log("[0b/7] Updating series files locally…");
    await updateSeriesFiles();
    console.log("\n✅ Done.");
    return;
  }

  console.log("Initializing Firebase…");
  const app = initFirebase();
  console.log(`✓ Firebase connected (bucket: ${STORAGE_BUCKET})\n`);

  if (doUpdateSeries) {
    console.log("[0b/7] Updating series files locally…");
    await updateSeriesFiles();
  }

  if (doUploadRaw) {
    console.log("\n[0a/7] Uploading raw semanal CSVs…");
    await uploadRawSemanalFiles(app);
  }

  if (doSeries) {
    console.log("\n[1/7] Uploading series CSVs…");
    await uploadSeriesFiles(app);
  }

  if (doGeo) {
    console.log("\n[2/7] Building geo.json…");
    await buildAndUploadGeo(app);
  }

  if (doAgg) {
    console.log("\n[3/7] Building aggregate JSONs…");
    await buildAndUploadAgg(app);
  }

  if (doEntitySeries) {
    console.log("\n[4/7] Building entity time-series JSONs…");
    await buildAndUploadEntitySeries(app);
  }

  if (doSectionSeries) {
    console.log("\n[5/7] Building section-level series JSONs…");
    await buildAndUploadSectionSeries(app);
  }

  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
