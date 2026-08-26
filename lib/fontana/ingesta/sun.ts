// lib/fontana/ingesta/sun.ts
// Adaptador de F5-7 (Zonas habitacionales y comerciales) — Familia 5.
//
// Verificado 2026-08-23. Drift real encontrado: la API CKAN de
// datos.gob.mx cambió de base — `/busca/api/3/action/...` (documentado
// hace un mes) ya no funciona; la base vigente es `/api/3/action/...`
// (sin `/busca`). Con la ruta corregida, el dataset `sistema_urbano_nacional`
// (CONAPO) sigue con los mismos recursos:
//   SUN_2020.csv (cve_cd,nom_cd,pob_2020) — población 2020 por Ciudad/ZM
//   SUN_2020_conformacion_por_ciudad.csv — qué localidades (con estado
//     real vía CVE_LOC) componen cada Ciudad, población por localidad
//
// Valor real: SUN_2020.csv solo trae `pob_2020` (magnitud/conteo, sin
// ningún campo categórico de tipo de zona) — Guadalajara (un estado)
// 4,957,649; Torreón (Coah./Dgo., multi-estado) 1,185,286, ambos
// confirmados en vivo.
//
// Nivel Municipal: valor completo de la Ciudad/ZM a la que pertenece el
// municipio (un municipio siempre pertenece a una sola Ciudad y a un
// solo estado — sin complicación). Nivel Estatal: para las 15 de 218
// Ciudades que cruzan más de un estado (confirmado con datos reales de
// población por localidad — Torreón, Puerto Vallarta, Tampico, Puebla,
// Querétaro, Lázaro Cárdenas, entre otras), se prorratea por población
// real de las localidades de ese estado ÷ población total de la Ciudad
// — nunca se muestra el total completo de una ZM en 2 estados a la vez
// (eso duplicaría el valor). Mismo criterio de "reconstruir desde datos
// reales, nunca inventar" ya establecido en el proyecto.
//
// Sin caché en Storage — los 2 CSV cacheados en memoria de proceso
// (TTL 24h, single-flight), un solo fetch de cada uno por proceso.

import { resolverCveOficialMunicipio } from "@/lib/fontana/ingesta/anvcc";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { Territorio } from "@/types/shared.types";

const SUN_2020_URL = "https://repodatos.atdt.gob.mx/api_update/conapo/sistema_urbano_nacional/SUN_2020.csv";
const SUN_CONFORMACION_URL = "https://repodatos.atdt.gob.mx/all_data/conapo/7711beb8-fa43-4329-b5b6-4096070eb228/SUN_2020_conformacion_por_ciudad.csv";

interface CiudadSun {
  nombre: string;
  pobTotal: number;
}

interface DatosSun {
  ciudadesPorCveCd: Map<string, CiudadSun>; // SUN_2020.csv
  municipioACiudad: Map<string, string>; // cve_mun (5 dígitos) -> cve_cd
  poblacionPorEstadoDeCiudad: Map<string, Map<string, number>>; // cve_cd -> (cve_ent -> población real)
  numMunicipiosPorCiudad: Map<string, number>; // cve_cd -> conteo real de municipios (para el chip de zona_metropolitana)
  // 2026-08-25 (chip de contexto ZM para el mecanismo genérico de
  // agregacionPlural) — set completo de cve_mun (5 dígitos, oficial
  // INEGI) por Ciudad, para detectar coincidencia EXACTA con la
  // selección del usuario. Mismo dato que ya se calculaba para
  // numMunicipiosPorCiudad (el tamaño del set) — ahora se expone el set
  // completo, no solo su tamaño.
  municipiosPorCiudad: Map<string, Set<string>>;
  ciudadesPorMunicipio: Map<string, Set<string>>;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: { datos: DatosSun; expira: number } | null = null;
let enVuelo: Promise<DatosSun> | null = null;

// BUG REAL encontrado y corregido en esta ronda: `cve_cd` no usa el
// mismo formato entre los 2 archivos del mismo dataset — confirmado con
// Torreón real: SUN_2020.csv trae "5.01" (sin cero a la izquierda),
// SUN_2020_conformacion_por_ciudad.csv trae "05.01" (con cero). Sin
// normalizar, el join entre ambos archivos fallaba en cualquier ciudad
// cuyo estado tuviera clave de un solo dígito (01-09) — no solo
// Torreón, cualquier ZM en esos 9 estados. Se normaliza quitando el
// cero a la izquierda de la parte antes del punto en ambos lados.
function normalizarCveCd(cveCd: string): string {
  const [parteEstado, resto] = cveCd.split(".");
  return `${Number(parteEstado)}.${resto}`;
}

async function fetchDatosSun(): Promise<DatosSun> {
  if (cache && cache.expira > Date.now()) return cache.datos;
  if (enVuelo) return enVuelo;

  enVuelo = (async (): Promise<DatosSun> => {
    const [resCiudades, resConformacion] = await Promise.all([fetch(SUN_2020_URL), fetch(SUN_CONFORMACION_URL)]);
    if (!resCiudades.ok) throw new Error(`SUN respondió ${resCiudades.status}`);
    if (!resConformacion.ok) throw new Error(`SUN (conformación) respondió ${resConformacion.status}`);
    const [textoCiudades, textoConformacion] = await Promise.all([resCiudades.text(), resConformacion.text()]);

    const ciudadesPorCveCd = new Map<string, CiudadSun>();
    for (const linea of textoCiudades.split(/\r?\n/).slice(1)) {
      if (!linea.trim()) continue;
      const [cveCdCrudo, nombre, pobTexto] = linea.split(",");
      const pob = Number(pobTexto);
      if (!cveCdCrudo || Number.isNaN(pob)) continue;
      const cveCd = normalizarCveCd(cveCdCrudo);
      if (!ciudadesPorCveCd.has(cveCd)) ciudadesPorCveCd.set(cveCd, { nombre, pobTotal: pob });
    }

    const lineasConf = textoConformacion.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const encabezados = lineasConf[0].split(",");
    const idxCiudad = encabezados.indexOf("Ciudad");
    const idxCveLoc = encabezados.indexOf("CVE_LOC");
    const idxAnio = encabezados.indexOf("ANIO");
    const idxPob = encabezados.indexOf("POBLACION");

    const municipioACiudad = new Map<string, string>();
    const poblacionPorEstadoDeCiudad = new Map<string, Map<string, number>>();
    const municipiosPorCiudad = new Map<string, Set<string>>();
    // Candidatos completos por municipio (2026-08-25, hallazgo real
    // durante la verificación del chip de contexto ZM) — un municipio
    // puede tener localidades repartidas entre 2 Ciudades distintas del
    // SUN (confirmado: El Salto y Juanacatlán, Jalisco, tienen
    // localidades contadas tanto en "Guadalajara" como en su propia
    // Ciudad "El Salto"). `municipioACiudad` (último valor visto, usado
    // por resolverZonasSun para el valor mostrado de un solo municipio)
    // pierde esa ambigüedad — para la detección de coincidencia EXACTA
    // hace falta el set COMPLETO de candidatos, no solo el último.
    const ciudadesPorMunicipio = new Map<string, Set<string>>();
    for (let i = 1; i < lineasConf.length; i++) {
      const campos = lineasConf[i].split(",");
      const ciudadCol = campos[idxCiudad]?.trim();
      const cveLoc = campos[idxCveLoc]?.trim();
      if (!ciudadCol || !cveLoc || cveLoc.length < 7) continue;
      const cveCd = normalizarCveCd(ciudadCol.split(" ")[0]);
      const cveEnt = cveLoc.slice(0, 2);
      const cveMun5 = cveLoc.slice(0, 5);
      municipioACiudad.set(cveMun5, cveCd);
      if (!municipiosPorCiudad.has(cveCd)) municipiosPorCiudad.set(cveCd, new Set());
      municipiosPorCiudad.get(cveCd)!.add(cveMun5);
      if (!ciudadesPorMunicipio.has(cveMun5)) ciudadesPorMunicipio.set(cveMun5, new Set());
      ciudadesPorMunicipio.get(cveMun5)!.add(cveCd);

      if (campos[idxAnio]?.trim() === "2020") {
        const pob = Number(campos[idxPob]?.trim());
        if (!Number.isNaN(pob)) {
          if (!poblacionPorEstadoDeCiudad.has(cveCd)) poblacionPorEstadoDeCiudad.set(cveCd, new Map());
          const porEstado = poblacionPorEstadoDeCiudad.get(cveCd)!;
          porEstado.set(cveEnt, (porEstado.get(cveEnt) ?? 0) + pob);
        }
      }
    }

    const numMunicipiosPorCiudad = new Map<string, number>(
      [...municipiosPorCiudad.entries()].map(([cveCd, set]) => [cveCd, set.size])
    );
    return { ciudadesPorCveCd, municipioACiudad, poblacionPorEstadoDeCiudad, numMunicipiosPorCiudad, municipiosPorCiudad, ciudadesPorMunicipio };
  })();
  try {
    const datos = await enVuelo;
    cache = { datos, expira: Date.now() + CACHE_TTL_MS };
    return datos;
  } finally {
    enVuelo = null;
  }
}

export async function resolverZonasSun(estadoCve2: string, municipioCve5: string): Promise<CeldaFontana[]> {
  let datos: DatosSun;
  try {
    datos = await fetchDatosSun();
  } catch {
    return [{ nivel: "municipal", motivo: "Error de conexión con el Sistema Urbano Nacional (SEDATU/CONAPO)" }];
  }

  const cveCd = datos.municipioACiudad.get(municipioCve5);
  if (!cveCd) {
    return [{ nivel: "municipal", motivo: "Este municipio no forma parte de ninguna Ciudad/Zona Metropolitana del Sistema Urbano Nacional" }];
  }
  const ciudad = datos.ciudadesPorCveCd.get(cveCd);
  if (!ciudad) {
    return [{ nivel: "municipal", motivo: "Sin dato de población del SUN para esta Ciudad/Zona Metropolitana" }];
  }

  const numMunicipios = datos.numMunicipiosPorCiudad.get(cveCd) ?? 1;

  const celdas: CeldaFontana[] = [{
    nivel: "municipal",
    valor: ciudad.pobTotal,
    unidad: `habitantes (Zona Metropolitana ${ciudad.nombre})`,
    naturaleza: "dato_directo",
    fuenteEtiqueta: "SEDATU/CONAPO, Sistema Urbano Nacional 2020",
    zonaMetropolitana: { nombre: ciudad.nombre, numMunicipios },
  }];

  const porEstado = datos.poblacionPorEstadoDeCiudad.get(cveCd);
  const estadosDeLaCiudad = porEstado ? [...porEstado.keys()] : [estadoCve2];

  if (estadosDeLaCiudad.length <= 1) {
    celdas.push({
      nivel: "estatal",
      valor: ciudad.pobTotal,
      unidad: `habitantes (Zona Metropolitana ${ciudad.nombre})`,
      naturaleza: "dato_directo",
      fuenteEtiqueta: "SEDATU/CONAPO, Sistema Urbano Nacional 2020",
      zonaMetropolitana: { nombre: ciudad.nombre, numMunicipios },
    });
  } else if (porEstado) {
    const pobEstado = porEstado.get(estadoCve2) ?? 0;
    const pobTotalReal = [...porEstado.values()].reduce((a, b) => a + b, 0);
    const pct = pobTotalReal > 0 ? Math.round((pobEstado / pobTotalReal) * 1000) / 10 : 0;
    celdas.push({
      nivel: "estatal",
      valor: pobEstado,
      unidad: `habitantes — porción en este estado de la Zona Metropolitana ${ciudad.nombre} (${pct}% del total, cruza ${estadosDeLaCiudad.length} estados)`,
      naturaleza: "estimacion_agregada",
      fuenteEtiqueta: "SEDATU/CONAPO, Sistema Urbano Nacional 2020 — prorrateado por población real de localidades",
      zonaMetropolitana: { nombre: ciudad.nombre, numMunicipios, prorrateo: { pctEstado: pct, numEstados: estadosDeLaCiudad.length } },
    });
  }

  return celdas;
}

// Chip de contexto ZM para el mecanismo GENÉRICO de agregacionPlural
// (2026-08-25) — usado por F5-6/F5-8/F5-11/12/13/15/16/17 cuando el
// usuario selecciona un territorio plural. Criterio confirmado por
// Raúl: el chip solo aparece con coincidencia EXACTA contra el catálogo
// SUN (mismo catálogo que ya usa F5-7) — nunca con coincidencia parcial
// ni superconjunto. Si la selección no es exactamente los miembros
// reales de una Ciudad/ZM, se regresa null y el valor combinado se
// sigue mostrando igual, solo sin la etiqueta.
export async function detectarZonaMetropolitanaExacta(
  unidades: { estadoCve: string; nombre: string }[]
): Promise<{ nombre: string; numMunicipios: number } | null> {
  if (unidades.length === 0) return null;
  let datos: DatosSun;
  try {
    datos = await fetchDatosSun();
  } catch {
    return null;
  }

  const cves5 = new Set<string>();
  for (const { estadoCve, nombre } of unidades) {
    const cve5 = await resolverCveOficialMunicipio(estadoCve, nombre);
    if (!cve5) return null; // un solo municipio sin cve oficial resuelto ya descarta el match exacto
    cves5.add(cve5);
  }
  if (cves5.size !== unidades.length) return null; // duplicados reales — no debería pasar, pero nunca se asume

  // Intersección de candidatos (no el último valor visto) — un municipio
  // puede tener localidades en más de una Ciudad del SUN (hallazgo real:
  // El Salto/Juanacatlán, Jalisco, cuentan tanto en "Guadalajara" como en
  // su propia Ciudad "El Salto"). Solo hay match si existe UNA Ciudad
  // común a los candidatos de TODOS los municipios seleccionados.
  let interseccion: Set<string> | null = null;
  for (const cve5 of cves5) {
    const candidatas: Set<string> | undefined = datos.ciudadesPorMunicipio.get(cve5);
    if (!candidatas || candidatas.size === 0) return null;
    const previa: Set<string> = interseccion ?? candidatas;
    interseccion = new Set([...previa].filter((c) => candidatas.has(c)));
    if (interseccion.size === 0) return null;
  }
  if (!interseccion || interseccion.size !== 1) return null; // ambiguo (2+ Ciudades comunes) o ninguna — nunca se adivina

  const [cveCd] = interseccion;
  const miembrosReales = datos.municipiosPorCiudad.get(cveCd);
  const ciudad = datos.ciudadesPorCveCd.get(cveCd);
  if (!miembrosReales || !ciudad) return null;

  if (miembrosReales.size !== cves5.size) return null; // ni parcial ni superconjunto — solo coincidencia exacta
  for (const cve5 of cves5) {
    if (!miembrosReales.has(cve5)) return null;
  }

  return { nombre: ciudad.nombre, numMunicipios: miembrosReales.size };
}
