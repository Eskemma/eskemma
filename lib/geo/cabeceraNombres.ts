// lib/geo/cabeceraNombres.ts
// Comparación de NOMBRES DE CABECERA de distritos electorales. LÓGICA PURA y
// deliberadamente ligera (sin JSON de catálogos): la importan componentes
// cliente vía lib/sefix/districtMatching.ts.
//
// Hallazgo real (CSV de Sefix, 2026-09-19): el nombre de una misma cabecera
// cambia entre años ("QUERETARO" ↔ "SANTIAGO DE QUERETARO", "CD." ↔ "CIUDAD",
// "TOLUCA" ↔ "TOLUCA DE LERDO", "GUSTAVO A. MADERO" ↔ "GUSTAVO A MADERO") y
// los CSV locales traen mojibake ("ZUÃ\x91IGA", "QUERÃ\x89TARO"). Por eso la
// comparación es por clave interna con mojibake reparado, y la tolerancia a
// renombres es solo por CONTENCIÓN DE PALABRAS completas.

import { normalizeGeoName, plegarDiacriticosGeo, repararMojibakeGeo } from "./municipioCanonico";

/**
 * Clave interna de una cabecera para comparar: mojibake reparado, MAYÚSCULAS,
 * sin acentos, Ñ/Ü plegadas, sin '?' (pérdida de encoding del INE), sin
 * puntuación ni espacios repetidos ("GUSTAVO A. MADERO" === "GUSTAVO A MADERO").
 */
export function claveCabecera(s: string): string {
  return plegarDiacriticosGeo(normalizeGeoName(repararMojibakeGeo(s).replace(/\?/g, "")))
    .replace(/[.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quita el prefijo numérico de una opción de Sefix: "1405 PUERTO VALLARTA" → "PUERTO VALLARTA". */
export function cabeceraSinPrefijo(opcionNombre: string): string {
  return opcionNombre.replace(/^\d+\s+/, "");
}

/** Código de 4 dígitos (CVE estado + número de distrito) de una opción de Sefix, o null. */
export function codigoDeOpcion(opcionNombre: string): string | null {
  return opcionNombre.match(/^(\d{4})(?:\s|$)/)?.[1] ?? null;
}

/**
 * ¿Dos nombres de cabecera pueden ser la MISMA cabecera con otro nombre? Igualdad
 * de clave, o uno contiene al otro como secuencia de PALABRAS completas
 * ("QUERETARO" ⊂ "SANTIAGO DE QUERETARO", "DURANGO" ⊂ "VICTORIA DE DURANGO").
 * No compara por subcadena de letras, y "NAUCALPAN DE JUAREZ" ≠ "AMECAMECA DE
 * JUAREZ" (mismo código reasignado a otro territorio por redistritación).
 */
export function nombresCabeceraCompatibles(a: string, b: string): boolean {
  const ca = claveCabecera(a);
  const cb = claveCabecera(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  return ` ${ca} `.includes(` ${cb} `) || ` ${cb} `.includes(` ${ca} `);
}
