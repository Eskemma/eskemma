// lib/fontana/ensuCatalogo.ts
// Catálogo de las 90 áreas urbanas de interés de la ENSU (INEGI) — helpers
// de solo lectura sobre data/fontana/ensu_areas_2026t2.json.
//
// Fuente: microdatos ENSU 2026-T2 (conjunto_de_datos_ensu_viv_0626.csv),
// descarga directa pública sin registro desde inegi.org.mx/programas/
// ensu/?ps=microdatos#datos_abiertos — NO el catálogo PDF investigado
// primero (docs/ecosistema/T10-fontana/, Fontana T10 F3-4): ese parser
// tuvo errores reales de atribución en al menos 2 casos (Ciudad
// Nezahualcóyotl atribuida a Jalisco en vez de México; Ciudad Victoria
// mezclada con municipios de Tlaxcala), corregidos aquí con la fuente
// primaria real (microdato, campos CVEGEO/CVE_ENT/CVE_MUN/CD/NOM_CD
// juntos por registro, sin ambigüedad de parseo de texto).
//
// Ver lib/fontana/ingesta/ensu.ts para el uso de este catálogo en F3-4.

import ensuAreasData from "@/data/fontana/ensu_areas_2026t2.json";
import { claveCanonicaMunicipio } from "@/lib/geo/municipios";

export interface MunicipioEnsu {
  cve_ent: string;
  nombre_ent: string;
  cve_mun: string;
  nombre_mun: string;
}

export interface AreaEnsu {
  cd: string;
  nombre: string;
  municipios: MunicipioEnsu[];
}

interface ProrrateoMultiEstado {
  [cd: string]: Record<string, number>; // { estadoCve: pctEstado }
}

const DATA = ensuAreasData as {
  areas: AreaEnsu[];
  prorrateoMultiEstado: ProrrateoMultiEstado;
};

// Índice {estadoCve|claveCanonicaMunicipio: area} — construido una sola
// vez en memoria (90 áreas, ~180 municipios en total, trivial), nunca por
// request.
let indice: Map<string, AreaEnsu> | null = null;
function obtenerIndice(): Map<string, AreaEnsu> {
  if (indice) return indice;
  indice = new Map();
  for (const area of DATA.areas) {
    for (const m of area.municipios) {
      const clave = `${m.cve_ent}|${claveCanonicaMunicipio(m.cve_ent, m.nombre_mun)}`;
      indice.set(clave, area);
    }
  }
  return indice;
}

// Join por NOMBRE (claveCanonicaMunicipio), protocolo por defecto del
// proyecto — nunca por CVE_MUN entre catálogos de origen distinto.
export function resolverAreaDeMunicipio(estadoCve: string, municipioNombre: string): AreaEnsu | null {
  const idx = obtenerIndice();
  return idx.get(`${estadoCve}|${claveCanonicaMunicipio(estadoCve, municipioNombre)}`) ?? null;
}

export function areaEsMultiMunicipio(area: AreaEnsu): boolean {
  return area.municipios.length > 1;
}

// Solo presente para las áreas que cruzan límite estatal (2 casos reales
// confirmados en 2026-T2: La Laguna, Tampico) — ver
// data/fontana/ensu_areas_2026t2.json:prorrateoMultiEstado y el
// comentario de procedencia ahí (población municipal CONAPO, verificada
// en vivo).
export function resolverProrrateoEstado(cd: string, estadoCve: string): { pctEstado: number; numEstados: number } | null {
  const porEstado = DATA.prorrateoMultiEstado[cd];
  if (!porEstado) return null;
  const pctEstado = porEstado[estadoCve];
  if (pctEstado == null) return null;
  return { pctEstado, numEstados: Object.keys(porEstado).length };
}