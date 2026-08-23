// lib/fontana/indicatorRegistry.ts
// Loader del catálogo de indicadores de Fontana — vive en la bodega de
// Firebase Storage (fontana/registry/INDICATOR_REGISTRY.json), nunca en
// Firestore (Documentación Técnica §3.3/§9). Mismo patrón de caché que
// lib/sefix/ecegStorage.ts.

import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";
import type { TipoAgregacionTerritorial } from "@/types/shared.types";

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

// Clasificación de agregación territorial peer-a-peer (Fase 2 del rediseño
// de territorio, 26-08-13) — ver types/shared.types.ts:TipoAgregacionTerritorial
// para la taxonomía compartida y el criterio de decisión. Completado por
// Raúl directamente en data/fontana/INDICATOR_REGISTRY.json, indicador por
// indicador — nunca inferido aquí. Ver loadIndicatorRegistry() para el
// aviso de cobertura cuando un indicador carece de este campo.
export interface AgregacionPlural {
  tipo: TipoAgregacionTerritorial;
  // Solo para "tasa_ponderada" — qué campo de la fuente pondera (ej.
  // "poblacion2020"), siguiendo el criterio ya fijado en
  // lib/fontana/ingesta/index.ts (reconstruir numerador/denominador, nunca
  // promediar el % ya calculado).
  ponderador?: string;
  notas?: string;
}

export interface IndicadorRegistro {
  id: string;
  nombre: string;
  familia: 1 | 2 | 3 | 4 | 5;
  pestel: Array<"P" | "E" | "S" | "T" | "Ec" | "L">;
  fuenteSlug: string;
  fuenteEtiqueta?: string;
  // Texto visible para el usuario final (tooltip (i) de la tabla y del
  // modal "Ver resto de países") — convención de redacción fijada en
  // Ronda 7 de Familia 4 (2026-08-22), auditada en las 52 entradas
  // existentes en ese momento: punto y seguido en vez de guión largo
  // (—), mayúscula al iniciar la siguiente oración, NUNCA jerga de
  // implementación (sin referencias cruzadas a otros IDs de indicador
  // tipo "F2-13" ni notas dirigidas al equipo tipo "ver notas"/"mismo
  // criterio que..."/"polaridad invertida respecto a..."). Aplicar esta
  // convención desde el primer borrador al escribir `definicion` de
  // Familia 3/5, no como corrección posterior.
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
  agregacionPlural?: AgregacionPlural;
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

  // Aviso de cobertura (Fase 2 del rediseño de territorio, 26-08-13) — nunca
  // asumir "aditivo" por default silencioso cuando falta la clasificación;
  // ver scripts/verify-fontana-agregacion-plural-cobertura.ts para el
  // reporte detallado indicador por indicador.
  const sinClasificar = data.filter((i) => !i.agregacionPlural).length;
  if (sinClasificar > 0) {
    console.warn(
      `[fontana/indicatorRegistry] ${sinClasificar}/${data.length} indicadores sin agregacionPlural clasificado.`
    );
  }

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
