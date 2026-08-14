/**
 * scripts/verify-fontana-stps.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/stpsSalario.ts
 * — Incremento 4, Fontana T10, Familia 2 (F2-10). Script temporal de
 * verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-stps.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverSalarioImss, resolverEstadosStpsSalario } = await import(
    "../lib/fontana/ingesta/stpsSalario"
  );
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Aguascalientes", municipio: "Aguascalientes", nombre: "Aguascalientes" },
    { nivel: "municipal" as const, estado: "Baja California", municipio: "Tijuana", nombre: "Baja California" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} ===`);
    const t0 = Date.now();
    const celdas = await resolverSalarioImss(territorio);
    for (const c of celdas) {
      console.log(`  ${c.nivel}:`, esValorDisponible(c) ? `${c.valor} ${c.unidad}` : `SIN DATO (${c.motivo})`);
    }
    console.log(`  tiempo: ${Date.now() - t0}ms`);
  }

  console.log("\n--- 2ª consulta (debe leer de caché) ---");
  const t2 = Date.now();
  await resolverSalarioImss(territorios[0]);
  console.log(`  tiempo: ${Date.now() - t2}ms`);

  console.log("\n=== Ver estados ===");
  const estados = await resolverEstadosStpsSalario();
  console.log(`  total: ${estados.length}`);
  for (const e of estados.slice(0, 3)) {
    console.log(`  ${e.nombre} (${e.cve}):`, esValorDisponible(e.celda) ? e.celda.valor : e.celda.motivo);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
