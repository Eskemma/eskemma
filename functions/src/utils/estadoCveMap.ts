// functions/src/utils/estadoCveMap.ts
// Mapping: state name (uppercase, no accents) → 2-digit INE entity code.
// Mirrors lib/sefix/eleccionesConstants.ts ESTADO_CVE_MAP — kept as a local
// copy because Cloud Functions cannot import from the Next.js lib/ root.

export const ESTADO_CVE_MAP: Record<string, string> = {
  "AGUASCALIENTES": "01",
  "BAJA CALIFORNIA": "02",
  "BAJA CALIFORNIA SUR": "03",
  "CAMPECHE": "04",
  "CHIAPAS": "07",
  "CHIHUAHUA": "08",
  "COAHUILA": "05",
  "COLIMA": "06",
  "CIUDAD DE MEXICO": "09",
  "DURANGO": "10",
  "GUANAJUATO": "11",
  "GUERRERO": "12",
  "HIDALGO": "13",
  "JALISCO": "14",
  "MEXICO": "15",
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

/**
 * Derives the 2-digit INE entity code from a free-form state name.
 * @param {string} estadoNombre State name (any case, may have accents)
 * @return {string|null} 2-digit code (e.g. "14") or null if not found
 */
export function getCveEntidad(estadoNombre: string): string | null {
  const normalized = estadoNombre
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return ESTADO_CVE_MAP[normalized] ?? null;
}
