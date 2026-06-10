// generate-labels-2024.mjs
// Genera las entradas PARTIDO_LABELS_LOC para partidos nuevos en 2024.
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const DIR = "data/results/locals/procesados/pel_2024";
const CONSTANTS_PATH = "lib/sefix/eleccionesLocalesConstants.ts";

const FIXED = new Set([
  "Id","anio","cve_ambito","ambito","cve_tipo","tipo","cve_principio","principio",
  "cve_cargo","cargo","cve_estado","estado","cve_del","cabecera",
  "cve_mun","municipio","seccion","no_reg","vot_nul","total_votos","lne","part_ciud",
]);

// Leer todos los partidos de 2024
const all2024 = new Set();
for (const file of readdirSync(DIR)) {
  if (!file.endsWith(".csv")) continue;
  const firstLine = readFileSync(join(DIR, file), "utf8").split("\n")[0];
  const cols = firstLine.trim().split(",").map(c => c.replace(/^"|"$/g, ""));
  for (const col of cols) {
    if (!FIXED.has(col)) all2024.add(col);
  }
}

// Extraer claves ya definidas en PARTIDO_LABELS_LOC
const constants = readFileSync(CONSTANTS_PATH, "utf8");
const labelMatch = constants.match(/export const PARTIDO_LABELS_LOC[^{]*\{([\s\S]*?)\n\};/);
if (!labelMatch) { console.error("No encontré PARTIDO_LABELS_LOC"); process.exit(1); }

const existingKeys = new Set();
const keyRe = /^\s+(\w+):/gm;
let m;
while ((m = keyRe.exec(labelMatch[1])) !== null) {
  existingKeys.add(m[1]);
}

// Generar label para claves nuevas
function makeLabel(key) {
  // CAD_IND* → mismo formato que CAND_IND*
  if (/^CAD_IND/.test(key)) return key.replace("CAD_IND", "Cand. Ind. ").trim();
  if (/^CAND_IND(\d+)$/.test(key)) return `Cand. Ind. ${key.replace("CAND_IND","")}`;
  if (/^CAND_IND_(\d+)$/.test(key)) return `Cand. Ind. ${key.replace("CAND_IND_","")}`;
  if (/^CAND_IND0(\d+)$/.test(key)) return `Cand. Ind. ${parseInt(key.replace("CAND_IND",""))}`;
  // Coaliciones con número al final (duplicados de municipios): quitar _N
  const clean = key.replace(/_\d+$/, "");
  if (clean !== key) return `${clean.replace(/_/g, "-")}*`;
  // Coalición tipo C_XXX_YYY (Oaxaca)
  if (key.startsWith("C_")) return key.replace(/^C_/, "").replace(/_/g, "-");
  // Resto: reemplazar _ por -
  return key.replace(/_/g, "-");
}

const newKeys = [...all2024].filter(k => !existingKeys.has(k)).sort();
console.log(`  // Partidos y coaliciones nuevos 2024 (${newKeys.length} entradas)`);
for (const key of newKeys) {
  console.log(`  ${key}: "${makeLabel(key)}",`);
}
