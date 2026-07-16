export function isMexico(pais?: string | null): boolean {
  // Legacy documents without pais field → assume Mexico for backward compatibility
  return !pais || pais === "México";
}
