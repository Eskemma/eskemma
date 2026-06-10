// insert-partidos-2024.mjs
// Inserta el bloque de PARTIDOS_MAPPING_LOC para 2024 en eleccionesLocalesConstants.ts
import { readFileSync, writeFileSync } from "fs";

const CONSTANTS_PATH = "lib/sefix/eleccionesLocalesConstants.ts";
const PARTIDOS_PATH = "/tmp/partidos_2024.txt";

const constants = readFileSync(CONSTANTS_PATH, "utf8");
const partidos = readFileSync(PARTIDOS_PATH, "utf8").trimEnd();

const MARKER = "  // 2025 — Durango, Ayuntamientos (única elección local 2025)";

if (!constants.includes(MARKER)) {
  console.error("ERROR: marcador no encontrado en el archivo de constantes");
  process.exit(1);
}

const insertion = `  // 2024 — 32 estados, múltiples cargos\n${partidos}\n\n`;
const updated = constants.replace(MARKER, insertion + MARKER);

writeFileSync(CONSTANTS_PATH, updated, "utf8");
console.log("Bloque 2024 insertado correctamente.");
