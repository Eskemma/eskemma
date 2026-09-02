/**
 * scripts/verify-fontana-disponibilidad-temporal.ts
 * Verifica que los 86 indicadores del registry tengan `disponibilidadTemporal`
 * poblado, con la categoría 1:1 de la auditoría final
 * (docs/ecosistema/T10-fontana/auditoria-series-temporales.md, addendum
 * 2026-08-31) y que los sub-grupos con nota especial (F3-8, F5-11..17,
 * F1-15/F1-19/F2-13) NO usen la nota genérica de su categoría.
 *
 * Lee el archivo LOCAL data/fontana/INDICATOR_REGISTRY.json (fuente de
 * edición). Para que el cambio sea efectivo en runtime falta subirlo:
 *   npx tsx scripts/upload-fontana-registry.ts
 *
 * Uso: npx tsx scripts/verify-fontana-disponibilidad-temporal.ts
 */

import * as fs from "fs";
import * as path from "path";

const REGISTRY_PATH = path.resolve(__dirname, "../data/fontana/INDICATOR_REGISTRY.json");

const NOTA_A_GEN =
  "Fontana hoy solo muestra el corte más reciente. La fuente sí tiene historia disponible; capturarla es una función pendiente, no un dato inexistente.";
const NOTA_A_F38 =
  "Fontana hoy solo muestra el corte más reciente. La fuente (decretos DOF) sí tiene historia, pero procesarla requiere revisar documentos de años anteriores uno por uno; no está priorizado por ahora.";
const NOTA_B_GEN =
  "Este indicador no tiene serie temporal: la fuente original solo publica una medición, no un histórico.";
const NOTA_B_COMPARABILIDAD =
  "Existen datos de ediciones anteriores del Censo, pero un cambio de metodología entre 2010/2015 y 2020 impide garantizar que sean comparables sin revisión adicional; no se muestra serie hasta confirmarlo.";
const NOTA_B_ANVCC =
  "Este indicador no tiene serie temporal en Fontana: la fuente que usamos (ANVCC) no la expone. Existen fuentes primarias con historial (ej. CONAFOR, SEGOB), pero no están conectadas en esta versión de Fontana.";
const MOTIVO_SEFIX = "Pendiente — se habilitará cuando Sefix-AI esté disponible";
const MOTIVO_RFOSC =
  "Fuente no disponible — infraestructura de RFOSC/CLUNI caída, reintentar en una próxima ronda";

const EXPECT_CONTEO = { a: 57, b: 19, c: 1, d: 9 };

const ESPERADO_NOTA: Record<string, string> = {
  "F3-8": NOTA_A_F38,
  "F2-17": NOTA_A_GEN,
  "F1-15": NOTA_B_COMPARABILIDAD,
  "F1-19": NOTA_B_COMPARABILIDAD,
  "F2-13": NOTA_B_COMPARABILIDAD,
  "F5-11": NOTA_B_ANVCC, "F5-12": NOTA_B_ANVCC, "F5-13": NOTA_B_ANVCC,
  "F5-14": NOTA_B_ANVCC, "F5-15": NOTA_B_ANVCC, "F5-16": NOTA_B_ANVCC, "F5-17": NOTA_B_ANVCC,
  "F3-5": MOTIVO_SEFIX, "F3-6": MOTIVO_SEFIX, "F3-9": MOTIVO_SEFIX, "F3-10": MOTIVO_SEFIX,
  "F3-11": MOTIVO_SEFIX, "F3-12": MOTIVO_SEFIX, "F3-13": MOTIVO_SEFIX, "F3-14": MOTIVO_SEFIX,
  "F3-15": MOTIVO_RFOSC,
};

const ESPERADO_CAT: Record<string, "a" | "b" | "c" | "d"> = {
  "F3-8": "a", "F2-17": "c",
  "F1-15": "b", "F1-19": "b", "F2-13": "b",
  "F5-11": "b", "F5-12": "b", "F5-13": "b", "F5-14": "b", "F5-15": "b", "F5-16": "b", "F5-17": "b",
  "F3-5": "d", "F3-6": "d", "F3-9": "d", "F3-10": "d", "F3-11": "d", "F3-12": "d",
  "F3-13": "d", "F3-14": "d", "F3-15": "d",
};

function main() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as Array<{
    id: string;
    disponibilidadTemporal?: { categoria: string; nota: string };
  }>;
  const fails: string[] = [];
  const conteo: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };

  for (const ind of registry) {
    const dt = ind.disponibilidadTemporal;
    if (!dt) { fails.push(`${ind.id}: falta disponibilidadTemporal`); continue; }
    if (!["a", "b", "c", "d"].includes(dt.categoria)) fails.push(`${ind.id}: categoria inválida "${dt.categoria}"`);
    if (!dt.nota || dt.nota.trim().length < 10) fails.push(`${ind.id}: nota vacía o muy corta`);
    conteo[dt.categoria] = (conteo[dt.categoria] ?? 0) + 1;

    if (ESPERADO_CAT[ind.id] && dt.categoria !== ESPERADO_CAT[ind.id]) {
      fails.push(`${ind.id}: categoria esperada "${ESPERADO_CAT[ind.id]}", got "${dt.categoria}"`);
    }
    if (ESPERADO_NOTA[ind.id] && dt.nota !== ESPERADO_NOTA[ind.id]) {
      fails.push(`${ind.id}: nota NO es la esperada para su caso especial`);
    }
    // Los casos especiales NUNCA deben caer en la nota genérica de su categoría.
    if ((ind.id === "F3-8") && dt.nota === NOTA_A_GEN) fails.push("F3-8 usa la nota genérica de 'a' (debe usar la especial)");
    if (/^F5-1[1-7]$/.test(ind.id) && dt.nota === NOTA_B_GEN) fails.push(`${ind.id} usa la nota genérica de 'b' (debe usar la de ANVCC)`);
    if (["F1-15", "F1-19", "F2-13"].includes(ind.id) && dt.nota === NOTA_B_GEN) fails.push(`${ind.id} usa la nota genérica de 'b' (debe usar la de comparabilidad)`);
  }

  // Ninguna nota especial debe aparecer en indicadores fuera de su grupo.
  for (const ind of registry) {
    const n = ind.disponibilidadTemporal?.nota;
    if (n === NOTA_A_F38 && ind.id !== "F3-8") fails.push(`${ind.id}: usa la nota especial de F3-8`);
    if (n === NOTA_B_ANVCC && !/^F5-1[1-7]$/.test(ind.id)) fails.push(`${ind.id}: usa la nota especial de ANVCC`);
  }

  for (const [cat, n] of Object.entries(EXPECT_CONTEO)) {
    if (conteo[cat] !== n) fails.push(`Conteo categoría "${cat}": esperado ${n}, got ${conteo[cat]}`);
  }
  if (registry.length !== 86) fails.push(`Total indicadores: esperado 86, got ${registry.length}`);

  console.log("Conteo:", conteo, "(esperado", EXPECT_CONTEO, ")");
  if (fails.length) {
    console.error(`\n❌ ${fails.length} fallos:`);
    fails.forEach((f) => console.error("  -", f));
    process.exit(1);
  }
  console.log("\n✅ 86/86 con disponibilidadTemporal; categorías 1:1 con la auditoría; notas especiales correctas (F3-8, F5-11..17, F1-15/F1-19/F2-13).");
  console.log("⚠️  Recordatorio: subir a Storage con `npx tsx scripts/upload-fontana-registry.ts` para que sea efectivo en runtime.");
}

main();
