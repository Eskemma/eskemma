/**
 * scripts/verify-fontana-registry.ts
 * Verificación en vivo de lib/fontana/indicatorRegistry.ts — confirma
 * lectura real desde Storage (no mock). Script temporal de verificación.
 *
 * Usage: npx tsx scripts/verify-fontana-registry.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { loadIndicatorRegistry, getIndicadorRegistro } = await import("../lib/fontana/indicatorRegistry");

  const registry = await loadIndicatorRegistry();
  console.log(`Total indicadores leídos de Storage: ${registry.length}`);
  console.log(registry.map((i) => i.id).join(", "));

  const f12 = await getIndicadorRegistro("F1-2");
  console.log(`\ngetIndicadorRegistro("F1-2") [debe ser null, diferido]:`, f12);

  const f13 = await getIndicadorRegistro("F1-13");
  console.log(`\ngetIndicadorRegistro("F1-13"):`);
  console.log(JSON.stringify(f13, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
