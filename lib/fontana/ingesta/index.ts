// lib/fontana/ingesta/index.ts
// Dispatcher de Familia 1 — enruta cada indicador al adaptador que lo
// resuelve. Único punto que app/api/fontana/familia/[familiaId]/route.ts
// necesita importar; agregar una fuente nueva no requiere tocar la ruta.

import { resolverIndicadorF1 as resolverIndicadorF1Eceg, FONTANA_F1_ECEG_MAP } from "@/lib/fontana/ingesta/eceg";
import { resolverIndicadorIter } from "@/lib/fontana/ingesta/iter";
import { resolverDensidad } from "@/lib/fontana/ingesta/compendio";
import { resolverRazonDependencia } from "@/lib/fontana/ingesta/conapo";
import { resolverRemesasPerCapita } from "@/lib/fontana/ingesta/banxico";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

const MOTIVO_CONECTOR_PENDIENTE =
  "Conector pendiente — disponible en un incremento posterior de Fontana";

export async function resolverIndicadorFamilia1(
  indicadorId: string,
  territorio: Territorio
): Promise<CeldaFontana[]> {
  if (indicadorId in FONTANA_F1_ECEG_MAP) {
    return resolverIndicadorF1Eceg(indicadorId, territorio);
  }
  if (indicadorId === "F1-2" || indicadorId === "F1-11") {
    return resolverIndicadorIter(indicadorId, territorio);
  }
  if (indicadorId === "F1-16") {
    return resolverDensidad(territorio);
  }
  if (indicadorId === "F1-17") {
    return resolverRemesasPerCapita(territorio);
  }
  if (indicadorId === "F1-18") {
    return resolverRazonDependencia(territorio);
  }

  // F1-10, F1-12 — bloqueados en ECEG (CURATED_COLUMNS incompleto),
  // pendientes de que se reprocesen los XLSX crudos.
  return [
    { nivel: "estatal", motivo: MOTIVO_CONECTOR_PENDIENTE },
    { nivel: "municipal", motivo: MOTIVO_CONECTOR_PENDIENTE },
  ];
}
