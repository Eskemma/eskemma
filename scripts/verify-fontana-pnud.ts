/**
 * scripts/verify-fontana-pnud.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/pnud.ts —
 * Incremento 4, Fontana T10, Familia 2 (F2-5, F2-19, F2-20, F2-21,
 * F2-22). Script temporal de verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-pnud.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const {
    resolverIdhMunicipal,
    resolverSaludMunicipal,
    resolverEducacionMunicipal,
    resolverIngresoMunicipal,
    resolverIdgMunicipal,
  } = await import("../lib/fontana/ingesta/pnud");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco (caso normal)" },
    { nivel: "municipal" as const, estado: "Oaxaca", municipio: "Oaxaca de Juárez", nombre: "Oaxaca de Juárez (hueco IDH/Salud esperado, SE/SI/IDG deberían funcionar)" },
    { nivel: "municipal" as const, estado: "Nuevo León", municipio: "General Escobedo", nombre: "General Escobedo, NL (nombre completo, geo usa 'Gral. Escobedo')" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} ===`);
    const t0 = Date.now();

    const idh = await resolverIdhMunicipal(territorio);
    console.log("  [IDH]", idh.map((c) => `${c.nivel}=${esValorDisponible(c) ? c.valor : "SIN DATO: " + c.motivo}`).join(" | "));

    const salud = await resolverSaludMunicipal(territorio);
    console.log("  [Salud]", salud.map((c) => `${c.nivel}=${esValorDisponible(c) ? c.valor : "SIN DATO: " + c.motivo}`).join(" | "));

    const educacion = await resolverEducacionMunicipal(territorio);
    console.log("  [Educación]", educacion.map((c) => `${c.nivel}=${esValorDisponible(c) ? c.valor : "SIN DATO: " + c.motivo}`).join(" | "));

    const ingreso = await resolverIngresoMunicipal(territorio);
    console.log("  [Ingreso]", ingreso.map((c) => `${c.nivel}=${esValorDisponible(c) ? c.valor : "SIN DATO: " + c.motivo}`).join(" | "));

    const idg = await resolverIdgMunicipal(territorio);
    console.log("  [IDG]", idg.map((c) => `${c.nivel}=${esValorDisponible(c) ? c.valor : "SIN DATO: " + c.motivo}`).join(" | "));

    console.log(`  tiempo: ${Date.now() - t0}ms`);
  }

  console.log("\n--- 2ª consulta (debe leer de caché) ---");
  const t2 = Date.now();
  await resolverIdhMunicipal(territorios[0]);
  console.log(`  tiempo: ${Date.now() - t2}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
