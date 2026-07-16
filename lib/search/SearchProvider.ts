export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  fecha: string | null; // YYYY-MM-DD or null if not available
}

export interface ExtractedIndicator {
  nombre: string;
  valor: string;
  fuente: string;
  url: string;
  fecha: string | null;
}

export interface WebContextResult {
  disponible: boolean;
  indicadores: ExtractedIndicator[];
}

export interface SearchProvider {
  search(query: string, opts?: { count?: number }): Promise<SearchResult[]>;
}
