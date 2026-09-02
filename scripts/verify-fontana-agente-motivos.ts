/**
 * scripts/verify-fontana-agente-motivos.ts
 * Verificación en vivo para la capa conversacional de Fontana (T10):
 *  1. F3 Bloque 2 (F3-5/6/9-14, dependen de Sefix-AI) — confirma que
 *     resolverIndicadorFontana devuelve celdas SIN valor con un motivo
 *     que menciona Sefix-AI, y qué campos trae (naturaleza incluida o no).
 *  2. Registry: naturaleza por nivel + agregacionPlural.tipo de esos 8
 *     indicadores y de los narrativos de Familia 5 (F5-1/3/4/5/9/10).
 *
 * Usage: npx tsx scripts/verify-fontana-agente-motivos.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const TERRITORIO_MUNICIPAL = {
  nivel: "municipal" as const,
  pais: "México",
  estado: "Jalisco",
  municipio: "Guadalajara",
  nombre: "Guadalajara, Jalisco",
};

const F3_BLOQUE2 = ["F3-5", "F3-6", "F3-9", "F3-10", "F3-11", "F3-12", "F3-13", "F3-14"];
const F5_NARRATIVOS = ["F5-1", "F5-3", "F5-4", "F5-5", "F5-9", "F5-10"];

async function main() {
  const { resolverIndicadorFontana } = await import("../lib/fontana/ingesta");
  const { getIndicadorRegistro } = await import("../lib/fontana/indicatorRegistry");

  console.log("=== 1. F3 Bloque 2 — celdas resueltas (territorio: Guadalajara) ===");
  for (const id of F3_BLOQUE2) {
    const celdas = await resolverIndicadorFontana(id, TERRITORIO_MUNICIPAL);
    console.log(id, JSON.stringify(celdas));
  }

  console.log("\n=== 2. Registry: naturaleza + agregacionPlural de F3 Bloque 2 ===");
  for (const id of F3_BLOQUE2) {
    const r = await getIndicadorRegistro(id);
    console.log(id, JSON.stringify({
      mecanismoAcceso: r?.mecanismoAcceso,
      naturalezaPorNivel: r?.niveles?.map((n) => `${n.nivel}:${n.naturaleza}(${n.estado})`),
      agregacionPlural: r?.agregacionPlural?.tipo,
    }));
  }

  console.log("\n=== 3. F5 narrativos — celdas resueltas (territorio: Guadalajara) + registry ===");
  for (const id of F5_NARRATIVOS) {
    const celdas = await resolverIndicadorFontana(id, TERRITORIO_MUNICIPAL);
    const r = await getIndicadorRegistro(id);
    console.log(id, "celdas:", JSON.stringify(celdas));
    console.log(id, "registry:", JSON.stringify({
      naturalezaPorNivel: r?.niveles?.map((n) => `${n.nivel}:${n.naturaleza}(${n.estado})`),
      agregacionPlural: r?.agregacionPlural?.tipo,
    }));
  }

  console.log("\n=== 4. resolverTextoNarrativo (lo que sirve el endpoint /narrativa) ===");
  const { resolverTextoNarrativo } = await import("../lib/fontana/ingesta/contenidoCurado");
  for (const id of F5_NARRATIVOS) {
    const r = await resolverTextoNarrativo(id, TERRITORIO_MUNICIPAL);
    console.log(id, JSON.stringify({
      nivel: r.nivel,
      tieneTexto: r.texto !== null,
      largoTexto: r.texto?.length ?? 0,
      motivo: r.motivo,
      fuente: r.fuenteEtiqueta?.slice(0, 50) ?? null,
    }));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
