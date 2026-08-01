// lib/fontana/bodegaStorage.ts
// Generaliza el patrón de Firebase Storage ya usado en lib/sefix/ecegStorage.ts
// y lib/fontana/indicatorRegistry.ts para que los adaptadores nuevos de
// Fontana (Compendio, CONAPO, Banxico — ver lib/fontana/ingesta/) no
// reimplementen el mismo boilerplate cada uno.
//
// Sin caché en memoria por proceso (a diferencia de ecegStorage.ts /
// indicatorRegistry.ts, que usan TTL de 30 min): esta pieza sirve a
// adaptadores de "bodega bajo demanda" — Compendio 2010, CONAPO,
// Banxico —, que escriben el dato una sola vez (writeToBodega) la
// primera vez que un territorio real se consulta, y a partir de ahí
// siempre lo leen ya persistido de Storage. Fuentes precomputadas
// completas (ITER, como ECEG) no usan esta pieza — siguen el patrón
// propio de ecegStorage.ts, con caché en memoria, porque su consumo es
// de alta frecuencia sobre un archivo por estado ya generado en batch.
//
// Convención de rutas: fontana/bodega/{fuenteSlug}/{clave}.json, con un
// _manifest.json por fuente documentando cuándo se creó el prefijo y por
// qué es bajo demanda (no precomputado) — ver Fontana_T10 Familia 1,
// incremento F1-16/F1-17/F1-18.

import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const BODEGA_PREFIX = "fontana/bodega";

function fullPath(path: string): string {
  return `${BODEGA_PREFIX}/${path}`;
}

// Regresa null si el archivo no existe todavía (bodega bajo demanda que
// no ha recibido este territorio) — el llamador decide si dispara la
// descarga/consulta real. Distinto de un error de red, que sí lanza.
export async function readFromBodega<T>(path: string): Promise<T | null> {
  const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
  const file = bucket.file(fullPath(path));
  const [exists] = await file.exists();
  if (!exists) return null;

  const [buf] = await file.download();
  return JSON.parse(buf.toString("utf-8")) as T;
}

export async function writeToBodega(path: string, data: unknown): Promise<void> {
  const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
  const file = bucket.file(fullPath(path));
  await file.save(JSON.stringify(data, null, 2), { contentType: "application/json" });
}

export interface BodegaManifest {
  fuenteSlug: string;
  creado: string; // ISO
  adaptador: string; // ruta del archivo que llena esta bodega
  estrategia: "bajo_demanda" | "precomputado";
  notas?: string;
}

export async function ensureManifest(
  fuenteSlug: string,
  manifest: Omit<BodegaManifest, "fuenteSlug">
): Promise<void> {
  const path = `${fuenteSlug}/_manifest.json`;
  const existing = await readFromBodega<BodegaManifest>(path);
  if (existing) return;
  await writeToBodega(path, { fuenteSlug, ...manifest });
}