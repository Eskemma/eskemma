// lib/geo/display.ts
// Convención de NOMBRE A MOSTRAR al usuario, por tipo de entidad. LÓGICA PURA.
// Es la otra mitad de lo que hace `normalizeGeoName`: aquella produce la clave
// interna (para comparar/unir); esta produce el nombre visible. Son dos
// representaciones del mismo dato canónico y NO se mezclan en una función.
//
//   · Distrito electoral (federal o local): SIEMPRE con prefijo de clave de
//     estado + número y la cabecera en MAYÚSCULAS sin acentos (Ñ/Ü conservadas)
//     — exactamente como ya lo muestra Sefix: "1405 PUERTO VALLARTA",
//     "3103 MERIDA". Un mismo nombre de cabecera puede pertenecer a más de un
//     distrito (Mérida tiene 3 en Yucatán; Zapopan y Tonalá 2 en Jalisco): el
//     prefijo existe justo para desambiguar.
//   · Estado / municipio / ciudad como entidad geográfica: SIN prefijo,
//     capitalización normal, CON acentos ("Puerto Vallarta", "Mérida",
//     "Michoacán", "Estado de México"). Los estados salen del catálogo
//     (./estados.ts); los municipios requieren un nombre de una fuente que
//     conserve los acentos (ver `nombreMunicipioDisplay`).

import { normalizeGeoName } from "./municipioCanonico";

/**
 * Distrito electoral → "1405 PUERTO VALLARTA": CVE de estado (2 dígitos) +
 * número de distrito (2 dígitos) + cabecera en MAYÚSCULAS sin acentos.
 * Ej.: nombreDistritoDisplay("14", "5", "Puerto Vallarta") → "1405 PUERTO VALLARTA".
 */
export function nombreDistritoDisplay(
  cveEstado: string,
  numeroDistrito: string | number,
  cabecera: string
): string {
  const est = String(cveEstado).padStart(2, "0");
  const num = String(numeroDistrito).padStart(2, "0");
  return `${est}${num} ${normalizeGeoName(cabecera).replace(/\s+/g, " ").trim()}`;
}

// Partículas que van en minúscula dentro de un nombre propio.
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "el", "en"]);

/**
 * Municipio / ciudad → capitalización normal, SIN prefijo numérico.
 *
 * Los acentos NO se pueden inventar: si `nombre` ya los trae ("Mérida",
 * "Tlajomulco de Zúñiga") se conservan; si viene de un catálogo en MAYÚSCULAS
 * sin acentos (el topojson INE y el padrón DERFE de Sefix: 2,477/2,477
 * municipios, verificado) solo se recapitaliza ("MERIDA" → "Merida") y
 * `conAcentosGarantizados` es false — restaurar el acento requiere una fuente
 * que lo conserve (pendiente: ninguno de los catálogos estructurados actuales
 * la tiene; el catálogo del ITER solo trae la clave canónica).
 */
export function nombreMunicipioDisplay(nombre: string): {
  nombre: string;
  conAcentosGarantizados: boolean;
} {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  const tieneAcentos = /[áéíóúÁÉÍÓÚ]/.test(limpio);
  const esTodoMayusculas = limpio === limpio.toUpperCase() && limpio !== limpio.toLowerCase();
  // Con acentos y ya en capitalización normal: se respeta tal cual.
  if (tieneAcentos && !esTodoMayusculas) {
    return { nombre: limpio, conAcentosGarantizados: true };
  }
  const recapitalizado = limpio
    .toLowerCase()
    .split(" ")
    .map((palabra, i) =>
      i > 0 && PARTICULAS.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1)
    )
    .join(" ");
  return { nombre: recapitalizado, conAcentosGarantizados: tieneAcentos };
}
