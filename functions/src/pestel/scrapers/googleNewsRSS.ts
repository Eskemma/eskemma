// functions/src/pestel/scrapers/googleNewsRSS.ts
// Obtiene artículos desde Google News RSS para un territorio y tópicos.
// Rate limit: 2s entre queries. Retry: 3 intentos con backoff exponencial.

import Parser from "rss-parser";

export interface RawArticle {
  title: string;
  link: string;
  pubDate: string;
  content: string;
  source: "google_news" | "dof";
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/120.0.0.0 Safari/537.36",
];

const TOPICS_DEFAULT = [
  "política",
  "economía",
  "sociedad",
  "tecnología",
  "legislación",
];

/**
 * Retorna un User-Agent aleatorio del pool definido.
 * @return {string} User-Agent string
 */
function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Espera el número de milisegundos indicado.
 * @param {number} ms Milisegundos a esperar
 * @return {Promise<void>}
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ejecuta fn hasta maxAttempts veces con backoff exponencial.
 * @param {Function} fn Función a ejecutar
 * @param {number} maxAttempts Número máximo de intentos
 * @return {Promise<T>}
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Obtiene artículos de Google News RSS para el territorio y tópicos dados.
 * @param {string} territorio Nombre del territorio (ej. "Jalisco")
 * @param {string[]} topics Tópicos a buscar
 * @return {Promise<RawArticle[]>}
 */
export async function fetchGoogleNewsRSS(
  territorio: string,
  topics: string[] = TOPICS_DEFAULT
): Promise<RawArticle[]> {
  const parser = new Parser({
    headers: {"User-Agent": randomUserAgent()},
    timeout: 30000,
  });

  const articles: RawArticle[] = [];

  for (const topic of topics) {
    const query = `${territorio} ${topic}`;
    const url =
      "https://news.google.com/rss/search?q=" +
      `${encodeURIComponent(query)}` +
      "+when:7d&hl=es-MX&gl=MX&ceid=MX:es-419";

    try {
      const feed = await withRetry(() => parser.parseURL(url));
      for (const item of feed.items || []) {
        articles.push({
          title: item.title || "",
          link: item.link || "",
          pubDate: item.pubDate || item.isoDate || "",
          content: item.contentSnippet || item.content || item.title || "",
          source: "google_news",
        });
      }
    } catch (error) {
      console.warn(`[googleNewsRSS] Error en query "${query}":`, error);
    }

    // Rate limit: 2s entre requests
    await sleep(2000);
  }

  return articles;
}
