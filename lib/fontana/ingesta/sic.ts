// lib/fontana/ingesta/sic.ts
// Adaptador de F5-5 (Tradiciones y fiestas) — Familia 5.
//
// Verificado 2026-08-23 vía GET https://sic.gob.mx/opendata/d/{estado_id}_{tabla}_directorio.csv
// (CSV real, sin token). Combina 3 tablas del SIC — mecanismo ya
// confirmado en investigación previa (2026-07-27) y reverificado en
// vivo esta ronda: Jalisco (14) sigue con `festividad` vacía (0 bytes)
// pero `frpintangible` (1,298 B) y `festival` (8,790 B) con contenido
// real; Oaxaca (20) rica en las 3.
//
// Esquema de columnas confirmado por tabla (2026-08-23, muestra real
// descargada de cada una — no asumido igual entre las 3):
//   festividad     → trae municipio_id/nom_mun (nivel localidad real)
//   frpintangible  → trae municipio_id/nom_mun (mismo nivel)
//   festival       → SIN columna de municipio/estado en absoluto — solo
//                     puede atribuirse al estado completo (el filtro
//                     estado_id ya viene aplicado en la URL de
//                     descarga), nunca a un municipio específico.
//
// Valor: número de registros combinados (conteo, no índice) — Estatal
// = suma de filas de las 3 tablas; Municipal = suma de filas de
// festividad+frpintangible que coinciden con el municipio (festival
// queda fuera del conteo municipal por no tener esa granularidad,
// documentado explícitamente, no descartado en silencio).
//
// Sin caché en Storage — CSV por estado+tabla cacheado en memoria de
// proceso (TTL 24h, single-flight).

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, claveCanonicaMunicipio } from "@/lib/geo/municipios";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { Territorio } from "@/types/shared.types";

const TABLAS = ["festividad", "frpintangible", "festival"] as const;
type Tabla = (typeof TABLAS)[number];

// SIC usa el id de estado SIN cero a la izquierda (1..32) — confirmado
// en vivo, el formato con cero (01) devuelve HTTP 404, no un archivo
// vacío. ESTADO_CVE_MAP ya trae la clave con cero ("01") — se convierte
// a número para quitar el padding.
function estadoIdSic(cve2: string): string {
  return String(Number(cve2));
}

interface FilaSic {
  nomMun: string | null; // null para `festival` (sin esa columna)
}

// Campos citados entre comillas dobles (confirmado en la descarga real
// — "Fiesta de San Jerónimo",...) — se quita la comilla, nunca se deja
// como parte del valor (bug real encontrado en esta ronda: dejarla
// rompe cualquier comparación contra un nombre de municipio sin
// comillas). Codificación Latin-1 confirmada (mismo problema de
// acentos ya visto en RSF — "Jerónimo" llega como bytes Latin-1, no
// UTF-8).
function limpiarCampo(campo: string): string {
  return campo.trim().replace(/^"|"$/g, "");
}

function parsearCsv(buffer: ArrayBuffer, tabla: Tabla): FilaSic[] {
  const texto = new TextDecoder("iso-8859-1").decode(buffer);
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lineas.length <= 1) return [];
  const encabezados = lineas[0].split(",").map(limpiarCampo);
  const idxNomMun = encabezados.indexOf("nom_mun"); // -1 en `festival`
  return lineas.slice(1).map((linea) => {
    const campos = linea.split(",");
    return { nomMun: idxNomMun >= 0 ? limpiarCampo(campos[idxNomMun] ?? "") || null : null };
  });
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { filas: FilaSic[]; expira: number }>();
const enVuelo = new Map<string, Promise<FilaSic[]>>();

async function fetchTabla(estadoIdSic_: string, tabla: Tabla): Promise<FilaSic[]> {
  const cacheKey = `${estadoIdSic_}:${tabla}`;
  const cacheado = cache.get(cacheKey);
  if (cacheado && cacheado.expira > Date.now()) return cacheado.filas;
  const enCurso = enVuelo.get(cacheKey);
  if (enCurso) return enCurso;

  const promesa = (async (): Promise<FilaSic[]> => {
    const res = await fetch(`https://sic.gob.mx/opendata/d/${estadoIdSic_}_${tabla}_directorio.csv`);
    if (!res.ok) throw new Error(`SIC respondió ${res.status} para ${cacheKey}`);
    const buffer = await res.arrayBuffer();
    return parsearCsv(buffer, tabla);
  })();
  enVuelo.set(cacheKey, promesa);
  try {
    const filas = await promesa;
    cache.set(cacheKey, { filas, expira: Date.now() + CACHE_TTL_MS });
    return filas;
  } finally {
    enVuelo.delete(cacheKey);
  }
}

export async function resolverTradicionesFiestas(territorio: Territorio): Promise<CeldaFontana[]> {
  if (!territorio.estado) return [];
  const cve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!cve) return [{ nivel: "estatal", motivo: "Estado no reconocido para el catálogo del SIC" }];
  const idSic = estadoIdSic(cve);

  let porTabla: Record<Tabla, FilaSic[]>;
  try {
    const [festividad, frpintangible, festival] = await Promise.all(TABLAS.map((t) => fetchTabla(idSic, t)));
    porTabla = { festividad, frpintangible, festival };
  } catch {
    return [{ nivel: "estatal", motivo: "Error de conexión con el SIC" }];
  }

  const totalEstatal = porTabla.festividad.length + porTabla.frpintangible.length + porTabla.festival.length;
  const celdas: CeldaFontana[] = [{
    nivel: "estatal",
    valor: totalEstatal,
    unidad: "registros (festividades + patrimonio inmaterial + festivales)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: "Sistema de Información Cultural (SIC), Secretaría de Cultura",
  }];

  if (territorio.municipio) {
    // Migrado a claveCanonicaMunicipio() (Incidente 2, alias table) — mismo
    // patrón ya usado en coneval.ts/conapoMarginacion.ts/bienestar.ts/
    // icmm.ts/iter.ts/pnud.ts.
    const municipioNorm = claveCanonicaMunicipio(cve, territorio.municipio);
    const totalMunicipal =
      porTabla.festividad.filter((f) => f.nomMun && claveCanonicaMunicipio(cve, f.nomMun) === municipioNorm).length +
      porTabla.frpintangible.filter((f) => f.nomMun && claveCanonicaMunicipio(cve, f.nomMun) === municipioNorm).length;
    celdas.push({
      nivel: "municipal",
      valor: totalMunicipal,
      unidad: "registros (festividades + patrimonio inmaterial — festival solo tiene granularidad estatal)",
      naturaleza: "dato_directo",
      fuenteEtiqueta: "Sistema de Información Cultural (SIC), Secretaría de Cultura",
    });
  }

  return celdas;
}
