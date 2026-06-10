// insert-labels-2024.mjs
// Inserta labels de 2024 en PARTIDO_LABELS_LOC de eleccionesLocalesConstants.ts
import { readFileSync, writeFileSync } from "fs";

const CONSTANTS_PATH = "lib/sefix/eleccionesLocalesConstants.ts";
const LABELS_PATH = "/tmp/labels_2024.txt";

const constants = readFileSync(CONSTANTS_PATH, "utf8");
const labels = readFileSync(LABELS_PATH, "utf8").trimEnd();

// Insertar justo antes del cierre del objeto PARTIDO_LABELS_LOC
// El marcador es la última línea de coaliciones de Durango 2025 + cierre
const MARKER = "  PAN_PRI:        \"PAN-PRI\",\n};";

if (!constants.includes(MARKER)) {
  console.error("ERROR: marcador no encontrado");
  process.exit(1);
}

const replacement = `  PAN_PRI:        "PAN-PRI",\n${labels}\n};`;
const updated = constants.replace(MARKER, replacement);

writeFileSync(CONSTANTS_PATH, updated, "utf8");
console.log("Labels 2024 insertados correctamente.");
