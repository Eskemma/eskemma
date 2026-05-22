"use client";
// app/sefix/hooks/useGeoElectoralMap.ts
// Construye scope, capas y colorByKey para el mapa coroplético electoral.
import { useState, useEffect, useRef, useCallback } from "react";
import { ESTADO_CVE_MAP, PARTY_COLORS, PARTIDO_LABELS } from "@/lib/sefix/eleccionesConstants";
import type { GeoScopeElectoral, GeoLayerConfig, GeoLayerTipo } from "@/types/geo.types";

interface GanadorFeature {
  ganador: string;
  top3: { partido: string; votos: number; pct: number }[];
  totalVotos: number;
  label: string;
}

interface GeoElectoralParams {
  cargo: string;
  anio: number;
  estado: string;
  cabecera: string;
  secciones: string[];
  queryVersion: number;
}

interface GeoElectoralResult {
  scope: GeoScopeElectoral;
  layers: GeoLayerConfig[];
  isLoading: boolean;
  error: string | null;
  partidosVisibles: { partido: string; color: string; label: string }[];
}

function formatVotos(n: number): string {
  return n.toLocaleString("es-MX");
}

function buildTooltip(label: string, ganador: GanadorFeature): string {
  const medals = ["1°", "2°", "3°"];
  const rows = ganador.top3
    .map((t, i) => {
      const color = PARTY_COLORS[t.partido] ?? "#B0BEC5";
      const nombrePartido = PARTIDO_LABELS[t.partido] ?? t.partido;
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

  return `<div style="background:#ffffff;border-radius:6px;padding:8px 4px 4px;font-family:system-ui,sans-serif;font-size:12px;min-width:180px;max-width:240px;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
    <p style="font-weight:600;margin:0 0 5px;color:#0f172a;font-size:11px;line-height:1.3">${label}</p>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    <p style="font-size:10px;color:#94a3b8;margin:4px 0 0">Total: ${formatVotos(ganador.totalVotos)} votos</p>
  </div>`;
}

export function useGeoElectoralMap(params: GeoElectoralParams): GeoElectoralResult {
  const { cargo, anio, estado, cabecera, secciones, queryVersion } = params;
  const [ganadores, setGanadores] = useState<Record<string, GanadorFeature>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const prevVersionRef = useRef(-1);

  const fetchGanadores = useCallback(async () => {
    let nivel: "entidades" | "distritos_fed" | "secciones";
    if (!estado) {
      nivel = "entidades";
    } else if (cabecera) {
      nivel = "secciones";
    } else {
      nivel = "distritos_fed";
    }

    cancelRef.current = false;
    setIsLoading(true);
    setError(null);

    const qs = new URLSearchParams({ nivel, cargo, anio: String(anio) });
    if (estado) qs.set("estado", estado);
    if (cabecera) qs.set("cabecera", cabecera);

    try {
      const res = await fetch(`/api/sefix/geo-resultados?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!cancelRef.current) {
        setGanadores(data.ganadores ?? {});
      }
    } catch (e) {
      if (!cancelRef.current) {
        setError(e instanceof Error ? e.message : "Error desconocido");
        setGanadores({});
      }
    } finally {
      if (!cancelRef.current) setIsLoading(false);
    }
  }, [cargo, anio, estado, cabecera]);

  useEffect(() => {
    if (queryVersion === prevVersionRef.current) return;
    prevVersionRef.current = queryVersion;
    cancelRef.current = false;
    fetchGanadores();
    return () => { cancelRef.current = true; };
  }, [queryVersion, fetchGanadores]);

  // Scope geográfico derivado de los filtros
  const scope: GeoScopeElectoral = (() => {
    if (!estado) return { nivel: "nacional" };
    const estado_id = ESTADO_CVE_MAP[estado];
    if (cabecera) {
      // cabecera format: "SSDDD NAME" (e.g. "1405 PUERTO VALLARTA") → local dist = substring(2) = "05" → "005"
      const cve_distrito_fed = (cabecera.match(/^(\d+)/)?.[1] ?? "").substring(2).padStart(3, "0");
      return {
        nivel: "distrito_fed",
        estado_id,
        estado_nombre: estado,
        cve_distrito_fed,
        ...(secciones.length > 0 && { cve_secciones: secciones }),
      };
    }
    return { nivel: "entidad", estado_id, estado_nombre: estado };
  })();

  // Tipo de shape a mostrar según el scope
  const tipoShape: GeoLayerTipo = (() => {
    if (!estado) return "entidades";
    if (cabecera) return "secciones";
    return "distritos_fed";
  })();

  // colorByKey y tooltip construidos a partir de los datos
  const colorByKey: Record<string, string> = {};
  for (const [key, g] of Object.entries(ganadores)) {
    colorByKey[key] = PARTY_COLORS[g.ganador] ?? "#B0BEC5";
  }

  const layers: GeoLayerConfig[] = [
    {
      id: "electoral",
      tipo: tipoShape,
      visible: true,
      colorByKey: Object.keys(colorByKey).length > 0 ? colorByKey : undefined,
      fillColor: Object.keys(colorByKey).length === 0 ? "#e2e8f0" : undefined,
      strokeColor: "#ffffff",
      strokeWidth: 0.6,
      fillOpacity: 0.82,
      tooltip: (props) => {
        const cveEnt = String(props.CVE_ENT ?? "").padStart(2, "0");
        let featureKey: string;
        if (tipoShape === "entidades") featureKey = cveEnt;
        else if (tipoShape === "distritos_fed") featureKey = cveEnt + String(props.DISTRITO_FED ?? "").padStart(3, "0");
        else featureKey = cveEnt + String(props.CVE_SECCION ?? "").padStart(4, "0");
        const g = ganadores[featureKey];
        if (!g) return `<span style="font-size:12px">${featureKey}</span>`;
        return buildTooltip(g.label, g);
      },
    },
  ];

  // Lista de partidos únicos presentes en el scope para la leyenda
  const partidosSet = new Map<string, string>();
  for (const g of Object.values(ganadores)) {
    const p = g.ganador;
    if (!partidosSet.has(p)) {
      partidosSet.set(p, PARTY_COLORS[p] ?? "#B0BEC5");
    }
  }
  const partidosVisibles = [...partidosSet.entries()].map(([partido, color]) => ({
    partido,
    color,
    label: PARTIDO_LABELS[partido] ?? partido,
  }));

  return { scope, layers, isLoading, error, partidosVisibles };
}
