// lib/fontana/tabla/fuenteOficialCurada.ts
//
// Curación manual de etiquetas de cita cortas para la integración
// PESTEL↔Fontana (26-09-13, 3ª corrección) — Raúl reportó que citar solo
// "INEGI" para TODO dato de esa institución pierde la distinción entre
// productos completamente distintos (Censo vs. ENSU vs. ENOE, etc.),
// exactamente la misma distinción que ya se estableció con cuidado en las
// Notas Metodológicas de Fontana (sección Fuentes de Datos). Un parser
// genérico no puede adivinar la etiqueta humana correcta (ej.
// "INEGI (ITER, Censo 2020)" daría mecánicamente "ITER", no "Censo") —
// esto requiere el mismo criterio editorial que ya se aplicó en ese
// documento, así que se cura a mano, una vez, aquí.
//
// Cada patrón se ancla al PREFIJO ESTABLE de `fuenteEtiqueta` (agencia +
// identificador de producto) — NUNCA al string completo, que siempre
// termina en un año/trimestre que cambia con el tiempo (ej. IMCO 2025 →
// 2026 el año próximo). Si ninguna entrada coincide (una fuente nueva
// aún no curada), `extraerFuenteOficial` cae a su fallback actual
// (agencia sola) — nunca rompe, nunca cita vacío, solo pierde precisión
// hasta que se agregue la entrada correspondiente aquí.
//
// Cobertura: las ~28 constantes `FUENTE_ETIQUETA_*` reales de
// `lib/fontana/ingesta/*.ts` (auditado por grep, 26-09-13) + 3 fuentes
// que NO usan constante nombrada (CONAGUA, GACP, ANVCC) y que además NO
// siguen el patrón estructural "<AGENCIA> (<detalle>)" del resto — usan
// "<AGENCIA>, <detalle>" (coma en vez de paréntesis inmediato) — motivo
// por el que el fallback ingenuo de `extraerFuenteOficial` (buscar el
// primer "(") las cita mal (verboso o con el detalle completo) sin esta
// tabla.
export const FUENTES_OFICIALES_CURADAS: { patron: RegExp; etiqueta: string }[] = [
  // INEGI — 9 productos distintos.
  { patron: /^INEGI \(Censo 2020, vía ECEG\)/, etiqueta: "INEGI/Censo" },
  { patron: /^INEGI \(ITER, Censo 2020\)/, etiqueta: "INEGI/Censo" },
  { patron: /^INEGI \(ENSU\b/, etiqueta: "INEGI/ENSU" },
  { patron: /^INEGI \(ENOE\b/, etiqueta: "INEGI/ENOE" },
  { patron: /^INEGI \(ENVIPE\b/, etiqueta: "INEGI/ENVIPE" },
  { patron: /^INEGI \(ENIGH\b/, etiqueta: "INEGI/ENIGH" },
  { patron: /^INEGI \(Ingreso Corriente para los Municipios de México/, etiqueta: "INEGI/ICMM" },
  { patron: /^INEGI \(Compendio de Información Geográfica Municipal/, etiqueta: "INEGI/Compendio Geográfico Municipal" },
  { patron: /^INEGI \(Pobreza Multidimensional/, etiqueta: "INEGI/Pobreza Multidimensional" },

  // CONEVAL — 3 productos (Pobreza nacional/estatal y municipal son el
  // mismo producto — solo cambia el corte geográfico — mismo nombre corto).
  { patron: /^CONEVAL \(Medición de la pobreza\b/, etiqueta: "CONEVAL/Pobreza" },
  { patron: /^CONEVAL \(Índice de Rezago Social\b/, etiqueta: "CONEVAL/Rezago Social" },
  { patron: /^CONEVAL, Grado de Accesibilidad a Carretera Pavimentada/, etiqueta: "CONEVAL/GACP" },

  // CONAPO — 2 productos.
  { patron: /^CONAPO \(Índice de Marginación\b/, etiqueta: "CONAPO/Marginación" },
  { patron: /^CONAPO \(Proyecciones de población\b/, etiqueta: "CONAPO/Proyecciones de Población" },

  // Bienestar — 2 productos.
  { patron: /^Bienestar \(Producción para el Bienestar\b/, etiqueta: "Bienestar/Producción para el Bienestar" },
  { patron: /^Bienestar \(Beca Benito Juárez\b/, etiqueta: "Bienestar/Beca Benito Juárez" },

  // PNUD México — 4 sub-productos (más la variante de serie histórica,
  // mismo producto IDH, mismo nombre corto).
  { patron: /^PNUD México \(IDH\b/, etiqueta: "PNUD/IDH" },
  { patron: /^PNUD México \(Sub-índice Educación\b/, etiqueta: "PNUD/Sub-índice Educación" },
  { patron: /^PNUD México \(Sub-índice Ingreso\b/, etiqueta: "PNUD/Sub-índice Ingreso" },
  { patron: /^PNUD México \(Índice de Desigualdad de Género\b/, etiqueta: "PNUD/Desigualdad de Género" },

  // Fuentes con un solo producto hoy — se curan igual por consistencia y
  // para que sobrevivan si el detalle entre paréntesis cambia de forma.
  { patron: /^SESNSP \(RNID\b/, etiqueta: "SESNSP/RNID" },
  { patron: /^IMCO \(Índice de Competitividad Estatal\b/, etiqueta: "IMCO/ICE" },
  { patron: /^Banxico \(SIE, Ingresos por Remesas Familiares\)/, etiqueta: "Banxico/Remesas" },
  { patron: /^Institute for Economics and Peace \(Índice de Paz México\b/, etiqueta: "IEP/Índice de Paz" },
  { patron: /^STPS \(Huelgas\b/, etiqueta: "STPS/Huelgas" },
  { patron: /^SHCP \(Transferencias a Entidades Federativas\b/, etiqueta: "SHCP/Transferencias" },
  { patron: /^DOF \(Declaratoria de Zonas de Atención Prioritaria\b/, etiqueta: "DOF/ZAP" },
  { patron: /^RFOSC\/CLUNI\b/, etiqueta: "RFOSC/CLUNI" },
  { patron: /^STPS\/SIEL\b/, etiqueta: "STPS/SIEL" },

  // Fuentes con formato "<AGENCIA>, <detalle>" (coma, no paréntesis
  // inmediato) — el fallback de `extraerFuenteOficial` las citaría mal
  // (verboso o con el detalle completo) sin esta tabla.
  { patron: /^INECC, Atlas Nacional de Vulnerabilidad al Cambio Climático/, etiqueta: "INECC/ANVCC" },
  { patron: /^CONAGUA SMN\b/, etiqueta: "CONAGUA/SMN" },

  // Contenido curado propio de Eskemma (narrativo, F5) — no es una
  // institución externa con "producto", se deja como agencia sola.
  { patron: /^Eskemma \(contenido curado\)/, etiqueta: "Eskemma" },
];

/**
 * Busca una etiqueta curada para `fuenteEtiqueta` contra los patrones de
 * `FUENTES_OFICIALES_CURADAS`. `undefined` si ninguna coincide — el
 * llamador (`extraerFuenteOficial`) cae a su fallback agencia-sola.
 */
export function buscarFuenteOficialCurada(fuenteEtiqueta: string): string | undefined {
  const encontrada = FUENTES_OFICIALES_CURADAS.find((f) => f.patron.test(fuenteEtiqueta));
  return encontrada?.etiqueta;
}
