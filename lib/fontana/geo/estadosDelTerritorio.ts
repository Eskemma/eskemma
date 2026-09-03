// lib/fontana/geo/estadosDelTerritorio.ts
// Lista de estados DISTINTOS que abarca el territorio de un proyecto de
// Fontana, tomando en cuenta la pluralidad real
// (estadosSeleccionados / municipiosPorEstado / distritosSeleccionados) y
// no solo el campo legado singular `territorio.estado` (que
// TerritorySelector fija al estado del PRIMER elemento).
//
// Uso: la ruta de serie temporal (F2-17, dato estatal) llama a esto para
// decidir si el proyecto abarca >1 estado — en cuyo caso NO elige por el
// usuario, sino que le pregunta a cuál de sus estados se refiere.

import type { Territorio } from "@/types/shared.types";
import { normalizeGeoName } from "@/lib/geo/municipios";

export function estadosDelTerritorio(t: Territorio): string[] {
  // key normalizada → nombre para mostrar (primero que aparece)
  const porNorm = new Map<string, string>();
  const add = (n?: string | null) => {
    const nombre = (n ?? "").trim();
    if (!nombre) return;
    const key = normalizeGeoName(nombre);
    if (!porNorm.has(key)) porNorm.set(key, nombre);
  };

  t.estadosSeleccionados?.forEach((e) => add(e));
  t.municipiosPorEstado?.forEach((m) => add(m.estado));
  t.distritosSeleccionados?.forEach((d) => add(d.estado));

  // Sin pluralidad estructurada → territorio legado singular.
  if (porNorm.size === 0) add(t.estado);

  return [...porNorm.values()];
}
