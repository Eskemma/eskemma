"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from "react-leaflet";
import type { PathOptions, Layer, LeafletMouseEvent } from "leaflet";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { GeoVisualizadorProps, GeoLayerConfig, GeoColorRamp, GeoScopeElectoral, GeoLayerTipo } from "@/types/geo.types";
import { getFeatureKey } from "@/types/geo.types";
import { useGeoShapes } from "./hooks/useGeoShapes";
import { GeoLegend } from "./GeoLegend";

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MEXICO_CENTER: [number, number] = [23.6, -102.5];

// ─────────────────────────────────────────────────────────────────────────────
// Color utilities
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function interpolateColor(ramp: GeoColorRamp, value: number): string {
  const t = Math.max(0, Math.min(1, (value - ramp.min) / (ramp.max - ramp.min)));
  const [lr, lg, lb] = hexToRgb(ramp.colorLow);
  const [hr, hg, hb] = hexToRgb(ramp.colorHigh);
  return `rgb(${Math.round(lr + (hr - lr) * t)},${Math.round(lg + (hg - lg) * t)},${Math.round(lb + (hb - lb) * t)})`;
}

function featureStyle(feature: Feature | undefined, layerConfig: GeoLayerConfig): PathOptions {
  // Apply selected highlight style if this feature's key is in selectedKeys
  if (layerConfig.selectedKeys && feature?.properties) {
    const key = getFeatureKey(layerConfig.tipo, feature.properties as Parameters<typeof getFeatureKey>[1]);
    if (key && layerConfig.selectedKeys.has(key)) {
      return layerConfig.selectedStyle ?? {
        color: "#1d4ed8",
        weight: 2.5,
        fillColor: "#bfdbfe",
        fillOpacity: 0.35,
      };
    }
  }

  const base: PathOptions = {
    color: layerConfig.strokeColor ?? "#1e293b",
    weight: layerConfig.strokeWidth ?? 0.8,
    fillOpacity: layerConfig.fillOpacity ?? 0.75,
  };
  if (layerConfig.fillColor === "transparent") return { ...base, fillOpacity: 0 };
  if (layerConfig.colorByKey && feature?.properties) {
    const key = getFeatureKey(layerConfig.tipo, feature.properties as Parameters<typeof getFeatureKey>[1]);
    const color = layerConfig.colorByKey[key] ?? "#B0BEC5";
    return { ...base, fillColor: color, fillOpacity: layerConfig.fillOpacity ?? 0.82, color: layerConfig.strokeColor ?? "#ffffff", weight: layerConfig.strokeWidth ?? 0.6 };
  }
  if (layerConfig.fillColor) return { ...base, fillColor: layerConfig.fillColor };
  if (layerConfig.colorRamp && layerConfig.data && feature?.properties) {
    const p = feature.properties;
    let key = "";
    if (p.CVEGEO)       key = String(p.CVEGEO);
    else if (p.CVE_SECCION) key = (p.CVE_ENT ?? "") + (p.CVE_SECCION ?? "");
    else if (p.CVE_MUN) key = (p.CVE_ENT ?? "") + (p.CVE_MUN ?? "");
    else if (p.DISTRITO_FED) key = (p.CVE_ENT ?? "") + (p.DISTRITO_FED ?? "");
    else if (p.DISTRITO_LOC) key = (p.CVE_ENT ?? "") + (p.DISTRITO_LOC ?? "");
    else key = p.CVE_ENT ?? "";
    const value = layerConfig.data[key];
    return value !== undefined
      ? { ...base, fillColor: interpolateColor(layerConfig.colorRamp, value) }
      : { ...base, fillColor: layerConfig.colorRamp.noDataColor ?? "#e2e8f0" };
  }
  return { ...base, fillColor: "#93c5fd" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry validation
// ─────────────────────────────────────────────────────────────────────────────

function isValidCoordPair(c: unknown): boolean {
  return Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number";
}
function isValidRing(ring: unknown): boolean {
  return Array.isArray(ring) && ring.length >= 3 && (ring as unknown[]).every(isValidCoordPair);
}
function isValidGeometry(geom: Geometry): boolean {
  switch (geom.type) {
    case "Point": return isValidCoordPair(geom.coordinates);
    case "LineString": return Array.isArray(geom.coordinates) && geom.coordinates.length >= 2 && geom.coordinates.every(isValidCoordPair);
    case "Polygon": return Array.isArray(geom.coordinates) && geom.coordinates.length > 0 && geom.coordinates.every(isValidRing);
    case "MultiPolygon":
      return Array.isArray(geom.coordinates) && geom.coordinates.length > 0 &&
        geom.coordinates.every(poly => Array.isArray(poly) && poly.length > 0 && poly.every(isValidRing));
    case "MultiLineString":
      return Array.isArray(geom.coordinates) && geom.coordinates.every(ls => Array.isArray(ls) && ls.every(isValidCoordPair));
    case "MultiPoint": return Array.isArray(geom.coordinates) && geom.coordinates.every(isValidCoordPair);
    default: return false;
  }
}
function sanitize(fc: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features.filter(f => f.geometry != null && isValidGeometry(f.geometry as Geometry)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Granularity order — most granular layer is the auto-zoom target
// ─────────────────────────────────────────────────────────────────────────────

const TIPO_GRANULARITY: Record<string, number> = {
  ageb_urbana: 0,
  ageb_rural: 0,
  secciones: 1,
  municipios: 2,
  distritos_loc: 3,
  distritos_fed: 4,
  entidades: 5,
};

function mostGranularTipo(layers: GeoLayerConfig[]): GeoLayerTipo {
  const visible = layers.filter(l => l.visible);
  if (visible.length === 0) return "entidades";
  return visible.sort(
    (a, b) => (TIPO_GRANULARITY[a.tipo] ?? 99) - (TIPO_GRANULARITY[b.tipo] ?? 99)
  )[0].tipo;
}

// ─────────────────────────────────────────────────────────────────────────────
// GeoLayerRenderer — pure display (no data fetching)
// ─────────────────────────────────────────────────────────────────────────────

function GeoLayerRenderer({
  geojson,
  layerConfig,
  onFeatureClick,
}: {
  geojson: FeatureCollection;
  layerConfig: GeoLayerConfig;
  onFeatureClick?: (layerId: string, props: Record<string, unknown>) => void;
}) {
  const safe = sanitize(geojson);
  if (safe.features.length === 0) return null;

  return (
    <GeoJSON
      key={JSON.stringify({ id: layerConfig.id, n: safe.features.length, dk: Object.keys(layerConfig.data ?? {}).length })}
      data={safe}
      style={(feature) => featureStyle(feature as Feature, layerConfig)}
      onEachFeature={(feature, layer: Layer) => {
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        if (layerConfig.tooltip) {
          layer.bindTooltip(layerConfig.tooltip(props), { sticky: true, direction: "top", offset: [0, -4] });
        }
        layer.on("click", (e: LeafletMouseEvent) => {
          e.originalEvent.stopPropagation();
          layerConfig.onClick?.(props);
          onFeatureClick?.(layerConfig.id, props);
        });
        layer.on("mouseover", () => {
          (layer as any).setStyle?.({ weight: (layerConfig.strokeWidth ?? 0.8) * 2.5, fillOpacity: 0.92 });
        });
        layer.on("mouseout", () => {
          (layer as any).setStyle?.(featureStyle(feature as Feature, layerConfig));
        });
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GeoLayerWithData — fetches its own shapes and renders.
// When isPrimary=true, calls map.fitBounds() on the sanitized geojson using
// L.geoJSON(safe).getBounds() — avoids degenerate-geometry crashes.
// ─────────────────────────────────────────────────────────────────────────────

function GeoLayerWithData({
  layerConfig,
  scope,
  onLoadingChange,
  onFeatureClick,
  isPrimary = false,
}: {
  layerConfig: GeoLayerConfig;
  scope: GeoScopeElectoral;
  onLoadingChange: (id: string, loading: boolean) => void;
  onFeatureClick?: (layerId: string, props: Record<string, unknown>) => void;
  isPrimary?: boolean;
}) {
  const { geojson, isLoading } = useGeoShapes(layerConfig.tipo, scope);
  const map = useMap();

  const onLoadingRef = useRef(onLoadingChange);
  onLoadingRef.current = onLoadingChange;

  useEffect(() => {
    onLoadingRef.current(layerConfig.id, isLoading);
  }, [layerConfig.id, isLoading]);

  const prevFitKeyRef = useRef("");
  useEffect(() => {
    if (!isPrimary || !geojson || geojson.features.length === 0) return;

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    function walkCoords(coords: unknown[]): void {
      if (!coords || coords.length === 0) return;
      if (typeof coords[0] === "number") {
        const lng = coords[0] as number;
        const lat = (coords[1] ?? NaN) as number;
        if (isFinite(lat) && isFinite(lng)) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
      } else {
        for (const c of coords) if (c != null) walkCoords(c as unknown[]);
      }
    }
    for (const f of geojson.features) {
      const geom = f.geometry as { coordinates?: unknown[] } | null;
      if (geom?.coordinates) walkCoords(geom.coordinates);
    }

    if (!isFinite(minLat)) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof import("leaflet");
    const bounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
    if (!bounds.isValid()) return;

    const key = `${JSON.stringify(scope)}|${minLat.toFixed(4)}|${minLng.toFixed(4)}`;
    if (key === prevFitKeyRef.current) return;
    prevFitKeyRef.current = key;
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  }, [geojson, isPrimary, map, scope]);

  if (!geojson || !layerConfig.visible) return null;

  return (
    <GeoLayerRenderer
      geojson={geojson}
      layerConfig={layerConfig}
      onFeatureClick={onFeatureClick}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main map component (loaded without SSR via GeoVisualizador)
// ─────────────────────────────────────────────────────────────────────────────

export function GeoVisualizadorMap({
  scope,
  layers,
  height = "500px",
  className = "",
  queryVersion = 0,
  onFeatureClick,
}: GeoVisualizadorProps) {
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const handleLoadingChange = useCallback((id: string, loading: boolean) => {
    setLoadingIds(prev => {
      const next = new Set(prev);
      loading ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const primaryTipo = mostGranularTipo(layers);
  const isLoading = loadingIds.size > 0;
  const legendLayer = layers.find(l => l.visible && l.colorRamp);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-gray-eske-20 dark:border-white/10 ${className}`}
      style={{ height }}
    >
      {isLoading && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-white-eske/70 dark:bg-[#0D2035]/70">
          <div className="flex flex-col items-center gap-2 text-blue-eske">
            <svg className="h-7 w-7 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium">Cargando mapa…</span>
          </div>
        </div>
      )}

      <MapContainer
        center={MEXICO_CENTER}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        scrollWheelZoom={true}
        className="z-0"
      >
        <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} />

        {layers.map(layerConfig => (
          <GeoLayerWithData
            key={`${layerConfig.id}-${queryVersion}`}
            layerConfig={layerConfig}
            scope={scope}
            onLoadingChange={handleLoadingChange}
            onFeatureClick={onFeatureClick}
            isPrimary={layerConfig.visible && layerConfig.tipo === primaryTipo}
          />
        ))}
      </MapContainer>

      {legendLayer?.colorRamp && (
        <GeoLegend colorRamp={legendLayer.colorRamp} label={legendLayer.id} />
      )}
    </div>
  );
}
