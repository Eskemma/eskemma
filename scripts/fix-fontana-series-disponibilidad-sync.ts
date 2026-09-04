/**
 * scripts/fix-fontana-series-disponibilidad-sync.ts
 * Corrige la desincronización encontrada 26-09-05 (incidente Iztapalapa):
 * `disponibilidadTemporal` en data/fontana/INDICATOR_REGISTRY.json seguía
 * describiendo "función pendiente" (categoría a/b/c/d) para los 13
 * indicadores que YA tienen un conector de serie real en
 * lib/fontana/series/seriesDisponibles.ts (SERIES_DISPONIBLES) — el campo
 * nunca se actualizó al cablear cada conector. Pone `disponibilidadTemporal`
 * en `null` para esos IDs (el system prompt ya instruye no usar ese campo
 * cuando `tieneSerie: true` — null lo hace imposible de usar por error).
 *
 * Uso: npx tsx scripts/fix-fontana-series-disponibilidad-sync.ts
 * Después: npx tsx scripts/diff-fontana-registry.ts   (revisar el diff)
 *          npx tsx scripts/upload-fontana-registry.ts (subir a Storage)
 */

import * as fs from "fs";
import * as path from "path";
import { SERIES_DISPONIBLES } from "../lib/fontana/series/seriesDisponibles";

const REGISTRY_PATH = path.resolve(__dirname, "../data/fontana/INDICATOR_REGISTRY.json");

function main() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as Array<
    Record<string, unknown> & { id: string }
  >;

  const idsSerie = new Set(Object.keys(SERIES_DISPONIBLES));
  const idsRegistry = new Set(registry.map((i) => i.id));
  const faltantes = [...idsSerie].filter((id) => !idsRegistry.has(id));
  if (faltantes.length) {
    console.error("IDs en SERIES_DISPONIBLES que no existen en el registry:", faltantes);
    process.exit(1);
  }

  let cambiados = 0;
  const antes: Record<string, unknown> = {};
  for (const ind of registry) {
    if (!idsSerie.has(ind.id)) continue;
    if (ind.disponibilidadTemporal !== null && ind.disponibilidadTemporal !== undefined) {
      antes[ind.id] = ind.disponibilidadTemporal;
      ind.disponibilidadTemporal = null;
      cambiados++;
    }
  }

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf-8");
  console.log(`OK — ${cambiados}/${idsSerie.size} indicadores de SERIES_DISPONIBLES corregidos a disponibilidadTemporal: null.`);
  console.log("IDs corregidos:", Object.keys(antes).sort());
}

main();
