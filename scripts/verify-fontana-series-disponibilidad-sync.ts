/**
 * scripts/verify-fontana-series-disponibilidad-sync.ts
 * Guard permanente (26-09-05, incidente Iztapalapa): falla si algún ID en
 * SERIES_DISPONIBLES o SERIES_INTERNACIONALES_DISPONIBLES (Fontana YA
 * expone esa serie de verdad) conserva `disponibilidadTemporal` con
 * categoría "a"/"b"/"c"/"d" (data/fontana/INDICATOR_REGISTRY.json) — ese
 * campo es una auditoría manual de la FUENTE, sin relación automática con
 * el código, y describe "función pendiente"/"no disponible": si un
 * indicador YA tiene conector real, ese campo queda contradictorio y el
 * agente lo usa para explicar mal por qué "no hay serie" cuando sí la hay
 * (el modelo mezcla disponibilidadTemporal con tieneSerie).
 *
 * 2026-09-06: extendido a SERIES_INTERNACIONALES_DISPONIBLES (Familia 4) —
 * misma clase de bug que motivó el guard: dejar una fuente de verdad nueva
 * sin la protección de sincronización que ya tenía la original.
 *
 * Correr manualmente después de tocar cualquiera de los 2 configs o el
 * registry — no está enganchado a `next build`/`tsc`.
 *
 * Uso: npx tsx scripts/verify-fontana-series-disponibilidad-sync.ts
 */

import * as fs from "fs";
import * as path from "path";
import { SERIES_DISPONIBLES } from "../lib/fontana/series/seriesDisponibles";
import { SERIES_INTERNACIONALES_DISPONIBLES } from "../lib/fontana/series/seriesInternacionalesDisponibles";

const REGISTRY_PATH = path.resolve(__dirname, "../data/fontana/INDICATOR_REGISTRY.json");

function main() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as Array<{
    id: string;
    disponibilidadTemporal?: { categoria: string; nota: string } | null;
  }>;
  const porId = new Map(registry.map((i) => [i.id, i]));

  const idsConSerie = [
    ...Object.keys(SERIES_DISPONIBLES).map((id) => ({ id, config: "SERIES_DISPONIBLES" })),
    ...Object.keys(SERIES_INTERNACIONALES_DISPONIBLES).map((id) => ({ id, config: "SERIES_INTERNACIONALES_DISPONIBLES" })),
  ];

  const desincronizados: { id: string; config: string; categoria: string }[] = [];
  for (const { id, config } of idsConSerie) {
    const ind = porId.get(id);
    if (!ind) {
      console.error(`❌ ${id} está en ${config} pero no existe en el registry.`);
      process.exit(1);
    }
    if (ind.disponibilidadTemporal) {
      desincronizados.push({ id, config, categoria: ind.disponibilidadTemporal.categoria });
    }
  }

  if (desincronizados.length > 0) {
    console.error(`❌ ${desincronizados.length} indicador(es) con serie real conservan disponibilidadTemporal desactualizado:`);
    for (const d of desincronizados) console.error(`   ${d.id} (${d.config}) → categoría "${d.categoria}"`);
    console.error(
      "\nEstos indicadores YA tienen conector real (tieneSerie:true / tieneSerieInternacional:true) — disponibilidadTemporal debe ser null." +
        "\nCorre scripts/fix-fontana-series-disponibilidad-sync.ts o actualiza el registry manualmente," +
        "\nluego scripts/upload-fontana-registry.ts para subir el fix a Storage."
    );
    process.exit(1);
  }

  console.log(`✅ ${idsConSerie.length} indicadores con serie (geográfica + internacional) sin disponibilidadTemporal stale.`);
}

main();
