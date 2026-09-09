// lib/fontana/geo/resolverPaisesNombres.ts
// Análogo mínimo de resolverTerritoriosNombres.ts pero para PAÍSES de
// Familia 4 — no hay geografía que resolver, es un lookup en el mapa
// cerrado de 23 países iberoamericanos (PAIS_ISO3_POR_NOMBRE, el mismo
// dropdown del selector de territorio). Tolerante a acentos/mayúsculas
// vía normalizeGeoName. Nunca omite en silencio: un nombre que no está
// en el catálogo va a `noResueltos` con su motivo.
//
// 2026-09-08 — el usuario puede pedir agregar (ej. "añade Perú") o
// excluir (ej. "sin Argentina") países del set fijo de F4. El guard
// server-side (tools.ts, réplica del de comparacion_territorios) verifica
// aparte que el nombre lo haya dicho el usuario; esto solo mapea
// nombre → iso3.

import { PAIS_ISO3_POR_NOMBRE } from "@/lib/fontana/familia4Catalogo";
import { normalizeGeoName } from "@/lib/geo/municipios";

export interface ResolucionPaisesBatch {
  resueltos: { nombreIngresado: string; iso3: string; nombre: string }[];
  noResueltos: { nombreIngresado: string; motivo: string }[];
}

// Índice normalizado (una vez): "PERU" → { iso3: "PER", nombre: "Perú" }.
const POR_NOMBRE_NORMALIZADO = new Map<string, { iso3: string; nombre: string }>(
  Object.entries(PAIS_ISO3_POR_NOMBRE).map(([nombre, iso3]) => [
    normalizeGeoName(nombre),
    { iso3, nombre },
  ])
);

export function resolverPaisesNombres(nombres: string[]): ResolucionPaisesBatch {
  const resueltos: ResolucionPaisesBatch["resueltos"] = [];
  const noResueltos: ResolucionPaisesBatch["noResueltos"] = [];

  for (const nombreIngresado of nombres) {
    const hit = POR_NOMBRE_NORMALIZADO.get(normalizeGeoName(nombreIngresado.trim()));
    if (hit) {
      resueltos.push({ nombreIngresado, iso3: hit.iso3, nombre: hit.nombre });
    } else {
      noResueltos.push({
        nombreIngresado,
        motivo: `«${nombreIngresado}» no es un país del catálogo (América Latina más España, Portugal, Estados Unidos).`,
      });
    }
  }

  return { resueltos, noResueltos };
}
