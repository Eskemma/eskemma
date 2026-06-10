// generate-partidos-2024.mjs
// Genera las entradas PARTIDOS_MAPPING_LOC para 2024 a partir de los headers CSV.
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const DIR = "data/results/locals/procesados/pel_2024";
const FIXED = new Set([
  "Id","anio","cve_ambito","ambito","cve_tipo","tipo","cve_principio","principio",
  "cve_cargo","cargo","cve_estado","estado","cve_del","cabecera",
  "cve_mun","municipio","seccion","no_reg","vot_nul","total_votos","lne","part_ciud",
]);

const cargos = ["ayun","dip_loc","gob","alc","jef_gob","reg","pres_com"];

for (const cargo of cargos) {
  const files = readdirSync(DIR).filter(f => f.includes(`_pel_${cargo}_`) && f.endsWith(".csv"));
  if (files.length === 0) continue;

  const allCols = new Set();
  for (const file of files) {
    const firstLine = readFileSync(join(DIR, file), "utf8").split("\n")[0];
    const cols = firstLine.trim().split(",").map(c => c.replace(/^"|"$/g, ""));
    for (const col of cols) {
      if (!FIXED.has(col)) allCols.add(col);
    }
  }

  const sorted = [...allCols].sort();
  const lines = [];
  let row = "  ";
  for (let i = 0; i < sorted.length; i++) {
    const entry = `"${sorted[i]}"` + (i < sorted.length - 1 ? ", " : "");
    if (row.length + entry.length > 90) {
      lines.push(row.trimEnd());
      row = "  " + entry;
    } else {
      row += entry;
    }
  }
  if (row.trim()) lines.push(row);

  console.log(`  "2024_${cargo}": [`);
  console.log(lines.join("\n"));
  console.log(`  ],`);
  console.log();
}
