// lib/fontana/ingesta/gacp.ts
// Adaptador de F5-8 (Zonas menos comunicadas) — Familia 5.
//
// Fuente reemplazada en Ronda 9 (2026-08-23): el catálogo original
// apuntaba a SICT (56 datasets vía CKAN) — verificado en vivo que SICT
// decayó a solo 11 datasets reales en datos.gob.mx, ninguno mide
// accesibilidad/conectividad por zona (el más cercano,
// `programa_construccion_caminos_rurales`, es solo estatal — 32 filas,
// inversión/km, no accesibilidad). CONEVAL GACP (Grado de Accesibilidad
// a Carretera Pavimentada) reemplaza a SICT — tiene el dato exacto:
//
// https://www.coneval.org.mx/Medicion/MP/Documents/Accesibilidad_carretera/2020/Anexo_estadistico.zip
// (9.2 MB, descarga real confirmada), hoja "Municipios" del XLSX:
// "Porcentaje de población con GACP bajo o muy bajo" — exactamente el
// concepto de "zonas menos comunicadas". Valores reales confirmados:
// Guadalajara 0.000577%, Zapopan 0.334035%.
//
// Sin caché en Storage — XLSX completo (extraído del ZIP) cacheado en
// memoria de proceso (TTL 24h, single-flight), mismo patrón que
// transparencyInternational.ts.

import JSZip from "jszip";
import * as XLSX from "xlsx";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, getMunicipiosOptions } from "@/lib/geo/municipios";
import { resolverCveOficialMunicipio } from "@/lib/fontana/ingesta/anvcc";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";
import type { Territorio } from "@/types/shared.types";

const GACP_ZIP_URL = "https://www.coneval.org.mx/Medicion/MP/Documents/Accesibilidad_carretera/2020/Anexo_estadistico.zip";

interface FilaGacp {
  cveEnt: string;
  nombreEstado: string;
  pctBajoAcceso: number;
  // Numerador/denominador reales (2026-08-25) — ya publicados por CONEVAL
  // en la misma hoja "Municipios", nunca extraídos hasta ahora (el
  // adaptador solo leía el % ya calculado, fila[6]). Necesarios para
  // reconstruir un % combinado real entre varios municipios (nunca
  // promediar % ya calculados) — mismo criterio que coneval.ts.
  poblacionTotal: number;
  poblacionGacpBajo: number;
}

// Modo B (2026-08-24) — hoja "Localidades" del mismo archivo ya
// descargado (189,432 filas nacional, sin costo de descarga adicional)
// — trae el desglose sub-municipal que "Municipios"/"Estados" no
// tienen: cuáles localidades específicas caen en accesibilidad
// Bajo/Muy bajo. Medido en vivo el rango real: desde 1 localidad
// (Guadalajara) hasta 1,039 (Guadalupe y Calvo, Chihuahua, el caso
// nacional más grande) — nunca se expone sin paginar.
interface LocalidadGacp {
  nombre: string;
  poblacion: number;
  grado: string; // "Bajo" | "Muy bajo" (únicos 2 valores que interesan a F5-8)
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cacheMunicipios: { porClave: Map<string, FilaGacp>; expira: number } | null = null;
let cacheEstados: { porCve: Map<string, number>; expira: number } | null = null;
let cacheLocalidades: { porMunicipio: Map<string, LocalidadGacp[]>; expira: number } | null = null;
let enVuelo: Promise<{ municipios: Map<string, FilaGacp>; estados: Map<string, number>; localidades: Map<string, LocalidadGacp[]> }> | null = null;

async function fetchGacp(): Promise<{ municipios: Map<string, FilaGacp>; estados: Map<string, number>; localidades: Map<string, LocalidadGacp[]> }> {
  if (cacheMunicipios && cacheMunicipios.expira > Date.now() && cacheEstados && cacheLocalidades) {
    return { municipios: cacheMunicipios.porClave, estados: cacheEstados.porCve, localidades: cacheLocalidades.porMunicipio };
  }
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const res = await fetch(GACP_ZIP_URL);
    if (!res.ok) throw new Error(`CONEVAL GACP respondió ${res.status}`);
    const buffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const entrada = Object.values(zip.files).find((f) => !f.dir && /\.xlsx$/i.test(f.name));
    if (!entrada) throw new Error("ZIP de GACP sin archivo .xlsx");
    const xlsxBuf = await entrada.async("nodebuffer");
    const wb = XLSX.read(xlsxBuf, { type: "buffer" });

    // Hoja "Municipios" — encabezado real en la fila 3 (índice 2):
    // Clave entidad, Entidad, Clave municipal, Municipio, Población
    // 2020 (índice 4), Población con GACP bajo/muy bajo (índice 5),
    // Porcentaje (índice 6) — confirmado con descarga real, Ronda 9.
    // Numerador/denominador (índices 4/5) extraídos desde 2026-08-25
    // (antes solo se leía el % ya calculado) — necesarios para
    // reconstrucción ponderada real en territorio plural.
    const wsMun = wb.Sheets["Municipios"];
    const filasMun = XLSX.utils.sheet_to_json<unknown[]>(wsMun, { header: 1, defval: null });
    const municipios = new Map<string, FilaGacp>();
    for (let i = 4; i < filasMun.length; i++) {
      const fila = filasMun[i] as (string | number | null)[];
      const cveEnt = fila[0];
      const nombreEstado = fila[1];
      const cveMunTexto = fila[2];
      const poblacionTotal = fila[4];
      const poblacionGacpBajo = fila[5];
      const pct = fila[6];
      if (
        typeof cveEnt !== "string" || typeof cveMunTexto !== "string" ||
        typeof poblacionTotal !== "number" || typeof poblacionGacpBajo !== "number" ||
        typeof pct !== "number"
      ) continue;
      // BUG REAL encontrado y corregido en esta ronda: "Clave municipal"
      // en el XLSX de GACP YA es la clave completa de 5 dígitos
      // (ej. "01001"), no un sufijo de 3 dígitos a concatenar con
      // cveEnt — confirmado con la fila real de Aguascalientes
      // ('01','Aguascalientes','01001','Aguascalientes',...). Usarla
      // como sufijo duplicaba el prefijo de estado y nunca coincidía
      // con ninguna clave real al buscar.
      municipios.set(cveMunTexto, { cveEnt, nombreEstado: String(nombreEstado ?? ""), pctBajoAcceso: pct, poblacionTotal, poblacionGacpBajo });
    }

    // Hoja "Estados" — encabezado confirmado con descarga real (Ronda
    // 9): Clave entidad, Entidad, Población 2020, Población con GACP
    // bajo/muy bajo, Porcentaje... — el porcentaje es la columna 4
    // (0-based), NUNCA la 3 (esa es el conteo absoluto, magnitud
    // distinta).
    const wsEst = wb.Sheets["Estados"];
    const filasEst = XLSX.utils.sheet_to_json<unknown[]>(wsEst, { header: 1, defval: null });
    const estados = new Map<string, number>();
    for (let i = 4; i < filasEst.length; i++) {
      const fila = filasEst[i] as (string | number | null)[];
      const cveEnt = fila[0];
      const pct = fila[4];
      if (typeof cveEnt === "string" && typeof pct === "number") estados.set(cveEnt, pct);
    }

    // Hoja "Localidades" — encabezado confirmado con descarga real
    // (2026-08-24): Clave entidad, Entidad, Clave municipal, Municipio,
    // Clave localidad, Localidad, Población 2020, Disponibilidad de
    // transporte..., Tiempo a centro de servicios..., Distancia a
    // carretera pavimentada..., Grado de accesibilidad (índice 10).
    const wsLoc = wb.Sheets["Localidades"];
    const filasLoc = XLSX.utils.sheet_to_json<unknown[]>(wsLoc, { header: 1, defval: null });
    const localidades = new Map<string, LocalidadGacp[]>();
    for (let i = 4; i < filasLoc.length; i++) {
      const fila = filasLoc[i] as (string | number | null)[];
      const cveMunTexto = fila[2];
      const nombreLoc = fila[5];
      const poblacion = fila[6];
      const grado = fila[10];
      if (typeof cveMunTexto !== "string" || typeof nombreLoc !== "string" || typeof poblacion !== "number" || typeof grado !== "string") continue;
      const gradoNorm = grado.trim();
      if (gradoNorm !== "Bajo" && gradoNorm !== "Muy bajo") continue;
      if (!localidades.has(cveMunTexto)) localidades.set(cveMunTexto, []);
      localidades.get(cveMunTexto)!.push({ nombre: nombreLoc, poblacion, grado: gradoNorm });
    }

    return { municipios, estados, localidades };
  })();
  try {
    const { municipios, estados, localidades } = await enVuelo;
    cacheMunicipios = { porClave: municipios, expira: Date.now() + CACHE_TTL_MS };
    cacheEstados = { porCve: estados, expira: Date.now() + CACHE_TTL_MS };
    cacheLocalidades = { porMunicipio: localidades, expira: Date.now() + CACHE_TTL_MS };
    return { municipios, estados, localidades };
  } finally {
    enVuelo = null;
  }
}

export async function resolverGacp(territorio: Territorio): Promise<CeldaFontana[]> {
  if (!territorio.estado) return [];
  const cve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!cve) return [{ nivel: "estatal", motivo: "Estado no reconocido para CONEVAL GACP" }];

  let datos: { municipios: Map<string, FilaGacp>; estados: Map<string, number> };
  try {
    datos = await fetchGacp();
  } catch {
    return [{ nivel: "estatal", motivo: "Error de conexión con CONEVAL" }];
  }

  const celdas: CeldaFontana[] = [];
  const pctEstatal = datos.estados.get(cve);
  celdas.push(
    pctEstatal !== undefined
      ? {
          nivel: "estatal",
          valor: pctEstatal,
          unidad: "% población con accesibilidad carretera baja o muy baja",
          naturaleza: "dato_directo",
          fuenteEtiqueta: "CONEVAL, Grado de Accesibilidad a Carretera Pavimentada (GACP) 2020",
        }
      : { nivel: "estatal", motivo: "Sin dato de CONEVAL GACP para este estado" }
  );

  if (territorio.municipio) {
    // BUG REAL encontrado y corregido (2026-08-24, durante el diseño de
    // Modo B) — este archivo NUNCA se migró al fix del Incidente 1: usaba
    // resolveMunicipioCve() (numeración Sefix/INE, no confiable, ver
    // docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md)
    // para construir la clave de 5 dígitos contra el mapa de GACP (que
    // usa el CVE_MUN OFICIAL de INEGI) — vivo en producción desde que se
    // implementó Familia 5. Confirmado con evidencia real: Guadalajara
    // mostraba 6.300676% en vez del valor real 0.000577% (el mismo tipo
    // exacto de "valor de otro municipio" del Incidente 1). Fix: usa
    // resolverCveOficialMunicipio() (anvcc.ts) — ya trae el CVE oficial
    // INEGI resuelto por NOMBRE (mismo criterio del Incidente 2), no el
    // de Sefix/INE.
    const municipioCveCompleto = await resolverCveOficialMunicipio(cve, territorio.municipio);
    const filaMun = municipioCveCompleto ? datos.municipios.get(municipioCveCompleto) : undefined;
    celdas.push(
      filaMun
        ? {
            nivel: "municipal",
            valor: filaMun.pctBajoAcceso,
            unidad: "% población con accesibilidad carretera baja o muy baja",
            naturaleza: "dato_directo",
            fuenteEtiqueta: "CONEVAL, Grado de Accesibilidad a Carretera Pavimentada (GACP) 2020",
          }
        : { nivel: "municipal", motivo: "Sin dato de CONEVAL GACP para este municipio" }
    );
  }

  return celdas;
}

// Modo B (2026-08-24) — detalle paginado de localidades en
// accesibilidad Bajo/Muy bajo para el modal "Ver detalle". Paginación
// SIEMPRE del lado del servidor (mismo criterio que
// resolverDetalleGiros en denue.ts) — el caso nacional real más grande
// (Guadalupe y Calvo, Chihuahua) tiene 1,039 localidades en este rango,
// nunca se manda la lista completa al cliente.
export const PAGE_SIZE_LOCALIDADES = 15;

export interface LocalidadDetalle {
  nombre: string;
  poblacion: number;
  grado: string;
}

export interface DetalleLocalidadesResultado {
  items: LocalidadDetalle[];
  total: number;
  offset: number;
  hasMore: boolean;
}

export async function resolverDetalleLocalidades(
  territorio: Territorio,
  offset: number = 0,
  limit: number = PAGE_SIZE_LOCALIDADES
): Promise<DetalleLocalidadesResultado> {
  if (!territorio.estado || !territorio.municipio) {
    return { items: [], total: 0, offset, hasMore: false };
  }
  const cve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!cve) return { items: [], total: 0, offset, hasMore: false };

  let datos: { localidades: Map<string, LocalidadGacp[]> };
  try {
    datos = await fetchGacp();
  } catch {
    return { items: [], total: 0, offset, hasMore: false };
  }

  const municipioCveCompleto = await resolverCveOficialMunicipio(cve, territorio.municipio);
  const lista = municipioCveCompleto ? datos.localidades.get(municipioCveCompleto) : undefined;
  if (!lista) return { items: [], total: 0, offset, hasMore: false };

  // Orden: descendente por Población 2020 (localidades más grandes
  // primero — más relevantes para un consultor político), empate
  // alfabético — confirmado con Raúl.
  const ordenadas = [...lista].sort((a, b) => b.poblacion - a.poblacion || a.nombre.localeCompare(b.nombre));
  const pagina = ordenadas.slice(offset, offset + limit);
  return {
    items: pagina.map(({ nombre, poblacion, grado }) => ({ nombre, poblacion, grado })),
    total: ordenadas.length,
    offset,
    hasMore: offset + limit < ordenadas.length,
  };
}

// Capa 2 (2026-08-25) — F5-8 estaba clasificado `no_agregable` en el
// registry con una nota mal copiada de F5-7 ("designación geográfica");
// F5-8 es un % real (magnitud numérica), corregido a `tasa_ponderada`.
// 2 piezas con roles distintos, mismo criterio "nunca promediar % ya
// calculados" de todo el proyecto:
//
// 1) resolverNumeradorDenominadorGacp — numerador/denominador crudos por
//    municipio, consumidos por la rama nueva de calcularTasaPonderada()
//    (index.ts) para el VALOR COMBINADO real (Σnumerador/Σdenominador).
// 2) resolverMunicipiosEstadoGacp — el % individual ya calculado por
//    municipio (mismo patrón que los resolvers de anvcc.ts), consumido
//    por resolverDesgloseMunicipiosEstado() (index.ts) para el listado
//    "Ver valores por unidad" — independiente del mecanismo de
//    agregación del valor combinado.
export async function resolverNumeradorDenominadorGacp(
  estadoCve: string,
  soloCves?: string[]
): Promise<Map<string, { numerador: number; denominador: number }>> {
  const opciones = await getMunicipiosOptions(estadoCve);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  const resultado = new Map<string, { numerador: number; denominador: number }>();
  let datos: { municipios: Map<string, FilaGacp> };
  try {
    datos = await fetchGacp();
  } catch {
    return resultado;
  }

  for (const { cve, nombre } of opcionesFiltradas) {
    const cveOficial = await resolverCveOficialMunicipio(estadoCve, nombre);
    const fila = cveOficial ? datos.municipios.get(cveOficial) : undefined;
    if (fila) resultado.set(cve, { numerador: fila.poblacionGacpBajo, denominador: fila.poblacionTotal });
  }
  return resultado;
}

export async function resolverMunicipiosEstadoGacp(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const opciones = await getMunicipiosOptions(estadoCve);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  let datos: { municipios: Map<string, FilaGacp> };
  try {
    datos = await fetchGacp();
  } catch {
    return opcionesFiltradas.map(({ cve, nombre }) => ({
      cve, nombre, celda: { nivel: "municipal", motivo: "Error de conexión con CONEVAL" },
    }));
  }

  return Promise.all(opcionesFiltradas.map(async ({ cve, nombre }): Promise<ElementoDeEstado> => {
    const cveOficial = await resolverCveOficialMunicipio(estadoCve, nombre);
    const fila = cveOficial ? datos.municipios.get(cveOficial) : undefined;
    return {
      cve,
      nombre,
      celda: fila
        ? { nivel: "municipal", valor: fila.pctBajoAcceso, unidad: "% población con accesibilidad carretera baja o muy baja", naturaleza: "dato_directo", fuenteEtiqueta: "CONEVAL, Grado de Accesibilidad a Carretera Pavimentada (GACP) 2020" }
        : { nivel: "municipal", motivo: "Sin dato de CONEVAL GACP para este municipio" },
    };
  }));
}
