// lib/centinela/pestel/scraper/dof.ts
// Lector RSS del Diario Oficial de la Federación.
// Implementación real en Fase 1.

import type { NewsItem } from "./googleNewsRSS";

/**
 * Obtiene los últimos boletines del DOF vía RSS.
 * Endpoint: https://www.dof.gob.mx/rss/rss.php
 */
export async function fetchDOFRSS(): Promise<NewsItem[]> {
  throw new Error("Not implemented — ver Fase 1");
}
