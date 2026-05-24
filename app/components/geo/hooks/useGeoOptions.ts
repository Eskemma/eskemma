"use client";

import { useState, useEffect, useRef } from "react";
import type { GeoOption } from "@/types/geo.types";

type OptionTipo = "municipios" | "distritos_fed" | "distritos_loc" | "secciones" | "localidades" | "agebs";

interface UseGeoOptionsParams {
  tipo: OptionTipo;
  estadoId: string;
  distrito_fed?: string;
  distrito_loc?: string;
  municipio?: string;
  /** INEGI: CVE_LOC filter for tipo=agebs */
  cve_loc?: string;
}

// Module-level cache shared across hook instances
const cache = new Map<string, GeoOption[]>();

function buildKey(p: UseGeoOptionsParams): string {
  return `${p.tipo}:${p.estadoId}:${p.distrito_fed ?? ""}:${p.distrito_loc ?? ""}:${p.municipio ?? ""}:${p.cve_loc ?? ""}`;
}

export function useGeoOptions({
  tipo,
  estadoId,
  distrito_fed,
  distrito_loc,
  municipio,
  cve_loc,
}: UseGeoOptionsParams): { options: GeoOption[]; isLoading: boolean; error: string | null } {
  const [options, setOptions] = useState<GeoOption[]>([]);
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
      setOptions(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const url = new URL("/api/geo/options", window.location.origin);
    url.searchParams.set("tipo", tipo);
    url.searchParams.set("estado_id", estadoId);
    if (distrito_fed) url.searchParams.set("distrito_fed", distrito_fed);
    if (distrito_loc) url.searchParams.set("distrito_loc", distrito_loc);
    if (municipio)    url.searchParams.set("municipio", municipio);
    if (cve_loc)      url.searchParams.set("loc", cve_loc);

    (async () => {
      try {
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data: GeoOption[] = await res.json();
        cache.set(key, data);
        setOptions(data);
        setIsLoading(false);
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message ?? "Error loading options");
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, estadoId, distrito_fed, distrito_loc, municipio, cve_loc]);

  return { options, isLoading, error };
}
