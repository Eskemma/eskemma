/**
 * scripts/verify-fontana-enigh.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/enigh.ts —
 * Incremento 4, Fontana T10, Familia 2 (F2-6, F2-12, F2-15, F2-16).
 * Script temporal de verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-enigh.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const {
    resolverGini,
    resolverDecilesIngreso,
    resolverGastoSalud,
    resolverGastoEducacion,
    resolverEstadosGini,
  } = await import("../lib/fontana/ingesta/enigh");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Aguascalientes", municipio: "Aguascalientes", nombre: "Aguascalientes" },
    { nivel: "municipal" as const, estado: "Coahuila", municipio: "Saltillo", nombre: "Coahuila (nombre compuesto: Coahuila de Zaragoza)" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} ===`);
    const t0 = Date.now();

    const gini = await resolverGini(territorio);
    for (const c of gini) {
      console.log(`  [Gini] ${c.nivel}:`, esValorDisponible(c) ? `${c.valor} ${c.unidad}` : `SIN DATO (${c.motivo})`);
    }

    const deciles = await resolverDecilesIngreso(territorio);
    for (const c of deciles) {
      if (esValorDisponible(c)) {
        console.log(`  [Deciles] ${c.nivel}: promedio=${c.valor} | distribucion=`, c.distribucion);
      } else {
        console.log(`  [Deciles] ${c.nivel}: SIN DATO (${c.motivo})`);
      }
    }

    const salud = await resolverGastoSalud(territorio);
    for (const c of salud) {
      console.log(`  [Gasto Salud] ${c.nivel}:`, esValorDisponible(c) ? `${c.valor} ${c.unidad}` : `SIN DATO (${c.motivo})`);
    }

    const educacion = await resolverGastoEducacion(territorio);
    for (const c of educacion) {
      console.log(`  [Gasto Educación] ${c.nivel}:`, esValorDisponible(c) ? `${c.valor} ${c.unidad}` : `SIN DATO (${c.motivo})`);
    }

    console.log(`  tiempo: ${Date.now() - t0}ms`);
  }

  console.log("\n--- 2ª consulta (debe leer de caché en memoria) ---");
  const t2 = Date.now();
  await resolverGini(territorios[0]);
  console.log(`  tiempo: ${Date.now() - t2}ms`);

  console.log("\n=== Ver estados (Gini) — muestra 3 ===");
  const estados = await resolverEstadosGini();
  console.log(`  total: ${estados.length}`);
  for (const e of estados.slice(0, 3)) {
    console.log(`  ${e.nombre} (${e.cve}):`, esValorDisponible(e.celda) ? e.celda.valor : e.celda.motivo);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
