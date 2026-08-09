// lib/fontana/familia2Catalogo.ts
// Nombres de los 22 indicadores de Familia 2 (Socioeconómicos),
// Fontana_T10_Cierre_Paso2_v2.md §3 — incluye los 17 aún sin conector
// (Incremento 1, 2026-08-07: solo F2-4, F2-7, F2-8, F2-11, F2-13 tienen
// dato real), mismo criterio que FAMILIA1_DIFERIDOS: la tabla comparativa
// puede mostrar el nombre real de un indicador aunque su conector todavía
// no exista (candado + "conector pendiente", nunca un id crudo sin
// contexto). INDICATOR_REGISTRY.json es la fuente de verdad para
// definición/fuente/niveles de los ya construidos; este catálogo es solo
// el respaldo de nombre para el resto.

export const FAMILIA2_ORDEN: string[] = [
  "F2-1", "F2-2", "F2-3", "F2-4", "F2-5", "F2-6", "F2-7", "F2-8", "F2-9",
  "F2-10", "F2-11", "F2-12", "F2-13", "F2-14", "F2-15", "F2-16", "F2-17",
  "F2-18", "F2-19", "F2-20", "F2-21", "F2-22",
];

export const FAMILIA2_NOMBRES: Record<string, string> = {
  "F2-1": "Pobreza multidimensional",
  "F2-2": "Pobreza extrema",
  "F2-3": "Índice de Rezago Social",
  "F2-4": "Índice de Marginación",
  "F2-5": "IDH Municipal",
  "F2-6": "Gini de ingreso",
  "F2-7": "Beneficiarios Producción para el Bienestar",
  "F2-8": "Beneficiarios Beca Benito Juárez",
  "F2-9": "Tasa de informalidad",
  "F2-10": "Salario real medio",
  "F2-11": "Acceso a internet en hogares",
  "F2-12": "Distribución del ingreso por decil",
  "F2-13": "% Población sin seguridad social (proxy)",
  "F2-14": "% Población con ≥1 carencia social",
  "F2-15": "Gasto de hogares en educación",
  "F2-16": "Gasto de hogares en salud",
  "F2-17": "Competitividad Estatal (IMCO)",
  "F2-18": "Ingreso corriente promedio municipal (ICMM)",
  "F2-19": "Índice de Desigualdad de Género (IDG) municipal",
  "F2-20": "Sub-índice IDH — Educación",
  "F2-21": "Sub-índice IDH — Ingreso",
  "F2-22": "Sub-índice IDH — Salud",
};

// Incremento 1 (2026-08-07): 5 de 22 con conector real (F2-4, F2-7,
// F2-8, F2-11, F2-13). Incremento 2 (2026-08-09): +4 (F2-1, F2-2, F2-3,
// F2-14, CONEVAL) — 9 de 22 con conector real. El resto queda diferido
// (F2-9/10 ENOE, F2-18 ICMM, F2-5/6/12/15/16/17/19/20/21/22).
export const FAMILIA2_DIFERIDOS = new Set<string>([
  "F2-5", "F2-6", "F2-9", "F2-10", "F2-12",
  "F2-15", "F2-16", "F2-17", "F2-18", "F2-19", "F2-20", "F2-21",
  "F2-22",
]);
