// lib/centinela/pestel/scraper/banxico.ts
// Cliente REST para la API SIE de Banxico.
// Requiere token BANXICO_TOKEN en variables de entorno.
// Implementación real en Fase 1.

export interface BanxicoDataPoint {
  date: string;   // Formato: "YYYY-MM-DD"
  value: number;
}

/**
 * Obtiene la serie histórica de un indicador de Banxico.
 * Endpoint: https://www.banxico.org.mx/SieAPIRest/service/v1/series/{serie}/datos
 * @param seriesId - ID de la serie SIE (ej. "SF43718" para inflación)
 */
export async function fetchBanxicoSeries(
  _seriesId: string
): Promise<BanxicoDataPoint[]> {
  throw new Error("Not implemented — ver Fase 1");
}
