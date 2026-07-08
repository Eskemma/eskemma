// lib/centinela/pestel/scraper/dof.ts
// Fetches recent DOF (Diario Oficial de la Federación) publications via RSS.
// Filters items from the last 7 days.

import Parser from "rss-parser";
import type { NewsItem } from "./googleNewsRSS";

const DOF_RSS_URL = "https://www.dof.gob.mx/rss/rss.php";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function fetchDOFRSS(): Promise<NewsItem[]> {
  const parser = new Parser({ timeout: 15000 });
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

  try {
    const feed = await parser.parseURL(DOF_RSS_URL);
    return (feed.items ?? [])
      .filter((item) => {
        if (!item.pubDate) return true;
        return new Date(item.pubDate) >= cutoff;
      })
      .map((item) => ({
        title: item.title ?? "",
        link: item.link ?? "",
        pubDate: item.pubDate ?? item.isoDate ?? "",
        content: item.contentSnippet ?? item.content ?? item.title ?? "",
      }));
  } catch (err) {
    console.warn("[dof] Error al obtener RSS del DOF:", err);
    return [];
  }
}
