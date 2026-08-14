/**
 * scripts/verify-cabeceras-coverage.ts
 * Verificación de solo lectura: ¿qué porcentaje de distritos electorales
 * (federal y local) tiene cabecera conocida en cabeceras_fed.json/
 * cabeceras_loc.json, a nivel NACIONAL (no solo un estado)? Informa la
 * decisión de UX de Fase 1 (rediseño de Territorio) para el caso de
 * cabecera ausente. Script de solo lectura — no escribe nada.
 *
 * Usage: npx tsx scripts/verify-cabeceras-coverage.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const {
    getDistritosFederalesOptionsNacional,
    getDistritosLocalesOptionsNacional,
  } = await import("../lib/geo/distritos");

  for (const [label, fn] of [
    ["Federal", getDistritosFederalesOptionsNacional],
    ["Local", getDistritosLocalesOptionsNacional],
  ] as const) {
    const options = await fn();
    const conCabecera = options.filter((o) => o.nombre.includes("–"));
    const sinCabecera = options.filter((o) => !o.nombre.includes("–"));
    console.log(`\n=== Distritos ${label} ===`);
    console.log(`Total: ${options.length}`);
    console.log(`Con cabecera conocida: ${conCabecera.length} (${((conCabecera.length / options.length) * 100).toFixed(1)}%)`);
    console.log(`SIN cabecera (fallback "D.X NNN" sin nombre): ${sinCabecera.length}`);
    if (sinCabecera.length > 0) {
      console.log(`Ejemplos sin cabecera (hasta 15):`);
      sinCabecera.slice(0, 15).forEach((o) => console.log(`  ${o.estadoNombre} (${o.estadoCve}) — ${o.nombre}`));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });