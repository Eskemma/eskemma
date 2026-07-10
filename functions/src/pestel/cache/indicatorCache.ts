// functions/src/pestel/cache/indicatorCache.ts
// DEUDA: duplicado de lib/centinela/pestel/cache/indicatorCache.ts
// Razón: functions/ usa module:NodeNext; incompatible con Next.js bundler.
// Actualizar AMBAS copias si cambia la lógica de TTL o el esquema.

import {getFirestore, Timestamp} from "firebase-admin/firestore";

const TTL_24H = 24 * 60 * 60 * 1000;
const TTL_7D = 7 * 24 * 60 * 60 * 1000;
export const CACHE_TTL = {TTL_24H, TTL_7D};

const COLLECTION = "pestel_indicator_cache";

/**
 * Returns cached data for cacheKey if a non-expired entry exists.
 * @param {string} cacheKey Deterministic lookup key.
 * @return {Promise<T | null>} Cached data or null on miss.
 */
export async function getCached<T>(cacheKey: string): Promise<T | null> {
  const snap = await getFirestore()
    .collection(COLLECTION)
    .where("cacheKey", "==", cacheKey)
    .where("expiresAt", ">", Timestamp.now())
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data().data as T);
}

/**
 * Stores data in the cache collection with a TTL expiry timestamp.
 * @param {string} source Source id (e.g. "google_news", "banxico").
 * @param {string} cacheKey Deterministic lookup key.
 * @param {T} data Payload to cache.
 * @param {number} ttlMs Time-to-live in milliseconds.
 * @return {Promise<void>}
 */
export async function setCached<T>(
  source: string,
  cacheKey: string,
  data: T,
  ttlMs: number
): Promise<void> {
  const now = Timestamp.now();
  await getFirestore()
    .collection(COLLECTION)
    .add({
      source,
      cacheKey,
      data,
      cachedAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + ttlMs),
    });
}

/**
 * Cache-aside wrapper: returns cached value or fetches and caches result.
 * @param {string} source Source identifier for the cache entry.
 * @param {string} key Deterministic lookup key.
 * @param {number} ttlMs Time-to-live in milliseconds.
 * @param {Function} fn Async function to invoke on cache miss.
 * @return {Promise} Cached or freshly fetched data.
 */
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
  const isEmpty = Array.isArray(result) ?
    result.length === 0 : result === null;
  if (!isEmpty) {
    try {
      await setCached(source, key, result, ttlMs);
    } catch (e) {
      console.warn(`[indicatorCache] setCached failed for ${key}:`, e);
    }
  }
  return result;
}
