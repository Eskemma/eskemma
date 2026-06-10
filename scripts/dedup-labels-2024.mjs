// dedup-labels-2024.mjs
// Elimina entradas duplicadas del bloque "Partidos y coaliciones nuevos 2024"
// en PARTIDO_LABELS_LOC — las duplicadas ya existen en el bloque anterior.
import { readFileSync, writeFileSync } from "fs";

const CONSTANTS_PATH = "lib/sefix/eleccionesLocalesConstants.ts";
const content = readFileSync(CONSTANTS_PATH, "utf8");

// Encontrar la sección 2024 dentro de PARTIDO_LABELS_LOC
const SECTION_START = "  // Partidos y coaliciones nuevos 2024";
const SECTION_END   = "\n};";

const sectionIdx = content.indexOf(SECTION_START);
const endIdx = content.indexOf(SECTION_END, sectionIdx);
if (sectionIdx === -1 || endIdx === -1) {
  console.error("No encontré la sección 2024 en PARTIDO_LABELS_LOC"); process.exit(1);
}

// Extraer todas las claves ANTES de la sección 2024 (para detectar existentes)
const before = content.slice(0, sectionIdx);
const existingKeys = new Set();
const allKeyRe = /\b(\w+)\s*:/g;
let m;
while ((m = allKeyRe.exec(before)) !== null) {
  existingKeys.add(m[1]);
}

// Procesar la sección 2024: eliminar líneas con claves ya existentes
const section2024 = content.slice(sectionIdx, endIdx);
const cleanLines = section2024.split("\n").filter(line => {
  const keyMatch = line.match(/^\s+(\w+):/);
  if (!keyMatch) return true; // línea de comentario o vacía
  return !existingKeys.has(keyMatch[1]);
});

const updated = content.slice(0, sectionIdx) + cleanLines.join("\n") + content.slice(endIdx);
writeFileSync(CONSTANTS_PATH, updated, "utf8");

// Contar eliminados
const originalLines = section2024.split("\n").filter(l => /^\s+\w+:/.test(l)).length;
const remainingLines = cleanLines.filter(l => /^\s+\w+:/.test(l)).length;
console.log(`Eliminadas ${originalLines - remainingLines} entradas duplicadas. Quedan ${remainingLines} entradas nuevas.`);
