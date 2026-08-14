// lib/fontana/ingesta/enigh.ts
// Adaptador de F2-6 (Gini), F2-12 (Deciles de ingreso), F2-15 (Gasto en
// educación) y F2-16 (Gasto en salud) — INEGI, ENIGH 2024, tabulados
// por entidad federativa. Un solo archivo sirve a los 4 indicadores,
// mismo patrón que coneval.ts.
//
// Verificado EN VIVO 2026-08-10:
//   https://inegi.org.mx/contenidos/programas/enigh/nc/2024/tabulados/enigh2024_ns_ef_tabulados.xlsx
//     HTTP 200, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
//     994,856 bytes. XLSX único (sin ZIP), 25 hojas. Se usan 2:
//
//   "Cuadro 2.1" — "Ingreso corriente total promedio trimestral por
//   hogar en deciles de hogares y Coeficiente de Gini por entidad
//   federativa" — bloque FIJO de 12 filas por territorio (Nacional +
//   32 estados, 33 bloques, filas 6-401): fila del territorio =
//   promedio general (columnas C-G = años 2016/2018/2020/2022/2024),
//   +1..+10 = deciles I-X (mismas columnas de año), +11 = "COEFICIENTE
//   DE GINI2". Columna G = 2024, verificado con datos reales (Nacional
//   G17=0.390521832467356, Aguascalientes G29=0.35129322150923897).
//
//   "Cuadro 4.2" — "Gasto corriente monetario trimestral por la
//   composición de los grandes rubros del gasto por entidad
//   federativa" — bloque FIJO de 44 filas por territorio (mismas 33),
//   filas 6-1449: fila del territorio +31 = "CUIDADOS DE LA SALUD"
//   (F2-16), +39 = "ARTÍCULOS Y SERVICIOS DE EDUCACIÓN" (F2-15).
//   Columna D = gasto trimestral en miles de pesos, columna F =
//   promedio por hogar en pesos — verificado con datos reales
//   (offsets idénticos en los 3 primeros bloques: Nacional 6→37/45,
//   Aguascalientes 50→81/89, Baja California 94→125/133).
//
// Ambos cuadros traen fila "NACIONAL" propia — Fontana NO agrega
// (a diferencia de F2-1/F2-2/F2-14), solo la lee.
//
// naturaleza: dato_directo en los 3 niveles usados — INEGI publica el
// valor final tabulado (Gini, deciles, gasto por rubro) sin
// coeficiente de variación ni error estándar acompañándolo (a
// diferencia de ICMM, que sí trae CV% — por eso ICMM es
// estimacion_modelada y esto no). Mismo criterio que CONAPO/CONEVAL.
//
// ⚠️ F2-6 cambia de DEFINICIÓN al migrar de CONEVAL (Ingreso Corriente
// Total Per Cápita calibrado con la metodología propia de pobreza de
// CONEVAL) a este archivo (ingreso corriente directo de la encuesta,
// sin calibración de CONEVAL) — confirmado con datos reales que NO
// coinciden para el mismo año: 2022 nacional, CONEVAL 0.4307 vs. este
// archivo (columna F, año 2022) 0.40196447118275302. Documentar en el
// registro como cambio de fuente Y de definición, no solo de año más
// reciente — motivado porque CONEVAL dejó de publicar esta medición
// (función transferida a INEGI en 2024), no por preferencia.
//
// Sin municipal/distrital — ENIGH no tiene representatividad
// estadística a ese nivel, límite ya conocido, no un hueco nuevo.

import * as XLSX from "xlsx";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_ENIGH = "INEGI (ENIGH 2024, tabulados por entidad federativa)";

const URL_ENIGH_TABULADOS =
  "https://inegi.org.mx/contenidos/programas/enigh/nc/2024/tabulados/enigh2024_ns_ef_tabulados.xlsx";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CLAVE_NACIONAL = "NACIONAL";
const COL_ANO_2024 = "G";

const CUADRO21_INICIO = 6;
const CUADRO21_BLOQUE = 12;
const CUADRO21_OFFSET_GINI = 11;
const DECILES_OFFSETS: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
};

const CUADRO42_INICIO = 6;
const CUADRO42_BLOQUE = 44;
const CUADRO42_OFFSET_SALUD = 31; // "CUIDADOS DE LA SALUD"
const CUADRO42_OFFSET_EDUCACION = 39; // "ARTÍCULOS Y SERVICIOS DE EDUCACIÓN"
const COL_PROMEDIO_HOGAR = "F"; // pesos por hogar

interface ValorGasto {
  gastoMilesPesos: number;
  promedioPorHogar: number;
}

interface CacheEnigh {
  gini: Map<string, number>; // clave (estadoCve | "NACIONAL") -> Gini 2024
  deciles: Map<string, { promedio: number; distribucion: Record<string, number> }>;
  gastoSalud: Map<string, ValorGasto>;
  gastoEducacion: Map<string, ValorGasto>;
  ts: number;
}

let cache: CacheEnigh | null = null;
let enVuelo: Promise<CacheEnigh> | null = null;

function celda(ws: XLSX.WorkSheet, col: string, fila: number): number | null {
  const c = ws[`${col}${fila}`];
  return typeof c?.v === "number" ? c.v : null;
}

function nombreTerritorio(ws: XLSX.WorkSheet, fila: number): string | null {
  const c = ws[`A${fila}`];
  return typeof c?.v === "string" ? c.v.trim() : null;
}

// ENIGH usa el nombre oficial LARGO de INEGI para 4 de las 32
// entidades — ESTADO_CVE_MAP usa el corto (ej. "COAHUILA", no
// "COAHUILA DE ZARAGOZA"). Verificado con los 33 nombres reales del
// archivo (2026-08-10): estos 4 son los únicos que no calzan directo
// con normalizeGeoName — el resto (28 entidades) sí. Alias explícitos,
// no fuzzy-matching (mismo criterio que el alias "México"→"Estado de
// México" ya usado en imco.ts).
const ALIAS_NOMBRE_ENIGH: Record<string, string> = {
  "COAHUILA DE ZARAGOZA": "COAHUILA",
  "MÉXICO": "ESTADO DE MÉXICO",
  "MICHOACÁN DE OCAMPO": "MICHOACAN",
  "VERACRUZ DE IGNACIO DE LA LLAVE": "VERACRUZ",
};

// Resuelve el nombre de fila (ej. "CIUDAD DE MÉXICO", "COAHUILA DE
// ZARAGOZA") a estadoCve, o null si es "NACIONAL" — separado de
// resolveEstadoCve (para territorio de entrada) porque aquí se recorre
// el archivo completo, no un territorio puntual.
function claveDeFila(nombre: string): string {
  if (normalizeGeoName(nombre) === "NACIONAL") return CLAVE_NACIONAL;
  const nombreResuelto = ALIAS_NOMBRE_ENIGH[nombre.toUpperCase()] ?? nombre;
  const cve = ESTADO_CVE_MAP[normalizeGeoName(nombreResuelto)];
  if (!cve) {
    throw new Error(`ENIGH: nombre de territorio "${nombre}" no reconocido en ESTADO_CVE_MAP`);
  }
  return cve;
}

async function descargarYParsearEnigh(): Promise<CacheEnigh> {
  const res = await fetch(URL_ENIGH_TABULADOS);
  if (!res.ok) throw new Error(`ENIGH HTTP ${res.status} en ${URL_ENIGH_TABULADOS}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });

  const wsCuadro21 = wb.Sheets["Cuadro 2.1"];
  const wsCuadro42 = wb.Sheets["Cuadro 4.2"];
  if (!wsCuadro21 || !wsCuadro42) {
    throw new Error('ENIGH: no se encontró "Cuadro 2.1" y/o "Cuadro 4.2" en el archivo — ¿cambió el nombre de hoja?');
  }

  const gini = new Map<string, number>();
  const deciles = new Map<string, { promedio: number; distribucion: Record<string, number> }>();
  for (let i = 0; i < 33; i++) {
    const filaTerritorio = CUADRO21_INICIO + i * CUADRO21_BLOQUE;
    const nombre = nombreTerritorio(wsCuadro21, filaTerritorio);
    if (!nombre) continue;
    const clave = claveDeFila(nombre);

    const promedio = celda(wsCuadro21, COL_ANO_2024, filaTerritorio);
    if (promedio != null) {
      const distribucion: Record<string, number> = {};
      for (const [decil, offset] of Object.entries(DECILES_OFFSETS)) {
        const v = celda(wsCuadro21, COL_ANO_2024, filaTerritorio + offset);
        if (v != null) distribucion[decil] = v;
      }
      deciles.set(clave, { promedio, distribucion });
    }

    const giniValor = celda(wsCuadro21, COL_ANO_2024, filaTerritorio + CUADRO21_OFFSET_GINI);
    if (giniValor != null) gini.set(clave, giniValor);
  }

  const gastoSalud = new Map<string, ValorGasto>();
  const gastoEducacion = new Map<string, ValorGasto>();
  for (let i = 0; i < 33; i++) {
    const filaTerritorio = CUADRO42_INICIO + i * CUADRO42_BLOQUE;
    const nombre = nombreTerritorio(wsCuadro42, filaTerritorio);
    if (!nombre) continue;
    const clave = claveDeFila(nombre);

    const filaSalud = filaTerritorio + CUADRO42_OFFSET_SALUD;
    const gastoMilesSalud = celda(wsCuadro42, "D", filaSalud);
    const promedioSalud = celda(wsCuadro42, COL_PROMEDIO_HOGAR, filaSalud);
    if (gastoMilesSalud != null && promedioSalud != null) {
      gastoSalud.set(clave, { gastoMilesPesos: gastoMilesSalud, promedioPorHogar: promedioSalud });
    }

    const filaEducacion = filaTerritorio + CUADRO42_OFFSET_EDUCACION;
    const gastoMilesEducacion = celda(wsCuadro42, "D", filaEducacion);
    const promedioEducacion = celda(wsCuadro42, COL_PROMEDIO_HOGAR, filaEducacion);
    if (gastoMilesEducacion != null && promedioEducacion != null) {
      gastoEducacion.set(clave, { gastoMilesPesos: gastoMilesEducacion, promedioPorHogar: promedioEducacion });
    }
  }

  return { gini, deciles, gastoSalud, gastoEducacion, ts: Date.now() };
}

async function cargarEnigh(): Promise<CacheEnigh> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache;
  if (enVuelo) return enVuelo;

  enVuelo = descargarYParsearEnigh();
  try {
    const resultado = await enVuelo;
    cache = resultado;
    return resultado;
  } finally {
    enVuelo = null;
  }
}

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

async function resolverNacionalYEstatal(
  territorio: Territorio,
  obtenerNacional: (datos: CacheEnigh) => CeldaFontana,
  obtenerEstatal: (datos: CacheEnigh, estadoCve: string) => CeldaFontana
): Promise<CeldaFontana[]> {
  let datos: CacheEnigh;
  try {
    datos = await cargarEnigh();
  } catch {
    const motivo = "Error de conexión con INEGI (ENIGH tabulados)";
    return [{ nivel: "nacional", motivo }, { nivel: "estatal", motivo }];
  }

  const nacional = obtenerNacional(datos);

  if (!territorio.estado) {
    return [nacional, { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" }];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    return [nacional, { nivel: "estatal", motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` }];
  }

  return [nacional, obtenerEstatal(datos, estadoCve)];
}

function celdaGini(clave: string | null, datos: CacheEnigh, nivel: "nacional" | "estatal"): CeldaFontana {
  const valor = clave != null ? datos.gini.get(clave) : undefined;
  if (valor == null) return { nivel, motivo: "INEGI no reportó Gini para este territorio" };
  return {
    nivel,
    valor: Math.round(valor * 10000) / 10000,
    unidad: "índice (0-1)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_ENIGH,
  };
}

export async function resolverGini(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverNacionalYEstatal(
    territorio,
    (datos) => celdaGini(CLAVE_NACIONAL, datos, "nacional"),
    (datos, estadoCve) => celdaGini(estadoCve, datos, "estatal")
  );
}

function celdaDeciles(clave: string | null, datos: CacheEnigh, nivel: "nacional" | "estatal"): CeldaFontana {
  const par = clave != null ? datos.deciles.get(clave) : undefined;
  if (!par) return { nivel, motivo: "INEGI no reportó deciles de ingreso para este territorio" };
  return {
    nivel,
    valor: Math.round(par.promedio * 100) / 100,
    distribucion: par.distribucion,
    unidad: "pesos (ingreso corriente promedio trimestral por hogar)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_ENIGH,
  };
}

export async function resolverDecilesIngreso(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverNacionalYEstatal(
    territorio,
    (datos) => celdaDeciles(CLAVE_NACIONAL, datos, "nacional"),
    (datos, estadoCve) => celdaDeciles(estadoCve, datos, "estatal")
  );
}

function celdaGasto(
  mapa: Map<string, ValorGasto>,
  clave: string | null,
  nivel: "nacional" | "estatal"
): CeldaFontana {
  const par = clave != null ? mapa.get(clave) : undefined;
  if (!par) return { nivel, motivo: "INEGI no reportó este gasto para este territorio" };
  return {
    nivel,
    valor: Math.round(par.promedioPorHogar * 100) / 100,
    unidad: "pesos (gasto trimestral promedio por hogar)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_ENIGH,
  };
}

export async function resolverGastoSalud(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverNacionalYEstatal(
    territorio,
    (datos) => celdaGasto(datos.gastoSalud, CLAVE_NACIONAL, "nacional"),
    (datos, estadoCve) => celdaGasto(datos.gastoSalud, estadoCve, "estatal")
  );
}

export async function resolverGastoEducacion(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverNacionalYEstatal(
    territorio,
    (datos) => celdaGasto(datos.gastoEducacion, CLAVE_NACIONAL, "nacional"),
    (datos, estadoCve) => celdaGasto(datos.gastoEducacion, estadoCve, "estatal")
  );
}

// Desglose "Ver estados" en proyectos nivel "nacional" — mismo patrón
// que el resto de Fontana. El archivo ya trae los 32 estados completos
// en memoria — sin llamada nueva.
export async function resolverEstadosGini(): Promise<ElementoDeEstado[]> {
  const datos = await cargarEnigh();
  return Array.from(datos.gini.entries())
    .filter(([cve]) => cve !== CLAVE_NACIONAL)
    .map(([cve, valor]): ElementoDeEstado => ({
      cve,
      nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
      celda: celdaGini(cve, datos, "estatal"),
    }));
}

export async function resolverEstadosDeciles(): Promise<ElementoDeEstado[]> {
  const datos = await cargarEnigh();
  return Array.from(datos.deciles.keys())
    .filter((cve) => cve !== CLAVE_NACIONAL)
    .map((cve): ElementoDeEstado => ({
      cve,
      nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
      celda: celdaDeciles(cve, datos, "estatal"),
    }));
}

export async function resolverEstadosGastoSalud(): Promise<ElementoDeEstado[]> {
  const datos = await cargarEnigh();
  return Array.from(datos.gastoSalud.keys())
    .filter((cve) => cve !== CLAVE_NACIONAL)
    .map((cve): ElementoDeEstado => ({
      cve,
      nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
      celda: celdaGasto(datos.gastoSalud, cve, "estatal"),
    }));
}

export async function resolverEstadosGastoEducacion(): Promise<ElementoDeEstado[]> {
  const datos = await cargarEnigh();
  return Array.from(datos.gastoEducacion.keys())
    .filter((cve) => cve !== CLAVE_NACIONAL)
    .map((cve): ElementoDeEstado => ({
      cve,
      nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
      celda: celdaGasto(datos.gastoEducacion, cve, "estatal"),
    }));
}
