/**
 * scripts/verify-fontana-familia1-cierre.ts
 * Verificación en vivo del dispatcher completo de Familia 1
 * (lib/fontana/ingesta/index.ts) — cierre de F1-2, F1-11, F1-16, F1-17,
 * F1-18, Paso 5 Fontana T10. Script temporal de verificación, no parte
 * del producto.
 *
 * Usage: npx tsx scripts/verify-fontana-familia1-cierre.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { resolverIndicadorFontana } = await import("../lib/fontana/ingesta");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");
  const { FAMILIA1_DIFERIDOS, FAMILIA1_ORDEN, FAMILIA1_NOMBRES } = await import("../lib/fontana/familia1Catalogo");

  console.log("=== FAMILIA1_DIFERIDOS (debe ser solo F1-10, F1-12) ===");
  console.log([...FAMILIA1_DIFERIDOS]);
  const esperado = new Set(["F1-10", "F1-12"]);
  const ok = FAMILIA1_DIFERIDOS.size === 2 && [...FAMILIA1_DIFERIDOS].every((id) => esperado.has(id));
  console.log(ok ? "✅ correcto" : "❌ INCORRECTO");

  const nuevos = ["F1-2", "F1-11", "F1-16", "F1-17", "F1-18"];
  const territorios = [
    { nivel: "municipal" as const, estado: "Jalisco", municipio: "Zapopan", nombre: "Zapopan, Jalisco" },
    { nivel: "municipal" as const, estado: "Nuevo León", municipio: "Monterrey", nombre: "Monterrey, Nuevo León" },
  ];

  for (const territorio of territorios) {
    console.log(`\n=== ${territorio.nombre} — 5 indicadores cerrados en este incremento ===`);
    for (const id of nuevos) {
      const celdas = await resolverIndicadorFontana(id, territorio);
      const partes = celdas.map((c) =>
        esValorDisponible(c)
          ? `${c.nivel}=${c.valor}${c.unidad ? " " + c.unidad : ""} (${c.naturaleza})`
          : `${c.nivel}=SIN DATO (${c.motivo})`
      );
      console.log(`  ${id} (${FAMILIA1_NOMBRES[id]}): ${partes.join(" | ")}`);
    }
  }

  console.log("\n=== Caso límite: F1-10 (todavía diferido) ===");
  const diferido = await resolverIndicadorFontana("F1-10", territorios[0]);
  console.log(JSON.stringify(diferido, null, 2));

  console.log("\n=== FAMILIA1_ORDEN cubre los 19 IDs, ninguno huérfano ===");
  console.log(FAMILIA1_ORDEN.length === 19 ? "✅ 19 indicadores" : `❌ ${FAMILIA1_ORDEN.length} indicadores`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
