// lib/geo/municipios.ts
// Resolución compartida nombre de municipio → CVE_MUN, extraída de
// app/api/geo/options/route.ts (única fuente hasta ahora) para que Fontana
// pueda resolver el municipio del territorio de un proyecto sin duplicar
// la lectura del TopoJSON de municipios ni la normalización de nombres.

import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";
import type { GeoOption } from "@/types/geo.types";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
// Import estático (Fase 2 del rediseño de territorio, corrección
// 26-08-14) — ver lib/geo/distritos.ts para el diagnóstico completo.
import { feature } from "topojson-client";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX_INE = "sefix/geo/ine";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 día — el TopoJSON cambia una vez al año

// Normalización y clave canónica de nombre de municipio: LÓGICA PURA movida
// a ./municipioCanonico.ts (para que también la importen scripts de
// pipeline sin arrastrar firebase/topojson, y para que build-time y
// query-time usen EXACTAMENTE la misma función). Se re-exporta aquí — los
// importadores de `@/lib/geo/municipios` no cambian.
import {
  normalizeGeoName,
  normalizarNombreMunicipio,
  claveCanonicaMunicipio,
  ALIAS_MUNICIPIO,
} from "./municipioCanonico";
export { normalizeGeoName, normalizarNombreMunicipio, claveCanonicaMunicipio, ALIAS_MUNICIPIO };

interface CacheEntry { options: GeoOption[]; ts: number }
const cache = new Map<string, CacheEntry>();

// Caché de 2 niveles (fix 2026-08-03, hallazgo real medido): descargar +
// convertir el topojson nacional completo (topojson-client `feature()`,
// ~2,469 municipios de todo México) tomaba 5.2s en frío — y el caché de
// abajo estaba indexado POR ESTADO, así que cada estado nuevo consultado
// por primera vez volvía a pagar ese costo NACIONAL completo, aunque ya
// se hubiera hecho el mismo trabajo segundos antes para otro estado. El
// costo caro (descarga+conversión) es independiente del estado — se
// cachea una sola vez, global; solo el filtrado por CVE_ENT (barato,
// milisegundos) se deriva por estado.
interface FeaturesCacheEntry { features: { properties: Record<string, unknown> }[]; ts: number }
let featuresCache: FeaturesCacheEntry | null = null;

// Single-flight (fix 2026-08-06, hallazgo real medido): getMunicipiosOptionsNacional()
// llama a esta función 32 veces vía Promise.all (una por estado) — en frío,
// las 32 llegaban antes de que la primera terminara de descargar/convertir,
// así que las 32 veían featuresCache === null y las 32 descargaban y
// convertían el topojson nacional COMPLETO en paralelo, compitiendo por CPU
// en el mismo proceso. Medido: 148,721ms en vez de los ~6s esperados. Fix:
// la primera llamada guarda su propia promesa en featuresPromise; cualquier
// llamada concurrente reutiliza esa MISMA promesa en vez de iniciar su
// propia descarga. Se limpia al terminar (éxito o error) para no dejar una
// promesa rechazada cacheada indefinidamente.
let featuresPromise: Promise<{ properties: Record<string, unknown> }[]> | null = null;

async function getMunicipiosFeaturesNacional(): Promise<{ properties: Record<string, unknown> }[]> {
  if (featuresCache && Date.now() - featuresCache.ts < CACHE_TTL_MS) return featuresCache.features;
  if (featuresPromise) return featuresPromise;

  featuresPromise = (async () => {
    const storagePath = `${STORAGE_PREFIX_INE}/nacional/municipios.topojson`;
    const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new Error(`File not found: ${storagePath}`);

    const [buf] = await file.download();
    const topojson = JSON.parse(buf.toString("utf-8"));

    const obj = topojson.objects as Record<string, unknown>;
    const layerName = Object.keys(obj)[0];
    const fc = feature(topojson as unknown as Parameters<typeof feature>[0], obj[layerName] as Parameters<typeof feature>[1]) as {
      features: { properties: Record<string, unknown> }[];
    };

    featuresCache = { features: fc.features, ts: Date.now() };
    return fc.features;
  })();

  try {
    return await featuresPromise;
  } finally {
    featuresPromise = null;
  }
}

// Regresa todos los municipios de un estado (CVE_MUN + nombre normalizado),
// leídos del mismo TopoJSON ya productivizado para Sefix — sin duplicar
// datos, solo la lectura.
export async function getMunicipiosOptions(estadoId: string): Promise<GeoOption[]> {
  const padId = estadoId.padStart(2, "0");
  const key = `v1:${padId}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.options;

  const featuresNacionales = await getMunicipiosFeaturesNacional();
  const features = featuresNacionales.filter(
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
// contra el catálogo real de un estado. Nivel 1: match exacto. Nivel 2
// (fallback, 26-08-17): coincidencia de palabra completa (\bNOMBRE\b)
// contra el nombre oficial — SOLO se acepta si resulta en exactamente 1
// candidato; 0 o 2+ candidatos devuelven null (mismo tratamiento que "no
// encontrado"), nunca se adivina entre nombres ambiguos (ej.
// "Ixtlahuacán" tiene 2 candidatos reales en Jalisco: "IXTLAHUACAN DEL
// RIO" e "IXTLAHUACAN DE LOS MEMBRILLOS"). Resuelve el caso real que
// motivó esto: nombres informales de uso común ("Tlaquepaque",
// "Tlajomulco", "Acatlán") que no coinciden con el nombre oficial del
// catálogo INEGI ("SAN PEDRO TLAQUEPAQUE", etc.). Confirmado (26-08-17):
// ninguno de los 9 consumidores reales de esta función usa `null` como
// señal para activar una ruta de resolución alterna — todos lo tratan
// simplemente como "sin dato para este municipio" — así que ampliar la
// resolución aquí beneficia a todos sin alterar ningún flujo existente.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function candidatosPorPalabraCompleta(estadoId: string, municipioNombre: string): Promise<GeoOption[]> {
  const objetivo = normalizeGeoName(municipioNombre);
  const options = await getMunicipiosOptions(estadoId);
  const patronPalabraCompleta = new RegExp(`\\b${escapeRegExp(objetivo)}\\b`);
  return options.filter((o) => patronPalabraCompleta.test(o.nombre));
}

export async function resolveMunicipioCve(estadoId: string, municipioNombre: string): Promise<string | null> {
  const objetivo = normalizeGeoName(municipioNombre);
  const options = await getMunicipiosOptions(estadoId);

  // BUG REAL encontrado y corregido (Incidente 2, Verificación 1,
  // 2026-08-23): `options.find()` regresaba SIEMPRE el primer match
  // exacto sin comprobar si había más de uno — para "San Juan Mixtepec"
  // (nombre EXACTAMENTE igual en 2 municipios reales, cve 208/209)
  // devolvía 208 en silencio, sin pasar nunca por la ruta de ambigüedad
  // (diagnosticarMunicipioNoResuelto/picker). Mismo tipo de fallo
  // silencioso que motivó el Incidente 1 — un match exacto puede seguir
  // siendo ambiguo si hay 2+ filas con el mismo nombre.
  const exactos = options.filter((o) => o.nombre === objetivo);
  if (exactos.length === 1) return exactos[0].cve;
  if (exactos.length > 1) return null;

  const candidatos = await candidatosPorPalabraCompleta(estadoId, municipioNombre);
  return candidatos.length === 1 ? candidatos[0].cve : null;
}

// Diagnóstico para cuando resolveMunicipioCve() devuelve null (26-08-17,
// Ronda 6) — usado SOLO para construir un motivo legible al usuario (ej.
// en el desglose de agregación plural), nunca para decidir un cve. 0
// candidatos → nombre no reconocido; 2+ → nombre ambiguo, se listan los
// candidatos reales (nunca se adivina cuál era el correcto).
//
// Expone `cve` además de `nombre` (Incidente 2, Verificación 1,
// 2026-08-23) — necesario para que el picker de la UI (TerritorySelector.tsx)
// pueda usar una key de React distinta al texto mostrado y, en los casos
// de nombre LITERALMENTE idéntico entre 2 municipios reales (ver
// ETIQUETA_DESAMBIGUACION_MUNICIPIO abajo), mostrar una etiqueta que sí
// los distinga.
export async function diagnosticarMunicipioNoResuelto(estadoId: string, municipioNombre: string): Promise<{ cve: string; nombre: string }[]> {
  return candidatosPorPalabraCompleta(estadoId, municipioNombre);
}

// Etiquetas de desambiguación para el picker — ver
// lib/geo/etiquetasDesambiguacionMunicipio.ts (módulo aparte, sin
// dependencias server-only, para que TerritorySelector.tsx, componente
// cliente, pueda importarlo directo — este archivo depende de
// firebase-admin y no es importable desde el cliente).
export { etiquetaDesambiguacionMunicipio } from "@/lib/geo/etiquetasDesambiguacionMunicipio";

// Reverso de ESTADO_CVE_MAP (lib/sefix/eleccionesConstants.ts) — para
// etiquetar cada entrada del índice nacional con el nombre de su estado.
const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);
const TODOS_LOS_ESTADOS_CVE = Object.values(ESTADO_CVE_MAP).sort();

export interface GeoOptionNacional extends GeoOption {
  estadoCve: string;
  estadoNombre: string;
}

interface CacheNacionalEntry { options: GeoOptionNacional[]; ts: number }
let cacheNacional: CacheNacionalEntry | null = null;

// Agregación nacional — concatena los 32 estados sobre getMunicipiosOptions
// ya cacheada por estado (mismo patrón que lib/geo/distritos.ts). El costo
// caro (conversión del topojson nacional) se paga una sola vez, en la
// primera llamada de cualquier estado — verificado (Puebla→Querétaro,
// 2026-08-03): 5.6s → 2ms.
export async function getMunicipiosOptionsNacional(): Promise<GeoOptionNacional[]> {
  if (cacheNacional && Date.now() - cacheNacional.ts < CACHE_TTL_MS) return cacheNacional.options;

  const porEstado = await Promise.all(
    TODOS_LOS_ESTADOS_CVE.map(async (estadoCve) => {
      const options = await getMunicipiosOptions(estadoCve);
      return options.map((o) => ({ ...o, estadoCve, estadoNombre: CVE_ESTADO_NOMBRE[estadoCve] ?? estadoCve }));
    })
  );
  const todas = porEstado.flat();
  cacheNacional = { options: todas, ts: Date.now() };
  return todas;
}
