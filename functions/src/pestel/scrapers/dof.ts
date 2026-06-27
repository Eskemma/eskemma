// functions/src/pestel/scrapers/dof.ts
// Obtiene publicaciones del Diario Oficial de la Federación vía RSS.
// Filtra artículos de los últimos 7 días.

import Parser from "rss-parser";
import type {RawArticle} from "./googleNewsRSS";

const DOF_RSS_URL = "https://www.dof.gob.mx/rss/rss.php";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Retorna artículos del DOF publicados en los últimos 7 días.
 */
export async function fetchDOFRSS(): Promise<RawArticle[]> {
  const parser = new Parser({timeout: 30000});
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

  try {
    const feed = await parser.parseURL(DOF_RSS_URL);

    return (feed.items || [])
      .filter((item) => {
        if (!item.pubDate) return true;
        return new Date(item.pubDate) >= cutoff;
      })
      .map((item) => ({
        title: item.title || "",
        link: item.link || "",
        pubDate: item.pubDate || item.isoDate || "",
        content: item.contentSnippet || item.content || item.title || "",
        source: "dof" as const,
      }));
  } catch (error) {
    console.warn("[dof] Error al obtener RSS del DOF:", error);
    return [];
  }
}
