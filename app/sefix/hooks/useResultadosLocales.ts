"use client";
// app/sefix/hooks/useResultadosLocales.ts
import { useState, useEffect, useRef } from "react";
import type { ResultadosEleccionesData, EleccionesLocalesFilterParams } from "@/types/sefix.types";

export function useResultadosLocales(
  params: EleccionesLocalesFilterParams,
  queryVersion: number
): { data: ResultadosEleccionesData | null; isLoading: boolean; error: string | null } {
  const [data, setData] = useState<ResultadosEleccionesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const lastVersion = useRef(-1);

  useEffect(() => {
    if (queryVersion === 0) return;
    if (queryVersion === lastVersion.current) return;
    lastVersion.current = queryVersion;
    cancelRef.current = false;
    setIsLoading(true);
    setError(null);

    const sp = new URLSearchParams({
      estado: params.estado,
      cargo: params.cargo,
      anio: String(params.anio),
    });
    if (params.tipo && params.tipo !== "AMBAS") sp.set("tipo", params.tipo);
    if (params.principio) sp.set("principio", params.principio);
    if (params.cabecera) sp.set("cabecera", params.cabecera);
    if (params.municipio) sp.set("municipio", params.municipio);
    if (params.secciones.length) sp.set("secciones", params.secciones.join(","));
    if (!params.partidos.includes("Todos") && params.partidos.length)
      sp.set("partidos", params.partidos.join(","));

    fetch(`/api/sefix/elecciones-locales-resultados?${sp}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelRef.current) {
          if (d.error) setError(d.error);
          else setData(d.resultados ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelRef.current) {
          setError("Error al cargar los resultados");
          setIsLoading(false);
        }
      });

    return () => { cancelRef.current = true; };
  }, [queryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading, error };
}

export function useResultadosLocalesAllYears(params: {
  committed: EleccionesLocalesFilterParams;
  queryVersion: number;
}): { data: ResultadosEleccionesData[]; isLoading: boolean } {
  const { committed, queryVersion } = params;
  const [data, setData] = useState<ResultadosEleccionesData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelRef = useRef(false);
  const lastVersion = useRef(-1);

  useEffect(() => {
    if (queryVersion === lastVersion.current) return;
    lastVersion.current = queryVersion;
    cancelRef.current = false;
    setIsLoading(true);

    const sp = new URLSearchParams({
      estado: committed.estado,
      cargo: committed.cargo,
      all_years: "true",
    });
    if (committed.tipo && committed.tipo !== "AMBAS") sp.set("tipo", committed.tipo);
    if (committed.principio) sp.set("principio", committed.principio);
    if (committed.cabecera) sp.set("cabecera", committed.cabecera);
    if (committed.municipio) sp.set("municipio", committed.municipio);
    if (committed.secciones.length) sp.set("secciones", committed.secciones.join(","));

    fetch(`/api/sefix/elecciones-locales-resultados?${sp}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelRef.current) setData(json.resultados ?? []); })
      .catch(() => { if (!cancelRef.current) setData([]); })
      .finally(() => { if (!cancelRef.current) setIsLoading(false); });

    return () => { cancelRef.current = true; };
  }, [queryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading };
}
