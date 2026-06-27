// lib/centinela/pestel/scraper/googleNewsRSS.ts
// Scraper de Google News RSS por territorio y query.
// Implementación real en Fase 1.

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  content: string;
}

/**
 * Busca noticias en Google News RSS filtrando por query y territorio.
 * Endpoint: https://news.google.com/rss/search?q={query}+when:7d&hl=es-MX&gl=MX&ceid=MX:es-419
 */
export async function fetchGoogleNewsRSS(_query: string): Promise<NewsItem[]> {
  throw new Error("Not implemented — ver Fase 1");
}
