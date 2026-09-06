// lib/fontana/ingesta/coneval.ts
// Adaptador de F2-1 (Pobreza), F2-2 (Pobreza extrema), F2-14 (Población
// con ≥1 carencia social) y F2-3 (Índice de Rezago Social) — 2 archivos
// CONEVAL distintos, no 1 (el catálogo Paso 2 documentaba "mismo
// archivo que F2-1" para F2-3, incorrecto — verificado en vivo
// 2026-08-09 descargando y parseando ambos):
//
//   POBREZA = https://www.coneval.org.mx/Medicion/Documents/Pobreza_municipal/2020/Concentrado_indicadores_de_pobreza_2020.zip
//     HTTP 200, ZIP válido, 4,401,534 bytes → Concentrado_indicadores_de_pobreza_2020.xlsx
//     (5MB), hojas "Concentrado municipal" (~2,469 filas) y "Concentrado
//     estatal" (32 filas). Cubre F2-1/F2-2/F2-14 — búsqueda exhaustiva de
//     "rezago" en las 2 hojas confirma que el Índice de Rezago Social NO
//     está aquí (el único match es "Rezago educativo", una de las 6
//     carencias de la metodología de pobreza multidimensional, concepto
//     distinto).
//
//   REZAGO_SOCIAL = https://www.coneval.org.mx/Medicion/Documents/IRS_2020/IRS_ent_mun_2000_2020.zip
//     HTTP 200, ZIP válido → IRS_entidades_mpios_2020.xlsx (551KB, uno de
//     5 archivos por año 2000-2020, se usa 2020), hojas "Estados" (32
//     filas + fila CVE_ENT="00"/"Nacional") y "Municipios" (~2,469 filas).
//
// coneval.org.mx NO requiere el workaround TLS de datos.gob.mx/conapo.segob.gob.mx
// — confirmado en vivo 2026-08-09 (fetch nativo, sin rejectUnauthorized:false,
// HEAD 200 directo). Certificado Sectigo con cadena completa.
//
// ZIP con un solo .xlsx adentro — se extrae con jszip (agregado como
// dependencia directa, antes transitivo de otros paquetes) en vez de
// shellear `unzip` (no garantizado en runtime serverless).
//
// Naturaleza dato_directo (no calculo_directo) en Estatal/Municipal: a
// diferencia de ECEG, CONEVAL YA publica el porcentaje/índice calculado
// — Fontana solo lo lee, nunca divide numerador/denominador.
//
// Nacional — 2 casos distintos, confirmados con evidencia real:
//   F2-1/F2-2/F2-14: la hoja "Concentrado estatal" NO trae fila
//   Nacional — se agrega (Σ Personas2020 / Σ Población2020 × 100 de los
//   32 estados, naturaleza estimacion_agregada, mismo criterio F1).
//   F2-3: la hoja "Estados" del archivo IRS SÍ tiene una fila
//   CVE_ENT="00"/"Nacional" con los 11 indicadores base poblados, pero
//   la columna "Índice de rezago social" para esa fila está VACÍA
//   (null) — CONEVAL mismo decidió no publicar el índice compuesto a
//   nivel país. Mismo tratamiento que F2-4 (CONAPO Marginación): no se
//   agrega, "no corresponde calcular" — aquí con evidencia más fuerte
//   (la propia fuente deja la celda en blanco, no es inferencia).
//
// ⚠️ Población NO es comparable entre estos indicadores y el resto de
// Fontana: la "Población total" de Concentrado_indicadores_de_pobreza_2020.xlsx
// es una cifra CALIBRADA por CONEVAL (MCS-ENIGH) — el propio archivo
// advierte "estas cifras de población podrían diferir de las reportadas
// por el INEGI y CONAPO" (verificado: Zapopan 1,458,652 aquí vs.
// 1,476,491 en ITER/ECEG, ~1.2% de diferencia). La población de
// IRS_entidades_mpios_2020.xlsx, en cambio, SÍ coincide exacto con ITER
// (Zapopan 1,476,491 en ambos). Nunca mezclar una fuente de población
// con la otra al calcular Nacional — cada loader usa su propia columna.

import JSZip from "jszip";
import * as XLSX from "xlsx";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, getMunicipiosOptions, claveCanonicaMunicipio } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";
import type { ResultadoSerie } from "@/lib/fontana/series/tipos";
import { nivelObjetivoSerie } from "@/lib/fontana/series/tipos";

export const FUENTE_ETIQUETA_CONEVAL_POBREZA = "CONEVAL (Medición de la pobreza 2020)";
export const FUENTE_ETIQUETA_CONEVAL_IRS = "CONEVAL (Índice de Rezago Social 2020)";

const URL_POBREZA = "https://www.coneval.org.mx/Medicion/Documents/Pobreza_municipal/2020/Concentrado_indicadores_de_pobreza_2020.zip";
const URL_REZAGO_SOCIAL = "https://www.coneval.org.mx/Medicion/Documents/IRS_2020/IRS_ent_mun_2000_2020.zip";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// nombrePatron filtra la entrada correcta dentro del ZIP — el ZIP de
// Rezago Social trae 5 archivos (uno por año 2000/2005/2010/2015/2020,
// bug real encontrado en vivo 2026-08-09: sin filtrar, `find` tomaba el
// primero del ZIP —"IRS_entidades_mpios_2000.xlsx"— en vez de 2020,
// dando valores de hace 20 años sin ningún error visible). El ZIP de
// Pobreza trae un solo .xlsx, así que el patrón por defecto (cualquier
// .xlsx) es seguro ahí, pero se exige el patrón explícito siempre para
// no repetir este mismo tipo de bug si CONEVAL cambia el empaquetado.
async function descargarZipYExtraerXlsx(url: string, nombrePatron: RegExp): Promise<XLSX.WorkBook> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CONEVAL HTTP ${res.status} en ${url}`);
  const zipBuf = Buffer.from(await res.arrayBuffer());
  const zip = await JSZip.loadAsync(zipBuf);
  const entradas = Object.values(zip.files).filter((f) => !f.dir && /\.xlsx$/i.test(f.name));
  const entry = entradas.find((f) => nombrePatron.test(f.name));
  if (!entry) {
    throw new Error(
      `ZIP de CONEVAL (${url}) no contiene ningún .xlsx que coincida con ${nombrePatron} — archivos encontrados: ${entradas.map((f) => f.name).join(", ")}`
    );
  }
  const xlsxBuf = await entry.async("nodebuffer");
  return XLSX.read(xlsxBuf, { type: "buffer" });
}

type ParPorcentajePersonas = { porcentaje: number; personas: number };

interface CachePobreza {
  porEstadoPobreza: Map<string, ParPorcentajePersonas>;
  porEstadoPobrezaExtrema: Map<string, ParPorcentajePersonas>;
  porEstadoCarencia: Map<string, ParPorcentajePersonas>;
  poblacionPorEstado: Map<string, number>; // Población 2020 (CONEVAL, MCS-ENIGH) — solo para agregar Nacional
  // FIX DE FONDO (Paso 4, 2026-08-23) — join municipal por NOMBRE, no por
  // CVE_MUN, mismo patrón ya aprobado y en producción en icmm.ts (ver
  // nota de cabecera de ese archivo). resolveMunicipioCve() (numeración
  // INE de lib/geo/municipios.ts) diverge del CVE_MUN oficial de CONEVAL
  // en ~55-63% de los municipios — cruzar por CVE producía el valor de
  // OTRO municipio sin ningún error visible (confirmado con evidencia
  // real, Guadalajara/El Grullo). Clave: `${cveEnt}|${normalizeGeoName(nombreConevalPropio)}`.
  porMunicipioPobrezaPorNombre: Map<string, ParPorcentajePersonas>;
  porMunicipioPobrezaExtremaPorNombre: Map<string, ParPorcentajePersonas>;
  porMunicipioCarenciaPorNombre: Map<string, ParPorcentajePersonas>;
  // Población 2020 por municipio (CONEVAL, MCS-ENIGH), por nombre — para
  // reconstruir numerador/denominador real al calcular Distrital
  // Federal/Local a escala Nacional (nunca promediar el % ya calculado
  // entre municipios, mismo criterio que Nacional).
  poblacionPorMunicipioPorNombre: Map<string, number>;
  ts: number;
}

interface CacheRezagoSocial {
  porEstado: Map<string, number>;
  // FIX DE FONDO (Paso 4, 2026-08-23) — mismo criterio de join por
  // nombre que CachePobreza arriba.
  porMunicipioPorNombre: Map<string, number>;
  ts: number;
}

// Clave compartida por los 2 loaders de este archivo (Pobreza/IRS) — cada
// uno usa el nombre de municipio TAL COMO lo publica CONEVAL en su propio
// archivo, nunca el nombre/cve de un catálogo externo.
// FIX DE FONDO (Incidente 2, 2026-08-23) — claveCanonicaMunicipio()
// aplica la tabla de alias central (lib/geo/municipios.ts) antes de
// normalizar, en vez de normalizeGeoName() a secas — ver nota de
// cabecera de ese archivo.
function claveMunicipioPorNombre(estadoCve: string, nombre: string): string {
  return `${estadoCve}|${claveCanonicaMunicipio(estadoCve, nombre)}`;
}

let cachePobreza: CachePobreza | null = null;
let enVueloPobreza: Promise<CachePobreza> | null = null;
let cacheRezagoSocial: CacheRezagoSocial | null = null;
let enVueloRezagoSocial: Promise<CacheRezagoSocial> | null = null;

// Offsets confirmados en vivo parseando el archivo real (2026-08-09) —
// difieren entre hojas por las columnas de identificación extra
// (municipal trae CVE_MUN+Municipio, estatal no).
const GRUPOS_MUNICIPAL = { pobreza: 8, pobrezaExtrema: 17, carencia: 110 };
const GRUPOS_ESTATAL = { pobreza: 6, pobrezaExtrema: 15, carencia: 108 };
const OFFSET_PORCENTAJE_2020 = 2;
const OFFSET_PERSONAS_2020 = 5;

function extraerParGrupo(fila: unknown[], grupoInicio: number): ParPorcentajePersonas | null {
  const porcentaje = fila[grupoInicio + OFFSET_PORCENTAJE_2020];
  const personas = fila[grupoInicio + OFFSET_PERSONAS_2020];
  if (typeof porcentaje !== "number" || typeof personas !== "number") return null;
  return { porcentaje, personas };
}

async function cargarPobreza(): Promise<CachePobreza> {
  if (cachePobreza && Date.now() - cachePobreza.ts < CACHE_TTL_MS) return cachePobreza;
  if (enVueloPobreza) return enVueloPobreza;

  enVueloPobreza = (async () => {
    const wb = await descargarZipYExtraerXlsx(URL_POBREZA, /2020\.xlsx$/i);

    const porEstadoPobreza = new Map<string, ParPorcentajePersonas>();
    const porEstadoPobrezaExtrema = new Map<string, ParPorcentajePersonas>();
    const porEstadoCarencia = new Map<string, ParPorcentajePersonas>();
    const poblacionPorEstado = new Map<string, number>();
    const wsEstatal = wb.Sheets["Concentrado estatal"];
    const filasEstatal = XLSX.utils.sheet_to_json<unknown[]>(wsEstatal, { header: 1, defval: null });
    for (const fila of filasEstatal) {
      const cveEnt = fila[1];
      if (typeof cveEnt !== "string" || !/^\d{2}$/.test(cveEnt)) continue;
      const poblacion2020 = fila[5];
      if (typeof poblacion2020 === "number") poblacionPorEstado.set(cveEnt, poblacion2020);
      const pobreza = extraerParGrupo(fila, GRUPOS_ESTATAL.pobreza);
      if (pobreza) porEstadoPobreza.set(cveEnt, pobreza);
      const pobrezaExtrema = extraerParGrupo(fila, GRUPOS_ESTATAL.pobrezaExtrema);
      if (pobrezaExtrema) porEstadoPobrezaExtrema.set(cveEnt, pobrezaExtrema);
      const carencia = extraerParGrupo(fila, GRUPOS_ESTATAL.carencia);
      if (carencia) porEstadoCarencia.set(cveEnt, carencia);
    }

    // Join por NOMBRE (Paso 4, ver nota de cabecera de CachePobreza) — el
    // nombre de municipio (fila[4]) es el propio de CONEVAL, "Concentrado
    // municipal", columnas confirmadas en vivo 2026-08-23:
    // [1]=cve_ent, [2]=nom_ent, [3]=cve_mun(5díg, solo para validar la
    // fila), [4]=nombre_municipio.
    const porMunicipioPobrezaPorNombre = new Map<string, ParPorcentajePersonas>();
    const porMunicipioPobrezaExtremaPorNombre = new Map<string, ParPorcentajePersonas>();
    const porMunicipioCarenciaPorNombre = new Map<string, ParPorcentajePersonas>();
    const poblacionPorMunicipioPorNombre = new Map<string, number>();
    const wsMunicipal = wb.Sheets["Concentrado municipal"];
    const filasMunicipal = XLSX.utils.sheet_to_json<unknown[]>(wsMunicipal, { header: 1, defval: null });
    for (const fila of filasMunicipal) {
      const cveMun = fila[3];
      const cveEnt = fila[1];
      const nombreMun = fila[4];
      if (typeof cveMun !== "string" || !/^\d{5}$/.test(cveMun)) continue;
      if (typeof cveEnt !== "string" || typeof nombreMun !== "string") continue;
      const clave = claveMunicipioPorNombre(cveEnt, nombreMun);
      const poblacion2020 = fila[7];
      if (typeof poblacion2020 === "number") poblacionPorMunicipioPorNombre.set(clave, poblacion2020);
      const pobreza = extraerParGrupo(fila, GRUPOS_MUNICIPAL.pobreza);
      if (pobreza) porMunicipioPobrezaPorNombre.set(clave, pobreza);
      const pobrezaExtrema = extraerParGrupo(fila, GRUPOS_MUNICIPAL.pobrezaExtrema);
      if (pobrezaExtrema) porMunicipioPobrezaExtremaPorNombre.set(clave, pobrezaExtrema);
      const carencia = extraerParGrupo(fila, GRUPOS_MUNICIPAL.carencia);
      if (carencia) porMunicipioCarenciaPorNombre.set(clave, carencia);
    }

    const resultado: CachePobreza = {
      porEstadoPobreza, porEstadoPobrezaExtrema, porEstadoCarencia,
      poblacionPorEstado,
      porMunicipioPobrezaPorNombre, porMunicipioPobrezaExtremaPorNombre, porMunicipioCarenciaPorNombre,
      poblacionPorMunicipioPorNombre,
      ts: Date.now(),
    };
    cachePobreza = resultado;
    return resultado;
  })();

  try {
    return await enVueloPobreza;
  } finally {
    enVueloPobreza = null;
  }
}

async function cargarRezagoSocial(): Promise<CacheRezagoSocial> {
  if (cacheRezagoSocial && Date.now() - cacheRezagoSocial.ts < CACHE_TTL_MS) return cacheRezagoSocial;
  if (enVueloRezagoSocial) return enVueloRezagoSocial;

  enVueloRezagoSocial = (async () => {
    const wb = await descargarZipYExtraerXlsx(URL_REZAGO_SOCIAL, /2020\.xlsx$/i);

    const porEstado = new Map<string, number>();
    const wsEstados = wb.Sheets["Estados"];
    const filasEstados = XLSX.utils.sheet_to_json<unknown[]>(wsEstados, { header: 1, defval: null });
    for (const fila of filasEstados) {
      const cveEnt = fila[0];
      if (typeof cveEnt !== "string" || !/^\d{2}$/.test(cveEnt)) continue;
      const indice = fila[14]; // "Índice de rezago social" — vacío (null) para CVE_ENT="00" (Nacional)
      if (typeof indice === "number") porEstado.set(cveEnt, indice);
    }

    // Join por NOMBRE (Paso 4) — hoja "Municipios" del IRS, columnas
    // confirmadas en vivo 2026-08-23: [0]=cve_ent, [1]=nom_ent,
    // [2]=cve_mun(5díg, solo para validar la fila), [3]=nombre_municipio.
    const porMunicipioPorNombre = new Map<string, number>();
    const wsMunicipios = wb.Sheets["Municipios"];
    const filasMunicipios = XLSX.utils.sheet_to_json<unknown[]>(wsMunicipios, { header: 1, defval: null });
    for (const fila of filasMunicipios) {
      const cveMun = fila[2];
      const cveEnt = fila[0];
      const nombreMun = fila[3];
      if (typeof cveMun !== "string" || !/^\d{5}$/.test(cveMun)) continue;
      if (typeof cveEnt !== "string" || typeof nombreMun !== "string") continue;
      const indice = fila[16]; // "Índice de rezago social"
      if (typeof indice === "number") porMunicipioPorNombre.set(claveMunicipioPorNombre(cveEnt, nombreMun), indice);
    }

    const resultado: CacheRezagoSocial = { porEstado, porMunicipioPorNombre, ts: Date.now() };
    cacheRezagoSocial = resultado;
    return resultado;
  })();

  try {
    return await enVueloRezagoSocial;
  } finally {
    enVueloRezagoSocial = null;
  }
}

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

// Reverso de ESTADO_CVE_MAP — mismo patrón ya usado en eceg.ts/conapoMarginacion.ts.
const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

// Nacional agregado — Σ Personas2020 / Σ Población2020 × 100 de los 32
// estados, mismo criterio que Familia 1 (nunca promedio de porcentajes
// estatales). El archivo ya está completo en memoria — sin llamada
// nueva.
function calcularNacionalPobreza(
  porEstado: Map<string, ParPorcentajePersonas>,
  poblacionPorEstado: Map<string, number>
): number | null {
  let personas = 0;
  let poblacion = 0;
  for (const [cve, par] of porEstado) {
    personas += par.personas;
    poblacion += poblacionPorEstado.get(cve) ?? 0;
  }
  if (poblacion === 0) return null;
  return (personas / poblacion) * 100;
}

async function resolverCeldasPobreza(
  territorio: Territorio,
  campo: "porEstadoPobreza" | "porEstadoPobrezaExtrema" | "porEstadoCarencia",
  campoMunicipal: "porMunicipioPobrezaPorNombre" | "porMunicipioPobrezaExtremaPorNombre" | "porMunicipioCarenciaPorNombre"
): Promise<CeldaFontana[]> {
  let datos: CachePobreza;
  try {
    datos = await cargarPobreza();
  } catch {
    const motivo = "Error de conexión con CONEVAL";
    return [{ nivel: "nacional", motivo }, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const nacionalValor = calcularNacionalPobreza(datos[campo], datos.poblacionPorEstado);
  const nacional: CeldaFontana = nacionalValor != null
    ? { nivel: "nacional", valor: Math.round(nacionalValor * 100) / 100, unidad: "%", naturaleza: "estimacion_agregada", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_POBREZA }
    : { nivel: "nacional", motivo: "CONEVAL no reportó datos suficientes para agregar el nacional" };

  if (!territorio.estado) {
    return [
      nacional,
      { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" },
      { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" },
    ];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const parEstado = datos[campo].get(estadoCve);
  const estatal: CeldaFontana = parEstado
    ? { nivel: "estatal", valor: Math.round(parEstado.porcentaje * 100) / 100, unidad: "%", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_POBREZA }
    : { nivel: "estatal", motivo: "CONEVAL no reportó este indicador para este territorio" };

  // FIX DE FONDO (Paso 4, 2026-08-23) — join municipal por NOMBRE, no
  // por CVE_MUN (ver nota de cabecera de CachePobreza). resolveMunicipioCve
  // ya no se usa como mecanismo de cruce contra este archivo.
  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const par = datos[campoMunicipal].get(claveMunicipioPorNombre(estadoCve, municipioNombre));
    municipal = par
      ? { nivel: "municipal", valor: Math.round(par.porcentaje * 100) / 100, unidad: "%", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_POBREZA }
      : { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo de CONEVAL` };
  }

  return [nacional, estatal, municipal];
}

export async function resolverPobreza(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverCeldasPobreza(territorio, "porEstadoPobreza", "porMunicipioPobrezaPorNombre");
}

export async function resolverPobrezaExtrema(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverCeldasPobreza(territorio, "porEstadoPobrezaExtrema", "porMunicipioPobrezaExtremaPorNombre");
}

export async function resolverCarenciaSocial(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverCeldasPobreza(territorio, "porEstadoCarencia", "porMunicipioCarenciaPorNombre");
}

// F2-3 — nacional NUNCA se calcula (ver nota de cabecera): la propia
// fuente deja esa celda en blanco en su archivo oficial.
export async function resolverRezagoSocial(territorio: Territorio): Promise<CeldaFontana[]> {
  let datos: CacheRezagoSocial;
  try {
    datos = await cargarRezagoSocial();
  } catch {
    const motivo = "Error de conexión con CONEVAL (Índice de Rezago Social)";
    return [{ nivel: "nacional", motivo }, { nivel: "estatal", motivo }, { nivel: "distrital", motivo }, { nivel: "municipal", motivo }];
  }

  const nacional: CeldaFontana = {
    nivel: "nacional",
    motivo: "CONEVAL no publica el Índice de Rezago Social a nivel nacional — es un índice compuesto sin metodología de agregación conocida (la propia fuente deja esta celda vacía en su archivo oficial)",
  };
  // "distrital" (Hallazgo B/C, revisión de consistencia 2ª ronda,
  // 2026-08-12) — mismo criterio que el nacional: sin celda propia,
  // completarA4Celdas rellenaba con el motivo genérico de "mecanismo no
  // disponible", perdiendo la razón metodológica específica (índice
  // compuesto sin fórmula de recombinación) ya explicada en nacional.
  const distrital: CeldaFontana = {
    nivel: "distrital",
    motivo: "CONEVAL no publica el Índice de Rezago Social a nivel distrital — es un índice compuesto sin metodología de agregación conocida",
  };

  if (!territorio.estado) {
    return [
      nacional,
      { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" },
      distrital,
      { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" },
    ];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, { nivel: "estatal", motivo }, distrital, { nivel: "municipal", motivo }];
  }

  const indiceEstado = datos.porEstado.get(estadoCve);
  const estatal: CeldaFontana = indiceEstado != null
    ? { nivel: "estatal", valor: indiceEstado, unidad: "índice", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_IRS }
    : { nivel: "estatal", motivo: "CONEVAL no reportó el Índice de Rezago Social para este territorio" };

  // FIX DE FONDO (Paso 4, 2026-08-23) — join municipal por NOMBRE (ver
  // nota de cabecera de CacheRezagoSocial). F2-3 usaba el mismo join
  // vulnerable que F2-1/F2-2/F2-14 — se encontró y mitigó junto con esos
  // en el Paso 1, y se corrige de fondo aquí en el mismo Paso 4.
  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const indiceMunicipio = datos.porMunicipioPorNombre.get(claveMunicipioPorNombre(estadoCve, municipioNombre));
    municipal = indiceMunicipio != null
      ? { nivel: "municipal", valor: indiceMunicipio, unidad: "índice", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_IRS }
      : { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo de CONEVAL` };
  }

  return [nacional, estatal, distrital, municipal];
}

// ==========================================
// SERIE TEMPORAL (T10, 2ª ola municipal 2026-09-03) — F2-3 Índice de
// Rezago Social. El ZIP IRS_ent_mun_2000_2020 trae 5 xlsx (uno por año
// 2000/2005/2010/2015/2020); resolverRezagoSocial() arriba lee solo 2020.
// Este resolver lee los 5. Caché propia — NO toca cacheRezagoSocial.
//
// Offsets del "Índice de rezago social" verificados EN VIVO 2026-09-03 en
// los 5 archivos del ZIP: hoja "Estados" col 14, hoja "Municipios" col 16
// — idénticos en 2000..2020 (encabezado literal "Índice de rezago social"
// en fila 4 de ambas hojas, valores municipales numéricos reales).
//
// Condición explícita de la ronda: si en algún año el encabezado de esa
// columna NO coincide con /índice de rezago social/, ese año NO
// desaparece de la serie — se emite con `valor:null` + `nota` (mismo
// principio de honestidad que el resto de Fontana: nunca una ausencia sin
// explicación).
// ==========================================
const PERIODOS_IRS = ["2000", "2005", "2010", "2015", "2020"];
const HEADER_ROW_IRS = 4;
const COL_INDICE_ESTADOS = 14;
const COL_INDICE_MUNICIPIOS = 16;
const RE_INDICE_RS = /indice de rezago social/;

interface CacheSerieRezagoSocial {
  porEstado: Map<string, Record<string, number>>; // cve 2 díg -> { periodo -> valor }
  porMunicipioPorNombre: Map<string, Record<string, number>>;
  aniosNoVerificados: string[]; // periodos cuyo encabezado no calzó / año ausente en el ZIP
  ts: number;
}
let cacheSerieRezagoSocial: CacheSerieRezagoSocial | null = null;
let enVueloSerieRezagoSocial: Promise<CacheSerieRezagoSocial> | null = null;

async function descargarZipYTodosLosXlsxIrs(): Promise<Map<string, XLSX.WorkBook>> {
  const res = await fetch(URL_REZAGO_SOCIAL);
  if (!res.ok) throw new Error(`CONEVAL HTTP ${res.status} en ${URL_REZAGO_SOCIAL}`);
  const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
  const out = new Map<string, XLSX.WorkBook>();
  for (const f of Object.values(zip.files)) {
    if (f.dir || !/\.xlsx$/i.test(f.name)) continue;
    const m = f.name.match(/(\d{4})\.xlsx$/i);
    if (!m) continue;
    out.set(m[1], XLSX.read(await f.async("nodebuffer"), { type: "buffer" }));
  }
  return out;
}

function normHeaderIrs(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

// Índice de columna real de "Índice de rezago social" en la hoja, o null
// si el encabezado no calza (→ año no verificable, punto con valor:null).
function columnaIndiceRS(ws: XLSX.WorkSheet, colEsperada: number): number | null {
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const header = (filas[HEADER_ROW_IRS] ?? []) as unknown[];
  if (RE_INDICE_RS.test(normHeaderIrs(header[colEsperada]))) return colEsperada;
  const alt = header.findIndex((c) => RE_INDICE_RS.test(normHeaderIrs(c)));
  return alt >= 0 ? alt : null;
}

function ponerPeriodoIrs(
  m: Map<string, Record<string, number>>,
  clave: string,
  periodo: string,
  valor: number
): void {
  const r = m.get(clave) ?? {};
  r[periodo] = valor;
  m.set(clave, r);
}

async function cargarSerieRezagoSocial(): Promise<CacheSerieRezagoSocial> {
  if (cacheSerieRezagoSocial && Date.now() - cacheSerieRezagoSocial.ts < CACHE_TTL_MS) {
    return cacheSerieRezagoSocial;
  }
  if (enVueloSerieRezagoSocial) return enVueloSerieRezagoSocial;

  enVueloSerieRezagoSocial = (async () => {
    const porAnio = await descargarZipYTodosLosXlsxIrs();
    const porEstado = new Map<string, Record<string, number>>();
    const porMunicipioPorNombre = new Map<string, Record<string, number>>();
    const aniosNoVerificados: string[] = [];

    for (const periodo of PERIODOS_IRS) {
      const wb = porAnio.get(periodo);
      if (!wb) {
        aniosNoVerificados.push(periodo);
        continue;
      }
      const wsEstados = wb.Sheets["Estados"];
      const wsMun = wb.Sheets["Municipios"];
      const colE = wsEstados ? columnaIndiceRS(wsEstados, COL_INDICE_ESTADOS) : null;
      const colM = wsMun ? columnaIndiceRS(wsMun, COL_INDICE_MUNICIPIOS) : null;
      if (colE == null || colM == null) aniosNoVerificados.push(periodo);

      if (wsEstados && colE != null) {
        const filas = XLSX.utils.sheet_to_json<unknown[]>(wsEstados, { header: 1, defval: null });
        for (const fila of filas) {
          const cveEnt = fila[0];
          if (typeof cveEnt !== "string" || !/^\d{2}$/.test(cveEnt) || cveEnt === "00") continue;
          const v = fila[colE];
          if (typeof v === "number") ponerPeriodoIrs(porEstado, cveEnt, periodo, v);
        }
      }
      if (wsMun && colM != null) {
        const filas = XLSX.utils.sheet_to_json<unknown[]>(wsMun, { header: 1, defval: null });
        for (const fila of filas) {
          const cveMun = fila[2];
          const cveEnt = fila[0];
          const nombreMun = fila[3];
          if (typeof cveMun !== "string" || !/^\d{5}$/.test(cveMun)) continue;
          if (typeof cveEnt !== "string" || typeof nombreMun !== "string") continue;
          const v = fila[colM];
          if (typeof v === "number") {
            ponerPeriodoIrs(porMunicipioPorNombre, claveMunicipioPorNombre(cveEnt, nombreMun), periodo, v);
          }
        }
      }
    }

    const resultado: CacheSerieRezagoSocial = {
      porEstado,
      porMunicipioPorNombre,
      aniosNoVerificados: [...new Set(aniosNoVerificados)].sort(),
      ts: Date.now(),
    };
    cacheSerieRezagoSocial = resultado;
    return resultado;
  })();

  try {
    return await enVueloSerieRezagoSocial;
  } finally {
    enVueloSerieRezagoSocial = null;
  }
}

// F2-3 — nacional/distrital NUNCA (índice compuesto sin agregación; la
// propia fuente deja la celda país vacía). Sirve estatal + municipal.
export async function resolverSerieConeval(
  indicadorId: string,
  territorio: Territorio
): Promise<ResultadoSerie> {
  if (indicadorId !== "F2-3") return { ok: false, motivo: "sin_serie" };

  let datos: CacheSerieRezagoSocial;
  try {
    datos = await cargarSerieRezagoSocial();
  } catch {
    return { ok: false, motivo: "Error de conexión con CONEVAL (Índice de Rezago Social)" };
  }

  const nivel = nivelObjetivoSerie(territorio, ["estatal", "municipal"]);
  if (!nivel) {
    return {
      ok: false,
      motivo:
        "El Índice de Rezago Social solo existe a nivel estatal y municipal — CONEVAL no lo publica a nivel nacional ni distrital",
    };
  }

  let porAno: Record<string, number> | undefined;
  let territorioLabel: string;

  if (nivel === "estatal") {
    if (!territorio.estado) {
      return { ok: false, motivo: "El proyecto no tiene un estado definido en su territorio" };
    }
    const cve = resolveEstadoCve(territorio.estado);
    if (!cve) {
      return { ok: false, motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` };
    }
    porAno = datos.porEstado.get(cve);
    territorioLabel = territorio.estado;
  } else {
    const nombreMun = resolverNombreMunicipio(territorio);
    if (!territorio.estado || !nombreMun) {
      return { ok: false, motivo: "El proyecto no tiene un municipio definido en su territorio" };
    }
    const cve = resolveEstadoCve(territorio.estado);
    if (!cve) {
      return { ok: false, motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` };
    }
    porAno = datos.porMunicipioPorNombre.get(claveMunicipioPorNombre(cve, nombreMun));
    territorioLabel = `${nombreMun}, ${territorio.estado}`;
  }

  if (!porAno || Object.keys(porAno).length === 0) {
    return {
      ok: false,
      motivo: "CONEVAL no reportó una serie del Índice de Rezago Social para este territorio",
    };
  }

  // Serie sobre los 5 cortes canónicos. Un año sin dato verificable NO se
  // omite — se emite con valor:null + nota (condición de la ronda).
  const puntosPorAno = porAno;
  const puntos = PERIODOS_IRS.map((periodo) => {
    const v = puntosPorAno[periodo];
    if (typeof v === "number") return { periodo, valor: v };
    if (datos.aniosNoVerificados.includes(periodo)) {
      return {
        periodo,
        valor: null,
        nota: "No se pudo verificar la estructura de este año en el archivo fuente.",
      };
    }
    return { periodo, valor: null };
  });

  return {
    ok: true,
    nivel,
    territorioLabel,
    unidad: "índice",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_IRS,
    formato: "coeficiente", // rezago social: escala ~ -2..+4, hasta 4 decimales
    puntos,
  };
}

// ==========================================================================
// SERIE MUNICIPAL de F2-1 / F2-2 / F2-14 (2ª ola municipal, 2026-09-06)
// --------------------------------------------------------------------------
// Los 3 indicadores ya tienen serie nacional/estatal vía resolverSerieInegiPm
// (API INEGI-PM BISE). El corte MUNICIPAL viene de otra fuente: los CSV de
// Datos Abiertos de CONEVAL, carpeta oficial "pobreza_municipal_2010-2020",
// un archivo por año (2010, 2015, 2020). Verificado en vivo 2026-09-06:
//   - Los 3 CSV descargan (HTTP 200, ~560-580 KB, latin-1).
//   - Los nombres de columna `pobreza` / `pobreza_e` / `carencias` son
//     IDÉNTICOS en los 3 años → se lee POR NOMBRE de columna, nunca por
//     offset posicional (a diferencia del xlsx del cell). Solo las últimas
//     4 columnas cambian (`plb*`→`plp*`, línea de ingresos, no se usa).
//   - El PDF metodológico oficial ("5. Comparabilidad") declara "serie
//     quinquenal comparable 2010-2020": CONEVAL re-estimó 2010 al ajustar
//     el método en 2015. La ruptura MCS→Modelo Estadístico 2015 (nivel
//     nacional) NO fragmenta esta serie municipal.
// Es una SERIE CERRADA: 2020 es la última edición y no habrá más (Encuesta
// Intercensal 2025 cancelada; la medición pasó a INEGI, que solo publica
// nacional/estatal). Eso se comunica con la `nota` a nivel de serie
// (ResultadoSerieOk.nota) → visible siempre en la tarjeta de Canvas.
// Formato del CSV: campos con coma van entre comillas ("922,268"); los
// porcentajes van planos (23.7). Requiere un splitter quote-aware (ninguno
// de los adaptadores existentes maneja comas dentro de comillas).
// ==========================================================================

const URL_POBREZA_MUN_BASE =
  "https://www.coneval.org.mx/Informes/Pobreza/Datos_abiertos/pobreza_municipal_2010-2020/indicadores%20de%20pobreza%20municipal_";
export const FUENTE_ETIQUETA_CONEVAL_POBREZA_MUN =
  "CONEVAL (Medición de la pobreza municipal 2010-2020)";
const NOTA_SERIE_POBREZA_MUN_CERRADA =
  "CONEVAL cerró la serie municipal de pobreza en 2020 (ediciones 2010, 2015 y 2020) — no habrá cortes municipales posteriores: la medición de pobreza pasó a INEGI, que solo la publica a nivel nacional y estatal.";
const PERIODOS_POBREZA_MUN = ["2010", "2015", "2020"];
const CAMPO_CSV_POR_INDICADOR: Record<string, "pobreza" | "pobreza_e" | "carencias"> = {
  "F2-1": "pobreza", // Pobreza multidimensional
  "F2-2": "pobreza_e", // Pobreza extrema
  "F2-14": "carencias", // % con al menos una carencia social
};

// Splitter CSV mínimo RFC-4180: respeta "..." y "" escapado. Sin newlines
// embebidos (estos archivos no los tienen dentro de campo).
function parseCsvLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (enComillas) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        actual += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ",") {
      campos.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos;
}

interface CacheSeriePobrezaMun {
  // campo CSV ("pobreza"|"pobreza_e"|"carencias") -> Map<claveMun, { periodo -> valor }>
  porCampo: Record<string, Map<string, Record<string, number>>>;
  // `${campo}@${periodo}` cuya columna no se localizó en el CSV de ese año
  // → ese punto sale con valor:null + nota (nunca se omite un año).
  columnaNoLocalizada: Set<string>;
  ts: number;
}
let cacheSeriePobrezaMun: CacheSeriePobrezaMun | null = null;
let enVueloSeriePobrezaMun: Promise<CacheSeriePobrezaMun> | null = null;

const CAMPOS_POBREZA_MUN: Array<"pobreza" | "pobreza_e" | "carencias"> = ["pobreza", "pobreza_e", "carencias"];

async function descargarCsvPobrezaMunicipal(anio: string): Promise<string> {
  const url = `${URL_POBREZA_MUN_BASE}${anio}.csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CONEVAL HTTP ${res.status} en ${url}`);
  // latin-1 (no UTF-8) — mismo caso que sic.ts/denue.ts/rsf.ts.
  return new TextDecoder("iso-8859-1").decode(await res.arrayBuffer()).replace(/^﻿/, "");
}

// Parser puro de UN CSV anual (por nombre de columna, nunca offset). Exportado
// solo para la verificación (permite forzar el caso "columna ausente" con un
// CSV doctoreado). `porCampo` mapea campo → Map<claveMun, valor>; `columnasFaltantes`
// lista los campos cuyo encabezado no apareció (→ punto null + nota).
export function parsearCsvPobrezaMunicipalAnio(texto: string): {
  porCampo: Record<string, Map<string, number>>;
  columnasFaltantes: string[];
} {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLinea(lineas[0] ?? "").map((h) => h.trim());
  const idxEnt = header.indexOf("clave_entidad");
  const idxMun = header.indexOf("municipio");
  const idxPorCampo: Record<string, number> = {};
  const columnasFaltantes: string[] = [];
  for (const campo of CAMPOS_POBREZA_MUN) {
    const i = header.indexOf(campo);
    idxPorCampo[campo] = i;
    if (i < 0) columnasFaltantes.push(campo);
  }
  const porCampo: Record<string, Map<string, number>> = {
    pobreza: new Map(),
    pobreza_e: new Map(),
    carencias: new Map(),
  };
  if (idxEnt < 0 || idxMun < 0) {
    // sin claves de municipio no se puede keyear este año — los 3 campos
    // quedan no localizados (punto null + nota para los 3 indicadores).
    return { porCampo, columnasFaltantes: [...CAMPOS_POBREZA_MUN] };
  }
  for (let i = 1; i < lineas.length; i++) {
    const fila = parseCsvLinea(lineas[i]);
    const cveEntRaw = fila[idxEnt]?.trim();
    const nombreMun = fila[idxMun]?.trim();
    if (!cveEntRaw || !nombreMun) continue;
    // el CSV trae la CVE de estado sin cero a la izquierda ("1".."32");
    // ESTADO_CVE_MAP / resolveEstadoCve usan 2 dígitos ("01".."32").
    const cveEnt = cveEntRaw.padStart(2, "0");
    const clave = claveMunicipioPorNombre(cveEnt, nombreMun);
    for (const campo of CAMPOS_POBREZA_MUN) {
      const idx = idxPorCampo[campo];
      if (idx < 0) continue;
      const v = Number(fila[idx]?.trim());
      if (Number.isFinite(v)) porCampo[campo].set(clave, v);
    }
  }
  return { porCampo, columnasFaltantes };
}

async function cargarSeriePobrezaMunicipal(): Promise<CacheSeriePobrezaMun> {
  if (cacheSeriePobrezaMun && Date.now() - cacheSeriePobrezaMun.ts < CACHE_TTL_MS) {
    return cacheSeriePobrezaMun;
  }
  if (enVueloSeriePobrezaMun) return enVueloSeriePobrezaMun;

  enVueloSeriePobrezaMun = (async () => {
    const porCampo: Record<string, Map<string, Record<string, number>>> = {
      pobreza: new Map(),
      pobreza_e: new Map(),
      carencias: new Map(),
    };
    const columnaNoLocalizada = new Set<string>();

    for (const periodo of PERIODOS_POBREZA_MUN) {
      const texto = await descargarCsvPobrezaMunicipal(periodo);
      const { porCampo: delAnio, columnasFaltantes } = parsearCsvPobrezaMunicipalAnio(texto);
      for (const campo of columnasFaltantes) columnaNoLocalizada.add(`${campo}@${periodo}`);
      for (const campo of CAMPOS_POBREZA_MUN) {
        for (const [clave, valor] of delAnio[campo]) {
          const r = porCampo[campo].get(clave) ?? {};
          r[periodo] = valor;
          porCampo[campo].set(clave, r);
        }
      }
    }

    const resultado: CacheSeriePobrezaMun = { porCampo, columnaNoLocalizada, ts: Date.now() };
    cacheSeriePobrezaMun = resultado;
    return resultado;
  })();

  try {
    return await enVueloSeriePobrezaMun;
  } finally {
    enVueloSeriePobrezaMun = null;
  }
}

// F2-1 / F2-2 / F2-14 a nivel MUNICIPAL — serie cerrada de 3 puntos
// (2010, 2015, 2020). El dispatcher (serieTemporal.ts) enruta aquí solo
// cuando nivelObjetivoSerie da "municipal"; nac/est sigue en
// resolverSerieInegiPm sin cambio.
export async function resolverSerieConevalPobrezaMunicipal(
  indicadorId: string,
  territorio: Territorio
): Promise<ResultadoSerie> {
  const campoCsv = CAMPO_CSV_POR_INDICADOR[indicadorId];
  if (!campoCsv) return { ok: false, motivo: "sin_serie" };

  const nivel = nivelObjetivoSerie(territorio, ["municipal"]);
  if (nivel !== "municipal") {
    return {
      ok: false,
      motivo: "La serie municipal de pobreza de CONEVAL solo aplica a proyectos con municipio o distrito definido",
    };
  }
  const nombreMun = resolverNombreMunicipio(territorio);
  if (!territorio.estado || !nombreMun) {
    return { ok: false, motivo: "El proyecto no tiene un municipio definido en su territorio" };
  }
  const cve = resolveEstadoCve(territorio.estado);
  if (!cve) {
    return { ok: false, motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` };
  }

  let datos: CacheSeriePobrezaMun;
  try {
    datos = await cargarSeriePobrezaMunicipal();
  } catch {
    return { ok: false, motivo: "No se pudo descargar el archivo histórico de pobreza municipal de CONEVAL" };
  }

  const clave = claveMunicipioPorNombre(cve, nombreMun);
  const porAno = datos.porCampo[campoCsv].get(clave);
  const territorioLabel = `${nombreMun}, ${territorio.estado}`;

  const puntos = PERIODOS_POBREZA_MUN.map((periodo) => {
    const v = porAno?.[periodo];
    if (typeof v === "number") return { periodo, valor: Math.round(v * 100) / 100 };
    if (datos.columnaNoLocalizada.has(`${campoCsv}@${periodo}`)) {
      return {
        periodo,
        valor: null,
        nota: `No se pudo localizar la columna «${campoCsv}» en el archivo de CONEVAL de ${periodo}.`,
      };
    }
    return { periodo, valor: null };
  });

  const conDato = puntos.filter((p) => p.valor != null).length;
  if (conDato === 0) {
    return {
      ok: false,
      motivo: `CONEVAL no tiene medición de pobreza municipal para «${territorioLabel}» en la serie 2010-2020`,
    };
  }
  if (conDato < 2) {
    return {
      ok: false,
      motivo: `«${territorioLabel}» tiene un solo punto en la serie municipal de pobreza de CONEVAL (2010-2020) — se creó como municipio después de las ediciones 2010/2015, así que no hay serie histórica`,
    };
  }

  return {
    ok: true,
    nivel: "municipal",
    territorioLabel,
    unidad: "%",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_POBREZA_MUN,
    formato: "porcentaje",
    nota: NOTA_SERIE_POBREZA_MUN_CERRADA,
    puntos,
  };
}

// Desglose "Ver municipios" en proyectos nivel "estatal" — mismo patrón
// que resolverMunicipiosEstadoMarginacion (conapoMarginacion.ts): ambos
// archivos ya están completos en memoria, filtrar por estado es solo
// iterar el Map. Nunca aplica a distritos_fed/distritos_loc — CONEVAL
// no publica por distrito electoral.
async function resolverMunicipiosEstadoPobrezaGenerico(
  estadoCve: string,
  campoMunicipal: "porMunicipioPobrezaPorNombre" | "porMunicipioPobrezaExtremaPorNombre" | "porMunicipioCarenciaPorNombre",
  soloCves?: string[]
): Promise<ElementoDeEstado[]> {
  const [datos, opciones] = await Promise.all([cargarPobreza(), getMunicipiosOptions(estadoCve)]);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  // FIX DE FONDO (Paso 4, 2026-08-23) — `cve` viene de getMunicipiosOptions()
  // (catálogo INE de Sefix), solo se usa para identificar la fila en el
  // picker; el valor se resuelve por `nombre` contra el archivo propio
  // de CONEVAL, mismo patrón que resolverMunicipiosEstadoIcmm (icmm.ts).
  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => {
    const par = datos[campoMunicipal].get(claveMunicipioPorNombre(estadoCve, nombre));
    return {
      cve,
      nombre,
      celda: par
        ? { nivel: "municipal", valor: Math.round(par.porcentaje * 100) / 100, unidad: "%", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_POBREZA }
        : { nivel: "municipal", motivo: "CONEVAL no reportó este indicador para este municipio" },
    };
  });
}

export async function resolverMunicipiosEstadoPobreza(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPobrezaGenerico(estadoCve, "porMunicipioPobrezaPorNombre", soloCves);
}

export async function resolverMunicipiosEstadoPobrezaExtrema(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPobrezaGenerico(estadoCve, "porMunicipioPobrezaExtremaPorNombre", soloCves);
}

export async function resolverMunicipiosEstadoCarenciaSocial(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPobrezaGenerico(estadoCve, "porMunicipioCarenciaPorNombre", soloCves);
}

export async function resolverMunicipiosEstadoRezagoSocial(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const [datos, opciones] = await Promise.all([cargarRezagoSocial(), getMunicipiosOptions(estadoCve)]);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  // FIX DE FONDO (Paso 4, 2026-08-23) — mismo patrón por nombre.
  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => {
    const indice = datos.porMunicipioPorNombre.get(claveMunicipioPorNombre(estadoCve, nombre));
    return {
      cve,
      nombre,
      celda: indice != null
        ? { nivel: "municipal", valor: indice, unidad: "índice", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_IRS }
        : { nivel: "municipal", motivo: "CONEVAL no reportó el Índice de Rezago Social para este municipio" },
    };
  });
}

// Desglose "Ver estados" en proyectos nivel "nacional" (Encargo de
// generalización, 2026-08-09). Ambos loaders ya traen los 32 estados
// completos en memoria — sin llamada nueva, mismo costo que "Ver
// municipios".
async function resolverEstadosPobrezaGenerico(
  campo: "porEstadoPobreza" | "porEstadoPobrezaExtrema" | "porEstadoCarencia"
): Promise<ElementoDeEstado[]> {
  const datos = await cargarPobreza();
  return Array.from(datos[campo].entries()).map(([cve, par]): ElementoDeEstado => ({
    cve,
    nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
    celda: { nivel: "estatal", valor: Math.round(par.porcentaje * 100) / 100, unidad: "%", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_POBREZA },
  }));
}

export async function resolverEstadosPobreza(): Promise<ElementoDeEstado[]> {
  return resolverEstadosPobrezaGenerico("porEstadoPobreza");
}

export async function resolverEstadosPobrezaExtrema(): Promise<ElementoDeEstado[]> {
  return resolverEstadosPobrezaGenerico("porEstadoPobrezaExtrema");
}

export async function resolverEstadosCarenciaSocial(): Promise<ElementoDeEstado[]> {
  return resolverEstadosPobrezaGenerico("porEstadoCarencia");
}

export async function resolverEstadosRezagoSocial(): Promise<ElementoDeEstado[]> {
  const datos = await cargarRezagoSocial();
  return Array.from(datos.porEstado.entries()).map(([cve, indice]): ElementoDeEstado => ({
    cve,
    nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
    celda: { nivel: "estatal", valor: indice, unidad: "índice", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_IRS },
  }));
}

// Numerador (Personas) + denominador (Población 2020 CONEVAL) crudos
// por municipio — usado exclusivamente por
// lib/fontana/ingesta/index.ts (calcularValorDistritoPonderado) para
// reconstruir el % real de un distrito Federal/Local a escala Nacional
// desde sus municipios componentes, NUNCA promediando el % ya
// calculado (mismo criterio que Nacional, aprobado 2026-08-09).
// Denominador exclusivamente de CONEVAL — nunca se mezcla con
// población de ECEG/ITER.
//
// FIX DE FONDO (Paso 4, 2026-08-23) — `cves` llega desde la composición
// municipio↔distrito de ECEG (numeración INE, ver Paso 2 del incidente),
// NO del CVE_MUN oficial de CONEVAL — el mismo bug de join por CVE que
// afectaba a resolverCeldasPobreza también afectaba aquí (encontrado en
// esta misma ronda, no estaba en la lista original). Se resuelve
// traduciendo cada cve INE a su nombre (getMunicipiosOptions, catálogo
// de Sefix — mismo lado "nombre" que usa el resto de este archivo) y
// cruzando por nombre contra los datos propios de CONEVAL; el resultado
// se sigue devolviendo keyed por el cve INE original porque el caller
// (calcularValorDistritoPonderado) pondera con esa misma numeración.
export async function resolverNumeradorDenominadorMunicipios(
  estadoCve: string,
  campoMunicipal: "porMunicipioPobrezaPorNombre" | "porMunicipioPobrezaExtremaPorNombre" | "porMunicipioCarenciaPorNombre",
  cves: string[]
): Promise<Map<string, { personas: number; poblacion: number }>> {
  const [datos, opciones] = await Promise.all([cargarPobreza(), getMunicipiosOptions(estadoCve)]);
  const nombrePorCve = new Map(opciones.map((o) => [o.cve, o.nombre]));
  const resultado = new Map<string, { personas: number; poblacion: number }>();
  for (const cve of cves) {
    const nombre = nombrePorCve.get(cve);
    if (!nombre) continue;
    const clave = claveMunicipioPorNombre(estadoCve, nombre);
    const par = datos[campoMunicipal].get(clave);
    const poblacion = datos.poblacionPorMunicipioPorNombre.get(clave);
    if (par && poblacion != null) resultado.set(cve, { personas: par.personas, poblacion });
  }
  return resultado;
}
