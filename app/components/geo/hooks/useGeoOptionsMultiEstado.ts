"use client";

import { useState, useEffect, useRef } from "react";
import type { GeoOption } from "@/types/geo.types";
import { fetchGeoOptions, type OptionTipo } from "./useGeoOptions";

export interface EstadoConCve {
  nombre: string;
  cve: string;
}

interface UseGeoOptionsMultiEstadoParams {
  tipo: OptionTipo;
  estados: EstadoConCve[];
}

// Decisión 1 (Ronda 2/3 del rediseño de territorio, 26-08-16) — carga en
// paralelo el catálogo de VARIOS estados a la vez (reemplaza el patrón
// "estado en edición" de la Ronda 1: elegir un estado, cargar, cambiar,
// repetir). Cada opción resultante viaja etiquetada con su estado de
// origen para poder construir la clave compuesta "{estado}::{cve}" en
// TerritorySelector.tsx (un mismo cve de 2 dígitos no es único entre
// estados).
//
// Promise.allSettled (no Promise.all) — decisión de diseño explícita,
// confirmada con Raúl: si 1 de N estados falla, los demás quedan
// usables con un aviso puntual solo para el que falló
// (erroresPorEstado), nunca bloqueando toda la vista — mismo criterio
// de "nunca bloquear más de lo necesario" ya aplicado en el resto de
// este workstream (cabecera desconocida, catálogo caído → texto libre).
export function useGeoOptionsMultiEstado<T extends GeoOption = GeoOption>({
  tipo,
  estados,
}: UseGeoOptionsMultiEstadoParams): {
  options: (T & { estado: string })[];
  isLoading: boolean;
  erroresPorEstado: Record<string, string>;
} {
  const [options, setOptions] = useState<(T & { estado: string })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [erroresPorEstado, setErroresPorEstado] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Key estable para el dep array — `estados` es un array nuevo en cada
  // render del padre; sin esto, el efecto se re-dispararía en cada
  // render aunque el CONTENIDO no haya cambiado.
  const estadosKey = estados.map((e) => `${e.nombre}:${e.cve}`).sort().join(",");

  useEffect(() => {
    abortRef.current?.abort();

    if (estados.length === 0) {
      setOptions([]);
      setIsLoading(false);
      setErroresPorEstado({});
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setErroresPorEstado({});

    (async () => {
      const resultados = await Promise.allSettled(
        estados.map((e) =>
          fetchGeoOptions<T>({ tipo, estadoId: e.cve }, controller.signal).then((data) => ({
            estado: e.nombre,
            data,
          }))
        )
      );
      if (controller.signal.aborted) return;

      const nuevasOpciones: (T & { estado: string })[] = [];
      const nuevosErrores: Record<string, string> = {};

      resultados.forEach((r, i) => {
        const estadoNombre = estados[i].nombre;
        if (r.status === "fulfilled") {
          for (const o of r.value.data) {
            nuevasOpciones.push({ ...o, estado: estadoNombre });
          }
        } else {
          const err = r.reason as Error;
          if (err?.name !== "AbortError") {
            nuevosErrores[estadoNombre] = err?.message ?? "No se pudo cargar el catálogo";
          }
        }
      });

      setOptions(nuevasOpciones);
      setErroresPorEstado(nuevosErrores);
      setIsLoading(false);
    })();

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, estadosKey]);

  return { options, isLoading, erroresPorEstado };
}
