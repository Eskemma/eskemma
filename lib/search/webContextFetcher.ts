import { getCached, setCached, CACHE_TTL } from "@/lib/centinela/pestel/cache/indicatorCache";
import { BraveSearchProvider } from "./BraveSearchProvider";
import { extractContextWithClaude } from "./extractContextWithClaude";
import type { WebContextResult } from "./SearchProvider";
import type { Territorio } from "@/types/pestel.types";

function getProvider(): BraveSearchProvider {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error("BRAVE_SEARCH_API_KEY is not set");
  return new BraveSearchProvider(key);
}

function buildGeoTag(territorio: Territorio): string {
  return [territorio.municipio, territorio.estado, territorio.pais]
    .filter(Boolean)
    .join(", ");
}

function buildCacheKey(tipo: string, territorio: Territorio): string {
  const date = new Date().toISOString().slice(0, 10);
  const pais = territorio.pais ?? "";
  const estado = territorio.estado ?? "";
  const municipio = territorio.municipio ?? "";
  // v2_ prefix busts entries written by the previous fetchWithCache-based implementation
  // which incorrectly cached { disponible: false } results permanently.
  return `v2_web_${tipo}_${pais}_${estado}_${municipio}_${date}`
    .toLowerCase()
    .replace(/\s+/g, "_");
}

async function fetchContext(
  tipo: string,
  query: string,
  territorio: Territorio
): Promise<WebContextResult> {
  const cacheKey = buildCacheKey(tipo, territorio);
  console.log(`[webContextFetcher] ${tipo} — key: ${cacheKey}`);

  const cached = await getCached<WebContextResult>(cacheKey);
  if (cached !== null) {
    console.log(`[webContextFetcher] ${tipo} cache HIT`);
    return cached;
  }

  const provider = getProvider();
  console.log(`[webContextFetcher] ${tipo} — calling Brave Search: "${query.slice(0, 80)}..."`);
  const results = await provider.search(query, { count: 7 });
  console.log(`[webContextFetcher] ${tipo} — Brave returned ${results.length} results`);

  const extracted = await extractContextWithClaude(results, tipo);
  console.log(
    `[webContextFetcher] ${tipo} — Claude extracted: disponible=${extracted.disponible} ` +
      `indicadores=${extracted.indicadores.length}`
  );

  // Only cache positive results. disponible:false is never cached — conscious trade-off:
  // avoids serving a stale negative indefinitely, at the cost of retrying
  // Brave+Claude on every regeneration for that context type.
  if (extracted.disponible && extracted.indicadores.length > 0) {
    await setCached(`web_${tipo}`, cacheKey, extracted, CACHE_TTL.TTL_24H);
  }
  return extracted;
}

export async function fetchWebEconomicContext(
  territorio: Territorio
): Promise<WebContextResult> {
  const geo = buildGeoTag(territorio);
  const query = `indicadores económicos inflación tipo de cambio desempleo PIB ${geo} 2025 2026`;
  return fetchContext("economic", query, territorio);
}

export async function fetchWebLegalContext(
  territorio: Territorio
): Promise<WebContextResult> {
  const geo = buildGeoTag(territorio);
  const query = `marco legal normativa vigente legislación constitución ${geo} 2025 2026`;
  return fetchContext("legal", query, territorio);
}

export async function fetchWebElectoralContext(
  territorio: Territorio
): Promise<WebContextResult> {
  const geo = buildGeoTag(territorio);
  const query = `resultados electorales participación partidos políticos elecciones ${geo} 2024 2025`;
  return fetchContext("electoral", query, territorio);
}
