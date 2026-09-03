// lib/fontana/ingesta/serieTemporal.ts
// Dispatcher de serie temporal — enruta indicadorId → resolver por familia
// de fuente, según el config SERIES_DISPONIBLES (fuente única de verdad de
// qué indicadores tienen serie). Ningún import directo de un adaptador
// específico desde el route/tool — todo pasa por aquí.

import type { Territorio } from "@/types/shared.types";
import type { ResultadoSerie } from "@/lib/fontana/series/tipos";
import { SERIES_DISPONIBLES } from "@/lib/fontana/series/seriesDisponibles";
import { resolverSerieCompetitividadEstatal } from "@/lib/fontana/ingesta/imco";
import { resolverSerieEnigh } from "@/lib/fontana/ingesta/enigh";
import { resolverSerieHuelgas } from "@/lib/fontana/ingesta/stpsHuelgas";
import { resolverSerieIep } from "@/lib/fontana/ingesta/iep";
import { resolverSerieInegiPm } from "@/lib/fontana/ingesta/inegiPm";

export async function resolverSerieTemporal(
  indicadorId: string,
  territorio: Territorio
): Promise<ResultadoSerie> {
  const cfg = SERIES_DISPONIBLES[indicadorId];
  if (!cfg) return { ok: false, motivo: "sin_serie" };

  switch (cfg.fuenteId) {
    case "imco": {
      // El piloto tiene su propia shape (SerieCompetitividadEstatal) — se
      // normaliza a ResultadoSerie aquí; su resolver NO cambia.
      const s = await resolverSerieCompetitividadEstatal(territorio);
      if (!s.ok) return s;
      return {
        ok: true,
        nivel: "estatal",
        territorioLabel: s.estadoNombre,
        unidad: s.unidad,
        naturaleza: s.naturaleza,
        fuenteEtiqueta: s.fuenteEtiqueta,
        formato: s.formato,
        puntos: s.puntos,
      };
    }
    case "enigh":
      return resolverSerieEnigh(indicadorId, territorio);
    case "stps_huelgas":
      return resolverSerieHuelgas(territorio);
    case "iep":
      return resolverSerieIep(territorio);
    case "inegi_pm_bise":
      return resolverSerieInegiPm(indicadorId, territorio);
  }
}
