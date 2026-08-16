"use client";

import { useState, useEffect, useRef } from "react";
import type { GeoOption } from "@/types/geo.types";

export type OptionTipo = "municipios" | "distritos_fed" | "distritos_loc" | "secciones" | "localidades" | "agebs";

export interface GeoOptionsParams {
  tipo: OptionTipo;
  estadoId: string;
  distrito_fed?: string;
  distrito_loc?: string;
  municipio?: string;
  /** INEGI: CVE_LOC filter for tipo=agebs */
  cve_loc?: string;
}

// Module-level cache shared across hook instances. Tipado como GeoOption[]
// (el shape mínimo común) — cada call site castea a su T vía el genérico
// del hook; el `key` ya incluye `tipo`, así que dos calls con distinto T
// nunca comparten entrada de caché por accidente.
const cache = new Map<string, GeoOption[]>();

function buildKey(p: GeoOptionsParams): string {
  return `${p.tipo}:${p.estadoId}:${p.distrito_fed ?? ""}:${p.distrito_loc ?? ""}:${p.municipio ?? ""}:${p.cve_loc ?? ""}`;
}

// Fetch cache-aware, standalone (Ronda 3, 26-08-16) — extraído de
// useGeoOptions para que useGeoOptionsMultiEstado.ts pueda disparar N
// fetches en paralelo (uno por estado seleccionado) sin duplicar la
// lógica de caché/URL-building ni violar las reglas de hooks (no se
// puede llamar useGeoOptions() un número variable de veces).
export async function fetchGeoOptions<T extends GeoOption = GeoOption>(
  params: GeoOptionsParams,
  signal?: AbortSignal
): Promise<T[]> {
  const key = buildKey(params);
  const cached = cache.get(key);
  if (cached) return cached as T[];

  const url = new URL("/api/geo/options", window.location.origin);
  url.searchParams.set("tipo", params.tipo);
  url.searchParams.set("estado_id", params.estadoId);
  if (params.distrito_fed) url.searchParams.set("distrito_fed", params.distrito_fed);
  if (params.distrito_loc) url.searchParams.set("distrito_loc", params.distrito_loc);
  if (params.municipio)    url.searchParams.set("municipio", params.municipio);
  if (params.cve_loc)      url.searchParams.set("loc", params.cve_loc);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const data: T[] = await res.json();
  cache.set(key, data);
  return data;
}

// T genérico (default GeoOption, sin cambio para los consumidores
// existentes): permite a TerritorySelector.tsx pedir GeoOptionDistrito
// (cve+nombre+cabecera) para tipo=distritos_fed/distritos_loc sin duplicar
// este hook — la respuesta cruda del endpoint ya trae `cabecera` cuando
// aplica (app/api/geo/options/route.ts), este hook no la descarta, solo no
// la tipaba hasta ahora.
export function useGeoOptions<T extends GeoOption = GeoOption>({
  tipo,
  estadoId,
  distrito_fed,
  distrito_loc,
  municipio,
  cve_loc,
}: GeoOptionsParams): { options: T[]; isLoading: boolean; error: string | null } {
  const [options, setOptions] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!estadoId) {
      setOptions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const key = buildKey({ tipo, estadoId, distrito_fed, distrito_loc, municipio, cve_loc });
    const cached = cache.get(key);
    if (cached) {
      setOptions(cached as T[]);
      setIsLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetchGeoOptions<T>({ tipo, estadoId, distrito_fed, distrito_loc, municipio, cve_loc }, controller.signal)
      .then((data) => {
        setOptions(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message ?? "Error loading options");
        setIsLoading(false);
      });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, estadoId, distrito_fed, distrito_loc, municipio, cve_loc]);

  return { options, isLoading, error };
}
