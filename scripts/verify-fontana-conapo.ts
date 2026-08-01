/**
 * scripts/verify-fontana-conapo.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/conapo.ts —
 * Paso 5, Fontana T10, Familia 1 (F1-18). Script temporal de
 * verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-conapo.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverRazonDependencia } = await import("../lib/fontana/ingesta/conapo");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
    { nivel: "municipal" as const, estado: "Aguascalientes", municipio: "Aguascalientes", nombre: "Aguascalientes, Aguascalientes" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} (1ª consulta) ===`);
    const t0 = Date.now();
    const celdas = await resolverRazonDependencia(territorio);
    const t1 = Date.now();
    for (const c of celdas) {
      if (esValorDisponible(c)) {
        console.log(`  ${c.nivel}: ${c.valor} | naturaleza=${c.naturaleza}`);
      } else {
        console.log(`  ${c.nivel}: SIN DATO (${c.motivo})`);
      }
    }
    console.log(`  tiempo: ${t1 - t0}ms`);

    console.log(`  --- 2ª consulta (debe leer de bodega) ---`);
    const t2 = Date.now();
    await resolverRazonDependencia(territorio);
    const t3 = Date.now();
    console.log(`  tiempo: ${t3 - t2}ms`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
