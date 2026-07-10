// lib/centinela/pestel/cache/indicatorCache.ts
// DEUDA: duplicado de functions/src/pestel/cache/indicatorCache.ts
// Razón: functions/ usa module:NodeNext (incompatible con moduleResolution:bundler de Next.js).
// Si se modifica la lógica de TTL o el esquema, actualizar AMBAS copias.

import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

const TTL_24H = 24 * 60 * 60 * 1000;
const TTL_7D = 7 * 24 * 60 * 60 * 1000;
export const CACHE_TTL = { TTL_24H, TTL_7D };

const COLLECTION = "pestel_indicator_cache";

export async function getCached<T>(cacheKey: string): Promise<T | null> {
  const snap = await adminDb
    .collection(COLLECTION)
    .where("cacheKey", "==", cacheKey)
    .where("expiresAt", ">", Timestamp.now())
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data().data as T);
}

export async function setCached<T>(
  source: string,
  cacheKey: string,
  data: T,
  ttlMs: number
): Promise<void> {
  const now = Timestamp.now();
  await adminDb.collection(COLLECTION).add({
    source,
    cacheKey,
    data,
    cachedAt: now,
    expiresAt: Timestamp.fromMillis(now.toMillis() + ttlMs),
  });
}

export async function fetchWithCache<T>(
  source: string,
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const cached = await getCached<T>(key);
    if (cached !== null) return cached;
  } catch (e) {
    console.warn(`[indicatorCache] getCached miss for ${key}:`, e);
  }
  const result = await fn();
  const isEmpty = Array.isArray(result) ? result.length === 0 : result === null;
  if (!isEmpty) {
    try {
      await setCached(source, key, result, ttlMs);
    } catch (e) {
      console.warn(`[indicatorCache] setCached failed for ${key}:`, e);
    }
  }
  return result;
}
