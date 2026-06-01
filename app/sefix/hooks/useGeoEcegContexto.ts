"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { DISTRITO_TODOS } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegCommitted } from "@/app/sefix/hooks/useGeoEcegFilters";

export interface EcegNivelData {
  numerador: number;
  denominador: number | null;
  porcentaje: number | null; // null for index indicators
  valor: number;
}

export type EcegContexto = Partial<{
  nacional: EcegNivelData;
  estado: EcegNivelData;
  distrito: EcegNivelData;
  municipio: EcegNivelData;
  seccion: EcegNivelData;
}>;

interface Params {
  committed: EcegCommitted;
  variable: string;
  denominatorKey: string | undefined;
  queryVersion: number;
}

export function useGeoEcegContexto({
  committed,
  variable,
  denominatorKey,
  queryVersion,
}: Params): { contexto: EcegContexto | null; isLoading: boolean; error: string | null } {
  const [contexto, setContexto] = useState<EcegContexto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevKeyRef = useRef("");

  const buildFetchKey = useCallback(() => {
    return [
      variable,
      denominatorKey ?? "",
      committed.estado,
      committed.cabeceraCve,
      committed.municipioNombre,
      committed.municipioCve,
      committed.secciones.join(","),
    ].join("|");
  }, [variable, denominatorKey, committed]);

  const fetchContexto = useCallback(async () => {
    if (!variable) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams({ variable });
      if (denominatorKey) qs.set("denominator", denominatorKey);

      const estadoId = ESTADO_CVE_MAP[committed.estado] ?? "";
      if (estadoId) qs.set("estado_id", estadoId);

      const hasDistrict =
        committed.filterMode === "distrito" &&
        committed.cabeceraCve &&
        committed.cabeceraCve !== DISTRITO_TODOS;
      if (hasDistrict) qs.set("distrito_cve", committed.cabeceraCve);

      if (committed.filterMode === "municipio" && committed.municipioCve) {
        qs.set("municipio_cve", committed.municipioCve);
      }

      if (committed.secciones.length > 0) {
        qs.set("secciones", committed.secciones.join(","));
      }

      const res = await fetch(`/api/sefix/eceg-contexto?${qs}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EcegContexto = await res.json();
      setContexto(data);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Error desconocido");
      setContexto(null);
    } finally {
      if (abortRef.current === ctrl) setIsLoading(false);
    }
  }, [variable, denominatorKey, committed]);

  useEffect(() => {
    const key = buildFetchKey();
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;
    fetchContexto();
    return () => { abortRef.current?.abort(); };
  }, [queryVersion, buildFetchKey, fetchContexto]);

  return { contexto, isLoading, error };
}
