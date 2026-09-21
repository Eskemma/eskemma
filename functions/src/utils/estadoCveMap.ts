// functions/src/utils/estadoCveMap.ts
// GENERATED FILE - DO NOT EDIT BY HAND.
// Source: lib/geo/estados.ts (catalog + aliases) and
// lib/geo/municipioCanonico.ts (accent map). Cloud Functions cannot
// import from lib/, which is why this copy exists.
// Regenerate (from the repo root): npm run sync-geo-cf
// Guard: lib/geo/estadoCveMapCF.test.ts fails (and blocks pre-push) if
// this file differs from what scripts/lib/geoCfSync.ts generates.

/** Accent folding (same map as normalizeGeoName; keeps N-tilde). */
const GEO_ACCENT_MAP: Record<string, string> = {
  "Á": "A", "À": "A", "Â": "A",
  "Ä": "A", "É": "E", "È": "E",
  "Ê": "E", "Ë": "E", "Í": "I",
  "Ì": "I", "Î": "I", "Ï": "I",
  "Ó": "O", "Ò": "O", "Ô": "O",
  "Ö": "O", "Ú": "U", "Ù": "U",
  "Û": "U", "á": "A", "à": "A",
  "â": "A", "ä": "A", "é": "E",
  "è": "E", "ê": "E", "ë": "E",
  "í": "I", "ì": "I", "î": "I",
  "ï": "I", "ó": "O", "ò": "O",
  "ô": "O", "ö": "O", "ú": "U",
  "ù": "U", "û": "U", "ñ": "Ñ",
  "ü": "Ü",
};

/** State key (uppercase, no accents) to 2-digit INE entity code. */
export const ESTADO_CVE_MAP: Record<string, string> = {
  "AGUASCALIENTES": "01",
  "BAJA CALIFORNIA": "02",
  "BAJA CALIFORNIA SUR": "03",
  "CAMPECHE": "04",
  "COAHUILA": "05",
  "COLIMA": "06",
  "CHIAPAS": "07",
  "CHIHUAHUA": "08",
  "CIUDAD DE MEXICO": "09",
  "DURANGO": "10",
  "GUANAJUATO": "11",
  "GUERRERO": "12",
  "HIDALGO": "13",
  "JALISCO": "14",
  "ESTADO DE MEXICO": "15",
  "MICHOACAN": "16",
  "MORELOS": "17",
  "NAYARIT": "18",
  "NUEVO LEON": "19",
  "OAXACA": "20",
  "PUEBLA": "21",
  "QUERETARO": "22",
  "QUINTANA ROO": "23",
  "SAN LUIS POTOSI": "24",
  "SINALOA": "25",
  "SONORA": "26",
  "TABASCO": "27",
  "TAMAULIPAS": "28",
  "TLAXCALA": "29",
  "VERACRUZ": "30",
  "YUCATAN": "31",
  "ZACATECAS": "32",
};

/** Verified aliases (key after normalization) to 2-digit entity code. */
const ALIAS_ESTADO: Record<string, string> = {
  "MEXICO": "15",
  "EDOMEX": "15",
  "EDO MEX": "15",
  "CDMX": "09",
  "DF": "09",
  "DISTRITO FEDERAL": "09",
  "COAHUILA DE ZARAGOZA": "05",
  "MICHOACAN DE OCAMPO": "16",
  "VERACRUZ DE IGNACIO DE LA LLAVE": "30",
};

/**
 * Normalizes a state name: fold accents, uppercase, treat _ . , as
 * separators/nothing and collapse whitespace.
 * @param {string} input State name in any format
 * @return {string} Normalized key
 */
function claveEntrada(input: string): string {
  const limpio = input
    .replace(/_/g, " ")
    .replace(/\./g, "")
    .replace(/,/g, " ");
  return limpio
    .split("")
    .map((c) => GEO_ACCENT_MAP[c] ?? c)
    .join("")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Derives the 2-digit INE entity code from a free-form state name.
 * Same behavior as resolverEstadoCve in lib/geo/estados.ts.
 * @param {string} estadoNombre State name (any case, accents, alias)
 * @return {string|null} 2-digit code (e.g. "14") or null if not found
 */
export function getCveEntidad(estadoNombre: string): string | null {
  if (typeof estadoNombre !== "string") return null;
  const key = claveEntrada(estadoNombre);
  return ESTADO_CVE_MAP[key] ?? ALIAS_ESTADO[key] ?? null;
}
