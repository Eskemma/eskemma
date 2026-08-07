/**
 * scripts/verify-fontana-eceg.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/eceg.ts — cierre
 * de Familia 1 (Nacional/Distrital/fix de %/F1-10/F1-12). Script temporal
 * de verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-eceg.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverIndicadorF1, FONTANA_F1_ECEG_CONFIG } = await import("../lib/fontana/ingesta/eceg");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
    {
      nivel: "distrito_federal" as const,
      estado: "Jalisco",
      municipio: "Distrito Electoral Federal V con cabecera en Puerto Vallarta, Jalisco, México.",
      nombre: "Jalisco › Distrito Electoral Federal V, con cabecera en Puerto Vallarta, Jalisco, México.",
    },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} ===`);
    for (const indicadorId of Object.keys(FONTANA_F1_ECEG_CONFIG)) {
      const celdas = await resolverIndicadorF1(indicadorId, territorio);
      const partes = celdas.map((c) =>
        esValorDisponible(c)
          ? `${c.nivel}=${c.valor}${c.unidad ? " " + c.unidad : ""} [${c.naturaleza}]`
          : `${c.nivel}=SIN DATO (${c.motivo})`
      );
      console.log(`  ${indicadorId} (${FONTANA_F1_ECEG_CONFIG[indicadorId].key}): ${partes.join(" | ")}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
