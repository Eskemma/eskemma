// lib/fontana/ingesta/conagua.ts
// Adaptador de F5-2 (Factores climáticos) — Familia 5.
//
// Verificado 2026-08-23: catálogo de estaciones por estado,
// https://smn.conagua.gob.mx/tools/RESOURCES/Normales_Climatologicas/catalogo/cat_{abrev}.html
// (532 KB para Jalisco, HTML real con enlaces a las 4 ediciones de
// normales por estación). Descarga real confirmada de la normal más
// reciente (1991-2020):
// .../Normales_Climatologicas/Normales9120/{abrev}/nor9120_{id}.txt
// Guadalajara (14065) y Ayutla/Oaxaca (20007), ambas con emisión
// 21/08/2026 — sistema activo. Las 32 abreviaturas de estado
// verificadas una por una contra el catálogo real (HTTP 200 las 32,
// no asumidas de un patrón).
//
// Mapeo estación→municipio viene en el propio archivo de normal
// (campo "MUNICIPIO") — no hace falta geocodificación adicional, pero
// si un estado tiene varias estaciones en el mismo municipio, Fontana
// debe elegir una (la primera encontrada en el catálogo, sin criterio
// de "mejor estación" todavía — ver notas de implementación).
//
// Valor principal: temperatura media anual (°C), sección "TEMPERATURA
// MEDIA" → fila "NORMAL" → columna "ANUAL". Precipitación anual (mm)
// se guarda en `distribucion` (mismo campo ya usado en Familia 1 para
// desgloses adicionales que la tabla no consume directo).
//
// Sin caché en Storage — catálogo y normales cacheados en memoria de
// proceso (TTL 24h, single-flight), mismo patrón que coneval.ts.

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, claveCanonicaMunicipio } from "@/lib/geo/municipios";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { Territorio } from "@/types/shared.types";

// Confirmado con HTTP 200 real contra las 32 URLs de catálogo,
// 2026-08-23 — no un patrón asumido.
const ABREV_POR_CVE: Record<string, string> = {
  "01": "ags", "02": "bc", "03": "bcs", "04": "camp", "05": "coah",
  "06": "col", "07": "chis", "08": "chih", "09": "df", "10": "dgo",
  "11": "gto", "12": "gro", "13": "hgo", "14": "jal", "15": "mex",
  "16": "mich", "17": "mor", "18": "nay", "19": "nl", "20": "oax",
  "21": "pue", "22": "qro", "23": "qroo", "24": "slp", "25": "sin",
  "26": "son", "27": "tab", "28": "tamps", "29": "tlax", "30": "ver",
  "31": "yuc", "32": "zac",
};

const CATALOGO_BASE = "https://smn.conagua.gob.mx/tools/RESOURCES/Normales_Climatologicas/catalogo";
const NORMALES_BASE = "https://smn.conagua.gob.mx/tools/RESOURCES/Normales_Climatologicas/Normales9120";

interface EstacionCatalogo {
  id: string;
  municipioNormalizado: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheCatalogo = new Map<string, { estaciones: EstacionCatalogo[]; expira: number }>();
const enVueloCatalogo = new Map<string, Promise<EstacionCatalogo[]>>();

async function fetchCatalogoEstado(abrev: string, cve: string): Promise<EstacionCatalogo[]> {
  const cacheado = cacheCatalogo.get(abrev);
  if (cacheado && cacheado.expira > Date.now()) return cacheado.estaciones;
  const enCurso = enVueloCatalogo.get(abrev);
  if (enCurso) return enCurso;

  const promesa = (async (): Promise<EstacionCatalogo[]> => {
    const res = await fetch(`${CATALOGO_BASE}/cat_${abrev}.html`);
    if (!res.ok) throw new Error(`CONAGUA (catálogo) respondió ${res.status} para ${abrev}`);
    const html = await res.text();
    // El catálogo es una tabla exportada de Excel con HTML mal formado
    // (filas <tr> sin su </tr> de cierre correspondiente, confirmado
    // inspeccionando el HTML real) — un regex de fila completa
    // <tr>...</tr> falla en encontrar los límites reales. Se parte el
    // documento en cada apertura <tr> en su lugar, y cada bloque se
    // procesa hasta el siguiente <tr> (nunca se busca su propio cierre).
    // Estructura de columnas confirmada con HTML real (fila de la
    // estación 14065, Guadalajara): td[0]=ID, td[1]=Nombre estación,
    // td[2]=Municipio, td[3]=Situación, resto=enlaces de descarga.
    const estaciones: EstacionCatalogo[] = [];
    const bloques = html.split(/<tr\b/i).slice(1);
    for (const bloque of bloques) {
      const idMatch = bloque.match(/nor9120_(\d+)\.txt/);
      if (!idMatch) continue;
      const celdas = [...bloque.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1].replace(/<[^>]+>/g, "").trim());
      const municipio = celdas[2] ?? "";
      if (municipio) {
        // Migrado a claveCanonicaMunicipio() (Incidente 2, alias table) —
        // mismo patrón ya usado en coneval.ts/conapoMarginacion.ts/
        // bienestar.ts/icmm.ts/iter.ts/pnud.ts/sic.ts.
        estaciones.push({ id: idMatch[1], municipioNormalizado: claveCanonicaMunicipio(cve, municipio) });
      }
    }
    return estaciones;
  })();
  enVueloCatalogo.set(abrev, promesa);
  try {
    const estaciones = await promesa;
    cacheCatalogo.set(abrev, { estaciones, expira: Date.now() + CACHE_TTL_MS });
    return estaciones;
  } finally {
    enVueloCatalogo.delete(abrev);
  }
}

function extraerAnual(texto: string, seccion: string): number | null {
  const bloque = texto.split(seccion)[1];
  if (!bloque) return null;
  const filaNormal = bloque.split("\n").find((l) => l.trim().startsWith("NORMAL"));
  if (!filaNormal) return null;
  const campos = filaNormal.trim().split(/\s+/).filter((c) => c !== "NORMAL");
  const anual = campos[campos.length - 1];
  const valor = Number(anual);
  return Number.isNaN(valor) ? null : valor;
}

async function fetchNormalEstacion(abrev: string, id: string): Promise<{ tempMediaAnual: number | null; precipAnual: number | null } | null> {
  const res = await fetch(`${NORMALES_BASE}/${abrev}/nor9120_${id}.txt`);
  if (!res.ok) return null;
  const texto = await res.text();
  return {
    tempMediaAnual: extraerAnual(texto, "TEMPERATURA MEDIA"),
    precipAnual: extraerAnual(texto, "PRECIPITACIÓN"),
  };
}

export async function resolverClima(territorio: Territorio): Promise<CeldaFontana[]> {
  if (!territorio.estado || !territorio.municipio) return [];
  const cve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  const abrev = cve ? ABREV_POR_CVE[cve] : undefined;
  if (!cve || !abrev) return [{ nivel: "municipal", motivo: "Estado no reconocido para el catálogo de CONAGUA" }];

  let estaciones: EstacionCatalogo[];
  try {
    estaciones = await fetchCatalogoEstado(abrev, cve);
  } catch {
    return [{ nivel: "municipal", motivo: "Error de conexión con CONAGUA" }];
  }

  const municipioNorm = claveCanonicaMunicipio(cve, territorio.municipio);
  const estacion = estaciones.find((e) => e.municipioNormalizado === municipioNorm);
  if (!estacion) {
    return [{ nivel: "municipal", motivo: "CONAGUA no tiene estación climatológica registrada para este municipio" }];
  }

  const normal = await fetchNormalEstacion(abrev, estacion.id);
  if (!normal || normal.tempMediaAnual === null) {
    return [{ nivel: "municipal", motivo: "Error de conexión con CONAGUA" }];
  }

  return [{
    nivel: "municipal",
    valor: normal.tempMediaAnual,
    unidad: "°C (temperatura media anual)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: "CONAGUA SMN, Normal Climatológica 1991-2020",
    distribucion: normal.precipAnual !== null ? { precipitacion_anual_mm: normal.precipAnual } : undefined,
  }];
}
