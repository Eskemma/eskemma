/**
 * scripts/verify-fontana-iter.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/iter.ts — Paso 5,
 * Fontana T10, Familia 1 (F1-2, F1-11). Script temporal de verificación,
 * no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-iter.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverIndicadorIter } = await import("../lib/fontana/ingesta/iter");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
    { nivel: "municipal" as const, estado: "Nuevo León", municipio: "Monterrey", nombre: "Monterrey, Nuevo León" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} ===`);

    const piramide = await resolverIndicadorIter("F1-2", territorio);
    for (const c of piramide) {
      if (esValorDisponible(c)) {
        const sumaGrupos = Object.values(c.distribucion ?? {}).reduce((a, b) => a + b, 0);
        console.log(
          `  F1-2 (pirámide) ${c.nivel}: POBTOT=${c.valor} | suma grupos=${sumaGrupos} | diferencia=${c.valor - sumaGrupos} | naturaleza=${c.naturaleza}`
        );
      } else {
        console.log(`  F1-2 (pirámide) ${c.nivel}: SIN DATO (${c.motivo})`);
      }
    }

    const urbanoRural = await resolverIndicadorIter("F1-11", territorio);
    for (const c of urbanoRural) {
      if (esValorDisponible(c)) {
        console.log(
          `  F1-11 (urbano/rural) ${c.nivel}: %urbano=${c.valor} | urbano=${c.distribucion?.urbano} rural=${c.distribucion?.rural} | naturaleza=${c.naturaleza}`
        );
      } else {
        console.log(`  F1-11 (urbano/rural) ${c.nivel}: SIN DATO (${c.motivo})`);
      }
    }
  }

  // Caso límite: territorio sin municipio (solo estado)
  console.log("\n=== Caso límite: sin municipio ===");
  const soloEstado = await resolverIndicadorIter("F1-11", { nivel: "estatal" as const, estado: "Jalisco", nombre: "Jalisco" });
  console.log(JSON.stringify(soloEstado, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
