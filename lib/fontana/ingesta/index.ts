// lib/fontana/ingesta/index.ts
// Dispatcher de Familia 1 — enruta cada indicador al adaptador que lo
// resuelve. Único punto que app/api/fontana/familia/[familiaId]/route.ts
// necesita importar; agregar una fuente nueva no requiere tocar la ruta.

import { resolverIndicadorF1 as resolverIndicadorF1Eceg, FONTANA_F1_ECEG_CONFIG } from "@/lib/fontana/ingesta/eceg";
import { resolverIndicadorIter } from "@/lib/fontana/ingesta/iter";
import { resolverDensidad } from "@/lib/fontana/ingesta/compendio";
import { resolverRazonDependencia } from "@/lib/fontana/ingesta/conapo";
import { resolverRemesasPerCapita } from "@/lib/fontana/ingesta/banxico";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

const MOTIVO_NIVEL_NO_CUBIERTO_ITER_COMPENDIO_ETC =
  "Nivel no cubierto — mecanismo de agregación no disponible para esta fuente";

// Los adaptadores fuera de ECEG (ITER, Compendio, Banxico, CONAPO) solo
// resuelven estatal/municipal — Nacional/Distrital no tienen mecanismo
// construido para ellos (investigación previa, cierre de Familia 1:
// ITER no viene por sección, Compendio es municipal, Banxico/CONAPO no
// bajan de entidad). Se completan aquí con motivo explícito para que el
// contrato de salida sea siempre 4 celdas, sin tocar cada adaptador.
function completarA4Celdas(celdas: CeldaFontana[]): CeldaFontana[] {
  const porNivel = new Map(celdas.map((c) => [c.nivel, c] as const));
  return (["nacional", "estatal", "distrital", "municipal"] as const).map(
    (nivel) => porNivel.get(nivel) ?? { nivel, motivo: MOTIVO_NIVEL_NO_CUBIERTO_ITER_COMPENDIO_ETC }
  );
}

export async function resolverIndicadorFamilia1(
  indicadorId: string,
  territorio: Territorio
): Promise<CeldaFontana[]> {
  if (indicadorId in FONTANA_F1_ECEG_CONFIG) {
    return resolverIndicadorF1Eceg(indicadorId, territorio);
  }
  if (indicadorId === "F1-2" || indicadorId === "F1-11") {
    return completarA4Celdas(await resolverIndicadorIter(indicadorId, territorio));
  }
  if (indicadorId === "F1-16") {
    return completarA4Celdas(await resolverDensidad(territorio));
  }
  if (indicadorId === "F1-17") {
    return completarA4Celdas(await resolverRemesasPerCapita(territorio));
  }
  if (indicadorId === "F1-18") {
    return completarA4Celdas(await resolverRazonDependencia(territorio));
  }

  return completarA4Celdas([]);
}
