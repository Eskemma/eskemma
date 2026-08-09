/**
 * scripts/verify-fontana-familia2-incremento1.ts
 * Verificación en vivo del Incremento 1 de Familia 2 (F2-4, F2-7, F2-8,
 * F2-11, F2-13) contra ≥2 territorios reales — mismo estándar aplicado a
 * cada pieza de Familia 1, sin relajar por estar en el grupo "barato".
 * Script temporal de verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-familia2-incremento1.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverIndicadorFontana } = await import("../lib/fontana/ingesta");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
    { nivel: "municipal" as const, estado: "Aguascalientes", municipio: "Aguascalientes", nombre: "Aguascalientes, Aguascalientes" },
    { nivel: "estatal" as const, estado: "Oaxaca", nombre: "Oaxaca (estatal)" },
  ];

  const ids = ["F2-4", "F2-7", "F2-8", "F2-11", "F2-13"];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} ===`);
    for (const indicadorId of ids) {
      const t0 = Date.now();
      const celdas = await resolverIndicadorFontana(indicadorId, territorio);
      const ms = Date.now() - t0;
      const partes = celdas.map((c) =>
        esValorDisponible(c)
          ? `${c.nivel}=${c.valor}${c.unidad ? " " + c.unidad : ""} [${c.naturaleza}]`
          : `${c.nivel}=SIN DATO (${c.motivo})`
      );
      console.log(`  ${indicadorId} (${ms}ms): ${partes.join(" | ")}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
