#!/usr/bin/env npx tsx
/**
 * scripts/fontana-iter-pipeline.ts
 *
 * Convierte los CSV de ITER 2020 (Censo de Población y Vivienda, INEGI)
 * → JSON precomputado por estado → Firebase Storage. Cubre F1-2
 * (pirámide de edades) y F1-11 (% urbana/rural) de Fontana Familia 1.
 *
 * Mecanismo de parseo y derivación urbano/rural ya verificado en vivo en
 * lib/dev/fontanaIterSandbox.ts (TAMLOC >= 5 = urbano, columnas
 * quinquenales P_0A4..P_85YMAS). Este script no repite esa exploración,
 * la productiviza para las 32 entidades.
 *
 * Precomputado completo (no bodega bajo demanda) — mismo criterio que
 * scripts/eceg-data-pipeline.ts: Fontana necesita poder resolver
 * cualquier territorio del país sin depender de qué proyecto exista hoy,
 * y ITER es descarga masiva por estado (no por unidad pequeña como el
 * Compendio municipal), así que precomputar no desperdicia trabajo.
 *
 * Run por estado:
 *   npx tsx scripts/fontana-iter-pipeline.ts --estado 01 [--upload|--dry-run]
 *
 * Run todas las entidades:
 *   npx tsx scripts/fontana-iter-pipeline.ts --all-estados [--upload|--dry-run]
 *
 * Salida en Firebase Storage:
 *   fontana/bodega/iter_2020/piramide/municipios/{NN}.json      → { "ENT+MUN": { POBTOT, P_0A4..P_85YMAS } }
 *   fontana/bodega/iter_2020/piramide/estatal.json              → { "ENT": { POBTOT, P_0A4..P_85YMAS } }
 *   fontana/bodega/iter_2020/urbano_rural/municipios/{NN}.json   → { "ENT+MUN": { urbano, rural } }
 *   fontana/bodega/iter_2020/urbano_rural/estatal.json           → { "ENT": { urbano, rural } }
 *   fontana/bodega/iter_2020/catalogo_municipios/{NN}.json       → { nombreNormalizado: "MUN" }
 *
 * El catálogo de municipios se construye desde el propio ITER (columna
 * NOM_MUN de cada CSV), NO desde lib/geo/municipios.ts. Verificado en
 * esta sesión (2026-07-31): el catálogo geo (topojson de INE, usado por
 * ECEG) usa una numeración de CVE_MUN que NO coincide con el CVE_MUN
 * oficial de INEGI en 1,550 de ~2,469 municipios (63%, las 32
 * entidades) — ej. Nuevo León: geo asigna CVE "040" a "Monterrey",
 * mientras que en el ITER real (fuente oficial INEGI), "040" es
 * "Parás" (906 hab.) y "039" es Monterrey (1,142,994 hab.). Usar
 * resolveMunicipioCve de lib/geo/municipios.ts para indexar datos de
 * ITER produciría valores sistemáticamente incorrectos. No se investiga
 * aquí el origen de esa discrepancia en el catálogo geo (pre-existente,
 * fuera de alcance de este incremento) — se documenta como hallazgo y
 * se evita heredarla construyendo un catálogo propio desde la fuente
 * oficial que este adaptador sí usa.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const ITER_DIR = path.resolve(__dirname, "../info_geo_eske/iter_2020");
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX = "fontana/bodega/iter_2020";

// Verificado en lib/dev/fontanaIterSandbox.ts (2026-07-24) contra
// fd_iter_cpv2020.pdf — 18 grupos quinquenales, presentes solo en ITER.
const QUINQUENAL_GROUPS = [
  "P_0A4", "P_5A9", "P_10A14", "P_15A19", "P_20A24", "P_25A29",
  "P_30A34", "P_35A39", "P_40A44", "P_45A49", "P_50A54", "P_55A59",
  "P_60A64", "P_65A69", "P_70A74", "P_75A79", "P_80A84", "P_85YMAS",
] as const;

const TAMLOC_URBANO_MIN = 5;
const ALL_ESTADO_IDS = Array.from({ length: 32 }, (_, i) => String(i + 1).padStart(2, "0"));

interface RawRow {
  [key: string]: string;
}

interface PiramideRecord {
  POBTOT: number;
  [grupo: string]: number;
}

interface UrbanoRuralRecord {
  urbano: number;
  rural: number;
}

function toInt(v: string | undefined): number {
  if (v == null) return NaN;
  const n = parseInt(v, 10);
  return isNaN(n) ? NaN : n;
}

function esUrbano(tamloc: string): boolean {
  const n = toInt(tamloc);
  return !isNaN(n) && n >= TAMLOC_URBANO_MIN;
}

// Misma normalización que normalizeGeoName en lib/geo/municipios.ts
// (acentos → letra base, mayúsculas, Ñ/Ü preservadas) — duplicada aquí
// en vez de importada porque este script corre fuera del runtime de
// Next y no depende de otros módulos de lib/. lib/fontana/ingesta/iter.ts
// SÍ importa la versión canónica de lib/geo/municipios.ts para que la
// búsqueda en tiempo de consulta use exactamente el mismo criterio con
// el que se construyó este catálogo.
const ACCENT_MAP: Record<string, string> = {
  "Á":"A","À":"A","Â":"A","Ä":"A","É":"E","È":"E","Ê":"E","Ë":"E",
  "Í":"I","Ì":"I","Î":"I","Ï":"I","Ó":"O","Ò":"O","Ô":"O","Ö":"O",
  "Ú":"U","Ù":"U","Û":"U",
  "á":"A","à":"A","â":"A","ä":"A","é":"E","è":"E","ê":"E","ë":"E",
  "í":"I","ì":"I","î":"I","ï":"I","ó":"O","ò":"O","ô":"O","ö":"O",
  "ú":"U","ù":"U","û":"U","ñ":"Ñ","ü":"Ü",
};
function normalizeGeoName(s: string): string {
  return s.split("").map((c) => ACCENT_MAP[c] ?? c).join("").toUpperCase();
}

function findEstadoDir(estadoId: string): string | null {
  const prefix = `${estadoId}_`;
  const entries = fs.readdirSync(ITER_DIR);
  const match = entries.find((e) => e.startsWith(prefix));
  if (!match) return null;
  const full = path.join(ITER_DIR, match);
  return fs.statSync(full).isDirectory() ? full : null;
}

function readCsv(estadoId: string): RawRow[] {
  const dir = findEstadoDir(estadoId);
  if (!dir) {
    throw new Error(`No se encontró carpeta para estado ${estadoId} en ${ITER_DIR}`);
  }
  const csvPath = path.join(dir, "conjunto_de_datos", `conjunto_de_datos_iter_${estadoId}CSV20.csv`);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`No se encontró ${csvPath}`);
  }
  const raw = fs.readFileSync(csvPath, "latin1");
  return parse(raw, { columns: true, skip_empty_lines: true, bom: true }) as RawRow[];
}

function buildPiramideRecord(row: RawRow): PiramideRecord {
  const rec: PiramideRecord = { POBTOT: toInt(row["POBTOT"]) };
  for (const g of QUINQUENAL_GROUPS) {
    const v = toInt(row[g]);
    rec[g] = isNaN(v) ? 0 : v;
  }
  return rec;
}

/**
 * Pirámide: toma directamente las filas ya agregadas por INEGI (LOC="0000")
 * — dato_directo, no una agregación de Fontana. Urbano/rural: NO está en
 * la fila agregada (TAMLOC solo aplica a localidades reales), se calcula
 * sumando POBTOT de localidades reales agrupadas por clasificarTamloc —
 * calculo_directo, suma de valores oficiales sin modelado.
 */
function processEstado(estadoId: string, rows: RawRow[]): {
  piramideMunicipios: Record<string, PiramideRecord>;
  piramideEstatal: PiramideRecord | null;
  urbanoRuralMunicipios: Record<string, UrbanoRuralRecord>;
  urbanoRuralEstatal: UrbanoRuralRecord;
  catalogoMunicipios: Record<string, string>;
} {
  const piramideMunicipios: Record<string, PiramideRecord> = {};
  let piramideEstatal: PiramideRecord | null = null;
  const urbanoRuralMunicipios: Record<string, UrbanoRuralRecord> = {};
  const urbanoRuralEstatal: UrbanoRuralRecord = { urbano: 0, rural: 0 };
  const catalogoMunicipios: Record<string, string> = {};

  for (const row of rows) {
    const mun = row["MUN"];
    const loc = row["LOC"];

    // Filas agregadas oficiales de INEGI (pirámide) — también fuente del
    // catálogo nombre→CVE, construido desde el propio ITER (ver nota de
    // cabecera sobre la divergencia con el catálogo geo de INE).
    if (loc === "0000") {
      if (mun === "000") {
        piramideEstatal = buildPiramideRecord(row);
      } else {
        piramideMunicipios[`${estadoId}${mun}`] = buildPiramideRecord(row);
        catalogoMunicipios[normalizeGeoName(row["NOM_MUN"])] = mun;
      }
      continue;
    }

    // Localidades reales (urbano/rural) — excluir agregados/no aplicables
    if (["0000", "9998", "9999"].includes(loc) || mun === "000") continue;
    const pobtot = toInt(row["POBTOT"]);
    if (isNaN(pobtot)) continue;

    const key = `${estadoId}${mun}`;
    if (!urbanoRuralMunicipios[key]) urbanoRuralMunicipios[key] = { urbano: 0, rural: 0 };

    if (esUrbano(row["TAMLOC"])) {
      urbanoRuralMunicipios[key].urbano += pobtot;
      urbanoRuralEstatal.urbano += pobtot;
    } else {
      urbanoRuralMunicipios[key].rural += pobtot;
      urbanoRuralEstatal.rural += pobtot;
    }
  }

  return { piramideMunicipios, piramideEstatal, urbanoRuralMunicipios, urbanoRuralEstatal, catalogoMunicipios };
}

function initFirebase(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan credenciales Firebase. Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY en .env");
  }
  if (!STORAGE_BUCKET) throw new Error("Falta NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET en .env");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function uploadJson(app: App, storagePath: string, data: unknown): Promise<void> {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET);
  const file = bucket.file(storagePath);
  await file.save(Buffer.from(JSON.stringify(data), "utf-8"), { contentType: "application/json" });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const upload = args.includes("--upload");
  const allEstados = args.includes("--all-estados");
  const estadoIdx = args.indexOf("--estado");
  const estadoArg = estadoIdx >= 0 ? args[estadoIdx + 1]?.padStart(2, "0") : null;

  if (!dryRun && !upload) {
    process.stderr.write("Usage: npx tsx scripts/fontana-iter-pipeline.ts --estado <id>|--all-estados [--upload|--dry-run]\n");
    process.exit(1);
  }

  const estados = allEstados ? ALL_ESTADO_IDS : estadoArg ? [estadoArg] : [];
  if (estados.length === 0) {
    process.stderr.write("Especifica --estado <id> o --all-estados.\n");
    process.exit(1);
  }

  const app = !dryRun && upload ? initFirebase() : null;
  const piramideEstatalTotal: Record<string, PiramideRecord> = {};
  const urbanoRuralEstatalTotal: Record<string, UrbanoRuralRecord> = {};

  for (const estadoId of estados) {
    process.stdout.write(`Procesando estado ${estadoId}…\n`);
    const rows = readCsv(estadoId);
    const { piramideMunicipios, piramideEstatal, urbanoRuralMunicipios, urbanoRuralEstatal, catalogoMunicipios } = processEstado(estadoId, rows);

    if (!piramideEstatal) {
      throw new Error(`Estado ${estadoId}: no se encontró fila agregada estatal (MUN="000", LOC="0000")`);
    }
    piramideEstatalTotal[estadoId] = piramideEstatal;
    urbanoRuralEstatalTotal[estadoId] = urbanoRuralEstatal;

    process.stdout.write(
      `  → ${Object.keys(piramideMunicipios).length} municipios (pirámide), ` +
      `${Object.keys(urbanoRuralMunicipios).length} municipios (urbano/rural), ` +
      `${Object.keys(catalogoMunicipios).length} en catálogo\n`
    );

    const piraPath = `${STORAGE_PREFIX}/piramide/municipios/${estadoId}.json`;
    const urPath = `${STORAGE_PREFIX}/urbano_rural/municipios/${estadoId}.json`;
    const catPath = `${STORAGE_PREFIX}/catalogo_municipios/${estadoId}.json`;

    if (dryRun) {
      const piraOut = path.join(os.tmpdir(), `fontana_iter_piramide_${estadoId}.json`);
      const urOut = path.join(os.tmpdir(), `fontana_iter_urbano_rural_${estadoId}.json`);
      const catOut = path.join(os.tmpdir(), `fontana_iter_catalogo_${estadoId}.json`);
      fs.writeFileSync(piraOut, JSON.stringify(piramideMunicipios));
      fs.writeFileSync(urOut, JSON.stringify(urbanoRuralMunicipios));
      fs.writeFileSync(catOut, JSON.stringify(catalogoMunicipios));
      process.stdout.write(`  [dry-run] → ${piraOut}\n  [dry-run] → ${urOut}\n  [dry-run] → ${catOut}\n`);
    } else {
      process.stdout.write(`  ↑ ${piraPath}…\n`);
      await uploadJson(app!, piraPath, piramideMunicipios);
      process.stdout.write(`  ↑ ${urPath}…\n`);
      await uploadJson(app!, urPath, urbanoRuralMunicipios);
      process.stdout.write(`  ↑ ${catPath}…\n`);
      await uploadJson(app!, catPath, catalogoMunicipios);
      process.stdout.write("  ✓ Done\n");
    }
  }

  if (allEstados) {
    process.stdout.write("Subiendo agregados estatales (piramide/estatal.json, urbano_rural/estatal.json)…\n");
    const piraEstatalPath = `${STORAGE_PREFIX}/piramide/estatal.json`;
    const urEstatalPath = `${STORAGE_PREFIX}/urbano_rural/estatal.json`;

    if (dryRun) {
      const piraOut = path.join(os.tmpdir(), "fontana_iter_piramide_estatal.json");
      const urOut = path.join(os.tmpdir(), "fontana_iter_urbano_rural_estatal.json");
      fs.writeFileSync(piraOut, JSON.stringify(piramideEstatalTotal));
      fs.writeFileSync(urOut, JSON.stringify(urbanoRuralEstatalTotal));
      process.stdout.write(`  [dry-run] → ${piraOut}\n  [dry-run] → ${urOut}\n`);
    } else {
      await uploadJson(app!, piraEstatalPath, piramideEstatalTotal);
      await uploadJson(app!, urEstatalPath, urbanoRuralEstatalTotal);
      process.stdout.write("  ✓ Done\n");
    }
  }
}

main().catch((e: Error) => {
  process.stderr.write(`Error: ${e.message}\n${e.stack ?? ""}\n`);
  process.exit(1);
});