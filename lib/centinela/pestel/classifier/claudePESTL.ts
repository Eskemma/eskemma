// lib/centinela/pestel/classifier/claudePESTL.ts
// Clasificador PEST-L usando Claude API (Sonnet 4).
// Toma noticias en bruto y retorna factores clasificados por dimensión.
// Implementación real en Fase 2.

import type { Factor } from "@/types/pestel.types";
import type { NewsItem } from "../scraper/googleNewsRSS";

/**
 * Clasifica un batch de noticias en factores PEST-L usando Claude.
 * Procesa hasta 10 noticias por llamada (batching para control de costos).
 * @param items - Noticias a clasificar
 * @returns Lista de factores con categoría, impacto y sentimiento
 */
export async function classifyWithClaude(_items: NewsItem[]): Promise<Factor[]> {
  throw new Error("Not implemented — ver Fase 2");
}
