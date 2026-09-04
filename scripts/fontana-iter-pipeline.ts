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
 *   fontana/bodega/iter_2020/piramide/municipios/{NN}.json      → { "ENT+MUN": { POBTOT, P_0A4..P_85YMAS, P_0A4_F/_M..P_85YMAS_F/_M } }
 *   fontana/bodega/iter_2020/piramide/estatal.json              → { "ENT": { POBTOT, P_0A4..P_85YMAS, P_0A4_F/_M..P_85YMAS_F/_M } }
 *   fontana/bodega/iter_2020/urbano_rural/municipios/{NN}.json   → { "ENT+MUN": { urbano, rural } }
 *   fontana/bodega/iter_2020/urbano_rural/estatal.json           → { "ENT": { urbano, rural } }
 *   fontana/bodega/iter_2020/catalogo_municipios/{NN}.json       → { claveCanonicaMunicipio: "MUN" }
 *
 * El catálogo de municipios se construye con los NOMBRES del propio ITER
 * (columna NOM_MUN de cada CSV, leída UTF-8), pero se KEYEA con
 * `claveCanonicaMunicipio()` de lib/geo/municipioCanonico.ts — la MISMA
 * función que usa el query time (resolverMunicipioCveIter en
 * lib/fontana/ingesta/iter.ts) y que produce resolverTerritorioNombre.
 * Lo que NO se hereda del catálogo geo de INE es su NUMERACIÓN de CVE_MUN:
 * verificado (2026-07-31) que diverge del CVE_MUN oficial de INEGI en
 * 1,550 de ~2,469 municipios (63%) — ej. Nuevo León: geo asigna "040" a
 * Monterrey, pero en el ITER real "040" es "Parás" y "039" es Monterrey.
 * Por eso el catálogo mapea nombre→CVE del propio ITER; solo la
 * NORMALIZACIÓN del nombre es compartida (antes era un normalize local
 * que divergía — causa del fallo sistémico de nombres acentuados,
 * 2026-09-03).
 */

import fs from "fs";
import path from "path";
import os from "os";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";
// Lógica PURA (sin firebase/topojson) — segura como import estático.
import { claveCanonicaMunicipio } from "@/lib/geo/municipioCanonico";
// getMunicipiosOptions (topojson INE) se importa DINÁMICAMENTE dentro de la
// validación round-trip, después de dotenv.config() — arrastra
// @/lib/firebase-admin, que revienta si se evalúa antes de cargar el .env.

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

// Desglose por sexo del mismo grupo — fd_iter_cpv2020.pdf sección
// "ESTRUCTURA POR EDAD Y SEXO" (indicadores 48-101): P_<grupo>_F (Mujeres)
// y P_<grupo>_M (Hombres). Se guardan JUNTO a los totales (no los
// reemplazan) para la pirámide de dos lados del Canvas y para la
// validación cruzada F+M ≈ total.
const QUINQUENAL_GROUPS_SEXO = QUINQUENAL_GROUPS.flatMap((g) => [`${g}_F`, `${g}_M`]);

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

// El catálogo nombre→CVE_MUN del ITER se keyea con la MISMA función
// canónica (claveCanonicaMunicipio) que usa el query time
// (resolverMunicipioCveIter en lib/fontana/ingesta/iter.ts) y que produce
// resolverTerritorioNombre — sin normalización propia que pueda divergir
// (causa del fallo sistémico de resolución de nombres acentuados,
// 2026-09-03: este script leía los CSV UTF-8 como latin1 Y keyeaba con un
// normalize local). El módulo lib/geo/municipioCanonico.ts es lógica pura
// (sin firebase/topojson), importable desde este script.

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
  // UTF-8 — verificado byte a byte (NOM_MUN acentuados = C3 xx). Leerlo como
  // latin1 mojibake'aba las llaves del catálogo de municipios.
  const raw = fs.readFileSync(csvPath, "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true, bom: true }) as RawRow[];
}

function buildPiramideRecord(row: RawRow): PiramideRecord {
  const rec: PiramideRecord = { POBTOT: toInt(row["POBTOT"]) };
  for (const g of QUINQUENAL_GROUPS) {
    const v = toInt(row[g]);
    rec[g] = isNaN(v) ? 0 : v;
  }
  for (const gs of QUINQUENAL_GROUPS_SEXO) {
    const v = toInt(row[gs]);
    rec[gs] = isNaN(v) ? 0 : v;
  }
  return rec;
}

// Validación cruzada: para cada grupo, Hombres + Mujeres debe igualar el
// total (conteos crudos del censo — sin redondeo, así que === exacto en las
// filas agregadas LOC="0000", que el diccionario confirma sin supresión a
// nivel entidad/municipio). Cualquier desviación se reporta antes de subir.
function verificarCruceSexo(
  etiqueta: string,
  registros: Record<string, PiramideRecord>
): { ok: boolean; desviaciones: string[] } {
  const desviaciones: string[] = [];
  for (const [clave, rec] of Object.entries(registros)) {
    for (const g of QUINQUENAL_GROUPS) {
      const total = rec[g] ?? 0;
      const suma = (rec[`${g}_M`] ?? 0) + (rec[`${g}_F`] ?? 0);
      if (suma !== total) {
        desviaciones.push(`${etiqueta} ${clave} ${g}: H+M=${suma} vs total=${total} (Δ ${suma - total})`);
      }
    }
  }
  return { ok: desviaciones.length === 0, desviaciones };
}

// Validación del catálogo nombre→CVE_MUN (2026-09-03):
//  (1) GATE — cada municipio con fila ITER (piramideMunicipios) debe tener
//      su CVE alcanzable desde el catálogo. Si falta uno, el keying del
//      nombre falló → NO se sube.
//  (2) ROUND-TRIP — cada nombre que produciría el query time
//      (claveCanonicaMunicipio sobre las opciones INE de ese estado) debe
//      ser una llave del catálogo. Las que no calzan se listan; las
//      genuinas (municipios creados post-Censo-2020, sin fila ITER) son
//      esperadas y no bloquean.
async function verificarCatalogo(
  estadoId: string,
  piramideMunicipios: Record<string, PiramideRecord>,
  catalogo: Record<string, string>,
  colisionesNombre: { clave: string; cves: string[] }[]
): Promise<{ ok: boolean; gateFaltantes: string[]; colisiones: string; roundTrip: string }> {
  const cvesEnCatalogo = new Set(Object.values(catalogo));
  const cvesEnColision = new Set(colisionesNombre.flatMap((c) => c.cves));
  // GATE: municipio con fila ITER que NO se puede resolver por nombre y que
  // NO es una colisión de nombre idéntico conocida.
  const gateFaltantes = Object.keys(piramideMunicipios)
    .map((k) => k.slice(2)) // ${estadoId}${mun} -> mun
    .filter((mun) => !cvesEnCatalogo.has(mun) && !cvesEnColision.has(mun));

  const colisiones = colisionesNombre.length
    ? colisionesNombre.map((c) => `${c.clave} = cves ${c.cves.join("/")}`).join("; ")
    : "";

  const { getMunicipiosOptions } = await import("@/lib/geo/municipios");
  const opciones = await getMunicipiosOptions(estadoId);
  const llaves = new Set(Object.keys(catalogo));
  const missINE: string[] = [];
  for (const o of opciones) {
    if (!llaves.has(claveCanonicaMunicipio(estadoId, o.nombre))) missINE.push(o.nombre);
  }
  const roundTrip =
    `INE→catálogo: ${opciones.length - missINE.length}/${opciones.length}` +
    (missINE.length ? ` — sin fila ITER: ${missINE.join(", ")}` : " (todos)");

  return { ok: gateFaltantes.length === 0, gateFaltantes, colisiones, roundTrip };
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
  // Municipios de ITER cuyo nombre canónico colisiona con el de otro del
  // mismo estado (ej. Oaxaca: 2 "SAN JUAN MIXTEPEC", 2 "SAN PEDRO
  // MIXTEPEC", sin campo que los distinga — ver ALIAS_MUNICIPIO). El
  // catálogo (mapa nombre→cve) solo puede guardar uno; el otro queda
  // irresoluble por nombre — ambigüedad conocida, NO el bug de encoding.
  colisionesNombre: { clave: string; cves: string[] }[];
} {
  const piramideMunicipios: Record<string, PiramideRecord> = {};
  let piramideEstatal: PiramideRecord | null = null;
  const urbanoRuralMunicipios: Record<string, UrbanoRuralRecord> = {};
  const urbanoRuralEstatal: UrbanoRuralRecord = { urbano: 0, rural: 0 };
  const catalogoMunicipios: Record<string, string> = {};
  const colisionesNombre: { clave: string; cves: string[] }[] = [];

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
        const claveCat = claveCanonicaMunicipio(estadoId, row["NOM_MUN"]);
        const previa = catalogoMunicipios[claveCat];
        if (previa !== undefined && previa !== mun) {
          const col = colisionesNombre.find((c) => c.clave === claveCat);
          if (col) col.cves.push(mun);
          else colisionesNombre.push({ clave: claveCat, cves: [previa, mun] });
        }
        catalogoMunicipios[claveCat] = mun;
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

  return { piramideMunicipios, piramideEstatal, urbanoRuralMunicipios, urbanoRuralEstatal, catalogoMunicipios, colisionesNombre };
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
  let cruceGlobalOk = true;

  for (const estadoId of estados) {
    process.stdout.write(`Procesando estado ${estadoId}…\n`);
    const rows = readCsv(estadoId);
    const { piramideMunicipios, piramideEstatal, urbanoRuralMunicipios, urbanoRuralEstatal, catalogoMunicipios, colisionesNombre } = processEstado(estadoId, rows);

    if (!piramideEstatal) {
      throw new Error(`Estado ${estadoId}: no se encontró fila agregada estatal (MUN="000", LOC="0000")`);
    }
    piramideEstatalTotal[estadoId] = piramideEstatal;
    urbanoRuralEstatalTotal[estadoId] = urbanoRuralEstatal;

    // Validación cruzada H+M ≈ total (estatal + todos los municipios).
    const cruce = verificarCruceSexo(estadoId, {
      [`${estadoId}_ESTATAL`]: piramideEstatal,
      ...piramideMunicipios,
    });
    if (cruce.ok) {
      process.stdout.write(`  ✓ cruce H+M=total OK (estatal + ${Object.keys(piramideMunicipios).length} municipios)\n`);
    } else {
      cruceGlobalOk = false;
      process.stdout.write(`  ✗ cruce H+M≠total en ${cruce.desviaciones.length} celdas:\n`);
      for (const d of cruce.desviaciones.slice(0, 10)) process.stdout.write(`    ${d}\n`);
      if (cruce.desviaciones.length > 10) process.stdout.write(`    …y ${cruce.desviaciones.length - 10} más\n`);
      if (upload) {
        throw new Error(
          `Estado ${estadoId}: la validación cruzada H+M=total falló — NO se sube nada. Revisa con --dry-run.`
        );
      }
    }

    // Validación del catálogo nombre→CVE (encoding + clave canónica).
    const cat = await verificarCatalogo(estadoId, piramideMunicipios, catalogoMunicipios, colisionesNombre);
    process.stdout.write(`  ${cat.ok ? "✓" : "✗"} catálogo: ${cat.roundTrip}\n`);
    if (cat.colisiones) {
      process.stdout.write(`  ⚠ colisión de nombre idéntico (ambigüedad conocida, no bloquea): ${cat.colisiones}\n`);
    }
    if (!cat.ok) {
      cruceGlobalOk = false;
      process.stdout.write(
        `  ✗ ${cat.gateFaltantes.length} municipios con fila ITER SIN entrada en el catálogo (no colisión): ${cat.gateFaltantes.join(", ")}\n`
      );
      if (upload) {
        throw new Error(
          `Estado ${estadoId}: hay municipios ITER que no se pueden resolver por nombre — NO se sube nada.`
        );
      }
    }

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

  if (!cruceGlobalOk) {
    process.stdout.write("\n⚠️  Hubo celdas con H+M≠total (ver arriba). En --dry-run se continúa para inspección.\n");
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