#!/usr/bin/env npx tsx
/**
 * scripts/check-geo-cf-sync.ts
 *
 * Guard de sincronización de la copia de Cloud Functions de la resolución de
 * estado → CVE (functions/src/utils/estadoCveMap.ts) contra la fuente real
 * (lib/geo/estados.ts). Dos comprobaciones:
 *   1. el archivo commiteado es EXACTAMENTE lo que genera la fuente;
 *   2. batería de paridad: para cientos de entradas (nombres, claves, alias,
 *      mayúsculas, acentos, "_", espacios, nacional, vacío, no-string) la copia
 *      responde igual que `resolverEstadoCve`.
 *
 *   npx tsx scripts/check-geo-cf-sync.ts           # chequea; exit 1 si difiere
 *   npx tsx scripts/check-geo-cf-sync.ts --write   # regenera la copia (npm run sync-geo-cf)
 *
 * El mismo chequeo corre como test de Vitest (lib/geo/estadoCveMapCF.test.ts),
 * que `npm run test` ejecuta como primer paso del pre-push (bloqueante).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buscarDivergenciasCF, generarEstadoCveMapCF, lineasDemasiadoLargas, RUTA_COPIA_CF } from "./lib/geoCfSync";

async function main() {
  const ruta = join(process.cwd(), RUTA_COPIA_CF);
  const generado = generarEstadoCveMapCF();
  const largas = lineasDemasiadoLargas(generado);
  if (largas.length) {
    console.error(`❌ El generador produjo ${largas.length} línea(s) de >80 columnas (rompe el lint de functions):\n${largas.join("\n")}`);
    process.exit(1);
  }

  if (process.argv.includes("--write")) {
    writeFileSync(ruta, generado, "utf8");
    console.log(`✅ Regenerado ${RUTA_COPIA_CF}`);
    return;
  }

  let problemas = 0;
  const actual = readFileSync(ruta, "utf8");
  if (actual !== generado) {
    problemas++;
    console.error(`❌ ${RUTA_COPIA_CF} NO coincide con lo que genera lib/geo/estados.ts.`);
  }
  const cf = (await import("../functions/src/utils/estadoCveMap")) as { getCveEntidad: (s: string) => string | null };
  const divergencias = buscarDivergenciasCF(cf.getCveEntidad);
  if (divergencias.length) {
    problemas++;
    console.error(`❌ ${divergencias.length} entrada(s) donde la copia de CF responde distinto que la fuente:`);
    for (const d of divergencias.slice(0, 20)) {
      console.error(`   ${JSON.stringify(d.entrada)} → CF: ${d.copiaCF} · fuente: ${d.fuente}`);
    }
  }
  if (problemas) {
    console.error("\nCorrección: npm run sync-geo-cf   (y commitea el archivo regenerado)");
    process.exit(1);
  }
  console.log("✅ La copia de Cloud Functions coincide con lib/geo/estados.ts (archivo idéntico + paridad total).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
