// lib/dev/fontanaIterSandbox.ts
// Sandbox de diagnóstico — NO es código de producto. Verifica en vivo el
// segundo mecanismo de acceso de Familia 1 (Fontana): descarga + parseo
// local del ITER (Censo de Población y Vivienda 2020), a diferencia del
// primer mecanismo (API BIE/BISE v2.0, ver fontanaInegiSandbox.ts).
//
// Fuente: archivo real descargado 2026-07-24 de
// https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_14_cpv2020_csv.zip
// Colocado en info_geo_eske/iter_2020/14_jalisco/ (gitignored, igual que
// la fuente cruda de ECEG en info_geo_eske/eceg_2020/ — nunca se commitea).
// Si este archivo no está presente localmente, el diagnóstico lo reporta
// explícitamente en vez de fallar en seco.

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const ITER_CSV_PATH = path.resolve(
  process.cwd(),
  "info_geo_eske/iter_2020/14_jalisco/conjunto_de_datos/conjunto_de_datos_iter_14CSV20.csv"
);

// Verificado 2026-07-24 contra fd_iter_cpv2020.pdf (descriptor oficial INEGI):
// 18 grupos quinquenales, cada uno con desglose total/femenino/masculino.
// Presentes SOLO en ITER (no están en ninguna de las 224 variables de ECEG).
const QUINQUENAL_GROUPS = [
  "P_0A4", "P_5A9", "P_10A14", "P_15A19", "P_20A24", "P_25A29",
  "P_30A34", "P_35A39", "P_40A44", "P_45A49", "P_50A54", "P_55A59",
  "P_60A64", "P_65A69", "P_70A74", "P_75A79", "P_80A84", "P_85YMAS",
] as const;

// Umbral oficial INEGI: TAMLOC 05+ (≥2,500 hab.) = urbano; 01-04 (<2,500) = rural.
const TAMLOC_URBANO_MIN = 5;

export interface IterExtractRow {
  entidad: string;
  mun: string;
  loc: string;
  nomLoc: string;
  pobtot: number;
  tamloc: string;
  clasificacion: "urbano" | "rural" | "sin_dato";
}

export interface IterPiramideCheck {
  nivel: string;
  pobtot: number;
  sumaQuinquenal: number;
  diferencia: number;
  porGrupo: Record<string, number>;
}

export interface IterDiagnostics {
  archivoEncontrado: boolean;
  rutaArchivo: string;
  totalFilas?: number;
  ejemploUrbano?: IterExtractRow;
  ejemploRural?: IterExtractRow;
  piramide?: IterPiramideCheck[];
  error?: string;
}

interface RawRow {
  [key: string]: string;
}

function toInt(v: string | undefined): number {
  if (v == null) return NaN;
  const n = parseInt(v, 10);
  return isNaN(n) ? NaN : n;
}

function clasificarTamloc(tamloc: string): "urbano" | "rural" | "sin_dato" {
  const n = toInt(tamloc);
  if (isNaN(n)) return "sin_dato";
  return n >= TAMLOC_URBANO_MIN ? "urbano" : "rural";
}

function buildPiramideCheck(nivel: string, row: RawRow): IterPiramideCheck {
  const pobtot = toInt(row["POBTOT"]);
  const porGrupo: Record<string, number> = {};
  let sumaQuinquenal = 0;
  for (const g of QUINQUENAL_GROUPS) {
    const v = toInt(row[g]);
    porGrupo[g] = isNaN(v) ? 0 : v;
    if (!isNaN(v)) sumaQuinquenal += v;
  }
  return {
    nivel,
    pobtot,
    sumaQuinquenal,
    diferencia: pobtot - sumaQuinquenal,
    porGrupo,
  };
}

export function runFontanaIterDiagnostics(): IterDiagnostics {
  if (!fs.existsSync(ITER_CSV_PATH)) {
    return {
      archivoEncontrado: false,
      rutaArchivo: ITER_CSV_PATH,
      error:
        "Archivo ITER de Jalisco no encontrado en info_geo_eske/iter_2020/14_jalisco/ " +
        "(directorio gitignored — descarga manual requerida, ver comentario en este archivo).",
    };
  }

  let rows: RawRow[];
  try {
    const raw = fs.readFileSync(ITER_CSV_PATH, "latin1");
    rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true }) as RawRow[];
  } catch (err) {
    return {
      archivoEncontrado: true,
      rutaArchivo: ITER_CSV_PATH,
      error: `Error al parsear el CSV: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Extracto mínimo + clasificación urbano/rural: buscar un ejemplo real de
  // cada categoría dentro de las localidades reales de un mismo municipio
  // (Guadalajara, MUN="039" — mismo municipio ya usado en el sandbox BIE).
  const localidadesGuadalajara = rows.filter(
    (r) => r["MUN"] === "039" && !["0000", "9998", "9999"].includes(r["LOC"])
  );

  const toExtractRow = (r: RawRow): IterExtractRow => ({
    entidad: r["ENTIDAD"],
    mun: r["MUN"],
    loc: r["LOC"],
    nomLoc: r["NOM_LOC"],
    pobtot: toInt(r["POBTOT"]),
    tamloc: r["TAMLOC"],
    clasificacion: clasificarTamloc(r["TAMLOC"]),
  });

  const ejemploUrbanoRaw = localidadesGuadalajara.find(
    (r) => clasificarTamloc(r["TAMLOC"]) === "urbano"
  );
  const ejemploRuralRaw = localidadesGuadalajara.find(
    (r) => clasificarTamloc(r["TAMLOC"]) === "rural"
  );

  // Pirámide quinquenal: Jalisco (estatal) y Guadalajara (municipal).
  const estatalRow = rows.find((r) => r["MUN"] === "000" && r["LOC"] === "0000");
  const municipalRow = rows.find((r) => r["MUN"] === "039" && r["LOC"] === "0000");

  const piramide: IterPiramideCheck[] = [];
  if (estatalRow) piramide.push(buildPiramideCheck("Jalisco (estatal)", estatalRow));
  if (municipalRow) piramide.push(buildPiramideCheck("Guadalajara (municipal)", municipalRow));

  return {
    archivoEncontrado: true,
    rutaArchivo: ITER_CSV_PATH,
    totalFilas: rows.length,
    ejemploUrbano: ejemploUrbanoRaw ? toExtractRow(ejemploUrbanoRaw) : undefined,
    ejemploRural: ejemploRuralRaw ? toExtractRow(ejemploRuralRaw) : undefined,
    piramide,
  };
}
