// lib/fontana/ingesta/stpsSalario.ts
// Adaptador de F2-10 (Salario real medio, aproximado vía IMSS) — STPS
// (Secretaría del Trabajo y Previsión Social), sistema SIEL, cubo
// "Salario_diario_Respecto_a_Trabajadores_Asegurados" (IBM Cognos).
//
// Verificado EN VIVO 2026-08-10:
//   http://siel.stps.gob.mx:303/ibmcognos/cgi-bin/cognos.cgi?...
//   (URL completa en la constante de abajo) — HTTP 200, ~768 KB de
//   HTML del visor de Cognos, sin autenticación. Los valores vienen
//   embebidos en un bloque JSON dentro del HTML
//   (`"u":"665.878264403172","m":2,"h":3,"d":4,"r":85`), no hay
//   exportación CSV/Excel directa (`run.outputFormat=CSV`/
//   `spreadsheetML` devuelven una página intermedia que dispara la
//   descarga real vía JavaScript, no fetcheable con un GET simple).
//
//   Orden de valores CONFIRMADO con el HTML crudo (no asumido): tras
//   el primer bloque de 33 valores que sigue al marcador `"u":"Promedio"`
//   (siguen más bloques de 33/12 que son desgloses mensuales — se
//   ignoran, se usa solo el bloque "Promedio"), la posición 0 es el
//   total Nacional (mal etiquetado "Entidad Federativa" en el propio
//   export de Cognos — confirmado con `"10":{"r":"Entidad
//   Federativa","level":0}` vs. `"14":{"r":"AGUASCALIENTES-1","level":1}`
//   en el HTML: nivel 0 = agregado de toda la dimensión), posiciones
//   1-32 = Aguascalientes→Zacatecas en el mismo orden que
//   ESTADO_CVE_MAP (01-32) — mapeo posicional directo, sin riesgo de
//   numeración cruzada (no hay CVE de municipio de por medio, solo
//   entidad).
//
// naturaleza: dato_directo — STPS publica el promedio ya calculado
// (agregación OLAP "Promedio" sobre el cubo), sin coeficiente de
// variación ni error estándar acompañándolo.
//
// ⚠️ Proxy de cobertura (aprobado 2026-08-10, mismo criterio que
// F2-13): esta cifra es el Salario Base de Cotización promedio de
// trabajadores FORMALMENTE ASEGURADOS ante el IMSS — no de la
// población ocupada total que mide ENOE (incluye informalidad). Se
// documenta aquí y en el registro, no en `naturaleza`.
//
// ⚠️ Riesgo de fuente: URL http:// (no https), puerto no estándar
// (303), parámetro `ui.object` codificado apuntando a una ruta
// específica del catálogo de reportes de STPS — puede romperse sin
// aviso si STPS reorganiza sus reportes.
//
// Solo Nacional + Estatal (confirmado en la respuesta) — sin
// municipal, STPS no publica este cubo a ese nivel.

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_STPS_SALARIO = "STPS/SIEL (Salario Base de Cotización IMSS, promedio)";

// ⚠️ Codificación literal obligatoria — Cognos usa `*XX` en vez de
// percent-encoding estándar para estos parámetros. Verificado en vivo:
// re-codificar esta URL con `%2f`/`%5b`/etc. (equivalente estándar)
// dispara el firewall de Cognos (`DPR-ERR-2079 Firewall Security
// Rejection / CAF_VALIDATION_FAILURE`) — la URL debe copiarse tal cual,
// nunca pasarla por encodeURIComponent ni normalizarla.
const URL_STPS_SALARIO =
  "http://siel.stps.gob.mx:303/ibmcognos/cgi-bin/cognos.cgi?b_action=cognosViewer&ui.action=run&ui.object=XSSSTART*2fcontent*2ffolder*5b*40name*3d*27Sitio*20STPS*27*5d*2ffolder*5b*40name*3d*272.*20Salarios*27*5d*2ffolder*5b*40name*3d*27Salario*20asociado*20a*20trabajadores*27*5d*2freport*5b*40name*3d*27Salario*20por*20Entidad*20Federativa*27*5dXSSEND&ui.name=XSSSTARTSalario*20por*20Entidad*20FederativaXSSEND&run.outputFormat=&run.prompt=true";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CLAVE_NACIONAL = "NACIONAL";
// Firma exacta del valor dentro del bloque "Promedio" del cubo — ver
// nota de cabecera. Distingue estos 33 valores de los bloques
// mensuales que le siguen en el mismo documento.
const REGEX_VALOR = /"u":"([\d.]+)","m":2,"h":3,"d":4,"r":85/g;

interface CacheStpsSalario {
  porTerritorio: Map<string, number>; // estadoCve | "NACIONAL" -> pesos/día
  ts: number;
}

let cache: CacheStpsSalario | null = null;
let enVuelo: Promise<CacheStpsSalario> | null = null;

async function descargarYParsearStps(): Promise<CacheStpsSalario> {
  const res = await fetch(URL_STPS_SALARIO);
  if (!res.ok) throw new Error(`STPS HTTP ${res.status} en ${URL_STPS_SALARIO}`);
  const html = await res.text();

  const anclaIdx = html.indexOf('"u":"Promedio"');
  if (anclaIdx === -1) {
    throw new Error('STPS: no se encontró el marcador "Promedio" en la respuesta — ¿cambió el formato del visor?');
  }
  const resto = html.slice(anclaIdx);

  const valores: number[] = [];
  for (const m of resto.matchAll(REGEX_VALOR)) {
    valores.push(Number(m[1]));
    if (valores.length === 33) break; // Nacional + 32 estados, resto son desgloses mensuales
  }
  if (valores.length !== 33) {
    throw new Error(`STPS: se esperaban 33 valores (Nacional + 32 estados), se obtuvieron ${valores.length}`);
  }

  const porTerritorio = new Map<string, number>();
  porTerritorio.set(CLAVE_NACIONAL, valores[0]);
  for (let i = 1; i <= 32; i++) {
    porTerritorio.set(String(i).padStart(2, "0"), valores[i]);
  }

  return { porTerritorio, ts: Date.now() };
}

async function cargarStpsSalario(): Promise<CacheStpsSalario> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache;
  if (enVuelo) return enVuelo;

  enVuelo = descargarYParsearStps();
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

function celdaDesdeValor(nivel: "nacional" | "estatal", valor: number | undefined, motivoVacio: string): CeldaFontana {
  if (valor == null) return { nivel, motivo: motivoVacio };
  return {
    nivel,
    valor: Math.round(valor * 100) / 100,
    unidad: "pesos/día (Salario Base de Cotización IMSS, promedio)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_STPS_SALARIO,
  };
}

export async function resolverSalarioImss(territorio: Territorio): Promise<CeldaFontana[]> {
  let datos: CacheStpsSalario;
  try {
    datos = await cargarStpsSalario();
  } catch {
    const motivo = "Error de conexión con STPS/SIEL";
    return [{ nivel: "nacional", motivo }, { nivel: "estatal", motivo }];
  }

  const nacional = celdaDesdeValor("nacional", datos.porTerritorio.get(CLAVE_NACIONAL), "STPS no reportó el valor nacional");

  if (!territorio.estado) {
    return [nacional, { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" }];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    return [nacional, { nivel: "estatal", motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` }];
  }

  const estatal = celdaDesdeValor("estatal", datos.porTerritorio.get(estadoCve), "STPS no reportó este indicador para este territorio");
  return [nacional, estatal];
}

// Desglose "Ver estados" en proyectos nivel "nacional" — mismo patrón
// que el resto de Fontana. El cubo ya trae los 32 estados completos en
// memoria — sin llamada nueva.
export async function resolverEstadosStpsSalario(): Promise<ElementoDeEstado[]> {
  const datos = await cargarStpsSalario();
  return Array.from(datos.porTerritorio.entries())
    .filter(([cve]) => cve !== CLAVE_NACIONAL)
    .map(([cve, valor]): ElementoDeEstado => ({
      cve,
      nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
      celda: celdaDesdeValor("estatal", valor, "STPS no reportó este indicador para este estado"),
    }));
}
