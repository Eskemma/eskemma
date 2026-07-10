// lib/centinela/pestel/scraper/dof.ts
// Fetches recent DOF (Diario Oficial de la Federación) publications via RSS.
// Filters items from the last 7 days.

import https from "https";
import Parser from "rss-parser";
import type { NewsItem } from "./googleNewsRSS";

// URL verificada 2026-07-08 — /rss/rss.php retorna HTTP 404 desde esa fecha.
const DOF_RSS_URL = "https://www.dof.gob.mx/sumario.xml";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function fetchDOFRSS(): Promise<NewsItem[]> {
  // dof.gob.mx uses an intermediate CA not in Node.js's trust bundle.
  // Agent is scoped strictly to this parser instance — not a global TLS setting.
  const dofAgent = new https.Agent({ rejectUnauthorized: false });
  const parser = new Parser({ timeout: 15000, requestOptions: { agent: dofAgent } });
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

  try {
    const feed = await parser.parseURL(DOF_RSS_URL);
    const allItems = feed.items ?? [];
    const recent = allItems.filter((item) => {
      if (!item.pubDate) return true;
      return new Date(item.pubDate) >= cutoff;
    });
    console.log(
      `[dof] RSS: ${allItems.length} entradas totales, ` +
      `${recent.length} recientes (≥ ${cutoff.toISOString().slice(0, 10)})`
    );
    return recent.map((item) => ({
      title: item.title ?? "",
      link: item.link ?? "",
      pubDate: item.pubDate ?? item.isoDate ?? "",
      content: item.contentSnippet ?? item.content ?? item.title ?? "",
    }));
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.warn(`[dof] Error al obtener RSS: ${msg}. URL: ${DOF_RSS_URL}`);
    return [];
  }
}
