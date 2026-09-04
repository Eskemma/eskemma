// lib/fontana/geo/municipiosDelTerritorio.ts
// Lista de municipios DISTINTOS que abarca el territorio de un proyecto de
// Fontana de nivel "municipal", tomando en cuenta la pluralidad real
// (municipiosPorEstado / municipiosSeleccionados) y no solo el campo legado
// singular `territorio.municipio` (que TerritorySelector fija al primer
// elemento).
//
// Espejo de estadosDelTerritorio.ts. Uso: la ruta de serie temporal la
// llama para indicadores con serie MUNICIPAL (F2-3 rezago social, F2-5/20/
// 21/22 IDH/sub-IDH) — si el proyecto abarca >1 municipio NO elige por el
// usuario, le pregunta a cuál se refiere (mismo criterio que multiEstado).

import type { Territorio } from "@/types/shared.types";
import { normalizeGeoName } from "@/lib/geo/municipios";

export interface MunicipioTerritorio {
  nombre: string;
  estado: string;
}

export function municipiosDelTerritorio(t: Territorio): MunicipioTerritorio[] {
  // key normalizada (estado|municipio) → par para mostrar (primero que aparece)
  const porNorm = new Map<string, MunicipioTerritorio>();
  const add = (nombre?: string | null, estado?: string | null) => {
    const n = (nombre ?? "").trim();
    const e = (estado ?? "").trim();
    if (!n || !e) return;
    const key = `${normalizeGeoName(e)}|${normalizeGeoName(n)}`;
    if (!porNorm.has(key)) porNorm.set(key, { nombre: n, estado: e });
  };

  // Fuente de verdad para municipal multi-estado.
  t.municipiosPorEstado?.forEach((m) => add(m.nombre, m.estado));

  // Fallback: lista plana sin estado por entrada → estado legado singular.
  if (porNorm.size === 0) {
    t.municipiosSeleccionados?.forEach((n) => add(n, t.estado));
  }

  // Último fallback: territorio legado singular.
  if (porNorm.size === 0) add(t.municipio, t.estado);

  return [...porNorm.values()];
}
