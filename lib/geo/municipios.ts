// lib/geo/municipios.ts
// Resolución compartida nombre de municipio → CVE_MUN, extraída de
// app/api/geo/options/route.ts (única fuente hasta ahora) para que Fontana
// pueda resolver el municipio del territorio de un proyecto sin duplicar
// la lectura del TopoJSON de municipios ni la normalización de nombres.

import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";
import type { GeoOption } from "@/types/geo.types";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX_INE = "sefix/geo/ine";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 día — el TopoJSON cambia una vez al año

// Quita acentos de nombres geográficos, preservando Ñ/Ü — igual criterio
// que app/api/geo/options/route.ts (GEO_ACCENT_MAP), aplica a NOMGEO del
// TopoJSON de municipios.
const GEO_ACCENT_MAP: Record<string, string> = {
  "Á":"A","À":"A","Â":"A","Ä":"A",
  "É":"E","È":"E","Ê":"E","Ë":"E",
  "Í":"I","Ì":"I","Î":"I","Ï":"I",
  "Ó":"O","Ò":"O","Ô":"O","Ö":"O",
  "Ú":"U","Ù":"U","Û":"U",
  "á":"A","à":"A","â":"A","ä":"A",
  "é":"E","è":"E","ê":"E","ë":"E",
  "í":"I","ì":"I","î":"I","ï":"I",
  "ó":"O","ò":"O","ô":"O","ö":"O",
  "ú":"U","ù":"U","û":"U",
  "ñ":"Ñ",
  "ü":"Ü",
};
export function normalizeGeoName(s: string): string {
  return s.split("").map((c) => GEO_ACCENT_MAP[c] ?? c).join("").toUpperCase();
}

interface CacheEntry { options: GeoOption[]; ts: number }
const cache = new Map<string, CacheEntry>();

// Regresa todos los municipios de un estado (CVE_MUN + nombre normalizado),
// leídos del mismo TopoJSON ya productivizado para Sefix — sin duplicar
// datos, solo la lectura.
export async function getMunicipiosOptions(estadoId: string): Promise<GeoOption[]> {
  const padId = estadoId.padStart(2, "0");
  const key = `v1:${padId}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.options;

  const storagePath = `${STORAGE_PREFIX_INE}/nacional/municipios.topojson`;
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

  const features = fc.features.filter(
    (f) => String(f.properties?.["CVE_ENT"] ?? "").padStart(2, "0") === padId
  );

  const seen = new Set<string>();
  const options: GeoOption[] = [];
  for (const f of features) {
    const p = f.properties;
    const cve = String(p["CVE_MUN"] ?? "").padStart(3, "0");
    const nombre = normalizeGeoName(String(p["NOMGEO"] ?? cve));
    if (cve && !seen.has(cve)) {
      seen.add(cve);
      options.push({ cve, nombre });
    }
  }
  options.sort((a, b) => a.cve.localeCompare(b.cve));

  cache.set(key, { options, ts: Date.now() });
  return options;
}

// Resuelve un nombre de municipio (con o sin acentos, cualquier mayúscula)
// contra el catálogo real de un estado. null si no hay match exacto —
// nunca adivina por coincidencia parcial.
export async function resolveMunicipioCve(estadoId: string, municipioNombre: string): Promise<string | null> {
  const objetivo = normalizeGeoName(municipioNombre);
  const options = await getMunicipiosOptions(estadoId);
  return options.find((o) => o.nombre === objetivo)?.cve ?? null;
}
