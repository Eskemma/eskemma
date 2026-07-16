// lib/centinela/pestel/scraper/googleNewsRSS.ts
// Fetches recent articles from Google News RSS for a given territory and topic list.
// All topics run in parallel (unlike the CF cron scraper, which uses sequential delays).
//
// SYNC NOTE: getGoogleNewsLocale() below is duplicated in
// functions/src/pestel/scrapers/googleNewsRSS.ts (CF cannot import from lib/).
// Any change to the locale table MUST be applied to BOTH files simultaneously.

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

// ── Google News locale mapping by country ─────────────────────────────────────
// ceid values verified empirically 2026-07-16 via Google News RSS canonical links.
// BR:pt-419 is correct despite being unintuitive (Google extends the 419 LatAm
// code to Brazilian Portuguese). PT uses pt-150 (UN code 150 = Europe).
// EUA has a Spanish fallback: if es-419 returns < 3 articles, a second call
// with en-US is made (see fetchGoogleNewsRSS).
interface GoogleNewsLocale {
  gl: string;
  hl: string;
  ceid: string;
  fallback?: { gl: string; hl: string; ceid: string };
}

const LOCALE_DEFAULT: GoogleNewsLocale = { gl: "MX", hl: "es-419", ceid: "MX:es-419" };

const COUNTRY_LOCALE_MAP: Record<string, GoogleNewsLocale> = {
  "México":                 { gl: "MX", hl: "es-419",  ceid: "MX:es-419" },
  "España":                 { gl: "ES", hl: "es",       ceid: "ES:es" },
  "Estados Unidos":         {
    gl: "US", hl: "es-419", ceid: "US:es-419",
    fallback: { gl: "US", hl: "en", ceid: "US:en" },
  },
  "Brasil":                 { gl: "BR", hl: "pt-BR",    ceid: "BR:pt-419" },
  "Portugal":               { gl: "PT", hl: "pt",       ceid: "PT:pt-150" },
  "Argentina":              { gl: "AR", hl: "es-419",   ceid: "AR:es-419" },
  "Bolivia":                { gl: "BO", hl: "es-419",   ceid: "BO:es-419" },
  "Chile":                  { gl: "CL", hl: "es-419",   ceid: "CL:es-419" },
  "Colombia":               { gl: "CO", hl: "es-419",   ceid: "CO:es-419" },
  "Costa Rica":             { gl: "CR", hl: "es-419",   ceid: "CR:es-419" },
  "Cuba":                   { gl: "CU", hl: "es-419",   ceid: "CU:es-419" },
  "Ecuador":                { gl: "EC", hl: "es-419",   ceid: "EC:es-419" },
  "El Salvador":            { gl: "SV", hl: "es-419",   ceid: "SV:es-419" },
  "Guatemala":              { gl: "GT", hl: "es-419",   ceid: "GT:es-419" },
  "Honduras":               { gl: "HN", hl: "es-419",   ceid: "HN:es-419" },
  "Nicaragua":              { gl: "NI", hl: "es-419",   ceid: "NI:es-419" },
  "Panamá":                 { gl: "PA", hl: "es-419",   ceid: "PA:es-419" },
  "Paraguay":               { gl: "PY", hl: "es-419",   ceid: "PY:es-419" },
  "Perú":                   { gl: "PE", hl: "es-419",   ceid: "PE:es-419" },
  "Puerto Rico":            { gl: "PR", hl: "es-419",   ceid: "PR:es-419" },
  "República Dominicana":   { gl: "DO", hl: "es-419",   ceid: "DO:es-419" },
  "Uruguay":                { gl: "UY", hl: "es-419",   ceid: "UY:es-419" },
  "Venezuela":              { gl: "VE", hl: "es-419",   ceid: "VE:es-419" },
};

export function getGoogleNewsLocale(pais?: string | null): GoogleNewsLocale {
  if (!pais) return LOCALE_DEFAULT;
  return COUNTRY_LOCALE_MAP[pais] ?? LOCALE_DEFAULT;
}

async function fetchTopicWithLocale(
  parser: Parser,
  territorio: string,
  topic: string,
  locale: { gl: string; hl: string; ceid: string }
): Promise<NewsItem[]> {
  const query = `${territorio} ${topic}`;
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    `+when:7d&hl=${locale.hl}&gl=${locale.gl}&ceid=${encodeURIComponent(locale.ceid)}`;

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
 * For "Estados Unidos", tries Spanish (es-419) first; if it returns < 3 articles,
 * makes a second pass in English (en-US) and merges results (deduplicated by URL).
 */
export async function fetchGoogleNewsRSS(
  territorio: string,
  topics: string[],
  pais?: string | null
): Promise<NewsItem[]> {
  if (!territorio || topics.length === 0) return [];

  const locale = getGoogleNewsLocale(pais);
  console.log(`[googleNewsRSS] pais="${pais ?? "México (legacy)"}" → ceid=${locale.ceid}`);

  const parser = new Parser({
    headers: { "User-Agent": randomUserAgent() },
    timeout: 15000,
  });

  const articles: NewsItem[] = [];
  for (let i = 0; i < topics.length; i++) {
    const items = await fetchTopicWithLocale(parser, territorio, topics[i], locale);
    articles.push(...items);
    if (i < topics.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }
  }

  // EUA fallback: if Spanish search yielded fewer than 3 articles, retry in English
  if (locale.fallback && articles.length < 3) {
    console.log(`[googleNewsRSS] EUA fallback: es-419 returned ${articles.length} articles — retrying with en-US`);
    const seenUrls = new Set(articles.map((a) => a.link));
    for (let i = 0; i < topics.length; i++) {
      const items = await fetchTopicWithLocale(parser, territorio, topics[i], locale.fallback);
      for (const item of items) {
        if (!seenUrls.has(item.link)) {
          articles.push(item);
          seenUrls.add(item.link);
        }
      }
      if (i < topics.length - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
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
