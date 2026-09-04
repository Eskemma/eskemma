/**
 * scripts/verify-fontana-series-disponibilidad-sync.ts
 * Guard permanente (26-09-05, incidente Iztapalapa): falla si algún ID en
 * SERIES_DISPONIBLES (lib/fontana/series/seriesDisponibles.ts — Fontana YA
 * expone esa serie de verdad) conserva `disponibilidadTemporal` con
 * categoría "a"/"b"/"c"/"d" (data/fontana/INDICATOR_REGISTRY.json) — ese
 * campo es una auditoría manual de la FUENTE, sin relación automática con
 * el código, y describe "función pendiente"/"no disponible": si un
 * indicador YA tiene conector real, ese campo queda contradictorio y el
 * agente lo usa para explicar mal por qué "no hay serie" cuando sí la hay
 * (el modelo mezcla disponibilidadTemporal con tieneSerie).
 *
 * Correr manualmente después de tocar SERIES_DISPONIBLES o el registry —
 * no está enganchado a `next build`/`tsc` (ninguno de los dos ejecuta
 * scripts de datos hoy; ver nota en el reporte de la ronda).
 *
 * Uso: npx tsx scripts/verify-fontana-series-disponibilidad-sync.ts
 */

import * as fs from "fs";
import * as path from "path";
import { SERIES_DISPONIBLES } from "../lib/fontana/series/seriesDisponibles";

const REGISTRY_PATH = path.resolve(__dirname, "../data/fontana/INDICATOR_REGISTRY.json");

function main() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as Array<{
    id: string;
    disponibilidadTemporal?: { categoria: string; nota: string } | null;
  }>;
  const porId = new Map(registry.map((i) => [i.id, i]));

  const desincronizados: { id: string; categoria: string }[] = [];
  for (const id of Object.keys(SERIES_DISPONIBLES)) {
    const ind = porId.get(id);
    if (!ind) {
      console.error(`❌ ${id} está en SERIES_DISPONIBLES pero no existe en el registry.`);
      process.exit(1);
    }
    if (ind.disponibilidadTemporal) {
      desincronizados.push({ id, categoria: ind.disponibilidadTemporal.categoria });
    }
  }

  if (desincronizados.length > 0) {
    console.error(
      `❌ ${desincronizados.length} indicador(es) en SERIES_DISPONIBLES conservan disponibilidadTemporal desactualizado:`
    );
    for (const d of desincronizados) console.error(`   ${d.id} → categoría "${d.categoria}"`);
    console.error(
      "\nEstos indicadores YA tienen conector real (tieneSerie:true) — disponibilidadTemporal debe ser null." +
        "\nCorre scripts/fix-fontana-series-disponibilidad-sync.ts o actualiza el registry manualmente," +
        "\nluego scripts/upload-fontana-registry.ts para subir el fix a Storage."
    );
    process.exit(1);
  }

  console.log(`✅ ${Object.keys(SERIES_DISPONIBLES).length} indicadores de SERIES_DISPONIBLES sin disponibilidadTemporal stale.`);
}

main();
