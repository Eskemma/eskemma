/**
 * scripts/verify-fontana-eceg.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/eceg.ts — Paso 5,
 * Fontana T10. Script temporal de verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-eceg.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverIndicadorF1, FONTANA_F1_ECEG_MAP } = await import("../lib/fontana/ingesta/eceg");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
    { nivel: "municipal" as const, estado: "Nuevo León", municipio: "Monterrey", nombre: "Monterrey, Nuevo León" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} ===`);
    for (const indicadorId of Object.keys(FONTANA_F1_ECEG_MAP)) {
      const celdas = await resolverIndicadorF1(indicadorId, territorio);
      const partes = celdas.map((c) =>
        esValorDisponible(c) ? `${c.nivel}=${c.valor}${c.unidad ? " " + c.unidad : ""}` : `${c.nivel}=SIN DATO (${c.motivo})`
      );
      console.log(`  ${indicadorId} (${FONTANA_F1_ECEG_MAP[indicadorId]}): ${partes.join(" | ")}`);
    }
  }

  // Caso límite: indicador diferido (no debe traer valor, debe traer motivo)
  console.log("\n=== Caso límite: F1-2 (diferido) ===");
  const celdasDiferido = await resolverIndicadorF1("F1-2", territorios[0]);
  console.log(JSON.stringify(celdasDiferido, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
