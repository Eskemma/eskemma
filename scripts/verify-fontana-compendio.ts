/**
 * scripts/verify-fontana-compendio.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/compendio.ts —
 * Paso 5, Fontana T10, Familia 1 (F1-16). Script temporal de
 * verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-compendio.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverDensidad } = await import("../lib/fontana/ingesta/compendio");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Guadalajara", nombre: "Guadalajara, Jalisco" },
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} (1ª consulta — dispara fetch real a INEGI) ===`);
    const t0 = Date.now();
    const celdas = await resolverDensidad(territorio);
    const t1 = Date.now();
    for (const c of celdas) {
      if (esValorDisponible(c)) {
        console.log(`  ${c.nivel}: ${c.valor} ${c.unidad} | naturaleza=${c.naturaleza} | fuente=${c.fuenteEtiqueta}`);
      } else {
        console.log(`  ${c.nivel}: SIN DATO (${c.motivo})`);
      }
    }
    console.log(`  tiempo: ${t1 - t0}ms`);

    console.log(`  --- 2ª consulta (debe leer de bodega, no volver a tocar INEGI) ---`);
    const t2 = Date.now();
    await resolverDensidad(territorio);
    const t3 = Date.now();
    console.log(`  tiempo: ${t3 - t2}ms (debería ser mucho menor que la 1ª)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
