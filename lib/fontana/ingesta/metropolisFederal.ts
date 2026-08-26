// lib/fontana/ingesta/metropolisFederal.ts
// Catálogo nacional de metrópolis — "Las metrópolis de México, 2020"
// (grupo interinstitucional SEDATU/CONAPO/INEGI), 2026-08-25.
//
// Segundo catálogo NACIONAL y sistematizado (junto con SUN, sun.ts) para
// el chip de contexto del mecanismo genérico de agregacionPlural. NO
// reemplaza a SUN — son 2 delimitaciones oficiales de propósito distinto
// (SUN: jerarquía urbana por Ciudad; este: delimitación metropolitana
// censal, la más reconocible en el uso común de "zona metropolitana").
// Decisión explícita de Raúl: no se construye un catálogo de decretos
// estatales (32 fuentes distintas, esfuerzo desproporcionado) — solo los
// 2 catálogos verdaderamente nacionales.
//
// Fuente real confirmada (datos.gob.mx, organización CONAPO):
// https://www.datos.gob.mx/dataset/da65ccd9-888c-4ce8-b3b5-6bd867be344d/resource/e7284215-f596-4025-9b5d-67c12eb84a4f/download/municipios_tipologia.csv
// 421 municipios / 92 metrópolis a nivel nacional (48 zonas
// metropolitanas + 22 metrópolis municipales + 22 zonas conurbadas — las
// 3 categorías cuentan como "metrópoli" para este catálogo). Columnas
// reales confirmadas: clave_metropoli, tipo, nombre, clave_entidad,
// entidad, clave_municipio, clave_compuesta_municipio (cve oficial INEGI
// de 5 dígitos, ya listo para cruzar con claveCanonicaMunicipio), municipio.
//
// Caso real que motivó esta integración: Guadalajara — este catálogo da
// 7 municipios (Guadalajara, Zapopan, San Pedro Tlaquepaque, Tonalá,
// Tlajomulco de Zúñiga, El Salto, Juanacatlán), subconjunto EXACTO de
// los 8 de SUN (SUN agrega Zapotlanejo) — confirmado con descarga real,
// sin discrepancia de datos, son 2 delimitaciones oficiales distintas.

import { resolverCveOficialMunicipio } from "@/lib/fontana/ingesta/anvcc";

const URL_METROPOLIS_TIPOLOGIA = "https://www.datos.gob.mx/dataset/da65ccd9-888c-4ce8-b3b5-6bd867be344d/resource/e7284215-f596-4025-9b5d-67c12eb84a4f/download/municipios_tipologia.csv";

interface MetropoliInfo {
  nombre: string;
  tipo: string; // "Zona metropolitana" | "Metrópoli municipal" | "Zona conurbada"
}

interface DatosMetropolisFederal {
  metropoliPorCve: Map<string, MetropoliInfo>; // clave_metropoli -> {nombre, tipo}
  municipiosPorMetropoli: Map<string, Set<string>>; // clave_metropoli -> set de cve5 oficiales
  // Un municipio real solo pertenece a 1 metrópoli en este catálogo
  // (a diferencia de SUN, donde una localidad puede repartirse entre 2
  // Ciudades) — se guarda como valor único, no como set, y se verifica
  // en tiempo de carga que nunca haya más de 1 clave_metropoli por cve5.
  metropoliDeMunicipio: Map<string, string>; // cve5 -> clave_metropoli
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: { datos: DatosMetropolisFederal; expira: number } | null = null;
let enVuelo: Promise<DatosMetropolisFederal> | null = null;

function partirFilaCsv(linea: string): string[] {
  // Mismo parser carácter-por-carácter ya usado en denue.ts — el archivo
  // trae nombres con comas dentro de comillas en algunas filas (ej.
  // entidades compuestas), un split ingenuo por "," las desalinea.
  const campos: string[] = [];
  let actual = "";
  let dentroComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      dentroComillas = !dentroComillas;
    } else if (c === "," && !dentroComillas) {
      campos.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos;
}

async function fetchDatosMetropolisFederal(): Promise<DatosMetropolisFederal> {
  if (cache && cache.expira > Date.now()) return cache.datos;
  if (enVuelo) return enVuelo;

  enVuelo = (async (): Promise<DatosMetropolisFederal> => {
    const res = await fetch(URL_METROPOLIS_TIPOLOGIA);
    if (!res.ok) throw new Error(`CONAPO (metrópolis) respondió ${res.status}`);
    const texto = await res.text();
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const encabezados = partirFilaCsv(lineas[0]);
    const idxClaveMetropoli = encabezados.indexOf("clave_metropoli");
    const idxTipo = encabezados.indexOf("tipo");
    const idxNombre = encabezados.indexOf("nombre");
    const idxCveCompuesta = encabezados.indexOf("clave_compuesta_municipio");

    const metropoliPorCve = new Map<string, MetropoliInfo>();
    const municipiosPorMetropoli = new Map<string, Set<string>>();
    const metropoliDeMunicipio = new Map<string, string>();

    for (let i = 1; i < lineas.length; i++) {
      const campos = partirFilaCsv(lineas[i]);
      const claveMetropoli = campos[idxClaveMetropoli]?.trim();
      const tipo = campos[idxTipo]?.trim();
      const nombre = campos[idxNombre]?.trim();
      const cve5 = campos[idxCveCompuesta]?.trim().padStart(5, "0");
      if (!claveMetropoli || !tipo || !nombre || !cve5 || cve5.length !== 5) continue;

      if (!metropoliPorCve.has(claveMetropoli)) metropoliPorCve.set(claveMetropoli, { nombre, tipo });
      if (!municipiosPorMetropoli.has(claveMetropoli)) municipiosPorMetropoli.set(claveMetropoli, new Set());
      municipiosPorMetropoli.get(claveMetropoli)!.add(cve5);
      metropoliDeMunicipio.set(cve5, claveMetropoli);
    }

    return { metropoliPorCve, municipiosPorMetropoli, metropoliDeMunicipio };
  })();

  try {
    const datos = await enVuelo;
    cache = { datos, expira: Date.now() + CACHE_TTL_MS };
    return datos;
  } finally {
    enVuelo = null;
  }
}

// Chip de contexto — mismo criterio y misma forma que
// detectarZonaMetropolitanaExacta (sun.ts): coincidencia EXACTA
// únicamente, nunca parcial ni superconjunto. A diferencia de SUN, aquí
// un municipio pertenece a una sola metrópoli (sin ambigüedad de
// localidades repartidas), así que no hace falta intersección de
// candidatos — un mapa directo cve5 -> clave_metropoli alcanza.
export async function detectarMetropolisFederalExacta(
  unidades: { estadoCve: string; nombre: string }[]
): Promise<{ nombre: string; numMunicipios: number } | null> {
  if (unidades.length === 0) return null;
  let datos: DatosMetropolisFederal;
  try {
    datos = await fetchDatosMetropolisFederal();
  } catch {
    return null;
  }

  const cves5 = new Set<string>();
  for (const { estadoCve, nombre } of unidades) {
    const cve5 = await resolverCveOficialMunicipio(estadoCve, nombre);
    if (!cve5) return null;
    cves5.add(cve5);
  }
  if (cves5.size !== unidades.length) return null;

  const clavesMetropoli = new Set([...cves5].map((cve5) => datos.metropoliDeMunicipio.get(cve5)).filter((v): v is string => !!v));
  if (clavesMetropoli.size !== 1) return null;

  const [claveMetropoli] = clavesMetropoli;
  const miembrosReales = datos.municipiosPorMetropoli.get(claveMetropoli);
  const info = datos.metropoliPorCve.get(claveMetropoli);
  if (!miembrosReales || !info) return null;

  if (miembrosReales.size !== cves5.size) return null;
  for (const cve5 of cves5) {
    if (!miembrosReales.has(cve5)) return null;
  }

  return { nombre: info.nombre, numMunicipios: miembrosReales.size };
}
