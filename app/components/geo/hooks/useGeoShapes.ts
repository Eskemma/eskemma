"use client";

import { useState, useEffect, useRef } from "react";
import type { FeatureCollection } from "geojson";
import type { LatLngBounds } from "leaflet";
import type { GeoLayerTipo, GeoScopeElectoral } from "@/types/geo.types";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — consistent with storage.ts CACHE_TTL

interface CacheEntry {
  geojson: FeatureCollection;
  ts: number;
}

// Module-level cache: survives re-renders within the session.
// Key: "tipo:estado_id" (e.g. "secciones:14", "entidades:nacional")
const cache = new Map<string, CacheEntry>();

function sessionKey(tipo: GeoLayerTipo, estadoId?: string): string {
  // Per-state types need estado_id in key to avoid cache collisions across states.
  // All other types (entidades, municipios, distritos_*) use the single national file.
  return PER_ESTADO_TIPOS.includes(tipo) && estadoId
    ? `${tipo}:${estadoId}`
    : `${tipo}:nacional`;
}

// Layer types that are stored per-state only (no national file)
const PER_ESTADO_TIPOS: GeoLayerTipo[] = [
  "secciones", "ageb_urbana", "ageb_rural",
  "eceg_secciones_2020", "eceg_municipios_2020",
];

/**
 * Determines which Storage file to fetch:
 *
 * - entidades:    always nacional (32 features, 10 KB)
 * - municipios:   always nacional (2,477 features, 970 KB) — filter client-side
 * - distritos_*:  always nacional (300-400 features, <1 MB) — filter client-side
 * - secciones:    per-estado (nacional is 147 MB — too large)
 * - ageb_urbana:  per-estado (INEGI Marco Geoestadístico 2025)
 *
 * Returns null if the combination is unsupported (e.g. secciones nacional).
 */
function resolveParams(
  tipo: GeoLayerTipo,
  scope: GeoScopeElectoral
): { nivel: "nacional" | "estado"; estado_id?: string } | null {
  if (PER_ESTADO_TIPOS.includes(tipo)) {
    if (!scope.estado_id) return null;
    return { nivel: "estado", estado_id: scope.estado_id };
  }
  // All other tipos use the national file and filter client-side
  return { nivel: "nacional" };
}

// Layer types that carry CVE_SECCION and can be filtered by sección
const SECCION_FILTERABLE: GeoLayerTipo[] = ["secciones", "ageb_urbana", "ageb_rural", "eceg_secciones_2020"];

/**
 * Filters a FeatureCollection by estado and/or district, depending on scope.
 * National files are filtered to the requested estado when scope is sub-national.
 * The `tipo` parameter prevents sección filters from being applied to layers
 * (e.g. municipios/distritos) that don't carry CVE_SECCION in their properties.
 */
function filterByScope(
  geojson: FeatureCollection,
  scope: GeoScopeElectoral,
  tipo?: GeoLayerTipo
): FeatureCollection {
  const { nivel, estado_id, cve_distrito_fed, cve_distrito_loc, cve_municipio, cve_secciones } = scope;

  let features = geojson.features;

  // Filter by state when scope is sub-national (secciones files are already per-state)
  if (nivel !== "nacional" && estado_id) {
    features = features.filter(
      (f) => String(f.properties?.["CVE_ENT"] ?? "").padStart(2, "0") === estado_id.padStart(2, "0")
    );
  }

  // Filter by municipio. When cve_municipio is a name string (ECEG context uses municipality
  // display names), fall back to matching the NOMGEO property.
  if (cve_municipio) {
    features = features.filter((f) => {
      const cveMun = String(f.properties?.["CVE_MUN"] ?? "").padStart(3, "0");
      if (cveMun === cve_municipio.padStart(3, "0")) return true;
      const nomgeo = String(f.properties?.["NOMGEO"] ?? "").toUpperCase().trim();
      return nomgeo.length > 0 && nomgeo === cve_municipio.toUpperCase().trim();
    });
  }

  // Filter by district (mutually exclusive with municipio filter above)
  if (cve_distrito_fed) {
    features = features.filter(
      (f) => String(f.properties?.["DISTRITO_FED"] ?? "").padStart(3, "0") === cve_distrito_fed.padStart(3, "0")
    );
  } else if (cve_distrito_loc) {
    features = features.filter(
      (f) => String(f.properties?.["DISTRITO_LOC"] ?? "").padStart(3, "0") === cve_distrito_loc.padStart(3, "0")
    );
  }

  // Only filter by CVE_SECCION for layers that carry this field after the spatial join.
  // Municipios/distritos/entidades don't have CVE_SECCION and would return 0 features.
  if (cve_secciones && cve_secciones.length > 0 && (!tipo || SECCION_FILTERABLE.includes(tipo))) {
    const secSet = new Set(cve_secciones.map(s => s.padStart(4, "0")));
    features = features.filter(
      (f) => secSet.has(String(f.properties?.["CVE_SECCION"] ?? "").padStart(4, "0"))
    );
  }

  // Filter by localidad (INEGI ageb_urbana layers)
  if (scope.cve_loc) {
    const target = scope.cve_loc.padStart(4, "0");
    features = features.filter(
      (f) => String(f.properties?.["CVE_LOC"] ?? "").padStart(4, "0") === target
    );
  }

  // Filter by single AGEB code — legacy, single-select (INEGI layers)
  if (scope.cve_ageb) {
    const target = scope.cve_ageb.padStart(4, "0");
    features = features.filter(
      (f) => String(f.properties?.["CVE_AGEB"] ?? "").padStart(4, "0") === target
    );
  }

  // Filter by multi-select AGEBs: match CVEGEO (full 13-char unique code)
  if (scope.cve_agebs && scope.cve_agebs.length > 0) {
    const agebSet = new Set(scope.cve_agebs);
    features = features.filter(
      (f) => agebSet.has(String(f.properties?.["CVEGEO"] ?? ""))
    );
  }

  return { type: "FeatureCollection", features };
}

/**
 * Computes a Leaflet LatLngBounds from a FeatureCollection's coordinate
 * ranges. Returns null if no features are present.
 */
function computeBounds(geojson: FeatureCollection): LatLngBounds | null {
  if (typeof window === "undefined") return null;
  if (geojson.features.length === 0) return null;

  // Lazy-import Leaflet only on client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet") as typeof import("leaflet");

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  function walkCoords(coords: unknown[] | number[]): void {
    if (!coords || coords.length === 0) return;
    if (typeof coords[0] === "number") {
      const [lng, lat] = coords as number[];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    } else {
      for (const c of coords as unknown[][]) {
        if (c != null) walkCoords(c);
      }
    }
  }

  for (const f of geojson.features) {
    const geom = f.geometry as { coordinates?: unknown[] } | null;
    if (geom?.coordinates) walkCoords(geom.coordinates);
  }

  if (!isFinite(minLat)) return null;
  return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
}

/**
 * Clears specific entries from the module-level cache.
 * Pass estado_id to remove per-state entries for that state.
 * Called from GeoNavegador on explicit Consultar to force fresh data.
 */
export function clearGeoShapeCache(estadoId?: string): void {
  if (!estadoId) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (key.endsWith(`:${estadoId}`)) {
      cache.delete(key);
    }
  }
}

export interface GeoShapesResult {
  geojson: FeatureCollection | null;
  isLoading: boolean;
  error: string | null;
  bounds: LatLngBounds | null;
}

/**
 * Loads and caches TopoJSON shapes from /api/geo/shapes, converts them
 * to GeoJSON, and optionally filters by district scope client-side.
 */
export function useGeoShapes(
  tipo: GeoLayerTipo,
  scope: GeoScopeElectoral
): GeoShapesResult {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track in-flight fetch to cancel on cleanup
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const params = resolveParams(tipo, scope);
    if (!params) {
      setGeojson(null);
      setError("National secciones view not supported. Select a state.");
      return;
    }

    const key = sessionKey(tipo, params.estado_id);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      const filtered = filterByScope(cached.geojson, scope, tipo);
      setGeojson(filtered);
      setBounds(computeBounds(filtered));
      setError(null);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const url = new URL("/api/geo/shapes", window.location.origin);
    url.searchParams.set("tipo", tipo);
    url.searchParams.set("nivel", params.nivel);
    if (params.estado_id) url.searchParams.set("estado_id", params.estado_id);

    (async () => {
      try {
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const topojsonData = await res.json();

        // Convert TopoJSON → GeoJSON using topojson-client
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { feature } = require("topojson-client") as typeof import("topojson-client");
        const layerName = Object.keys(topojsonData.objects)[0];
        const fc = feature(topojsonData, topojsonData.objects[layerName]) as unknown as FeatureCollection;

        cache.set(key, { geojson: fc, ts: Date.now() });

        const filtered = filterByScope(fc, scope, tipo);
        setGeojson(filtered);
        setBounds(computeBounds(filtered));
        setIsLoading(false);
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message ?? "Error loading shapes");
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
    // Intentionally exclude `scope` object reference — only re-fetch when
    // the actual storage file changes (tipo, nivel, estado_id).
    // District filtering is client-side and handled synchronously above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, scope.nivel, scope.estado_id]);

  // Re-apply state/district filter when filter keys change without re-fetching
  useEffect(() => {
    const key = sessionKey(tipo, scope.estado_id);
    const cached = cache.get(key);
    if (!cached || !geojson) return;

    const filtered = filterByScope(cached.geojson, scope, tipo);
    setGeojson(filtered);
    setBounds(computeBounds(filtered));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.nivel, scope.estado_id, scope.cve_municipio, scope.cve_distrito_fed, scope.cve_distrito_loc, scope.cve_secciones?.join(","), scope.cve_ageb, scope.cve_loc, scope.cve_agebs?.join(",")]);

  return { geojson, isLoading, error, bounds };
}
