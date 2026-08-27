// lib/fontana/ingesta/sesnsp.ts
// F3-1 (Tasa de homicidios dolosos) y F3-2 (Incidencia delictiva) —
// SESNSP (RNID), dataset "Incidencia delictiva" (datos.gob.mx, package
// "incidencia_delictiva").
//
// Verificado en vivo 2026-08-26: el catálogo original documentaba una URL
// de SharePoint inestable ("re-resolver la URL en cada corrida") — el
// mecanismo real disponible hoy es mucho más simple: resource municipal
// con `datastore_active: true` (resource_id
// "57fbd692-3e5c-4b1b-8621-694cb3a33035", dataset "Incidencia delictiva
// municipal"), consultable por filtros exactos vía CKAN
// (`datastore_search?filters=...`) — no hace falta descargar el CSV
// completo (>10MB) ni resolver ninguna URL cambiante. Campos reales:
// `Entidad`, `Municipio` (nombre, no solo clave — join por NOMBRE, mismo
// protocolo por defecto del proyecto), `Cve. Municipio` (CVE_MUN OFICIAL
// INEGI de 5 dígitos — confirmado Guadalajara→14039, coincide con el
// CVE_MUN oficial real ya documentado en
// docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md, pero
// NO se usa ese campo para el join — se mantiene el protocolo por defecto
// de join-por-nombre), `Subtipo de delito`, `Modalidad`, `Ano`, y 12
// columnas mensuales (`Enero`...`Diciembre`) con CONTEOS ABSOLUTOS
// (carpetas de investigación) — NUNCA tasas ya calculadas.
//
// F3-1 filtra `Subtipo de delito = "Homicidio doloso"` y suma las 12
// columnas mensuales de TODAS las modalidades (arma de fuego/blanca/otro
// elemento/no especificado) del año de referencia — luego divide entre
// población municipal/estatal del MISMO año calendario (nunca un año
// distinto, decisión explícita de Raúl 2026-08-26) usando
// resolverPoblacionMunicipal/resolverPoblacionEstatal
// (lib/fontana/ingesta/conapo.ts, misma fuente CONAPO ya integrada en el
// proyecto — NUNCA la población censal ECEG/ITER 2020 de Familia 1, que
// desalinearía el año del numerador y el denominador). Confirmado con
// datos reales: Guadalajara 2025 = 149 carpetas de homicidio doloso,
// población municipal 2025 (CONAPO) = 1,383,955 → tasa 10.77 por cada
// 100,000 habitantes.
//
// F3-2 suma TODAS las filas (todos los delitos/modalidades) del
// municipio/año, sin filtrar por subtipo ni dividir entre población — es
// un CONTEO, no una tasa (decisión explícita de Raúl: F3-2 queda como
// `agregacionPlural.tipo: "aditivo"`, F3-1 como `"tasa_ponderada"`).
//
// Nivel Distrital: sin mecanismo (SESNSP no publica por distrito
// electoral) — motivo explícito, igual que el resto de fuentes sin ese
// nivel.
//
// FIX DE FONDO (2026-08-27, hallazgo real de Raúl — Cuernavaca/Morelos
// F3-2 mostraba Municipal > Estatal, matemáticamente imposible):
// `ckanBuscarCarpetas` pedía `limit=500` una sola vez, SIN paginar.
// Confirmado en vivo: Morelos 2025 (Estatal, todos los delitos) tiene
// 3,528 filas reales — se perdían 3,028, el total quedaba en 1,857 en vez
// de 45,451 real. Oaxaca 2025 (Homicidio doloso, para F3-1 Estatal)
// también excede el límite: 2,284 filas. Nivel Municipal confirmado
// SEGURO por diseño (no por suerte): la taxonomía de delito/modalidad es
// FIJA (98 filas exactas, verificado con Iztapalapa/Ecatepec de Morelos/
// León — municipios grandes y chicos por igual), nunca escala con el
// tamaño del municipio — aun así se pagina igual, por consistencia y para
// no depender de que ese número se mantenga fijo para siempre. Fix: mismo
// patrón `paginarCompleto` de bienestar.ts (offset hasta agotar `total`).
//
// FIX DE FONDO 2 (2026-08-27, riesgo detectado por Raúl) — el filtro
// `Entidad` de SESNSP es comparación EXACTA de string (confirmado en
// vivo: "Mexico" sin acento → 0 filas; "México" con acento → 12,250).
// Usar `territorio.estado` tal cual como filtro era frágil: además del
// acento, SESNSP usa el nombre HISTÓRICO completo para 3 entidades
// ("Coahuila de Zaragoza", "Michoacán de Ocampo", "Veracruz de Ignacio de
// la Llave") — ninguno coincide con el nombre corto que usa el resto de
// la app. Se traduce por CVE_ENT (ya resuelto vía ESTADO_CVE_MAP) contra
// `SESNSP_NOMBRE_POR_CVE`, verificado en vivo contra las 32 entidades
// reales del dataset — nunca se vuelve a pasar `territorio.estado` crudo
// al filtro `Entidad`.

import https from "https";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, getMunicipiosOptions, claveCanonicaMunicipio } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import { resolverPoblacionEstatal, resolverPoblacionMunicipal } from "@/lib/fontana/ingesta/conapo";
import { resolverCveOficialMunicipio } from "@/lib/fontana/ingesta/anvcc";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_SESNSP_TASA = "SESNSP (RNID, Incidencia delictiva municipal, datos.gob.mx)";
export const FUENTE_ETIQUETA_SESNSP_CONTEO = "SESNSP (RNID, Incidencia delictiva municipal, datos.gob.mx)";

const CKAN_BASE = "https://www.datos.gob.mx/api/3/action/datastore_search";
const RESOURCE_MUNICIPAL = "57fbd692-3e5c-4b1b-8621-694cb3a33035";
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"] as const;
const PAGE_SIZE = 1000; // tamaño de página, no un límite — se pagina con offset hasta agotar `total`.

// Nombre EXACTO tal como lo publica SESNSP por CVE_ENT (numeración
// oficial INEGI, coincide con ESTADO_CVE_MAP) — verificado en vivo
// 2026-08-27 consultando las 32 entidades reales del dataset
// (`datastore_search?filters={"Clave_Ent":"NN"}`). 3 nombres NO coinciden
// con el nombre corto que usa el resto de la app (Coahuila, Michoacán,
// Veracruz) — de ahí la necesidad de esta tabla en vez de pasar
// `territorio.estado` crudo.
const SESNSP_NOMBRE_POR_CVE: Record<string, string> = {
  "01": "Aguascalientes", "02": "Baja California", "03": "Baja California Sur",
  "04": "Campeche", "05": "Coahuila de Zaragoza", "06": "Colima", "07": "Chiapas",
  "08": "Chihuahua", "09": "Ciudad de México", "10": "Durango", "11": "Guanajuato",
  "12": "Guerrero", "13": "Hidalgo", "14": "Jalisco", "15": "México",
  "16": "Michoacán de Ocampo", "17": "Morelos", "18": "Nayarit", "19": "Nuevo León",
  "20": "Oaxaca", "21": "Puebla", "22": "Querétaro", "23": "Quintana Roo",
  "24": "San Luis Potosí", "25": "Sinaloa", "26": "Sonora", "27": "Tabasco",
  "28": "Tamaulipas", "29": "Tlaxcala", "30": "Veracruz de Ignacio de la Llave",
  "31": "Yucatán", "32": "Zacatecas",
};

interface RegistroSesnsp {
  Entidad?: string;
  Municipio?: string;
  [mes: string]: unknown;
}

function anioReferencia(): string {
  return String(new Date().getFullYear() - 1);
}

// Mismo hallazgo TLS de conapo.ts/bienestar.ts/stpsHuelgas.ts/shcpGasto.ts.
function ckanBuscarCarpetasPagina(filters: Record<string, string>, offset: number): Promise<{ records: RegistroSesnsp[]; total: number }> {
  const url = `${CKAN_BASE}?resource_id=${RESOURCE_MUNICIPAL}&limit=${PAGE_SIZE}&offset=${offset}&filters=${encodeURIComponent(JSON.stringify(filters))}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false, timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`CKAN HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          const data = JSON.parse(body) as { success: boolean; result?: { records: RegistroSesnsp[]; total: number } };
          if (!data.success || !data.result) {
            reject(new Error("CKAN respondió success:false"));
            return;
          }
          resolve({ records: data.result.records, total: data.result.total });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("CKAN timeout")));
  });
}

// Pagina hasta agotar `total` — FIX DE FONDO (ver comentario de cabecera):
// un `limit` único sin paginar subestimaba silenciosamente cualquier
// consulta con más filas que el límite (Estatal, casi siempre; Municipal,
// nunca en la práctica, pero se pagina igual por consistencia).
async function ckanBuscarCarpetas(filters: Record<string, string>): Promise<RegistroSesnsp[]> {
  const primera = await ckanBuscarCarpetasPagina(filters, 0);
  const todos = [...primera.records];
  let offset = PAGE_SIZE;
  while (offset < primera.total) {
    const pagina = await ckanBuscarCarpetasPagina(filters, offset);
    todos.push(...pagina.records);
    offset += PAGE_SIZE;
  }
  return todos;
}

function sumarCarpetas(registros: RegistroSesnsp[]): number {
  let total = 0;
  for (const r of registros) {
    for (const mes of MESES) {
      const v = r[mes];
      const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
      if (!Number.isNaN(n)) total += n;
    }
  }
  return total;
}

async function carpetasMunicipio(estadoCve: string, municipioNombre: string, anio: string, subtipo?: string): Promise<number> {
  const filters: Record<string, string> = { Entidad: SESNSP_NOMBRE_POR_CVE[estadoCve], Municipio: municipioNombre, Ano: anio };
  if (subtipo) filters["Subtipo de delito"] = subtipo;
  const registros = await ckanBuscarCarpetas(filters);
  return sumarCarpetas(registros);
}

async function carpetasEstado(estadoCve: string, anio: string, subtipo?: string): Promise<number> {
  const filters: Record<string, string> = { Entidad: SESNSP_NOMBRE_POR_CVE[estadoCve], Ano: anio };
  if (subtipo) filters["Subtipo de delito"] = subtipo;
  const registros = await ckanBuscarCarpetas(filters);
  return sumarCarpetas(registros);
}

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

// Genérico para F3-1 (subtipo="Homicidio doloso", tasa por 100k) y F3-2
// (sin subtipo, conteo total) — mismo mecanismo de consulta, distinta
// forma de mostrar el resultado (tasa_ponderada vs. aditivo, ya
// clasificado así en el registry).
async function resolverSesnspGenerico(
  territorio: Territorio,
  opts: { subtipo?: string; comoTasa: boolean }
): Promise<CeldaFontana[]> {
  const anio = anioReferencia();
  const distrital: CeldaFontana = { nivel: "distrital", motivo: "SESNSP no publica incidencia delictiva por distrito electoral" };

  if (!territorio.estado) {
    const motivo = "El proyecto no tiene un estado definido en su territorio";
    return [{ nivel: "nacional", motivo: "SESNSP no publica un total nacional agregado en este dataset — solo por entidad/municipio" }, { nivel: "estatal", motivo }, distrital, { nivel: "municipal", motivo }];
  }
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [{ nivel: "nacional", motivo: "SESNSP no publica un total nacional agregado en este dataset — solo por entidad/municipio" }, { nivel: "estatal", motivo }, distrital, { nivel: "municipal", motivo }];
  }

  let estatal: CeldaFontana;
  try {
    const carpetas = await carpetasEstado(estadoCve, anio, opts.subtipo);
    if (opts.comoTasa) {
      const poblacion = await resolverPoblacionEstatal(estadoCve, anio);
      estatal = poblacion
        ? { nivel: "estatal", valor: Math.round((carpetas / poblacion) * 100000 * 100) / 100, unidad: "por cada 100,000 habitantes", naturaleza: "calculo_directo", fuenteEtiqueta: FUENTE_ETIQUETA_SESNSP_TASA }
        : { nivel: "estatal", motivo: "No se pudo obtener la población de este estado (CONAPO) para calcular la tasa" };
    } else {
      estatal = { nivel: "estatal", valor: carpetas, unidad: "carpetas de investigación", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_SESNSP_CONTEO };
    }
  } catch {
    estatal = { nivel: "estatal", motivo: "Error de conexión con SESNSP (datos.gob.mx)" };
  }

  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    try {
      // Join por nombre — SESNSP publica el nombre del municipio
      // directamente, se usa tal cual (no se traduce por CVE de ningún
      // catálogo externo) para la consulta de carpetas. Para el
      // denominador de población de CONAPO sí se necesita el CVE_MUN
      // OFICIAL (formato CONAPO: CLAVE_ENT sin padding + MUN con padding
      // de 3) — se resuelve con resolverCveOficialMunicipio()
      // (lib/fontana/ingesta/anvcc.ts), mismo mecanismo nombre→CVE oficial
      // ya establecido en el proyecto para este tipo de traducción
      // (patrón sun.ts/gacp.ts) — NUNCA resolveMunicipioCve()
      // (numeración INE, incompatible con CVE_MUN oficial, ver
      // docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md).
      const carpetas = await carpetasMunicipio(estadoCve, municipioNombre, anio, opts.subtipo);
      if (opts.comoTasa) {
        const cveOficial = await resolverCveOficialMunicipio(estadoCve, municipioNombre);
        const municipioCve = cveOficial ? cveOficial.slice(-3) : null;
        const poblacion = municipioCve ? await resolverPoblacionMunicipal(estadoCve, municipioCve, anio) : null;
        municipal = poblacion
          ? { nivel: "municipal", valor: Math.round((carpetas / poblacion) * 100000 * 100) / 100, unidad: "por cada 100,000 habitantes", naturaleza: "calculo_directo", fuenteEtiqueta: FUENTE_ETIQUETA_SESNSP_TASA }
          : { nivel: "municipal", motivo: "No se pudo obtener la población de este municipio (CONAPO) para calcular la tasa" };
      } else {
        municipal = { nivel: "municipal", valor: carpetas, unidad: "carpetas de investigación", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_SESNSP_CONTEO };
      }
    } catch {
      municipal = { nivel: "municipal", motivo: "Error de conexión con SESNSP (datos.gob.mx)" };
    }
  }

  return [
    { nivel: "nacional", motivo: "SESNSP no publica un total nacional agregado en este dataset — solo por entidad/municipio" },
    estatal,
    distrital,
    municipal,
  ];
}

export async function resolverTasaHomicidiosDolosos(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverSesnspGenerico(territorio, { subtipo: "Homicidio doloso", comoTasa: true });
}

export async function resolverIncidenciaDelictiva(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverSesnspGenerico(territorio, { comoTasa: false });
}

// --- Agregación plural (2026-08-27, Gap B — Familia 3 Bloque 1) ---
//
// FIX DE FONDO (2026-08-27, hallazgo real de Raúl — ZMG mostraba 0 en las
// 8 unidades de F3-1/F3-2, incluyendo Guadalajara con 149 carpetas ya
// verificadas): la primera versión de estos 3 resolvers pasaba el campo
// `nombre` de `getMunicipiosOptions()` DIRECTO al filtro `Municipio` de
// SESNSP — pero ese campo es `normalizeGeoName(NOMGEO)`
// (lib/geo/municipios.ts:235), es decir MAYÚSCULAS SIN ACENTOS por
// diseño (una clave de comparación interna, nunca pensada para un filtro
// exacto externo). Confirmado en vivo: `Municipio: "GUADALAJARA"` → 0
// filas; `Municipio: "Guadalajara"` → 4. Mismo con `"TONALA"` (0) vs.
// `"Tonalá"` (4) — el filtro de SESNSP es exacto en mayúsculas Y acento,
// igual que ya se documentó para `Entidad` arriba.
//
// Fix (mismo patrón que bienestar.ts): UNA sola consulta paginada por
// Entidad+Año(+subtipo) para TODO el estado — usa el nombre REAL que
// SESNSP publica en cada fila (`r.Municipio`, nunca reconstruido) y
// agrega por `claveCanonicaMunicipio(estadoCve, r.Municipio)`. El cruce
// contra `getMunicipiosOptions()` para saber qué municipios mostrar SÍ es
// seguro (su `nombre` ya normalizado es la llave de comparación
// diseñada para eso, mismo criterio ya usado en zap.ts/ensu.ts) — el
// error nunca estuvo en usar `getMunicipiosOptions`, sino en pasar su
// salida a un filtro externo en vez de a otra normalización.
async function carpetasPorMunicipioEstado(estadoCve: string, anio: string, subtipo?: string): Promise<Map<string, number>> {
  const filters: Record<string, string> = { Entidad: SESNSP_NOMBRE_POR_CVE[estadoCve], Ano: anio };
  if (subtipo) filters["Subtipo de delito"] = subtipo;
  const registros = await ckanBuscarCarpetas(filters);
  const mapa = new Map<string, number>();
  for (const r of registros) {
    if (!r.Municipio) continue;
    const clave = claveCanonicaMunicipio(estadoCve, r.Municipio);
    let suma = 0;
    for (const mes of MESES) {
      const v = r[mes];
      const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
      if (!Number.isNaN(n)) suma += n;
    }
    mapa.set(clave, (mapa.get(clave) ?? 0) + suma);
  }
  return mapa;
}

// Conteo (F3-2, "Ver municipios"/desglose plural) — celda ya lista para
// mostrar (dato_directo), válida también para sumar directo
// (calcularAditivo).
export async function resolverMunicipiosEstadoIncidencia(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const anio = anioReferencia();
  try {
    const [mapa, opciones] = await Promise.all([carpetasPorMunicipioEstado(estadoCve, anio), getMunicipiosOptions(estadoCve)]);
    const filtradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;
    return filtradas.map(({ cve, nombre }): ElementoDeEstado => {
      const carpetas = mapa.get(claveCanonicaMunicipio(estadoCve, nombre)) ?? 0;
      return { cve, nombre, celda: { nivel: "municipal", valor: carpetas, unidad: "carpetas de investigación", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_SESNSP_CONTEO } };
    });
  } catch {
    const opciones = await getMunicipiosOptions(estadoCve).catch(() => []);
    const filtradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;
    return filtradas.map(({ cve, nombre }): ElementoDeEstado => ({ cve, nombre, celda: { nivel: "municipal", motivo: "Error de conexión con SESNSP (datos.gob.mx)" } }));
  }
}

// Tasa (F3-1, "Ver municipios"/desglose plural) — celda YA dividida, para
// mostrar el valor de cada municipio individualmente. NUNCA usar esta
// función para calcular el valor COMBINADO de un conjunto plural (sumar/
// promediar tasas ya calculadas está prohibido en todo el proyecto) — ver
// resolverNumeradorDenominadorHomicidios abajo, que calcularTasaPonderada
// sí usa para eso.
export async function resolverMunicipiosEstadoHomicidios(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const anio = anioReferencia();
  let mapa: Map<string, number>;
  let opciones: Awaited<ReturnType<typeof getMunicipiosOptions>>;
  try {
    [mapa, opciones] = await Promise.all([carpetasPorMunicipioEstado(estadoCve, anio, "Homicidio doloso"), getMunicipiosOptions(estadoCve)]);
  } catch {
    opciones = await getMunicipiosOptions(estadoCve).catch(() => []);
    const filtradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;
    return filtradas.map(({ cve, nombre }): ElementoDeEstado => ({ cve, nombre, celda: { nivel: "municipal", motivo: "Error de conexión con SESNSP (datos.gob.mx)" } }));
  }
  const filtradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;
  return Promise.all(
    filtradas.map(async ({ cve, nombre }): Promise<ElementoDeEstado> => {
      const carpetas = mapa.get(claveCanonicaMunicipio(estadoCve, nombre)) ?? 0;
      const cveOficial = await resolverCveOficialMunicipio(estadoCve, nombre);
      const municipioCveOficial = cveOficial ? cveOficial.slice(-3) : null;
      const poblacion = municipioCveOficial ? await resolverPoblacionMunicipal(estadoCve, municipioCveOficial, anio) : null;
      if (!poblacion) return { cve, nombre, celda: { nivel: "municipal", motivo: "No se pudo obtener la población de este municipio (CONAPO) para calcular la tasa" } };
      return {
        cve, nombre,
        celda: { nivel: "municipal", valor: Math.round((carpetas / poblacion) * 100000 * 100) / 100, unidad: "por cada 100,000 habitantes", naturaleza: "calculo_directo", fuenteEtiqueta: FUENTE_ETIQUETA_SESNSP_TASA },
      };
    })
  );
}

// Numerador (carpetas de homicidio doloso) / denominador (población
// CONAPO) SIN dividir — para calcularTasaPonderada (index.ts), que suma
// ambos por separado entre todos los municipios del conjunto plural y
// divide UNA sola vez al final. Mismo campo `personas`/`poblacion` que ya
// usa `resolverNumeradorDenominadorMunicipios` (coneval.ts) para poder
// reutilizar el mismo reductor genérico en calcularTasaPonderada.
export async function resolverNumeradorDenominadorHomicidios(estadoCve: string, cves: string[]): Promise<Map<string, { personas: number; poblacion: number }>> {
  const anio = anioReferencia();
  const resultado = new Map<string, { personas: number; poblacion: number }>();
  let mapa: Map<string, number>;
  let opciones: Awaited<ReturnType<typeof getMunicipiosOptions>>;
  try {
    [mapa, opciones] = await Promise.all([carpetasPorMunicipioEstado(estadoCve, anio, "Homicidio doloso"), getMunicipiosOptions(estadoCve)]);
  } catch {
    return resultado;
  }
  const filtradas = opciones.filter((o) => cves.includes(o.cve));
  await Promise.all(
    filtradas.map(async ({ cve, nombre }) => {
      try {
        const carpetas = mapa.get(claveCanonicaMunicipio(estadoCve, nombre)) ?? 0;
        const cveOficial = await resolverCveOficialMunicipio(estadoCve, nombre);
        const municipioCveOficial = cveOficial ? cveOficial.slice(-3) : null;
        const poblacion = municipioCveOficial ? await resolverPoblacionMunicipal(estadoCve, municipioCveOficial, anio) : null;
        if (poblacion) resultado.set(cve, { personas: carpetas, poblacion });
      } catch {
        // Municipio omitido del numerador/denominador combinado — mismo
        // criterio que el resto de fuentes: mejor excluir un municipio con
        // error que fabricar un cero silencioso que distorsione la tasa.
      }
    })
  );
  return resultado;
}
