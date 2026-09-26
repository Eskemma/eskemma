// lib/geo/referenciaDistrito.ts
// Paso 3 de la desambiguación geográfica (26-09-25): reconoce cómo un USUARIO nombra un
// distrito electoral cuando lo hace por NÚMERO o CLAVE y no por el nombre de su cabecera:
//
//   "distrito federal 5 de Jalisco"   → federal, distrito 05, Jalisco   → 1405
//   "D.L. 27 CDMX"                     → local, distrito 27, CDMX         → 0927
//   "D.F. 1405 PUERTO VALLARTA"        → federal, código 1405
//   "1405"                             → código 1405 (federal y local: pregunta cuál)
//   "distrito V de Jalisco"            → número romano
//   "distrito federal de Jalisco"      → todos los federales de Jalisco (pide número o cabecera)
//
// Módulo PURO: solo reconoce y normaliza; validar contra el catálogo y armar candidatos lo
// hace `desambiguar.ts`. No decide nada sobre "este distrito" (referencia contextual, ver
// referenciaContextual.ts): aquí solo llegan textos que YA nombran un distrito concreto.
//
// "Distrito Federal" a secas NO es un distrito: es el nombre antiguo de la Ciudad de México
// (alias en estados.ts). Solo se lee como distrito electoral si trae número, clave, estado o
// cabecera (regla de Raúl, 26-09-25).

import { resolverEstadoCve } from "./estados";
import { normalizarNombreMunicipio, plegarDiacriticosGeo } from "./municipioCanonico";

export type TipoDistrito = "distrito_federal" | "distrito_local";

/** Plain comparison form: accent-free uppercase, "_" "." "," as separators, Ñ/Ü folded. */
export function formaPlana(s: string): string {
  return plegarDiacriticosGeo(normalizarNombreMunicipio(s.replace(/[_.,]/g, " ")));
}

export interface ReferenciaDistrito {
  /** Tipo dicho por el usuario ("federal"/"local"/"D.F."/"D.L."); null si no lo dijo. */
  tipo: TipoDistrito | null;
  /** Número de distrito a 2 dígitos ("05"), si lo dijo. */
  numero: string | null;
  /** Código completo de 4 dígitos ("1405"), si lo dijo. */
  codigo: string | null;
  /** Estado nombrado en la frase (CVE), si lo hay y se reconoce. */
  estadoCve: string | null;
  /** Había un estado escrito pero no se reconoce como estado mexicano. */
  estadoNoReconocido: boolean;
  /** Texto libre restante (probablemente el nombre de la cabecera), si lo hay. */
  cabecera: string | null;
}

const ROMANOS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

function romanoAEntero(s: string): number | null {
  if (!/^[IVXLC]{1,6}$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMANOS[s[i]];
    const next = ROMANOS[s[i + 1]];
    total += next && next > cur ? -cur : cur;
  }
  return total >= 1 && total <= 99 ? total : null;
}

const dos = (n: number | string): string => String(Number(n)).padStart(2, "0");

const RE_PREFIJO =
  /^(?:EL\s+)?(?:(DISTRITO(?:\s+ELECTORAL)?|DTTO|DTO|DIST)|(D\s?F)|(D\s?L))\b\s*(FEDERAL|LOCAL|FED|LOC)?\s*(.*)$/;

function tipoDePalabra(p: string | undefined): TipoDistrito | null {
  if (p === "FEDERAL" || p === "FED") return "distrito_federal";
  if (p === "LOCAL" || p === "LOC") return "distrito_local";
  return null;
}

function vacia(): ReferenciaDistrito {
  return { tipo: null, numero: null, codigo: null, estadoCve: null, estadoNoReconocido: false, cabecera: null };
}

function conEstado(ref: ReferenciaDistrito, resto: string): ReferenciaDistrito {
  const texto = resto.replace(/^(?:DE|DEL|EN)\s+/, "").trim();
  if (!texto) return ref;
  const cve = resolverEstadoCve(texto);
  return cve ? { ...ref, estadoCve: cve } : { ...ref, estadoNoReconocido: true };
}

/**
 * Reconoce una referencia a distrito por número/clave/tipo. Devuelve null si el texto no es de
 * esa forma (entonces es un nombre: se busca por nombre como siempre). Un texto que es SOLO el
 * prefijo ("distrito local") devuelve una referencia vacía con `tipo` (solo nivel, sin lugar).
 */
export function parsearReferenciaDistrito(texto: string | null | undefined): ReferenciaDistrito | null {
  if (!texto) return null;
  const p = formaPlana(texto);
  if (!p) return null;

  // "1405" o "1405 PUERTO VALLARTA": código suelto (federal y local existen con el mismo código).
  const suelto = p.match(/^(\d{4})(?:\s+.+)?$/);
  if (suelto) return { ...vacia(), codigo: suelto[1] };

  const m = p.match(RE_PREFIJO);
  if (!m) return null;
  const tipo: TipoDistrito | null = m[2] ? "distrito_federal" : m[3] ? "distrito_local" : tipoDePalabra(m[4]);
  const resto = (m[5] ?? "").trim();
  const base: ReferenciaDistrito = { ...vacia(), tipo };

  if (!resto) return base; // solo el prefijo: "distrito local", "distrito federal"

  const codigo = resto.match(/^(\d{4})\b\s*(.*)$/);
  if (codigo) return { ...base, codigo: codigo[1], cabecera: codigo[2] || null };

  const numero = resto.match(/^(\d{1,3})\b\s*(.*)$/);
  if (numero && Number(numero[1]) >= 1) {
    return conEstado({ ...base, numero: dos(numero[1]) }, numero[2]);
  }

  const romano = resto.match(/^([IVXLC]{1,6})\b\s*(.*)$/);
  if (romano && (tipo || m[1])) {
    const n = romanoAEntero(romano[1]);
    if (n !== null) return conEstado({ ...base, numero: dos(n) }, romano[2]);
  }

  // "distrito federal de Jalisco" / "D.F. en Jalisco": tipo + estado, sin número.
  const deEstado = resto.match(/^(?:DE|DEL|EN)\s+(.+)$/);
  if (deEstado) return conEstado(base, deEstado[1]);

  // Cualquier otra cosa detrás del prefijo es el nombre de una cabecera ("distrito federal Puerto Vallarta").
  return { ...base, cabecera: resto };
}

/** "Distrito Federal" / "DF" a secas: el nombre antiguo de la Ciudad de México, no un distrito electoral. */
export function esDistritoFederalAntiguo(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const p = formaPlana(texto);
  return p === "DISTRITO FEDERAL" || p === "EL DISTRITO FEDERAL" || p === "DF" || p === "D F";
}

/** ¿El texto habla de un distrito (por palabra o abreviatura), aunque no lo identifique? */
export function mencionaDistrito(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const p = formaPlana(texto);
  return /\b(DISTRITO|DISTRITOS|DTTO|DTO|D\s?F|D\s?L)\b/.test(p) || /^\d{4}\b/.test(p);
}
