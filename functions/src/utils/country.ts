/**
 * Returns true if the project territory is Mexico.
 * Legacy documents without a pais field default to Mexico.
 * @param {string | null | undefined} pais - Country name from territorio.pais.
 * @return {boolean} Whether the territory is Mexico.
 */
export function isMexico(pais?: string | null): boolean {
  return !pais || pais === "México";
}
