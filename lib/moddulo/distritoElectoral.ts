// lib/moddulo/distritoElectoral.ts
// Extractor compartido del número de distrito electoral (Federal o Local)
// a partir del texto descriptivo que el wizard de territorio guarda para
// niveles distrito_federal/distrito_local — formato por diseño en todo el
// ecosistema: "Distrito Electoral Federal/Local {num} con cabecera en
// {ciudad}, ...". Misma lógica (romanToInt + regex) ya usada en
// parseCveDistritoFed/buildPadronLabel
// (app/moddulo/proyecto/[projectId]/exploracion/page.tsx) — extraída aquí,
// generalizada a Federal y Local y con padding a 3 dígitos, para que
// Fontana (sefix/eceg_2020/distritos/{estadoCve}.json, featureKey de 3
// dígitos) la reutilice sin triplicar el patrón.

function romanToInt(s: string): number | null {
  const map: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
  };
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]], next = map[s[i + 1]];
    result += next && next > cur ? -cur : cur;
  }
  return result;
}

// Regresa el número de distrito con padding a 3 dígitos (ej. "005"), o
// null si el texto no sigue el formato esperado. Prioriza cve_distrito si
// ya viene numérico (mismo criterio que parseCveDistritoFed).
export function extraerNumeroDistrito(
  texto: string | null | undefined,
  cveDistrito?: string | null
): string | null {
  if (cveDistrito && /^\d+$/.test(cveDistrito)) {
    return cveDistrito.padStart(3, "0");
  }
  if (!texto) return null;

  const re = /Distrito\s+Electoral\s+(?:Federal|Local)\s+([IVX\d]+)/i;
  const match = texto.match(re);
  if (!match) return null;

  const raw = match[1].toUpperCase();
  const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : romanToInt(raw);
  return n !== null ? String(n).padStart(3, "0") : null;
}