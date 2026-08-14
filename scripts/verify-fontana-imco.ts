/**
 * scripts/verify-fontana-imco.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/imco.ts —
 * Incremento 4, Fontana T10, Familia 2 (F2-17). Script temporal de
 * verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-imco.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverCompetitividadEstatal, resolverEstadosImcoIce } = await import(
    "../lib/fontana/ingesta/imco"
  );
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
    { nivel: "municipal" as const, estado: "Chiapas", municipio: "Tuxtla Gutiérrez", nombre: "Tuxtla Gutiérrez, Chiapas" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} ===`);
    const celdas = await resolverCompetitividadEstatal(territorio);
    for (const c of celdas) {
      if (esValorDisponible(c)) {
        console.log(`  ${c.nivel}: ${c.valor} ${c.unidad} | naturaleza=${c.naturaleza}`);
      } else {
        console.log(`  ${c.nivel}: SIN DATO (${c.motivo})`);
      }
    }
  }

  console.log("\n=== Ver estados (nacional) ===");
  const estados = await resolverEstadosImcoIce();
  console.log(`  total: ${estados.length}`);
  const ordenados = [...estados].sort((a, b) => {
    const va = esValorDisponible(a.celda) ? a.celda.valor : -1;
    const vb = esValorDisponible(b.celda) ? b.celda.valor : -1;
    return vb - va;
  });
  for (const e of ordenados.slice(0, 3)) {
    const c = e.celda;
    console.log(`  ${e.nombre} (${e.cve}): ${esValorDisponible(c) ? c.valor : c.motivo}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
