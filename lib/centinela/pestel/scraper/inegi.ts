// lib/centinela/pestel/scraper/inegi.ts
// Cliente REST para la API BIE del INEGI.
// Requiere token INEGI_TOKEN en variables de entorno.
// Implementación real en Fase 1.

/**
 * Obtiene el valor más reciente de uno o varios indicadores del INEGI.
 * Endpoint: https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/{id}
 * @param seriesIds - IDs de series BIE (ej. ["628194", "444612"])
 * @returns Mapa { serieId: valorNumerico }
 */
export async function fetchInegiIndicators(
  _seriesIds: string[]
): Promise<Record<string, number>> {
  throw new Error("Not implemented — ver Fase 1");
}
