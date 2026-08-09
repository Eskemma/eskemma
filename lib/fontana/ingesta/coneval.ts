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
import { resolveMunicipioCve, normalizeGeoName, getMunicipiosOptions } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

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
  porMunicipioPobreza: Map<string, ParPorcentajePersonas>;
  porEstadoPobrezaExtrema: Map<string, ParPorcentajePersonas>;
  porMunicipioPobrezaExtrema: Map<string, ParPorcentajePersonas>;
  porEstadoCarencia: Map<string, ParPorcentajePersonas>;
  porMunicipioCarencia: Map<string, ParPorcentajePersonas>;
  poblacionPorEstado: Map<string, number>; // Población 2020 (CONEVAL, MCS-ENIGH) — solo para agregar Nacional
  // Población 2020 por municipio (CONEVAL, MCS-ENIGH) — agregada
  // 2026-08-09 para reconstruir numerador/denominador real al calcular
  // Distrital Federal/Local a escala Nacional (nunca promediar el %
  // ya calculado entre municipios, mismo criterio que Nacional).
  poblacionPorMunicipio: Map<string, number>;
  ts: number;
}

interface CacheRezagoSocial {
  porEstado: Map<string, number>;
  porMunicipio: Map<string, number>;
  ts: number;
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

    const porMunicipioPobreza = new Map<string, ParPorcentajePersonas>();
    const porMunicipioPobrezaExtrema = new Map<string, ParPorcentajePersonas>();
    const porMunicipioCarencia = new Map<string, ParPorcentajePersonas>();
    const poblacionPorMunicipio = new Map<string, number>();
    const wsMunicipal = wb.Sheets["Concentrado municipal"];
    const filasMunicipal = XLSX.utils.sheet_to_json<unknown[]>(wsMunicipal, { header: 1, defval: null });
    for (const fila of filasMunicipal) {
      const cveMun = fila[3];
      if (typeof cveMun !== "string" || !/^\d{5}$/.test(cveMun)) continue;
      const poblacion2020 = fila[7];
      if (typeof poblacion2020 === "number") poblacionPorMunicipio.set(cveMun, poblacion2020);
      const pobreza = extraerParGrupo(fila, GRUPOS_MUNICIPAL.pobreza);
      if (pobreza) porMunicipioPobreza.set(cveMun, pobreza);
      const pobrezaExtrema = extraerParGrupo(fila, GRUPOS_MUNICIPAL.pobrezaExtrema);
      if (pobrezaExtrema) porMunicipioPobrezaExtrema.set(cveMun, pobrezaExtrema);
      const carencia = extraerParGrupo(fila, GRUPOS_MUNICIPAL.carencia);
      if (carencia) porMunicipioCarencia.set(cveMun, carencia);
    }

    const resultado: CachePobreza = {
      porEstadoPobreza, porMunicipioPobreza,
      porEstadoPobrezaExtrema, porMunicipioPobrezaExtrema,
      porEstadoCarencia, porMunicipioCarencia,
      poblacionPorEstado, poblacionPorMunicipio,
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

    const porMunicipio = new Map<string, number>();
    const wsMunicipios = wb.Sheets["Municipios"];
    const filasMunicipios = XLSX.utils.sheet_to_json<unknown[]>(wsMunicipios, { header: 1, defval: null });
    for (const fila of filasMunicipios) {
      const cveMun = fila[2];
      if (typeof cveMun !== "string" || !/^\d{5}$/.test(cveMun)) continue;
      const indice = fila[16]; // "Índice de rezago social"
      if (typeof indice === "number") porMunicipio.set(cveMun, indice);
    }

    const resultado: CacheRezagoSocial = { porEstado, porMunicipio, ts: Date.now() };
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
  campoMunicipal: "porMunicipioPobreza" | "porMunicipioPobrezaExtrema" | "porMunicipioCarencia"
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
    const motivo = "El proyecto no tiene un estado definido en su territorio";
    return [nacional, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
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

  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const municipioCve = await resolveMunicipioCve(estadoCve, municipioNombre);
    if (!municipioCve) {
      municipal = { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo INEGI` };
    } else {
      const parMunicipio = datos[campoMunicipal].get(`${estadoCve}${municipioCve}`);
      municipal = parMunicipio
        ? { nivel: "municipal", valor: Math.round(parMunicipio.porcentaje * 100) / 100, unidad: "%", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_POBREZA }
        : { nivel: "municipal", motivo: "CONEVAL no reportó este indicador para este territorio" };
    }
  }

  return [nacional, estatal, municipal];
}

export async function resolverPobreza(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverCeldasPobreza(territorio, "porEstadoPobreza", "porMunicipioPobreza");
}

export async function resolverPobrezaExtrema(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverCeldasPobreza(territorio, "porEstadoPobrezaExtrema", "porMunicipioPobrezaExtrema");
}

export async function resolverCarenciaSocial(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverCeldasPobreza(territorio, "porEstadoCarencia", "porMunicipioCarencia");
}

// F2-3 — nacional NUNCA se calcula (ver nota de cabecera): la propia
// fuente deja esa celda en blanco en su archivo oficial.
export async function resolverRezagoSocial(territorio: Territorio): Promise<CeldaFontana[]> {
  let datos: CacheRezagoSocial;
  try {
    datos = await cargarRezagoSocial();
  } catch {
    const motivo = "Error de conexión con CONEVAL (Índice de Rezago Social)";
    return [{ nivel: "nacional", motivo }, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const nacional: CeldaFontana = {
    nivel: "nacional",
    motivo: "CONEVAL no publica el Índice de Rezago Social a nivel nacional — es un índice compuesto sin metodología de agregación conocida (la propia fuente deja esta celda vacía en su archivo oficial)",
  };

  if (!territorio.estado) {
    const motivo = "El proyecto no tiene un estado definido en su territorio";
    return [nacional, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const indiceEstado = datos.porEstado.get(estadoCve);
  const estatal: CeldaFontana = indiceEstado != null
    ? { nivel: "estatal", valor: indiceEstado, unidad: "índice", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_IRS }
    : { nivel: "estatal", motivo: "CONEVAL no reportó el Índice de Rezago Social para este territorio" };

  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const municipioCve = await resolveMunicipioCve(estadoCve, municipioNombre);
    if (!municipioCve) {
      municipal = { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo INEGI` };
    } else {
      const indiceMun = datos.porMunicipio.get(`${estadoCve}${municipioCve}`);
      municipal = indiceMun != null
        ? { nivel: "municipal", valor: indiceMun, unidad: "índice", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONEVAL_IRS }
        : { nivel: "municipal", motivo: "CONEVAL no reportó el Índice de Rezago Social para este territorio" };
    }
  }

  return [nacional, estatal, municipal];
}

// Desglose "Ver municipios" en proyectos nivel "estatal" — mismo patrón
// que resolverMunicipiosEstadoMarginacion (conapoMarginacion.ts): ambos
// archivos ya están completos en memoria, filtrar por estado es solo
// iterar el Map. Nunca aplica a distritos_fed/distritos_loc — CONEVAL
// no publica por distrito electoral.
async function resolverMunicipiosEstadoPobrezaGenerico(
  estadoCve: string,
  campoMunicipal: "porMunicipioPobreza" | "porMunicipioPobrezaExtrema" | "porMunicipioCarencia",
  soloCves?: string[]
): Promise<ElementoDeEstado[]> {
  const [datos, opciones] = await Promise.all([cargarPobreza(), getMunicipiosOptions(estadoCve)]);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => {
    const par = datos[campoMunicipal].get(`${estadoCve}${cve}`);
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
  return resolverMunicipiosEstadoPobrezaGenerico(estadoCve, "porMunicipioPobreza", soloCves);
}

export async function resolverMunicipiosEstadoPobrezaExtrema(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPobrezaGenerico(estadoCve, "porMunicipioPobrezaExtrema", soloCves);
}

export async function resolverMunicipiosEstadoCarenciaSocial(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPobrezaGenerico(estadoCve, "porMunicipioCarencia", soloCves);
}

export async function resolverMunicipiosEstadoRezagoSocial(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const [datos, opciones] = await Promise.all([cargarRezagoSocial(), getMunicipiosOptions(estadoCve)]);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => {
    const indice = datos.porMunicipio.get(`${estadoCve}${cve}`);
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
export async function resolverNumeradorDenominadorMunicipios(
  estadoCve: string,
  campoMunicipal: "porMunicipioPobreza" | "porMunicipioPobrezaExtrema" | "porMunicipioCarencia",
  cves: string[]
): Promise<Map<string, { personas: number; poblacion: number }>> {
  const datos = await cargarPobreza();
  const resultado = new Map<string, { personas: number; poblacion: number }>();
  for (const cve of cves) {
    const clave = `${estadoCve}${cve}`;
    const par = datos[campoMunicipal].get(clave);
    const poblacion = datos.poblacionPorMunicipio.get(clave);
    if (par && poblacion != null) resultado.set(cve, { personas: par.personas, poblacion });
  }
  return resultado;
}
