/**
 * scripts/verify-fontana-agregacion-plural-cobertura.ts
 * Fase 2 del rediseño de territorio (26-08-13) — carga el registry real de
 * Fontana (Storage, no el JSON local) y reporta qué indicadores tienen
 * agregacionPlural clasificado vs. cuáles no. Correr después de agregar
 * cualquier familia nueva, antes de dar por cerrado ese incremento.
 *
 * Usage: npx tsx scripts/verify-fontana-agregacion-plural-cobertura.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { loadIndicatorRegistry } = await import("../lib/fontana/indicatorRegistry");

  const registry = await loadIndicatorRegistry();
  const sinClasificar = registry.filter((i) => !i.agregacionPlural);
  const clasificados = registry.filter((i) => i.agregacionPlural);

  console.log(`Total de indicadores en el registry: ${registry.length}`);
  console.log(`Con agregacionPlural clasificado: ${clasificados.length}`);
  console.log(`SIN agregacionPlural clasificado: ${sinClasificar.length}\n`);

  if (sinClasificar.length > 0) {
    console.log("Indicadores pendientes de clasificar:");
    for (const ind of sinClasificar) {
      console.log(`  - ${ind.id} (${ind.nombre})`);
    }
  }

  if (clasificados.length > 0) {
    console.log("\nIndicadores ya clasificados:");
    for (const ind of clasificados) {
      console.log(`  - ${ind.id} (${ind.nombre}): ${ind.agregacionPlural!.tipo}`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
