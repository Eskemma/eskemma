/**
 * scripts/verify-fontana-banxico.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/banxico.ts —
 * Paso 5, Fontana T10, Familia 1 (F1-17). Script temporal de
 * verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-banxico.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverRemesasPerCapita } = await import("../lib/fontana/ingesta/banxico");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
    { nivel: "municipal" as const, estado: "Nuevo León", municipio: "Monterrey", nombre: "Monterrey, Nuevo León" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} (1ª consulta) ===`);
    const t0 = Date.now();
    const celdas = await resolverRemesasPerCapita(territorio);
    const t1 = Date.now();
    for (const c of celdas) {
      if (esValorDisponible(c)) {
        console.log(`  ${c.nivel}: ${c.valor} ${c.unidad} | naturaleza=${c.naturaleza}`);
      } else {
        console.log(`  ${c.nivel}: SIN DATO (${c.motivo})`);
      }
    }
    console.log(`  tiempo: ${t1 - t0}ms`);

    console.log(`  --- 2ª consulta (debe leer de bodega, TTL 30d) ---`);
    const t2 = Date.now();
    await resolverRemesasPerCapita(territorio);
    const t3 = Date.now();
    console.log(`  tiempo: ${t3 - t2}ms`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
