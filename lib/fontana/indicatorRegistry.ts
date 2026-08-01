// lib/fontana/indicatorRegistry.ts
// Loader del catálogo de indicadores de Fontana — vive en la bodega de
// Firebase Storage (fontana/registry/INDICATOR_REGISTRY.json), nunca en
// Firestore (Documentación Técnica §3.3/§9). Mismo patrón de caché que
// lib/sefix/ecegStorage.ts.

import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PATH = "fontana/registry/INDICATOR_REGISTRY.json";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export type NaturalezaDato =
  | "dato_directo"
  | "calculo_directo"
  | "estimacion_modelada"
  | "estimacion_agregada"
  | "proxy_conceptual";

export interface NivelIndicador {
  nivel: "nacional" | "estatal" | "distrital" | "municipal" | "ageb" | "seccional" | "localidad";
  naturaleza: NaturalezaDato;
  metodo?: string;
  estado: "confirmado" | "pendiente" | "no_viable";
}

export interface IndicadorRegistro {
  id: string;
  nombre: string;
  familia: 1 | 2 | 3 | 4 | 5;
  pestel: Array<"P" | "E" | "S" | "T" | "Ec" | "L">;
  fuenteSlug: string;
  fuenteEtiqueta?: string;
  definicion?: string;
  mecanismoAcceso:
    | "api_token"
    | "descarga_directa"
    | "descarga_navegador_headless"
    | "curacion_manual"
    | "consumo_interno_sefix";
  niveles: NivelIndicador[];
  frecuenciaActualizacion: string;
  ultimaVerificacion: string;
  confiabilidadPorCampo?: Record<string, "alta" | "media" | "baja">;
  notas?: string;
}

interface CacheEntry { data: IndicadorRegistro[]; expiresAt: number }
let cache: CacheEntry | null = null;

export async function loadIndicatorRegistry(): Promise<IndicadorRegistro[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;

  const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
  const file = bucket.file(STORAGE_PATH);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`File not found: ${STORAGE_PATH}`);

  const [buf] = await file.download();
  const data = JSON.parse(buf.toString("utf-8")) as IndicadorRegistro[];
  cache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

export async function getIndicadorRegistro(id: string): Promise<IndicadorRegistro | null> {
  const registry = await loadIndicatorRegistry();
  return registry.find((i) => i.id === id) ?? null;
}

export async function getIndicadoresPorFamilia(familia: 1 | 2 | 3 | 4 | 5): Promise<IndicadorRegistro[]> {
  const registry = await loadIndicatorRegistry();
  return registry.filter((i) => i.familia === familia);
}
