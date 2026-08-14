// lib/geo/distritos.ts
// Resolución compartida de distritos electorales (Federal y Local) →
// {cve, nombre}, extraída del mismo patrón ya usado por
// lib/geo/municipios.ts y por app/api/geo/options/route.ts (tipos
// distritos_fed/distritos_loc) — mismo topojson nacional
// (sefix/geo/ine/nacional/distritos_fed.topojson / distritos_loc.topojson),
// misma vintage 2025 que mgs_2025_INE (confirmado 2026-08-04: ambos
// topojson se generan, en scripts/geo-pipeline.ts, desde los MISMOS
// shapefiles DISTRITO_FEDERAL.shp/DISTRITO_LOCAL.shp de
// info_geo_eske/mgs_2025_INE/ que ya usa scripts/eceg-data-pipeline.ts
// para calcular valores reales — no es una fuente cartográfica distinta).
//
// Mismo caché de 2 niveles ya corregido en municipios.ts (fix
// 2026-08-03): la conversión cara del topojson nacional completo se
// cachea UNA vez, global; el filtrado por estado (barato) se deriva de
// ahí, nunca re-descarga/re-convierte por cada estado nuevo consultado.

import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";
import type { GeoOption } from "@/types/geo.types";
import cabecerasFed from "@/lib/geo/cabeceras_fed.json";
import cabecerasLoc from "@/lib/geo/cabeceras_loc.json";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX_INE = "sefix/geo/ine";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 día — el TopoJSON cambia una vez al año

type TipoDistritoGeo = "fed" | "loc";

interface CacheEntry { options: GeoOptionDistrito[]; ts: number }
const cachePorTipo: Record<TipoDistritoGeo, Map<string, CacheEntry>> = {
  fed: new Map(),
  loc: new Map(),
};

interface FeaturesCacheEntry { features: { properties: Record<string, unknown> }[]; ts: number }
const featuresCachePorTipo: Record<TipoDistritoGeo, FeaturesCacheEntry | null> = {
  fed: null,
  loc: null,
};

// Single-flight (fix 2026-08-06, mismo hallazgo y mismo fix que
// lib/geo/municipios.ts): getDistritosFederalesOptionsNacional()/
// getDistritosLocalesOptionsNacional() llaman esta función 32 veces vía
// Promise.all — sin esto, las 32 verían featuresCachePorTipo[tipo] === null
// en frío y descargarían/convertirían el topojson nacional completo 32
// veces en paralelo. Un slot de promesa en vuelo POR TIPO (fed y loc son
// archivos distintos, cada uno con su propia carrera posible).
const featuresPromisePorTipo: Record<TipoDistritoGeo, Promise<{ properties: Record<string, unknown> }[]> | null> = {
  fed: null,
  loc: null,
};

async function getDistritosFeaturesNacional(tipo: TipoDistritoGeo): Promise<{ properties: Record<string, unknown> }[]> {
  const cached = featuresCachePorTipo[tipo];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.features;
  if (featuresPromisePorTipo[tipo]) return featuresPromisePorTipo[tipo]!;

  featuresPromisePorTipo[tipo] = (async () => {
    const storagePath = `${STORAGE_PREFIX_INE}/nacional/distritos_${tipo}.topojson`;
    const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new Error(`File not found: ${storagePath}`);

    const [buf] = await file.download();
    const topojson = JSON.parse(buf.toString("utf-8"));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { feature } = require("topojson-client") as typeof import("topojson-client");
    const obj = topojson.objects as Record<string, unknown>;
    const layerName = Object.keys(obj)[0];
    const fc = feature(topojson as unknown as Parameters<typeof feature>[0], obj[layerName] as Parameters<typeof feature>[1]) as {
      features: { properties: Record<string, unknown> }[];
    };

    featuresCachePorTipo[tipo] = { features: fc.features, ts: Date.now() };
    return fc.features;
  })();

  try {
    return await featuresPromisePorTipo[tipo]!;
  } finally {
    featuresPromisePorTipo[tipo] = null;
  }
}

// Campo real del topojson (confirmado en app/api/geo/options/route.ts,
// ya en producción): DISTRITO_FED / DISTRITO_LOC — distinto del nombre
// DISTRITO_F/DISTRITO_L que usa mgs_2025_INE en scripts/eceg-data-pipeline.ts
// (mismo shapefile de origen, nombres de campo distintos tras el pipeline
// de conversión a topojson de scripts/geo-pipeline.ts).
const CAMPO_DISTRITO: Record<TipoDistritoGeo, string> = { fed: "DISTRITO_FED", loc: "DISTRITO_LOC" };
const PREFIJO_NOMBRE: Record<TipoDistritoGeo, string> = { fed: "D.F.", loc: "D.L." };
const CABECERAS: Record<TipoDistritoGeo, Record<string, string>> = {
  fed: cabecerasFed as Record<string, string>,
  loc: cabecerasLoc as Record<string, string>,
};

// Extiende GeoOption con la cabecera SIN fusionar — aditivo, no rompe a los
// consumidores existentes de GeoOption (Sefix/GeoEcegFilters, que hoy
// reconstruyen el nombre de cabecera parseando `nombre.split("–")` porque
// nunca tuvieron el campo separado; confirmado por lectura de código que
// ningún consumidor desestructura GeoOption de forma que un campo extra
// rompa algo — todos acceden solo a `.cve`/`.nombre`).
export interface GeoOptionDistrito extends GeoOption {
  /** Nombre de la cabecera distrital, sin el prefijo/cve. undefined si el
   *  catálogo no tiene esa cabecera (cobertura nacional verificada 26-08-13:
   *  300/300 federal, 679/679 local — el caso undefined no ocurre hoy en la
   *  práctica, pero se mantiene como fallback defensivo, no eliminado). */
  cabecera?: string;
}

async function getDistritosOptions(tipo: TipoDistritoGeo, estadoId: string): Promise<GeoOptionDistrito[]> {
  const padId = estadoId.padStart(2, "0");
  const cache = cachePorTipo[tipo];
  const key = `v1:${padId}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.options;

  const featuresNacionales = await getDistritosFeaturesNacional(tipo);
  const campo = CAMPO_DISTRITO[tipo];
  const features = featuresNacionales.filter(
    (f) => String(f.properties?.["CVE_ENT"] ?? "").padStart(2, "0") === padId
  );

  const seen = new Set<string>();
  const options: GeoOptionDistrito[] = [];
  for (const f of features) {
    const p = f.properties;
    const cve = String(p[campo] ?? "").padStart(3, "0");
    if (!cve || seen.has(cve)) continue;
    seen.add(cve);
    // Mismo formato de clave de cabecera ya usado en app/api/geo/options/route.ts:
    // estado(2) + distrito(2, sin padding a 3) — no cambiar sin revisar ese endpoint.
    const cabeceraKey = padId + String(Number(p[campo])).padStart(2, "0");
    const nombreCabecera = CABECERAS[tipo][cabeceraKey];
    const nombre = nombreCabecera ? `${PREFIJO_NOMBRE[tipo]} ${cve} – ${nombreCabecera}` : `${PREFIJO_NOMBRE[tipo]} ${cve}`;
    options.push({ cve, nombre, cabecera: nombreCabecera || undefined });
  }
  options.sort((a, b) => a.cve.localeCompare(b.cve));

  cache.set(key, { options, ts: Date.now() });
  return options;
}

export async function getDistritosFederalesOptions(estadoId: string): Promise<GeoOptionDistrito[]> {
  return getDistritosOptions("fed", estadoId);
}

export async function getDistritosLocalesOptions(estadoId: string): Promise<GeoOptionDistrito[]> {
  return getDistritosOptions("loc", estadoId);
}

// Reverso de ESTADO_CVE_MAP (nombre→cve) — para etiquetar cada entrada
// del índice nacional con el nombre legible de su estado.
const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);
const TODOS_LOS_ESTADOS_CVE = Object.values(ESTADO_CVE_MAP).sort();

export interface GeoOptionNacional extends GeoOptionDistrito {
  estadoCve: string;
  estadoNombre: string;
}

interface CacheNacionalEntry { options: GeoOptionNacional[]; ts: number }
const cacheNacionalPorTipo: Record<TipoDistritoGeo, CacheNacionalEntry | null> = {
  fed: null,
  loc: null,
};

// Agregación nacional — concatena los 32 estados sobre la función ya
// cacheada por estado (sin archivo nuevo en Storage). El costo caro
// (conversión del topojson nacional) se paga una sola vez, en la
// primera llamada de cualquier estado — las otras 31 son lookups
// baratos (mismo criterio ya verificado en lib/geo/municipios.ts).
async function getDistritosOptionsNacional(tipo: TipoDistritoGeo): Promise<GeoOptionNacional[]> {
  const cached = cacheNacionalPorTipo[tipo];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.options;

  const porEstado = await Promise.all(
    TODOS_LOS_ESTADOS_CVE.map(async (estadoCve) => {
      const options = await getDistritosOptions(tipo, estadoCve);
      return options.map((o) => ({ ...o, estadoCve, estadoNombre: CVE_ESTADO_NOMBRE[estadoCve] ?? estadoCve }));
    })
  );
  const todas = porEstado.flat();
  cacheNacionalPorTipo[tipo] = { options: todas, ts: Date.now() };
  return todas;
}

export async function getDistritosFederalesOptionsNacional(): Promise<GeoOptionNacional[]> {
  return getDistritosOptionsNacional("fed");
}

export async function getDistritosLocalesOptionsNacional(): Promise<GeoOptionNacional[]> {
  return getDistritosOptionsNacional("loc");
}
