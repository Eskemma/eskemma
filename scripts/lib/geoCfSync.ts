// scripts/lib/geoCfSync.ts
// Generador y verificador de la copia de Cloud Functions de la resolución de
// estado → CVE (functions/src/utils/estadoCveMap.ts). functions/ tiene su propio
// build y NO puede importar de lib/, así que esa copia existe; en lugar de
// mantenerla a mano (y que diverja: hasta 2026-09-20 devolvía null para CDMX,
// "Distrito Federal", nombres oficiales largos, espacios de más y "nuevo_leon"),
// se GENERA desde la fuente real (lib/geo/estados.ts) y se VERIFICA con una
// batería de paridad. Lógica pura: la usan el CLI (scripts/check-geo-cf-sync.ts)
// y el test bloqueante (lib/geo/estadoCveMapCF.test.ts).

import { ALIAS_ESTADO, ESTADOS, resolverEstadoCve } from "../../lib/geo/estados";
import { GEO_ACCENT_MAP } from "../../lib/geo/municipioCanonico";

export const RUTA_COPIA_CF = "functions/src/utils/estadoCveMap.ts";

const MAX_COLS = 80; // guía de estilo de functions (ESLint google)

/** Entradas `"CLAVE": "cve",` de un objeto, una por línea, con sangría de 2. */
function lineasMapa(entradas: [string, string][]): string[] {
  return entradas.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
}

/** Contenido COMPLETO que debe tener functions/src/utils/estadoCveMap.ts. */
export function generarEstadoCveMapCF(): string {
  const claves = ESTADOS.map((e): [string, string] => [e.clave, e.cve]);
  const alias = Object.entries(ALIAS_ESTADO);
  const acentos = Object.entries(GEO_ACCENT_MAP);
  // Acentos: 3 pares por línea para respetar el ancho de 80 columnas.
  const lineasAcentos: string[] = [];
  for (let i = 0; i < acentos.length; i += 3) {
    lineasAcentos.push(
      "  " + acentos.slice(i, i + 3)
        .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)},`)
        .join(" ")
    );
  }
  const lineas = [
    "// functions/src/utils/estadoCveMap.ts",
    "// GENERATED FILE - DO NOT EDIT BY HAND.",
    "// Source: lib/geo/estados.ts (catalog + aliases) and",
    "// lib/geo/municipioCanonico.ts (accent map). Cloud Functions cannot",
    "// import from lib/, which is why this copy exists.",
    "// Regenerate (from the repo root): npm run sync-geo-cf",
    "// Guard: lib/geo/estadoCveMapCF.test.ts fails (and blocks pre-push) if",
    "// this file differs from what scripts/lib/geoCfSync.ts generates.",
    "",
    "/** Accent folding (same map as normalizeGeoName; keeps N-tilde). */",
    "const GEO_ACCENT_MAP: Record<string, string> = {",
    ...lineasAcentos,
    "};",
    "",
    "/** State key (uppercase, no accents) to 2-digit INE entity code. */",
    "export const ESTADO_CVE_MAP: Record<string, string> = {",
    ...lineasMapa(claves),
    "};",
    "",
    "/** Verified aliases (key after normalization) to 2-digit entity code. */",
    "const ALIAS_ESTADO: Record<string, string> = {",
    ...lineasMapa(alias),
    "};",
    "",
    "/**",
    " * Normalizes a state name: fold accents, uppercase, treat _ . , as",
    " * separators/nothing and collapse whitespace.",
    " * @param {string} input State name in any format",
    " * @return {string} Normalized key",
    " */",
    "function claveEntrada(input: string): string {",
    "  const limpio = input",
    "    .replace(/_/g, \" \")",
    "    .replace(/\\./g, \"\")",
    "    .replace(/,/g, \" \");",
    "  return limpio",
    "    .split(\"\")",
    "    .map((c) => GEO_ACCENT_MAP[c] ?? c)",
    "    .join(\"\")",
    "    .toUpperCase()",
    "    .trim()",
    "    .replace(/\\s+/g, \" \");",
    "}",
    "",
    "/**",
    " * Derives the 2-digit INE entity code from a free-form state name.",
    " * Same behavior as resolverEstadoCve in lib/geo/estados.ts.",
    " * @param {string} estadoNombre State name (any case, accents, alias)",
    " * @return {string|null} 2-digit code (e.g. \"14\") or null if not found",
    " */",
    "export function getCveEntidad(estadoNombre: string): string | null {",
    "  if (typeof estadoNombre !== \"string\") return null;",
    "  const key = claveEntrada(estadoNombre);",
    "  return ESTADO_CVE_MAP[key] ?? ALIAS_ESTADO[key] ?? null;",
    "}",
    "",
  ];
  return lineas.join("\n");
}

/** Líneas del archivo generado que exceden el ancho de la guía de estilo de functions. */
export function lineasDemasiadoLargas(contenido: string): string[] {
  return contenido.split("\n").filter((l) => l.length > MAX_COLS);
}

/** Entradas de la batería de paridad: todo lo que el núcleo reconoce, en varias formas, más casos límite. */
export function bateriaParidad(): unknown[] {
  const base = [
    ...ESTADOS.flatMap((e) => [e.nombre, e.clave, e.cve]),
    ...Object.keys(ALIAS_ESTADO),
    "CDMX", "D.F.", "Edo. Méx.", "Edo Mex", "Coahuila de Zaragoza",
    "Michoacán de Ocampo", "Veracruz de Ignacio de la Llave", "Distrito Federal",
    "México", "MÉXICO", "Nuevo León", "nuevo_leon", "San_Luis_Potosí",
  ];
  const variantes = base.flatMap((x) => {
    const s = String(x);
    return [s, s.toLowerCase(), s.toUpperCase(), `  ${s}  `, s.replace(/ /g, "_"), s.replace(/ /g, "   "), `${s},`];
  });
  // Casos límite: nacional, vacío, ajenos, no-string.
  return [...variantes, "Nacional", "NACIONAL", "", "   ", "Narnia", "Mexico City", "Magdalena", null, undefined, 14, {}];
}

export interface Divergencia {
  entrada: unknown;
  copiaCF: string | null;
  fuente: string | null;
}

/** Entradas donde la copia de CF responde distinto que `resolverEstadoCve` (la fuente real). */
export function buscarDivergenciasCF(getCveEntidadCF: (s: string) => string | null): Divergencia[] {
  const out: Divergencia[] = [];
  for (const entrada of bateriaParidad()) {
    const fuente = resolverEstadoCve(entrada as string);
    let copiaCF: string | null;
    try {
      copiaCF = getCveEntidadCF(entrada as string);
    } catch (e) {
      // La copia anterior lanzaba TypeError con entradas no-string; se cuenta como divergencia.
      copiaCF = `<lanza ${(e as Error).name}>`;
    }
    if (copiaCF !== fuente) out.push({ entrada, copiaCF, fuente });
  }
  return out;
}
