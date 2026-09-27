// lib/geo/sugerenciasTecleo.ts
// Pieza 1b (26-09-26): sugerencias "¿quisiste decir…?" por error de tecleo. SOLO sugiere: nunca resuelve.
//
// Reglas (decisiones de Raúl, no reinterpretar):
//   · Solo cuando `desambiguarReferencia` termina en `ninguno` (nunca con coincidencia exacta, alias o parcial).
//   · Distancia de edición 1 (sustitución, inserción, borrado o transposición adyacente). NO 2: a distancia 2
//     el 21.7 % de los nombres reales tiene otro nombre real (medido en el catálogo de 2,475 municipios).
//   · Mínimo 5 letras en lo tecleado; municipios y estados únicamente (sin distritos ni cabeceras).
//   · Máximo 3 sugerencias; si hay MÁS de 3 no se sugiere nada (el llamador pide el estado). Con estado dado
//     no ocurre (medido: 0 de 2,406 tecleos simulados); sin estado ocurre en ~3 %.
//   · Todo lo que se sugiere lo confirma una persona: la sugerencia se acepta reenviando su clave, que el
//     servidor vuelve a verificar contra las sugerencias recalculadas (ver resolverReferenciaTerritorio).
//
// Riesgo conocido: ~7 % de los nombres tienen otro nombre real a distancia 1 a nivel nacional (Colima~Colipa,
// Comala~Copala) y ~1.5 % dentro de un mismo estado, por eso NUNCA se elige una sola sugerencia por el usuario.
//
// Módulo PURO (el catálogo de municipios se inyecta).

import type { MunicipioCatalogoRef, TipoReferencia } from "./desambiguar";
import { formaPlana } from "./referenciaDistrito";
import { NOMBRES_ESTADO_ORDENADOS, nombreEstadoDisplay, resolverEstadoCve } from "./estados";
import { ALIAS_COLOQUIAL_MUNICIPIO, ALIAS_MUNICIPIO } from "./municipioCanonico";

export const MIN_LETRAS_SUGERENCIA = 5;
export const MAX_SUGERENCIAS = 3;
/** Distancia máxima de edición para sugerir (1 carácter). */
export const DISTANCIA_MAXIMA_SUGERENCIA = 1;

/**
 * Distancia de Damerau-Levenshtein (la transposición de dos letras contiguas cuenta 1) con corte:
 * devuelve `max + 1` en cuanto se sabe que la distancia supera `max`.
 */
export function distanciaEdicion(a: string, b: string, max: number = DISTANCIA_MAXIMA_SUGERENCIA): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const fila = new Array<number>(b.length + 1).fill(0);
    fila[0] = i;
    return fila;
  });
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length] > max ? max + 1 : d[a.length][b.length];
}

/** Letras de lo tecleado (sin espacios ni signos), para el mínimo de activación. */
function letras(textoPlano: string): number {
  return textoPlano.replace(/[^A-ZÑÜ0-9]/g, "").length;
}

/** Nombre (plano) que puede sugerirse, con lo que hace falta para armar su candidato. */
export interface NombreSugerible {
  tipo: "estado" | "municipio";
  /** Forma plana (MAYÚSCULAS sin acentos) contra la que se mide la distancia. */
  plano: string;
  estadoCve: string;
  /** Solo municipios: el nombre tal cual del catálogo, para reconstruir su clave. */
  nombreCatalogo?: string;
}

/**
 * Nombres a distancia 1 de `texto` dentro del alcance dado (o [] si el texto no califica). Devuelve los
 * nombres, sin armar candidatos: `desambiguar.ts` los convierte con su lógica de claves y etiquetas.
 */
export function nombresSugeridosPorTecleo(
  texto: string,
  alcance: {
    estadoCve?: string;
    municipios: readonly MunicipioCatalogoRef[];
    tipos: readonly TipoReferencia[];
  }
): NombreSugerible[] {
  const plano = formaPlana(texto);
  if (letras(plano) < MIN_LETRAS_SUGERENCIA) return [];

  const universo: NombreSugerible[] = [];
  if (alcance.tipos.includes("estado") && !alcance.estadoCve) {
    for (const nombre of NOMBRES_ESTADO_ORDENADOS) {
      const cve = resolverEstadoCve(nombre);
      const oficial = cve ? nombreEstadoDisplay(cve) : null;
      if (cve && oficial) universo.push({ tipo: "estado", plano: formaPlana(oficial), estadoCve: cve });
    }
  }
  if (alcance.tipos.includes("municipio")) {
    for (const m of alcance.municipios) {
      if (alcance.estadoCve && m.estadoCve !== alcance.estadoCve) continue;
      universo.push({ tipo: "municipio", plano: formaPlana(m.nombre), estadoCve: m.estadoCve, nombreCatalogo: m.nombre });
    }
    // Los alias reales también se pueden teclear mal («Tlaqepaque» → alias «Tlaquepaque» → San Pedro
    // Tlaquepaque): se mide contra el alias y se sugiere el municipio OFICIAL al que apunta.
    for (const tabla of [ALIAS_MUNICIPIO, ALIAS_COLOQUIAL_MUNICIPIO]) {
      for (const [estadoCve, alias] of Object.entries(tabla)) {
        if (alcance.estadoCve && estadoCve !== alcance.estadoCve) continue;
        for (const [nombreAlias, oficial] of Object.entries(alias)) {
          universo.push({ tipo: "municipio", plano: formaPlana(nombreAlias), estadoCve, nombreCatalogo: oficial });
        }
      }
    }
  }
  return universo.filter((u) => u.plano !== plano && distanciaEdicion(plano, u.plano) <= DISTANCIA_MAXIMA_SUGERENCIA);
}

/** Marca para que ningún consumidor confunda una sugerencia con una coincidencia real. */
export const COINCIDENCIA_SUGERIDA = "sugerida" as const;

/** ¿Cabe mostrar estas sugerencias? Vacío o más de MAX_SUGERENCIAS → ninguna. */
export function limitarSugerencias<T>(candidatos: T[]): T[] {
  return candidatos.length === 0 || candidatos.length > MAX_SUGERENCIAS ? [] : candidatos;
}

