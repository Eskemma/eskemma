// lib/fontana/ingesta/pnud.ts
// Adaptador de F2-5 (IDH municipal), F2-19 (IDG municipal), F2-20
// (Sub-índice Educación), F2-21 (Sub-índice Ingreso) y F2-22
// (Sub-índice Salud) — PNUD México, 4 archivos de Google Drive.
//
// Verificado EN VIVO 2026-08-10, descarga vía
// `https://docs.google.com/spreadsheets/d/{id}/export?format=xlsx`
// (público, sin autenticación, confirmado con los 4):
//   IDH combinado = 1HLYIfCnhQQ1Tm3JJgmpEAJrDD_TqRYxc → IDH + Salud(SS)
//     + Educación(SE) + Ingreso(SI), años 2010/2015/2020, 1,917 filas.
//   SE 2020       = 1SC2ckf97szOjNGzqXnyZRl8mSHjtIWgl → Educación
//     standalone, 2,466/2,469 municipios.
//   SI 2020       = 11dRCKn0EQFTxwaVa546QGP8Q981YfDkp → Ingreso
//     standalone, 2,469/2,469 (3 filas "ND").
//   IDG 2020      = 11QvC4hpuZjq2WonuXvh-haHPfcooAtnM → IDG, 2,469
//     filas, SIN columna de nombre de municipio (solo clave).
//
// ⚠️ BUG REAL confirmado (mismo patrón que ICMM): el "Clave de
// Municipio" de los 4 archivos de PNUD NO es la numeración estándar de
// lib/geo/municipios.ts (verificado cruzando por CVE: Jalisco solo
// 35/125 coinciden). El join municipal se hace por NOMBRE normalizado
// (normalizeGeoName), nunca por CVE — verificado que el NOMBRE sí
// calza bien entre PNUD y el catálogo estándar (Jalisco 125/125, CDMX
// 16/16; Oaxaca 563/568 y Nuevo León 41/51 con variantes de formato ya
// documentadas — mismo patrón de honoríficos/abreviaturas ya visto en
// ICMM, casos que caen a "no reconocido" explícito, nunca a un valor
// equivocado).
//
// El archivo IDG no trae nombre de municipio — su clave se traduce a
// nombre cruzando contra el propio archivo SE 2020 (mismo origen PNUD,
// verificado: 2,466 de 2,466 claves de IDG con posible match SÍ
// coinciden con el mapa clave→nombre de SE; las 2 sin match son huecos
// que YA existen en SE mismo — Chiapas 095/125, Tlaxcala 048 — no un
// desalineo de numeración).
//
// Oaxaca en el archivo IDH combinado: sus 570 municipios NO aparecen
// individualmente — están colapsados en 30 filas "Oaxaca-Región X"
// (columna DISTRITO poblada, columna MUNICIPIO vacía). F2-5 (IDH) y
// F2-22 (Salud), que solo viven en este archivo, devuelven motivo
// explícito para Oaxaca — nunca inventan el dato ni usan el agregado
// regional como si fuera municipal.
//
// naturaleza: dato_directo — PNUD publica el índice final (IDH/IDG y
// sub-índices) sin coeficiente de variación ni error estándar
// acompañándolo.
//
// Nacional y Estatal: verificado que NINGUNO de los 4 archivos trae
// fila propia de esos niveles (0 filas con clave terminada en "000" en
// los 4). Son índices compuestos (mismo tipo que F2-3/F2-4/ICMM) — no
// se agregan sin metodología validada, van "no_viable" en el registro,
// no se calculan aquí.
//
// Riesgo declarado: depender de carpetas de Google Drive (no URL
// institucional) — el contenido puede moverse o restringirse sin
// aviso. Fecha de verificación: 2026-08-10.

import * as XLSX from "xlsx";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, getMunicipiosOptions } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_PNUD_IDH = "PNUD México (IDH municipal 2010-2020)";
export const FUENTE_ETIQUETA_PNUD_SE = "PNUD México (Sub-índice Educación municipal 2020)";
export const FUENTE_ETIQUETA_PNUD_SI = "PNUD México (Sub-índice Ingreso municipal 2020)";
export const FUENTE_ETIQUETA_PNUD_IDG = "PNUD México (Índice de Desigualdad de Género municipal 2020)";

const ID_IDH_COMBINADO = "1HLYIfCnhQQ1Tm3JJgmpEAJrDD_TqRYxc";
const ID_SE_2020 = "1SC2ckf97szOjNGzqXnyZRl8mSHjtIWgl";
const ID_SI_2020 = "11dRCKn0EQFTxwaVa546QGP8Q981YfDkp";
const ID_IDG_2020 = "11QvC4hpuZjq2WonuXvh-haHPfcooAtnM";

function urlExportXlsx(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const MOTIVO_OAXACA = "PNUD no publica IDH/Salud individual por municipio en Oaxaca en esta edición — solo agregados regionales";

function claveNombre(estadoCve: string, nombre: string): string {
  return `${estadoCve}|${normalizeGeoName(nombre)}`;
}

interface CachePnud {
  idhPorNombre: Map<string, number>; // IDH 2020
  saludPorNombre: Map<string, number>; // Subíndice Salud (SS) 2020
  educacionPorNombre: Map<string, number>; // Subíndice Educación (SE) 2020
  ingresoPorNombre: Map<string, number>; // Subíndice Ingreso (SI) 2020
  idgPorNombre: Map<string, number>; // IDG 2020
  clavesOaxacaConDato: Set<string>; // estadoCve="20" siempre — solo para distinguir "hueco Oaxaca" de "no reconocido"
  ts: number;
}

async function descargarXlsx(id: string): Promise<XLSX.WorkBook> {
  const res = await fetch(urlExportXlsx(id));
  if (!res.ok) throw new Error(`PNUD HTTP ${res.status} en Drive id=${id}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return XLSX.read(buf, { type: "buffer" });
}

async function descargarYParsearPnud(): Promise<CachePnud> {
  const [wbIdh, wbSe, wbSi, wbIdg] = await Promise.all([
    descargarXlsx(ID_IDH_COMBINADO),
    descargarXlsx(ID_SE_2020),
    descargarXlsx(ID_SI_2020),
    descargarXlsx(ID_IDG_2020),
  ]);

  const idhPorNombre = new Map<string, number>();
  const saludPorNombre = new Map<string, number>();
  {
    const ws = wbIdh.Sheets[wbIdh.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    for (const fila of filas) {
      const clave = fila[0];
      if (typeof clave !== "string" || !/^\d{5}$/.test(clave)) continue;
      const estadoCve = clave.slice(0, 2);
      const municipio = fila[2]; // vacío para las 30 filas de Oaxaca-Región
      if (typeof municipio !== "string" || !municipio.trim()) continue; // excluye Oaxaca-Región, nunca las trata como municipio real
      const ss2020 = fila[18]; // columna S
      const idh2020 = fila[27]; // columna AB
      const key = claveNombre(estadoCve, municipio);
      if (typeof ss2020 === "number") saludPorNombre.set(key, ss2020);
      if (typeof idh2020 === "number") idhPorNombre.set(key, idh2020);
    }
  }

  // Nombre real de cada municipio de SE — se reutiliza para traducir
  // la clave de IDG (sin nombre propio) a la misma clave nombre+estado
  // que usan los otros 3 mapas.
  const nombrePorClaveSe = new Map<string, string>(); // clave 5 díg. -> nombre
  const educacionPorNombre = new Map<string, number>();
  {
    const ws = wbSe.Sheets[wbSe.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    for (const fila of filas) {
      const clave = fila[0];
      if (typeof clave !== "string" || !/^\d{5}$/.test(clave)) continue;
      const municipio = fila[2];
      const se2020 = fila[6]; // columna G
      if (typeof municipio === "string" && municipio.trim()) {
        nombrePorClaveSe.set(clave, municipio);
        const key = claveNombre(clave.slice(0, 2), municipio);
        if (typeof se2020 === "number") educacionPorNombre.set(key, se2020);
      }
    }
  }

  const ingresoPorNombre = new Map<string, number>();
  {
    const ws = wbSi.Sheets[wbSi.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    for (const fila of filas) {
      const clave = fila[0];
      if (typeof clave !== "string" || !/^\d{5}$/.test(clave)) continue;
      const municipio = fila[2];
      // columna F — a diferencia de SE/IDH/IDG, este archivo guarda la
      // columna como TEXTO (ej. "0.925", no 0.925) — bug real
      // encontrado en verificación: `typeof === "number"` descartaba
      // silenciosamente TODAS las filas. "ND" (3 filas) se filtra con
      // Number.isFinite, no con typeof.
      const si2020Raw = fila[5];
      const si2020 = typeof si2020Raw === "number" ? si2020Raw : Number(si2020Raw);
      if (typeof municipio === "string" && municipio.trim() && Number.isFinite(si2020)) {
        ingresoPorNombre.set(claveNombre(clave.slice(0, 2), municipio), si2020);
      }
    }
  }

  const idgPorNombre = new Map<string, number>();
  {
    const ws = wbIdg.Sheets[wbIdg.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    for (const fila of filas) {
      const claveRaw = fila[0];
      if (typeof claveRaw !== "number" && typeof claveRaw !== "string") continue;
      const clave5 = String(claveRaw).padStart(5, "0");
      const nombre = nombrePorClaveSe.get(clave5);
      if (!nombre) continue; // clave sin match en SE (huecos ya conocidos, ej. Chiapas 095/125, Tlaxcala 048)
      const idgValor = fila[17]; // columna R — "IDG MUNICIPAL"
      if (typeof idgValor === "number") {
        idgPorNombre.set(claveNombre(clave5.slice(0, 2), nombre), idgValor);
      }
    }
  }

  return {
    idhPorNombre,
    saludPorNombre,
    educacionPorNombre,
    ingresoPorNombre,
    idgPorNombre,
    clavesOaxacaConDato: new Set(),
    ts: Date.now(),
  };
}

let cache: CachePnud | null = null;
let enVuelo: Promise<CachePnud> | null = null;

async function cargarPnud(): Promise<CachePnud> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache;
  if (enVuelo) return enVuelo;

  enVuelo = descargarYParsearPnud();
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

// Bug real encontrado en revisión de consistencia (Incremento 4,
// 2026-08-10): esta función faltaba — para proyectos distrito_federal/
// distrito_local, territorio.municipio trae el texto crudo del
// territorio ("Distrito Electoral Federal V, con cabecera en..."), no
// un nombre de municipio real. Mismo patrón ya resuelto en icmm.ts/
// conapoMarginacion.ts — extraerCiudadCabecera() lo resuelve.
function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

async function resolverIndicadorMunicipalPnud(
  territorio: Territorio,
  mapa: (datos: CachePnud) => Map<string, number>,
  unidad: string,
  fuenteEtiqueta: string,
  esOaxacaConHueco: boolean
): Promise<CeldaFontana[]> {
  const nacional: CeldaFontana = {
    nivel: "nacional",
    motivo: "PNUD no publica este índice a nivel nacional — índice compuesto sin metodología de agregación validada",
  };
  const noEstatal: CeldaFontana = {
    nivel: "estatal",
    motivo: "PNUD no publica este índice a nivel estatal — índice compuesto sin metodología de agregación validada",
  };
  // "distrital" (Hallazgo B, revisión de consistencia 2ª ronda,
  // 2026-08-12) — antes se dejaba sin celda propia y completarA4Celdas
  // la rellenaba con el motivo genérico "mecanismo de agregación no
  // disponible para esta fuente" (correcto para fuentes sin granularidad
  // municipal como ENIGH/IMCO, pero engañoso para PNUD: sí hay dato
  // municipal, lo que falta es una metodología de recombinación
  // municipio→distrito validada — mismo motivo ya usado en
  // nacional/estatal, no un motivo distinto). Misma celda para las 2
  // columnas inversas (distrital_federal/distrital_local de proyectos
  // Municipal) y para el distrito propio de un proyecto distrito_federal/
  // distrito_local — construirCeldasTabla decide cuál mostrar.
  const noDistrital: CeldaFontana = {
    nivel: "distrital",
    motivo: "PNUD no publica este índice a nivel distrital — índice compuesto sin metodología de agregación validada",
  };

  let datos: CachePnud;
  try {
    datos = await cargarPnud();
  } catch {
    const motivo = "Error de conexión con PNUD (Google Drive)";
    return [{ nivel: "nacional", motivo }, { nivel: "estatal", motivo }, { nivel: "distrital", motivo }, { nivel: "municipal", motivo }];
  }

  if (!territorio.estado) {
    return [
      nacional,
      noEstatal,
      noDistrital,
      { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" },
    ];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, noEstatal, noDistrital, { nivel: "municipal", motivo }];
  }

  const municipioNombre = resolverNombreMunicipio(territorio);
  if (!municipioNombre) {
    return [nacional, noEstatal, noDistrital, { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" }];
  }

  if (esOaxacaConHueco && estadoCve === "20") {
    return [nacional, noEstatal, noDistrital, { nivel: "municipal", motivo: MOTIVO_OAXACA }];
  }

  const valor = mapa(datos).get(claveNombre(estadoCve, municipioNombre));
  const municipal: CeldaFontana = valor != null
    ? { nivel: "municipal", valor: Math.round(valor * 1000) / 1000, unidad, naturaleza: "dato_directo", fuenteEtiqueta }
    : { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo de PNUD` };

  return [nacional, noEstatal, noDistrital, municipal];
}

export async function resolverIdhMunicipal(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorMunicipalPnud(territorio, (d) => d.idhPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_IDH, true);
}

export async function resolverSaludMunicipal(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorMunicipalPnud(territorio, (d) => d.saludPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_IDH, true);
}

export async function resolverEducacionMunicipal(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorMunicipalPnud(territorio, (d) => d.educacionPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_SE, false);
}

export async function resolverIngresoMunicipal(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorMunicipalPnud(territorio, (d) => d.ingresoPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_SI, false);
}

export async function resolverIdgMunicipal(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverIndicadorMunicipalPnud(territorio, (d) => d.idgPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_IDG, false);
}

// Desglose "Ver municipios" en proyectos nivel "estatal" — construido en
// la revisión de consistencia del Incremento 4 (2026-08-10): nunca se
// había hecho para PNUD (a diferencia de icmm.ts, que sí lo tenía desde
// su propio incremento) — mismo patrón exacto que
// resolverMunicipiosEstadoIcmm (icmm.ts): iterar
// getMunicipiosOptions(estadoCve) (catálogo geo estándar, nunca la
// clave propia de PNUD) y resolver cada valor cruzando por nombre
// normalizado contra el mapa ya cacheado — el CVE devuelto en cada
// elemento es el del catálogo geo (lo que el resto del sistema
// necesita para agrupar por distrito/nacional), no el de PNUD.
async function resolverMunicipiosEstadoPnudGenerico(
  estadoCve: string,
  soloCves: string[] | undefined,
  mapa: (datos: CachePnud) => Map<string, number>,
  unidad: string,
  fuenteEtiqueta: string,
  esOaxacaConHueco: boolean
): Promise<ElementoDeEstado[]> {
  const [datos, opciones] = await Promise.all([cargarPnud(), getMunicipiosOptions(estadoCve)]);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  if (esOaxacaConHueco && estadoCve === "20") {
    return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => ({
      cve,
      nombre,
      celda: { nivel: "municipal", motivo: MOTIVO_OAXACA },
    }));
  }

  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => {
    const valor = mapa(datos).get(claveNombre(estadoCve, nombre));
    return {
      cve,
      nombre,
      celda: valor != null
        ? { nivel: "municipal", valor: Math.round(valor * 1000) / 1000, unidad, naturaleza: "dato_directo", fuenteEtiqueta }
        : { nivel: "municipal", motivo: `Municipio "${nombre}" no reconocido en el catálogo de PNUD` },
    };
  });
}

export async function resolverMunicipiosEstadoIdh(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPnudGenerico(estadoCve, soloCves, (d) => d.idhPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_IDH, true);
}

export async function resolverMunicipiosEstadoSalud(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPnudGenerico(estadoCve, soloCves, (d) => d.saludPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_IDH, true);
}

export async function resolverMunicipiosEstadoEducacion(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPnudGenerico(estadoCve, soloCves, (d) => d.educacionPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_SE, false);
}

export async function resolverMunicipiosEstadoIngreso(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPnudGenerico(estadoCve, soloCves, (d) => d.ingresoPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_SI, false);
}

export async function resolverMunicipiosEstadoIdg(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoPnudGenerico(estadoCve, soloCves, (d) => d.idgPorNombre, "índice (0-1)", FUENTE_ETIQUETA_PNUD_IDG, false);
}
