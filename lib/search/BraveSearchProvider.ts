import type { SearchProvider, SearchResult } from "./SearchProvider";

// Brave Search API response shape (relevant fields only)
interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string | null;
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function normalizeAge(age: string | null | undefined): string | null {
  if (!age) return null;
  const d = new Date(age);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export class BraveSearchProvider implements SearchProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.search.brave.com/res/v1/web/search";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, opts: { count?: number } = {}): Promise<SearchResult[]> {
    const count = opts.count ?? 5;
    const url = new URL(this.baseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(count));

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
        },
      });
    } catch (err) {
      console.error(`[BraveSearch] Network error — query: "${query}"`, err);
      return [];
    }

    if (!res.ok) {
      console.error(`[BraveSearch] HTTP ${res.status} — query: "${query}"`);
      return [];
    }

    let data: BraveSearchResponse;
    try {
      data = (await res.json()) as BraveSearchResponse;
    } catch (err) {
      console.error(`[BraveSearch] JSON parse error — query: "${query}"`, err);
      return [];
    }

    return (data.web?.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.description ? stripHtml(r.description) : "",
      fecha: normalizeAge(r.age),
    }));
  }
}
