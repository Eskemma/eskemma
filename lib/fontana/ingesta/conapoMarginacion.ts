// lib/fontana/ingesta/conapoMarginacion.ts
// Adaptador de F2-4 (Índice de Marginación) — CONAPO, descarga directa
// de los 2 archivos .xls oficiales (Entidad Federativa + Municipio),
// verificados EN VIVO 2026-08-07:
//
//   ENTIDAD = https://conapo.segob.gob.mx/work/models/CONAPO/Datos_Abiertos/Entidad_Federativa/IME_2020.xls
//     HTTP 200, application/vnd.ms-excel, 60,416 bytes.
//   MUNICIPIO = https://conapo.segob.gob.mx/work/models/CONAPO/Datos_Abiertos/Municipio/IMM_2020.xls
//     HTTP 200, application/vnd.ms-excel, 1,640,448 bytes — verificado
//     parseando el archivo real: hoja "IMM_2020", 2,469 filas de datos,
//     columna CVE_MUN combinada (CVE_ENT+CVE_MUN, 5 dígitos, ej. "14120"
//     = Zapopan — confirmado que coincide con la numeración geo/INE
//     estándar, POB_TOT=1,476,491 coincide exacto con el dato ya usado
//     en Fontana para Zapopan vía ITER — NO usa la numeración propia de
//     ITER que causó un bug real documentado en otros adaptadores).
//
// Usa la columna IMN_2020 (normalizada 0-1), no IM_2020 (índice
// original en unidades arbitrarias) — decisión ya fijada en el Paso 2
// del catálogo de Fontana.
//
// Mecanismo distinto al resto de Fontana (bajo demanda por territorio,
// como conapo.ts/compendio.ts): aquí ambos archivos son pequeños y
// completos (60KB/1.6MB), se descargan y parsean UNA vez por proceso y
// se cachean en memoria — no hace falta bodega bajo demanda ni Storage,
// mismo criterio ya aplicado a lib/geo/{municipios,distritos}.ts para
// archivos nacionales completos.

import https from "https";
import * as XLSX from "xlsx";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, getMunicipiosOptions, claveCanonicaMunicipio } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_CONAPO_MARGINACION = "CONAPO (Índice de Marginación 2020)";

const URL_ENTIDAD = "https://conapo.segob.gob.mx/work/models/CONAPO/Datos_Abiertos/Entidad_Federativa/IME_2020.xls";
const URL_MUNICIPIO = "https://conapo.segob.gob.mx/work/models/CONAPO/Datos_Abiertos/Municipio/IMM_2020.xls";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 día — el archivo es estático (congelado, sin edición posterior confirmada)

// Mismo host/certificado que datos.gob.mx (cadena TLS incompleta) — ver
// nota extensa en lib/fontana/ingesta/conapo.ts, mismo workaround
// acotado, mismo criterio (GET público sin credenciales).
function descargarBinario(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false, timeout: 20000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`CONAPO HTTP ${res.statusCode} en ${url}`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("CONAPO timeout")));
  });
}

interface CacheMarginacion {
  porEstado: Map<string, number>; // estadoCve (2 díg.) -> IMN_2020
  // FIX DE FONDO (Paso 4, 2026-08-23) — join municipal por NOMBRE, no
  // por CVE_MUN, mismo patrón ya aprobado y en producción en icmm.ts.
  // resolveMunicipioCve() (numeración INE de lib/geo/municipios.ts)
  // diverge del CVE_MUN oficial de CONAPO en ~55-63% de los municipios
  // (incidente 2026-08-23) — cruzar por CVE producía el valor de OTRO
  // municipio sin ningún error visible. Clave: `${estadoCve}|${normalizeGeoName(nombreConapoPropio)}`.
  porMunicipioPorNombre: Map<string, number>;
  ts: number;
}

// FIX DE FONDO (Incidente 2, 2026-08-23) — ver nota en coneval.ts /
// lib/geo/municipios.ts.
function claveMunicipioPorNombre(estadoCve: string, nombre: string): string {
  return `${estadoCve}|${claveCanonicaMunicipio(estadoCve, nombre)}`;
}
let cache: CacheMarginacion | null = null;
let enVuelo: Promise<CacheMarginacion> | null = null; // single-flight, mismo fix ya aplicado en lib/geo (Fase 1, Nacional)

async function cargarMarginacion(): Promise<CacheMarginacion> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const [bufEntidad, bufMunicipio] = await Promise.all([
      descargarBinario(URL_ENTIDAD),
      descargarBinario(URL_MUNICIPIO),
    ]);

    const porEstado = new Map<string, number>();
    const wbEntidad = XLSX.read(bufEntidad, { type: "buffer" });
    const wsEntidad = wbEntidad.Sheets["IME_2020"] ?? wbEntidad.Sheets[wbEntidad.SheetNames[1]];
    const filasEntidad = XLSX.utils.sheet_to_json<unknown[]>(wsEntidad, { header: 1, defval: null });
    for (const fila of filasEntidad) {
      const cveEnt = fila[0];
      const imn = fila[fila.length - 1];
      if (typeof cveEnt === "string" && /^\d{2}$/.test(cveEnt) && typeof imn === "number") {
        porEstado.set(cveEnt, imn);
      }
    }

    // Join por NOMBRE (Paso 4) — columnas confirmadas en vivo 2026-08-23:
    // [0]=CVE_ENT, [1]=NOM_ENT, [2]=CVE_MUN(5díg, solo para validar la
    // fila), [3]=NOM_MUN.
    const porMunicipioPorNombre = new Map<string, number>();
    const wsMunicipio = wbMunicipioSheet(bufMunicipio);
    const filasMunicipio = XLSX.utils.sheet_to_json<unknown[]>(wsMunicipio, { header: 1, defval: null });
    for (const fila of filasMunicipio) {
      const cveMun5 = fila[2]; // "CVE_MUN" combinado, ej. "14120" — solo valida la fila
      const cveEnt = fila[0];
      const nomMun = fila[3];
      const imn = fila[fila.length - 1];
      if (
        typeof cveMun5 === "string" && /^\d{5}$/.test(cveMun5) &&
        typeof cveEnt === "string" && typeof nomMun === "string" &&
        typeof imn === "number"
      ) {
        porMunicipioPorNombre.set(claveMunicipioPorNombre(cveEnt, nomMun), imn);
      }
    }

    const resultado: CacheMarginacion = { porEstado, porMunicipioPorNombre, ts: Date.now() };
    cache = resultado;
    return resultado;
  })();

  try {
    return await enVuelo;
  } finally {
    enVuelo = null;
  }
}

function wbMunicipioSheet(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer" });
  return wb.Sheets["IMM_2020"] ?? wb.Sheets[wb.SheetNames[1]];
}

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

// Reverso de ESTADO_CVE_MAP — mismo patrón ya usado en eceg.ts (cada
// módulo construye su propia copia, costo trivial de 32 entradas, sin
// importar lib/geo/* solo por este mapa).
const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

export async function resolverIndiceMarginacion(territorio: Territorio): Promise<CeldaFontana[]> {
  let datos: CacheMarginacion;
  try {
    datos = await cargarMarginacion();
  } catch {
    const motivo = "Error de conexión con CONAPO (marginación)";
    return [{ nivel: "nacional", motivo }, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  // Nacional: CONAPO no publica un valor país en este archivo (solo 32
  // entidades) — sin mecanismo de agregación válido (el índice de
  // marginación no es sumable/promediable de forma simple entre
  // entidades sin la metodología completa de CONAPO) — motivo explícito.
  const nacional: CeldaFontana = {
    nivel: "nacional",
    motivo: "CONAPO no publica un índice de marginación nacional agregable — solo por entidad y municipio",
  };
  // "distrital" (Hallazgo B/C, revisión de consistencia 2ª ronda,
  // 2026-08-12) — mismo criterio que el nacional, evita el motivo
  // genérico de completarA4Celdas para esta celda.
  const distrital: CeldaFontana = {
    nivel: "distrital",
    motivo: "CONAPO no publica un índice de marginación distrital agregable — solo por entidad y municipio",
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

  const imnEstado = datos.porEstado.get(estadoCve);
  const estatal: CeldaFontana = imnEstado != null
    ? { nivel: "estatal", valor: imnEstado, unidad: "índice normalizado (0-1)", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONAPO_MARGINACION }
    : { nivel: "estatal", motivo: "CONAPO no reportó índice de marginación para este territorio" };

  // FIX DE FONDO (Paso 4, 2026-08-23) — join municipal por NOMBRE, no por
  // CVE_MUN (ver nota de cabecera de CacheMarginacion).
  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const imnMunicipio = datos.porMunicipioPorNombre.get(claveMunicipioPorNombre(estadoCve, municipioNombre));
    municipal = imnMunicipio != null
      ? { nivel: "municipal", valor: imnMunicipio, unidad: "índice normalizado (0-1)", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONAPO_MARGINACION }
      : { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo de CONAPO` };
  }

  return [nacional, estatal, distrital, municipal];
}

// Desglose "Ver municipios" en proyectos nivel "estatal" (botón ya
// construido en la tabla para ECEG — Encargo de generalización,
// 2026-08-08). cargarMarginacion() ya trae TODO el país en memoria
// (porMunicipio, clave estadoCve+municipioCve) — filtrar por estado es
// solo iterar el Map, sin ninguna llamada nueva. Nunca aplica a
// distritos_fed/distritos_loc — CONAPO no publica por distrito
// electoral, ese caso se queda fuera (400 "sin mecanismo" ya existente).
export async function resolverMunicipiosEstadoMarginacion(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const [datos, opciones] = await Promise.all([cargarMarginacion(), getMunicipiosOptions(estadoCve)]);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  // FIX DE FONDO (Paso 4, 2026-08-23) — join por nombre, mismo patrón
  // que resolverMunicipiosEstadoIcmm (icmm.ts).
  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => {
    const imn = datos.porMunicipioPorNombre.get(claveMunicipioPorNombre(estadoCve, nombre));
    return {
      cve,
      nombre,
      celda: imn != null
        ? { nivel: "municipal", valor: imn, unidad: "índice normalizado (0-1)", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONAPO_MARGINACION }
        : { nivel: "municipal", motivo: "CONAPO no reportó índice de marginación para este municipio" },
    };
  });
}

// Desglose "Ver estados" en proyectos nivel "nacional" (Encargo de
// generalización, 2026-08-09). cargarMarginacion() ya trae los 32
// estados completos en memoria (porEstado) — sin llamada nueva, mismo
// costo que "Ver municipios".
export async function resolverEstadosMarginacion(): Promise<ElementoDeEstado[]> {
  const datos = await cargarMarginacion();
  return Array.from(datos.porEstado.entries()).map(([cve, valor]): ElementoDeEstado => ({
    cve,
    nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
    celda: { nivel: "estatal", valor, unidad: "índice normalizado (0-1)", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONAPO_MARGINACION },
  }));
}