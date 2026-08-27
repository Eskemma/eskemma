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
  // Mecanismo general (2026-08-24, hallazgo real F5-7) — algunos
  // indicadores YA resuelven territorio plural correctamente dentro de
  // su propio resolver (ej. F5-7/sun.ts: una Ciudad/Zona Metropolitana
  // vale lo mismo sin importar cuál de sus municipios miembro se
  // consulte, así que sumar/promediar entre los municipios
  // seleccionados sería incorrecto — el propio resolver ya da la
  // respuesta correcta). Cuando `resolverPropio: true`, el overwrite
  // genérico de territorio plural en route.ts se OMITE por completo
  // para este indicador — se conserva el valor que `resolverIndicadorFontana`
  // ya calculó, en vez de reemplazarlo por el agregado genérico o por
  // "sin valor combinado". Siempre junto con `tipo: "no_agregable"`
  // (nunca tiene sentido combinarlo con aditivo/tasa_ponderada, que sí
  // dependen del overwrite para mostrar el agregado).
  //
  // ⚠️ Limitación conocida, no resuelta: esto asume que TODAS las
  // unidades plurales seleccionadas comparten la misma respuesta bajo
  // el resolver propio (cierto hoy para F5-7 solo cuando los municipios
  // seleccionados pertenecen a la MISMA Ciudad/ZM — ej. el caso real
  // Tlaquepaque/ZMG). Si un proyecto plural mezclara municipios de 2
  // Ciudades/ZM distintas, el resolver seguiría devolviendo solo la del
  // municipio "principal" (`territorio.municipio`), ignorando en
  // silencio las demás — el mismo tipo de "unidad principal disfrazada
  // de respuesta completa" que el overwrite genérico existe para
  // evitar. No se resolvió en esta ronda (fuera de alcance); documentar
  // aquí para no perder el hallazgo.
  resolverPropio?: boolean;
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
    // Inventario completo de valores ya en uso en el JSON del registry
    // pero ausentes del tipo, encontrado 2026-08-26 al agregar
    // "pendiente_app_ecosistema" (Familia 3, Bloque 2) — loadIndicatorRegistry
    // castea el JSON sin validar en runtime, así que estos desajustes
    // nunca fallaban, pero tampoco eran correctos:
    //   - "api_ckan" (F2-7, F2-8) — API CKAN pública de datos.gob.mx, sin
    //     token (distinto de "api_token").
    //   - "api_en_vivo" (F2-1, F2-2, F2-14) — llamada en vivo a INEGI-PM
    //     2024 en cada request, sin bodega intermedia.
    //   - "descarga_directa_con_fallback_curado" (F5-2) — descarga directa
    //     (CONAGUA) con contenido curado como respaldo cuando la fuente
    //     falla.
    // Los 3 se agregan aquí. No se investigó si hay más huecos de tipo en
    // ningún otro campo del registry (`naturaleza`, `estado`, etc.) — solo
    // se auditó `mecanismoAcceso`, que es el campo tocado en esta ronda.
    | "api_ckan"
    | "api_en_vivo"
    | "descarga_directa"
    | "descarga_directa_con_fallback_curado"
    | "descarga_navegador_headless"
    | "curacion_manual"
    | "consumo_interno_sefix"
    // Familia 3, Bloque 2 (2026-08-26) — indicador que depende de OTRA app
    // del ecosistema Eskemma sin conector construido todavía (ej.
    // Sefix-AI/T06, en pausa de desarrollo) — distinto de
    // "consumo_interno_sefix", que ya identifica el consumo REAL y vigente
    // de otro módulo (ECEG vía el dashboard Sefix). Genérico a propósito:
    // sirve como patrón para cualquier futura dependencia de otra app del
    // ecosistema en el mismo estado (definido, sin conector aún).
    | "pendiente_app_ecosistema";
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
