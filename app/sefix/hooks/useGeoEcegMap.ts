"use client";
// app/sefix/hooks/useGeoEcegMap.ts
// Builds scope, layers, and colorRamp for the ECEG 2020 choropleth map.
import { useState, useEffect, useRef, useCallback } from "react";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import {
  ECEG_INDICATOR_MAP,
  ECEG_COLOR_RAMPS,
} from "@/lib/sefix/ecegConstants";
import type { GeoScopeElectoral, GeoLayerConfig, GeoLayerTipo } from "@/types/geo.types";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface UseGeoEcegMapParams {
  estado: string;
  cabecera: string;
  municipio: string;
  secciones: string[];
  queryVersion: number;
  variable: string;
}

interface UseGeoEcegMapResult {
  scope: GeoScopeElectoral;
  layers: GeoLayerConfig[];
  isLoading: boolean;
  error: string | null;
}

type EcegNivel = "nacional" | "municipios" | "secciones";

export function useGeoEcegMap(params: UseGeoEcegMapParams): UseGeoEcegMapResult {
  const { estado, cabecera, municipio, secciones, queryVersion, variable } = params;

  const [ecegData, setEcegData] = useState<{
    data: Record<string, number>;
    min: number;
    max: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataKey, setDataKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const prevVersionRef = useRef(-1);
  const prevVariableRef = useRef("");

  // Derive nivel from geographic scope (mirrors useGeoElectoralMap logic)
  const nivel: EcegNivel = !estado ? "nacional" : "municipios";
  // When a district or municipio is selected, show secciones
  const nivelResolved: EcegNivel =
    !estado ? "nacional"
    : cabecera || municipio || secciones.length > 0 ? "secciones"
    : "municipios";

  const fetchData = useCallback(async () => {
    if (!variable) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const qs = new URLSearchParams({ nivel: nivelResolved, variable });
    if (estado && nivelResolved !== "nacional") {
      const estadoId = ESTADO_CVE_MAP[estado];
      if (estadoId) qs.set("estado_id", estadoId);
    }

    try {
      const res = await fetch(`/api/sefix/eceg-datos?${qs}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEcegData({ data: json.data, min: json.min, max: json.max });
      setDataKey((k) => k + 1);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Error desconocido");
      setEcegData(null);
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
    }
  }, [estado, cabecera, municipio, secciones, variable, nivelResolved]);

  useEffect(() => {
    const versionChanged = queryVersion !== prevVersionRef.current;
    const variableChanged = variable !== prevVariableRef.current;
    if (!versionChanged && !variableChanged) return;
    prevVersionRef.current = queryVersion;
    prevVariableRef.current = variable;
    fetchData();
    return () => { abortRef.current?.abort(); };
  }, [queryVersion, variable, fetchData]);

  // Geographic scope
  const scope: GeoScopeElectoral = (() => {
    if (!estado) return { nivel: "nacional" };
    const estado_id = ESTADO_CVE_MAP[estado];
    if (cabecera) {
      const distMatch = cabecera.match(/^(\d{2})(\d+)/);
      const cve_distrito_fed = distMatch ? distMatch[2].padStart(3, "0") : "";
      return {
        nivel: "distrito_fed",
        estado_id,
        estado_nombre: estado,
        cve_distrito_fed,
        ...(secciones.length > 0 && { cve_secciones: secciones }),
      };
    }
    if (municipio) {
      return {
        nivel: "municipio",
        estado_id,
        estado_nombre: estado,
        cve_municipio: municipio,
      };
    }
    return { nivel: "entidad", estado_id, estado_nombre: estado };
  })();

  // Shape tipo based on nivel
  const tipoShape: GeoLayerTipo = (() => {
    if (!estado) return "entidades"; // national view uses existing INE entidades
    if (nivelResolved === "secciones") return "eceg_secciones_2020";
    return "eceg_municipios_2020";
  })();

  const indicator = ECEG_INDICATOR_MAP[variable];
  const group = indicator?.group ?? "demografia";
  const rampColors = ECEG_COLOR_RAMPS[group];

  const layers: GeoLayerConfig[] = [
    {
      id: "eceg",
      tipo: tipoShape,
      visible: true,
      data: ecegData?.data ?? {},
      colorRamp: ecegData
        ? {
            min: ecegData.min,
            max: ecegData.max,
            colorLow: rampColors.low,
            colorHigh: rampColors.high,
            noDataColor: "#E2E8F0",
          }
        : undefined,
      fillColor: !ecegData ? "#e2e8f0" : undefined,
      strokeColor: "#ffffff",
      strokeWidth: 0.6,
      fillOpacity: 0.82,
      version: dataKey,
      tooltip: (props) => {
        const cveEnt = String(props.CVE_ENT ?? "").padStart(2, "0");
        let featureKey: string;
        if (tipoShape === "entidades") {
          featureKey = cveEnt;
        } else if (tipoShape === "eceg_municipios_2020") {
          featureKey = cveEnt + String(props.CVE_MUN ?? "").padStart(3, "0");
        } else {
          featureKey = cveEnt + String(props.CVE_SECCION ?? "").padStart(4, "0");
        }

        const nombre = escapeHtml(
          String(props.NOMBRE_ENT ?? props.NOMGEO ?? props.CVE_SECCION ?? featureKey)
        );
        const val = ecegData?.data[featureKey];
        const valStr =
          val != null
            ? val.toLocaleString("es-MX", { maximumFractionDigits: 2 })
            : "Sin datos";
        const labelStr = escapeHtml(indicator?.label ?? variable);
        const unitStr = indicator?.unit ? escapeHtml(indicator.unit) : "";

        return `<div style="background:#ffffff;border-radius:6px;padding:8px;font-family:system-ui,sans-serif;font-size:12px;min-width:160px;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
          <p style="font-weight:600;margin:0 0 4px;color:#0f172a;font-size:11px">${nombre}</p>
          <p style="margin:0;color:#334155">${labelStr}</p>
          <p style="margin:2px 0 0;font-weight:700;color:#0f172a">${valStr}${unitStr ? ` <span style="font-weight:400;color:#64748b">${unitStr}</span>` : ""}</p>
          <p style="font-size:10px;color:#94a3b8;margin:4px 0 0">ECEG 2020 — INEGI</p>
        </div>`;
      },
    },
  ];

  return { scope, layers, isLoading, error };
}
