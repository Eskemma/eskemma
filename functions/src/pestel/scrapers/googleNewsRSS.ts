// functions/src/pestel/scrapers/googleNewsRSS.ts
// DEUDA: análogo a lib/centinela/pestel/scraper/googleNewsRSS.ts
// Razón: functions/ usa module:NodeNext; incompatible con
// moduleResolution:bundler de Next.js.
// Actualizar AMBAS copias si cambia lógica de scraping.
// Rate limit: 2s entre queries. Retry: 3 intentos con backoff exponencial.
//
// SYNC NOTE: getGoogleNewsLocale() is duplicated from
// lib/centinela/pestel/scraper/googleNewsRSS.ts.
// Any change to the locale table MUST be applied to BOTH files simultaneously.

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

// Google News locale mapping by country.
// ceid values verified empirically 2026-07-16 via RSS canonical links.
// BR:pt-419 — Google extends the 419 LatAm code to Brazilian Portuguese.
// PT uses pt-150 (UN code 150 = Europe).
// EUA: Spanish fallback — if es-419 returns < 3 articles, second call
// with en-US is made (see fetchGoogleNewsRSS).
interface GoogleNewsLocale {
  gl: string;
  hl: string;
  ceid: string;
  fallback?: {gl: string; hl: string; ceid: string};
}

const LOCALE_DEFAULT: GoogleNewsLocale = {
  gl: "MX",
  hl: "es-419",
  ceid: "MX:es-419",
};

const COUNTRY_LOCALE_MAP: Record<string, GoogleNewsLocale> = {
  "México": {gl: "MX", hl: "es-419", ceid: "MX:es-419"},
  "España": {gl: "ES", hl: "es", ceid: "ES:es"},
  "Estados Unidos": {
    gl: "US",
    hl: "es-419",
    ceid: "US:es-419",
    fallback: {gl: "US", hl: "en", ceid: "US:en"},
  },
  "Brasil": {gl: "BR", hl: "pt-BR", ceid: "BR:pt-419"},
  "Portugal": {gl: "PT", hl: "pt", ceid: "PT:pt-150"},
  "Argentina": {gl: "AR", hl: "es-419", ceid: "AR:es-419"},
  "Bolivia": {gl: "BO", hl: "es-419", ceid: "BO:es-419"},
  "Chile": {gl: "CL", hl: "es-419", ceid: "CL:es-419"},
  "Colombia": {gl: "CO", hl: "es-419", ceid: "CO:es-419"},
  "Costa Rica": {gl: "CR", hl: "es-419", ceid: "CR:es-419"},
  "Cuba": {gl: "CU", hl: "es-419", ceid: "CU:es-419"},
  "Ecuador": {gl: "EC", hl: "es-419", ceid: "EC:es-419"},
  "El Salvador": {gl: "SV", hl: "es-419", ceid: "SV:es-419"},
  "Guatemala": {gl: "GT", hl: "es-419", ceid: "GT:es-419"},
  "Honduras": {gl: "HN", hl: "es-419", ceid: "HN:es-419"},
  "Nicaragua": {gl: "NI", hl: "es-419", ceid: "NI:es-419"},
  "Panamá": {gl: "PA", hl: "es-419", ceid: "PA:es-419"},
  "Paraguay": {gl: "PY", hl: "es-419", ceid: "PY:es-419"},
  "Perú": {gl: "PE", hl: "es-419", ceid: "PE:es-419"},
  "Puerto Rico": {gl: "PR", hl: "es-419", ceid: "PR:es-419"},
  "República Dominicana": {gl: "DO", hl: "es-419", ceid: "DO:es-419"},
  "Uruguay": {gl: "UY", hl: "es-419", ceid: "UY:es-419"},
  "Venezuela": {gl: "VE", hl: "es-419", ceid: "VE:es-419"},
};

/**
 * Returns the Google News RSS locale params for a given country name.
 * @param {string | null | undefined} pais Country name from territorio.pais.
 * @return {GoogleNewsLocale} Locale params.
 */
export function getGoogleNewsLocale(
  pais?: string | null
): GoogleNewsLocale {
  if (!pais) return LOCALE_DEFAULT;
  return COUNTRY_LOCALE_MAP[pais] ?? LOCALE_DEFAULT;
}

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
 * Fetches articles for one topic with the given locale.
 * @param {Parser} parser RSS parser instance
 * @param {string} territorio Territory name
 * @param {string} topic Topic to search
 * @param {GoogleNewsLocale} locale Locale params
 * @return {Promise<RawArticle[]>}
 */
async function fetchTopicWithLocale(
  parser: Parser,
  territorio: string,
  topic: string,
  locale: {gl: string; hl: string; ceid: string}
): Promise<RawArticle[]> {
  const query = `${territorio} ${topic}`;
  const url =
    "https://news.google.com/rss/search?q=" +
    `${encodeURIComponent(query)}` +
    `+when:7d&hl=${locale.hl}&gl=${locale.gl}` +
    `&ceid=${encodeURIComponent(locale.ceid)}`;

  try {
    const feed = await withRetry(() => parser.parseURL(url));
    const items = feed.items || [];
    if (items.length === 0) {
      console.warn(
        `[googleNewsRSS] Feed vacío para query "${query}" — ` +
        "posible bloqueo o RSS sin resultados"
      );
    }
    return items.map((item) => ({
      title: item.title || "",
      link: item.link || "",
      pubDate: item.pubDate || item.isoDate || "",
      content: item.contentSnippet || item.content || item.title || "",
      source: "google_news" as const,
    }));
  } catch (error) {
    const msg =
      error instanceof Error ?
        `${error.name}: ${error.message}` : String(error);
    console.warn(`[googleNewsRSS] Error en query "${query}": ${msg}`);
    return [];
  }
}

/**
 * Obtiene artículos de Google News RSS para el territorio y tópicos dados.
 * Para "Estados Unidos", intenta es-419 primero; si retorna < 3 artículos,
 * hace una segunda pasada en en-US y combina (deduplicando por URL).
 * @param {string} territorio Nombre del territorio (ej. "Jalisco")
 * @param {string[]} topics Tópicos a buscar
 * @param {string | null | undefined} pais País del proyecto
 * @return {Promise<RawArticle[]>}
 */
export async function fetchGoogleNewsRSS(
  territorio: string,
  topics: string[] = TOPICS_DEFAULT,
  pais?: string | null
): Promise<RawArticle[]> {
  const locale = getGoogleNewsLocale(pais);
  console.log(
    `[googleNewsRSS] pais="${pais ?? "México (legacy)"}"`+
    ` → ceid=${locale.ceid}`
  );

  const parser = new Parser({
    headers: {"User-Agent": randomUserAgent()},
    timeout: 30000,
  });

  const articles: RawArticle[] = [];

  for (const topic of topics) {
    const items = await fetchTopicWithLocale(parser, territorio, topic, locale);
    articles.push(...items);
    await sleep(2000);
  }

  // EUA fallback: if Spanish search yielded < 3 articles, retry in English
  if (locale.fallback && articles.length < 3) {
    console.log(
      `[googleNewsRSS] EUA fallback: es-419 returned ${articles.length}` +
      " articles — retrying with en-US"
    );
    const seenUrls = new Set(articles.map((a) => a.link));
    for (const topic of topics) {
      const items = await fetchTopicWithLocale(
        parser, territorio, topic, locale.fallback
      );
      for (const item of items) {
        if (!seenUrls.has(item.link)) {
          articles.push(item);
          seenUrls.add(item.link);
        }
      }
      await sleep(2000);
    }
  }

  return articles;
}
