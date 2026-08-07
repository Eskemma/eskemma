// lib/sefix/ecegStorage.ts
// Lectura de la bodega ECEG 2020 ya productivizada en Storage, extraída de
// app/api/sefix/eceg-datos/route.ts para que Fontana pueda leer el mismo
// origen sin duplicar la ruta de archivo ni el caché — ver
// scripts/eceg-data-pipeline.ts para cómo se generan estos JSON.

import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX = "sefix/eceg_2020";

export type EcegNivel =
  | "nacional"
  | "distritos"
  | "distritos_municipios"
  | "distritos_locales"
  | "distritos_locales_municipios"
  | "municipios"
  | "secciones";

// "nacional" → national.json, en realidad keyed por CVE_ENT (2 dígitos) —
// es un archivo de valores por ESTADO, no un solo total país. Confirmado
// en scripts/eceg-data-pipeline.ts: "Builds national.json by aggregating
// all municipios data up to state level."
export function buildEcegStoragePath(nivel: EcegNivel, estadoId?: string): string | null {
  if (nivel === "nacional") return `${STORAGE_PREFIX}/national.json`;
  if (!estadoId) return null;
  const id = estadoId.padStart(2, "0");
  if (nivel === "distritos") return `${STORAGE_PREFIX}/distritos/${id}.json`;
  if (nivel === "distritos_municipios") return `${STORAGE_PREFIX}/distritos_municipios/${id}.json`;
  if (nivel === "distritos_locales") return `${STORAGE_PREFIX}/distritos_locales/${id}.json`;
  if (nivel === "distritos_locales_municipios") return `${STORAGE_PREFIX}/distritos_locales_municipios/${id}.json`;
  if (nivel === "secciones") return `${STORAGE_PREFIX}/secciones/${id}.json`;
  return `${STORAGE_PREFIX}/municipios/${id}.json`;
}

interface CacheEntry { data: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// Genérico con default = forma "clásica" (nacional/distritos/municipios/
// secciones) para no tocar ningún llamador existente — distritos_municipios
// tiene una forma distinta ({composicion, coberturaDistritos,
// coberturaMunicipios}, ver eceg-data-pipeline.ts) y pasa su propio T.
export async function fetchEcegFromStorage<T = Record<string, Record<string, number>>>(
  storagePath: string
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(storagePath);
  if (cached && cached.expiresAt > now) return cached.data as T;

  const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`File not found: ${storagePath}`);

  const [buf] = await file.download();
  const data = JSON.parse(buf.toString("utf-8")) as T;
  cache.set(storagePath, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}
