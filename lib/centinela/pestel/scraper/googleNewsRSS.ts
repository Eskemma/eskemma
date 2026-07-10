// lib/centinela/pestel/scraper/googleNewsRSS.ts
// Fetches recent articles from Google News RSS for a given territory and topic list.
// All topics run in parallel (unlike the CF cron scraper, which uses sequential delays).

import Parser from "rss-parser";

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  content: string;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchTopicWithTimeout(
  parser: Parser,
  territorio: string,
  topic: string
): Promise<NewsItem[]> {
  const query = `${territorio} ${topic}`;
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "+when:7d&hl=es-MX&gl=MX&ceid=MX:es-419";

  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items ?? []).map((item) => ({
      title: item.title ?? "",
      link: item.link ?? "",
      pubDate: item.pubDate ?? item.isoDate ?? "",
      content: item.contentSnippet ?? item.content ?? item.title ?? "",
    }));
    if (items.length === 0) {
      console.warn(`[googleNewsRSS] Feed vacío para query "${query}" — posible bloqueo o RSS sin resultados. URL: ${url}`);
    }
    return items;
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.warn(`[googleNewsRSS] Error en query "${query}": ${msg}. URL: ${url}`);
    return [];
  }
}

/**
 * Returns news articles for all provided topics, executed sequentially with
 * a 500ms delay between requests to avoid Google News rate-limiting.
 */
export async function fetchGoogleNewsRSS(
  territorio: string,
  topics: string[]
): Promise<NewsItem[]> {
  if (!territorio || topics.length === 0) return [];

  const parser = new Parser({
    headers: { "User-Agent": randomUserAgent() },
    timeout: 15000,
  });

  const articles: NewsItem[] = [];
  for (let i = 0; i < topics.length; i++) {
    const items = await fetchTopicWithTimeout(parser, territorio, topics[i]);
    articles.push(...items);
    if (i < topics.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }
  }
  return articles;
}

// ── Topic sets by project type ─────────────────────────────────
// Covers all 6 PEST-L dimensions: P/E/S/T/Ec/L

export function getNewsTopicsForProject(tipo: string, nivel: string): string[] {
  if (tipo === "electoral") {
    if (nivel === "municipal") {
      return [
        "elecciones municipales",
        "presidente municipal",
        "campaña electoral",
        "economía",
        "sociedad",
        "medio ambiente",
        "tecnología",
      ];
    }
    return [
      "elecciones",
      "campaña electoral",
      "candidatos",
      "economía",
      "sociedad",
      "medio ambiente",
      "tecnología",
    ];
  }
  if (tipo === "gubernamental") {
    return [
      "gobierno",
      "política gubernamental",
      "administración pública",
      "economía",
      "sociedad",
      "medio ambiente",
      "tecnología",
    ];
  }
  if (tipo === "legislativo") {
    return [
      "legislatura",
      "congreso",
      "diputados",
      "economía",
      "sociedad",
      "medio ambiente",
      "tecnología",
    ];
  }
  // ciudadano / default
  return ["política", "economía", "sociedad", "tecnología", "legislación", "medio ambiente"];
}
