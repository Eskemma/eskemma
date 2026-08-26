// lib/fontana/ingesta/anvcc.ts
// Adaptador de F5-11, F5-12, F5-13, F5-14, F5-15, F5-16, F5-17 (Familia
// 5) — INECC, Atlas Nacional de Vulnerabilidad al Cambio Climático
// (ANVCC), mismo archivo WFS para las 7 (más F5-10, diferido — ver nota
// abajo).
//
// Verificado en vivo (Ronda 9, 2026-08-23):
// https://atlasvulnerabilidad.inecc.gob.mx/geoserver/ows?outputFormat=csv&service=WFS&srs=EPSG:4326&request=GetFeature&typename=geonode:municipios_anvcc&version=1.0.0
//   HTTP 200, CSV, 1.58 MB, 2,871 filas (una por municipio). Columnas
//   reales confirmadas (índice 0-based): cve_geo(4), cve_ent(6),
//   nom_ent(7), cve_mun(8), nom_mun(10), no_incendios(66),
//   sup_inc_ha(67), area(9) y areanaturalprot(74) [F5-14, % ponderado
//   por área, no promedio simple de %], porcent_areanat(75) [% ya
//   calculado por la fuente, se usa directo], dec_desastre/
//   dec_contigencia/dec_emergencia/tot_declaratorias(99-102) [F5-13
//   usa tot_declaratorias — verificado: Guadalajara/Zapopan ambos dan
//   6, coincide exacto con el valor ya documentado en Ronda 9, no
//   dec_desastre solo que da 3/4], pib_mun(86), pib_turistico_mun(87),
//   con_rezago/sin_rezago(76-77) [F5-17, conteo de viviendas, no
//   índice — se usa con_rezago directo].
//
// F5-10 (Problemáticas ecológicas) — DIFERIDO explícito en este
// adaptador. El archivo no tiene ninguna columna con ese nombre ni un
// candidato inequívoco: se revisaron todas las 115 columnas del CSV y
// los candidatos plausibles (appf/aprn/mn/pn/rb/s — tipo de área
// natural protegida; upaa_acciones_medio_a/porcent_tipo_prev_incendios/
// porcent_tipo_plag_enferm/porcent_tipo_separacion — % de unidades de
// producción agropecuaria con ciertas prácticas, censo ENA) miden cosas
// conceptualmente distintas entre sí, ninguno se puede confirmar como
// "el" indicador sin una fuente/definición externa que lo respalde —
// mismo criterio que graproes/grs/gmar (excluidos activamente, no son
// ningún indicador de Familia 5, son columnas de contexto del propio
// ANVCC). Se deja fuera hasta que Raúl confirme cuál columna (o
// combinación) corresponde — no se adivina.
//
// grs/gmar (columnas 63-64, grado de riesgo social/marginación) se
// excluyen activamente — no corresponden a ningún indicador de Familia
// 5, confirmado en Ronda 9.
//
// Nivel Estatal: estimación derivada (agregación de los municipios del
// estado) — la fuente no publica totales estatales. F5-11/12/13/17
// (conteos) se suman; F5-14 (%) se recalcula ponderado por área
// (Σárea_natural / Σárea_total), nunca promedio simple de porcentajes
// ya calculados; F5-15/16 (PIB, pesos) se suman, con datos faltantes
// tratados como 0 (municipios sin PIB reportado no restan del total,
// mismo criterio que otros indicadores de Fontana con cobertura
// parcial).
//
// Join municipal por NOMBRE (claveCanonicaMunicipio, lib/geo/municipios.ts)
// — NUNCA por cve_geo de ANVCC cruzado con el cve de Sefix/INE (mismo
// tipo de bug del Incidente 1: se intentó usar cve_geo de ANVCC como
// referencia cruzada para otro caso en esta misma ronda —Verificación 1—
// y dio nombres distintos para el mismo cve en un clúster de Oaxaca,
// confirmando que la numeración de ANVCC tampoco es intercambiable 1:1
// con la de Sefix/INE).

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, claveCanonicaMunicipio, getMunicipiosOptions } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

const URL_ANVCC = "https://atlasvulnerabilidad.inecc.gob.mx/geoserver/ows?outputFormat=csv&service=WFS&srs=EPSG:4326&request=GetFeature&typename=geonode:municipios_anvcc&version=1.0.0";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const FUENTE_ETIQUETA_ANVCC = "INECC, Atlas Nacional de Vulnerabilidad al Cambio Climático (ANVCC)";

interface FilaAnvcc {
  cveGeo: string; // 5 dígitos, numeración oficial INEGI (confirmado ya en Ronda 9/Incidente 1)
  noIncendios: number | null;
  supIncHa: number | null;
  totDeclaratorias: number | null;
  areaNaturalProtHa: number | null;
  areaTotalHa: number | null;
  porcentAreanat: number | null;
  pibMun: number | null;
  pibTuristicoMun: number | null;
  conRezago: number | null;
}

interface CacheAnvcc {
  porMunicipioPorNombre: Map<string, FilaAnvcc>; // `${estadoCve}|${claveCanonica}`
  ts: number;
}

let cache: CacheAnvcc | null = null;
let enVuelo: Promise<CacheAnvcc> | null = null;

function num(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function cargarAnvcc(): Promise<CacheAnvcc> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const res = await fetch(URL_ANVCC);
    if (!res.ok) throw new Error(`ANVCC HTTP ${res.status}`);
    const texto = await res.text();
    const lineas = texto.split("\n");
    const header = lineas[0].split(",");
    const idx = (nombre: string) => header.indexOf(nombre);
    const iCveGeo = idx("cve_geo");
    const iCveEnt = idx("cve_ent");
    const iNomMun = idx("nom_mun");
    const iNoIncendios = idx("no_incendios");
    const iSupIncHa = idx("sup_inc_ha");
    const iTotDeclaratorias = idx("tot_declaratorias");
    const iArea = idx("area");
    const iAreaNaturalProt = idx("areanaturalprot");
    const iPorcentAreanat = idx("porcent_areanat");
    const iPibMun = idx("pib_mun");
    const iPibTuristicoMun = idx("pib_turistico_mun");
    const iConRezago = idx("con_rezago");

    const porMunicipioPorNombre = new Map<string, FilaAnvcc>();
    for (const linea of lineas.slice(1)) {
      if (!linea.trim()) continue;
      const cols = linea.split(",");
      const cveEnt = cols[iCveEnt];
      const nomMun = cols[iNomMun];
      if (!cveEnt || !nomMun) continue;
      const clave = `${cveEnt}|${claveCanonicaMunicipio(cveEnt, nomMun)}`;
      porMunicipioPorNombre.set(clave, {
        cveGeo: cols[iCveGeo],
        noIncendios: num(cols[iNoIncendios]),
        supIncHa: num(cols[iSupIncHa]),
        totDeclaratorias: num(cols[iTotDeclaratorias]),
        areaNaturalProtHa: num(cols[iAreaNaturalProt]),
        areaTotalHa: num(cols[iArea]),
        porcentAreanat: num(cols[iPorcentAreanat]),
        pibMun: num(cols[iPibMun]),
        pibTuristicoMun: num(cols[iPibTuristicoMun]),
        conRezago: num(cols[iConRezago]),
      });
    }

    const resultado: CacheAnvcc = { porMunicipioPorNombre, ts: Date.now() };
    cache = resultado;
    return resultado;
  })();

  try {
    return await enVuelo;
  } finally {
    enVuelo = null;
  }
}

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

// Reutilizado por el wrapper de F5-7 (sun.ts) en index.ts — SUN indexa
// su propia bodega por CVE_MUN oficial INEGI (via CVE_LOC), no por
// nombre; como ANVCC ya trae ese cve oficial (`cve_geo`) junto al
// nombre en el mismo archivo (ya cacheado aquí), resolver
// nombre→cve-oficial vía ANVCC evita levantar una quinta fuente solo
// para esto. Nunca se usa el cve de Sefix/INE para esto — mismo
// criterio del Incidente 1.
export async function resolverCveOficialMunicipio(estadoCve: string, municipioNombre: string): Promise<string | null> {
  const datos = await cargarAnvcc();
  const fila = datos.porMunicipioPorNombre.get(`${estadoCve}|${claveCanonicaMunicipio(estadoCve, municipioNombre)}`);
  return fila?.cveGeo ?? null;
}

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

type CampoNumerico = "noIncendios" | "supIncHa" | "totDeclaratorias" | "pibMun" | "pibTuristicoMun" | "conRezago";

interface ConfigIndicadorAnvcc {
  campo: CampoNumerico;
  unidad: string;
}

const CONFIG_INDICADORES: Record<string, ConfigIndicadorAnvcc> = {
  "F5-11": { campo: "noIncendios", unidad: "incendios" },
  "F5-12": { campo: "supIncHa", unidad: "hectáreas" },
  "F5-13": { campo: "totDeclaratorias", unidad: "declaratorias" },
  "F5-15": { campo: "pibMun", unidad: "pesos" },
  "F5-16": { campo: "pibTuristicoMun", unidad: "pesos" },
  "F5-17": { campo: "conRezago", unidad: "viviendas" },
};

async function resolverIndicadorNumerico(indicadorId: string, territorio: Territorio): Promise<CeldaFontana[]> {
  const config = CONFIG_INDICADORES[indicadorId];
  let datos: CacheAnvcc;
  try {
    datos = await cargarAnvcc();
  } catch {
    const motivo = "Error de conexión con INECC (ANVCC)";
    return [{ nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  if (!territorio.estado) {
    return [
      { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" },
      { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" },
    ];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [{ nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  // Estatal: suma de todos los municipios del estado (estimación
  // derivada — la fuente no publica totales estatales).
  let sumaEstado = 0;
  let algunoConDato = false;
  for (const [clave, fila] of datos.porMunicipioPorNombre) {
    if (!clave.startsWith(`${estadoCve}|`)) continue;
    const valor = fila[config.campo];
    if (valor != null) {
      sumaEstado += valor;
      algunoConDato = true;
    }
  }
  const estatal: CeldaFontana = algunoConDato
    ? { nivel: "estatal", valor: sumaEstado, unidad: config.unidad, naturaleza: "estimacion_agregada", fuenteEtiqueta: FUENTE_ETIQUETA_ANVCC }
    : { nivel: "estatal", motivo: "ANVCC no reportó datos para este estado" };

  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const fila = datos.porMunicipioPorNombre.get(`${estadoCve}|${claveCanonicaMunicipio(estadoCve, municipioNombre)}`);
    const valor = fila?.[config.campo];
    municipal = valor != null
      ? { nivel: "municipal", valor, unidad: config.unidad, naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_ANVCC }
      : { nivel: "municipal", motivo: `ANVCC no reportó "${config.unidad}" para este municipio` };
  }

  return [estatal, municipal];
}

// F5-14 — caso aparte: nivel Municipal usa el % ya calculado por la
// fuente (dato_directo); nivel Estatal se recalcula ponderado por área
// (Σárea_natural / Σárea_total × 100), nunca promedio simple de los
// porcentajes municipales ya calculados — mismo criterio que Nacional
// en otros indicadores de Fontana (nunca promediar un % ya agregado).
export async function resolverAreaNaturalProtegida(territorio: Territorio): Promise<CeldaFontana[]> {
  let datos: CacheAnvcc;
  try {
    datos = await cargarAnvcc();
  } catch {
    const motivo = "Error de conexión con INECC (ANVCC)";
    return [{ nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  if (!territorio.estado) {
    return [
      { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" },
      { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" },
    ];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [{ nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  let areaNaturalTotal = 0;
  let areaTotal = 0;
  for (const [clave, fila] of datos.porMunicipioPorNombre) {
    if (!clave.startsWith(`${estadoCve}|`)) continue;
    if (fila.areaNaturalProtHa != null) areaNaturalTotal += fila.areaNaturalProtHa;
    if (fila.areaTotalHa != null) areaTotal += fila.areaTotalHa;
  }
  const estatal: CeldaFontana = areaTotal > 0
    ? { nivel: "estatal", valor: Math.round((areaNaturalTotal / areaTotal) * 10000) / 100, unidad: "%", naturaleza: "estimacion_agregada", fuenteEtiqueta: FUENTE_ETIQUETA_ANVCC }
    : { nivel: "estatal", motivo: "ANVCC no reportó datos para este estado" };

  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const fila = datos.porMunicipioPorNombre.get(`${estadoCve}|${claveCanonicaMunicipio(estadoCve, municipioNombre)}`);
    municipal = fila?.porcentAreanat != null
      ? { nivel: "municipal", valor: fila.porcentAreanat, unidad: "%", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_ANVCC }
      : { nivel: "municipal", motivo: "ANVCC no reportó % de área natural protegida para este municipio" };
  }

  return [estatal, municipal];
}

export async function resolverIncendiosForestales(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorNumerico("F5-11", territorio);
}
export async function resolverSuperficieIncendiada(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorNumerico("F5-12", territorio);
}
export async function resolverDeclaratoriasDesastre(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorNumerico("F5-13", territorio);
}
export async function resolverPibMunicipal(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorNumerico("F5-15", territorio);
}
export async function resolverPibTuristico(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorNumerico("F5-16", territorio);
}
export async function resolverRezagoVivienda(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorNumerico("F5-17", territorio);
}

// Desglose "Ver municipios" — mismo patrón que el resto de Fontana.
async function resolverMunicipiosEstadoGenerico(
  estadoCve: string,
  campo: CampoNumerico,
  unidad: string,
  opciones: { cve: string; nombre: string }[]
): Promise<ElementoDeEstado[]> {
  const datos = await cargarAnvcc();
  return opciones.map(({ cve, nombre }): ElementoDeEstado => {
    const fila = datos.porMunicipioPorNombre.get(`${estadoCve}|${claveCanonicaMunicipio(estadoCve, nombre)}`);
    const valor = fila?.[campo];
    return {
      cve,
      nombre,
      celda: valor != null
        ? { nivel: "municipal", valor, unidad, naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_ANVCC }
        : { nivel: "municipal", motivo: `ANVCC no reportó "${unidad}" para este municipio` },
    };
  });
}

export { resolverMunicipiosEstadoGenerico as resolverMunicipiosEstadoAnvcc };

// Capa 2 (2026-08-24) — wrappers con la firma estándar
// `(estadoCve, soloCves?)` que espera `resolverDesgloseMunicipiosEstado()`
// (lib/fontana/ingesta/index.ts), usados tanto por "Ver municipios" como
// por la agregación de territorio plural (`resolverAgregacionPlural`).
// Solo los 6 indicadores "aditivo" de Modo A — F5-14 (tasa_ponderada)
// necesita numerador/denominador propio (área ponderada), no este
// bulk-resolver simple; queda para cuando se diseñe Modo B.
async function resolverMunicipiosEstadoIndicador(
  estadoCve: string,
  campo: CampoNumerico,
  unidad: string,
  soloCves?: string[]
): Promise<ElementoDeEstado[]> {
  const opciones = await getMunicipiosOptions(estadoCve);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;
  return resolverMunicipiosEstadoGenerico(estadoCve, campo, unidad, opcionesFiltradas);
}

export async function resolverMunicipiosEstadoIncendios(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoIndicador(estadoCve, "noIncendios", CONFIG_INDICADORES["F5-11"].unidad, soloCves);
}
export async function resolverMunicipiosEstadoSuperficieIncendiada(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoIndicador(estadoCve, "supIncHa", CONFIG_INDICADORES["F5-12"].unidad, soloCves);
}
export async function resolverMunicipiosEstadoDeclaratorias(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoIndicador(estadoCve, "totDeclaratorias", CONFIG_INDICADORES["F5-13"].unidad, soloCves);
}
export async function resolverMunicipiosEstadoPib(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoIndicador(estadoCve, "pibMun", CONFIG_INDICADORES["F5-15"].unidad, soloCves);
}
export async function resolverMunicipiosEstadoPibTuristico(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoIndicador(estadoCve, "pibTuristicoMun", CONFIG_INDICADORES["F5-16"].unidad, soloCves);
}
export async function resolverMunicipiosEstadoRezagoVivienda(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoIndicador(estadoCve, "conRezago", CONFIG_INDICADORES["F5-17"].unidad, soloCves);
}
