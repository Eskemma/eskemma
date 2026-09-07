// lib/fontana/ingesta/serieInternacional.ts
// Dispatcher de series históricas de Familia 4 — PARALELO a
// resolverIndicadorComparativoF4 (familia4.ts), no una rama dentro de él.
// El camino de series de F4 no toca serieTemporal.ts / SERIES_DISPONIBLES /
// Territorio / nivelObjetivoSerie (todo eso es geográfico mexicano).
//
// Enruta por indicadorId → resolver de serie por fuente (que NO colapsa la
// serie a 1 punto, a diferencia del resolver de celda) y arma la fila país
// principal + países de referencia. Cada país conserva SUS PROPIOS años
// (CEPALSTAT solo reporta años de oleada; HDR trae 1990..2023) — el render
// posiciona cada punto por AÑO, no por índice, así que dos países con
// muestreo distinto se dibujan bien en el mismo eje sin romper la línea.

import { PAISES_REFERENCIA_F4 } from "@/lib/fontana/familia4Catalogo";
import type { SeriePaisComparativa, FilaSerieInternacional } from "@/lib/fontana/tablaComparativaInternacional";
import { SERIES_INTERNACIONALES_DISPONIBLES } from "@/lib/fontana/series/seriesInternacionalesDisponibles";
import { resolverSerieCepalstat } from "@/lib/fontana/ingesta/cepalstat";
import { resolverSerieHdr } from "@/lib/fontana/ingesta/pnudHdr";

const SIN_MECANISMO = (iso3: string): SeriePaisComparativa => ({
  iso3,
  estadoConsulta: "fuente_no_disponible",
  motivo: "Conector de serie pendiente para este indicador",
  puntos: [],
});

export async function resolverSerieInternacionalF4(
  indicadorId: string,
  paisPrincipalIso3: string
): Promise<FilaSerieInternacional> {
  const cfg = SERIES_INTERNACIONALES_DISPONIBLES[indicadorId];
  const isos3 = [paisPrincipalIso3, ...PAISES_REFERENCIA_F4.map((p) => p.iso3)];

  let porPais: Map<string, SeriePaisComparativa>;
  if (!cfg) {
    porPais = new Map(isos3.map((iso3) => [iso3, SIN_MECANISMO(iso3)]));
  } else if (cfg.fuenteId === "cepalstat") {
    porPais = await resolverSerieCepalstat(indicadorId, isos3, cfg.anioMinimo);
  } else if (cfg.fuenteId === "pnud_hdr") {
    porPais = await resolverSerieHdr(isos3);
  } else {
    // banco_mundial / transparency — Fases 2/3, aún sin resolver de serie.
    porPais = new Map(isos3.map((iso3) => [iso3, SIN_MECANISMO(iso3)]));
  }

  // Cada país conserva SUS PROPIOS años (sin re-expresar sobre un eje
  // común) — el render los posiciona por valor de año, así que México con
  // datos bienales y Colombia con datos anuales se dibujan sin que la
  // línea de México se rompa en los años intermedios que solo tiene otro
  // país. Los `puntos` de cada resolver ya vienen ordenados por año.
  return {
    indicadorId,
    paisPrincipal: porPais.get(paisPrincipalIso3) ?? SIN_MECANISMO(paisPrincipalIso3),
    referencia: PAISES_REFERENCIA_F4.map((p) => porPais.get(p.iso3) ?? SIN_MECANISMO(p.iso3)),
  };
}
