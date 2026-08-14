/**
 * scripts/verify-fontana-enoe-til1.ts
 * Verificación del adaptador lib/fontana/ingesta/enoeInformalidad.ts —
 * Incremento 4, Fontana T10, Familia 2 (F2-9). Script temporal de
 * verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-enoe-til1.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverInformalidadLaboral, resolverEstadosInformalidadLaboral } = await import(
    "../lib/fontana/ingesta/enoeInformalidad"
  );
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Aguascalientes", municipio: "Aguascalientes", nombre: "Aguascalientes" },
    { nivel: "municipal" as const, estado: "Oaxaca", municipio: "Oaxaca de Juárez", nombre: "Oaxaca" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} ===`);
    const celdas = await resolverInformalidadLaboral(territorio);
    for (const c of celdas) {
      console.log(`  ${c.nivel}:`, esValorDisponible(c) ? `${c.valor} ${c.unidad}` : `SIN DATO (${c.motivo})`);
    }
  }

  console.log("\n=== Ver estados ===");
  const estados = await resolverEstadosInformalidadLaboral();
  console.log(`  total: ${estados.length}`);
  const top = [...estados].sort((a, b) => {
    const va = esValorDisponible(a.celda) ? a.celda.valor : -1;
    const vb = esValorDisponible(b.celda) ? b.celda.valor : -1;
    return vb - va;
  });
  for (const e of top.slice(0, 3)) {
    console.log(`  ${e.nombre} (${e.cve}):`, esValorDisponible(e.celda) ? e.celda.valor : e.celda.motivo);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
