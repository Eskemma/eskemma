"use client";
// app/sefix/hooks/useGeoElectoralMapLoc.ts
// Construye scope, capas y colorByKey para el mapa coroplético de elecciones locales.
import { useState, useEffect, useRef, useCallback } from "react";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { PARTY_COLORS_LOC, PARTIDO_LABELS_LOC } from "@/lib/sefix/eleccionesLocalesConstants";
import type { GeoScopeElectoral, GeoLayerConfig, GeoLayerTipo } from "@/types/geo.types";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface GanadorFeature {
  ganador: string;
  top3: { partido: string; votos: number; pct: number }[];
  totalVotos: number;
  label: string;
}

interface GeoElectoralLocParams {
  cargo: string;
  anio: number;
  estado: string;
  cabecera: string;
  municipio: string;
  secciones: string[];
  queryVersion: number;
}

interface GeoElectoralLocResult {
  scope: GeoScopeElectoral;
  layers: GeoLayerConfig[];
  isLoading: boolean;
  error: string | null;
  partidosVisibles: { partido: string; color: string; label: string }[];
}

function formatVotos(n: number): string {
  return n.toLocaleString("es-MX");
}

function buildTooltipLoc(label: string, ganador: GanadorFeature): string {
  const medals = ["1°", "2°", "3°"];
  const rows = ganador.top3
    .map((t, i) => {
      const color = PARTY_COLORS_LOC[t.partido] ?? "#B0BEC5";
      const nombrePartido = escapeHtml(PARTIDO_LABELS_LOC[t.partido] ?? t.partido);
      return `<tr>
        <td style="padding:1px 4px 1px 0;white-space:nowrap">
          <span style="display:inline-block;width:8px;height:8px;background:${color};border-radius:50%;margin-right:4px"></span>
          ${medals[i]} ${nombrePartido}
        </td>
        <td style="padding:1px 4px;text-align:right;white-space:nowrap">${formatVotos(t.votos)}</td>
        <td style="padding:1px 0;text-align:right;white-space:nowrap;color:#64748b">${t.pct}%</td>
      </tr>`;
    })
    .join("");

  return `<div style="background:#ffffff;border-radius:6px;padding:8px 4px 4px;font-family:system-ui,sans-serif;font-size:12px;min-width:180px;max-width:240px;width:240px;box-shadow:0 2px 8px rgba(0,0,0,0.12);box-sizing:border-box">
    <p style="font-weight:600;margin:0 0 5px;color:#0f172a;font-size:11px;line-height:1.3">${escapeHtml(label)}</p>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    <p style="font-size:10px;color:#94a3b8;margin:4px 0 0">Total: ${formatVotos(ganador.totalVotos)} votos</p>
  </div>`;
}

export function useGeoElectoralMapLoc(params: GeoElectoralLocParams): GeoElectoralLocResult {
  const { cargo, anio, estado, cabecera, municipio, secciones, queryVersion } = params;
  const [ganadores, setGanadores] = useState<Record<string, GanadorFeature>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataKey, setDataKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const prevVersionRef = useRef(-1);

  const fetchGanadores = useCallback(async () => {
    if (!estado) return;

    const nivel: "municipios" | "secciones" = cabecera ? "secciones" : "municipios";

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const qs = new URLSearchParams({ nivel, cargo, anio: String(anio), estado });
    if (cabecera) qs.set("cabecera", cabecera);
    if (municipio) qs.set("municipio", municipio);

    try {
      const res = await fetch(`/api/sefix/geo-resultados-locales?${qs}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGanadores(data.ganadores ?? {});
      setDataKey((k) => k + 1);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Error desconocido");
      setGanadores({});
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
    }
  }, [cargo, anio, estado, cabecera, municipio]);

  useEffect(() => {
    if (queryVersion === prevVersionRef.current) return;
    prevVersionRef.current = queryVersion;
    fetchGanadores();
    return () => { abortRef.current?.abort(); };
  }, [queryVersion, fetchGanadores]);

  const estado_id = ESTADO_CVE_MAP[estado] ?? "";
  const scope: GeoScopeElectoral = {
    nivel: "entidad",
    estado_id,
    estado_nombre: estado,
    ...(secciones.length > 0 && { cve_secciones: secciones }),
  };

  const tipoShape: GeoLayerTipo = cabecera ? "secciones" : "municipios";

  const colorByKey: Record<string, string> = {};
  for (const [key, g] of Object.entries(ganadores)) {
    colorByKey[key] = PARTY_COLORS_LOC[g.ganador] ?? "#B0BEC5";
  }

  const layers: GeoLayerConfig[] = [
    {
      id: "electoral-loc",
      tipo: tipoShape,
      visible: true,
      colorByKey: Object.keys(colorByKey).length > 0 ? colorByKey : undefined,
      fillColor: Object.keys(colorByKey).length === 0 ? "#e2e8f0" : undefined,
      strokeColor: "#ffffff",
      strokeWidth: 0.6,
      fillOpacity: 0.82,
      version: dataKey,
      tooltip: (props) => {
        const cveEnt = String(props.CVE_ENT ?? "").padStart(2, "0");
        let featureKey: string;
        if (tipoShape === "municipios") {
          featureKey = cveEnt + String(props.CVE_MUN ?? "").padStart(3, "0");
        } else {
          featureKey = cveEnt + String(props.CVE_SECCION ?? "").padStart(4, "0");
        }
        const g = ganadores[featureKey];
        if (!g) return `<span style="font-size:12px;color:#64748b">${escapeHtml(featureKey)}</span>`;
        return buildTooltipLoc(g.label, g);
      },
    },
  ];

  const partidosSet = new Map<string, string>();
  for (const g of Object.values(ganadores)) {
    const p = g.ganador;
    if (!partidosSet.has(p)) {
      partidosSet.set(p, PARTY_COLORS_LOC[p] ?? "#B0BEC5");
    }
  }
  const partidosVisibles = [...partidosSet.entries()].map(([partido, color]) => ({
    partido,
    color,
    label: PARTIDO_LABELS_LOC[partido] ?? partido,
  }));

  return { scope, layers, isLoading, error, partidosVisibles };
}
