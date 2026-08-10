/**
 * scripts/verify-fontana-icmm.ts
 * Verificación en vivo del adaptador lib/fontana/ingesta/icmm.ts —
 * Incremento 3, Fontana T10, Familia 2 (F2-18). Script temporal de
 * verificación, no parte del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-icmm.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverIngresoCorrienteMunicipal, resolverEstadosIcmm, resolverMunicipiosEstadoIcmm } = await import(
    "../lib/fontana/ingesta/icmm"
  );
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
    { nivel: "municipal" as const, estado: "Oaxaca", municipio: "Oaxaca de Juárez", nombre: "Oaxaca de Juárez, Oaxaca" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} (1ª consulta) ===`);
    const t0 = Date.now();
    const celdas = await resolverIngresoCorrienteMunicipal(territorio);
    const t1 = Date.now();
    for (const c of celdas) {
      if (esValorDisponible(c)) {
        console.log(
          `  ${c.nivel}: ${c.valor} ${c.unidad} | naturaleza=${c.naturaleza} | CV=${c.coeficienteVariacionPct}%`
        );
      } else {
        console.log(`  ${c.nivel}: SIN DATO (${c.motivo})`);
      }
    }
    console.log(`  tiempo: ${t1 - t0}ms`);

    console.log(`  --- 2ª consulta (debe leer de caché en memoria) ---`);
    const t2 = Date.now();
    await resolverIngresoCorrienteMunicipal(territorio);
    const t3 = Date.now();
    console.log(`  tiempo: ${t3 - t2}ms`);
  }

  console.log("\n=== Ver estados (nacional) — muestra 3 ===");
  const estados = await resolverEstadosIcmm();
  console.log(`  total: ${estados.length}`);
  for (const e of estados.slice(0, 3)) {
    const c = e.celda;
    console.log(`  ${e.nombre} (${e.cve}): ${esValorDisponible(c) ? `${c.valor} ${c.unidad}` : c.motivo}`);
  }

  console.log("\n=== Ver municipios (Jalisco, cve 14) — muestra 3 ===");
  const municipios = await resolverMunicipiosEstadoIcmm("14");
  console.log(`  total: ${municipios.length}`);
  for (const m of municipios.slice(0, 3)) {
    const c = m.celda;
    console.log(`  ${m.nombre} (${m.cve}): ${esValorDisponible(c) ? `${c.valor} ${c.unidad}` : c.motivo}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
