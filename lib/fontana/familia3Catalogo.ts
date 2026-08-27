// lib/fontana/familia3Catalogo.ts
// Nombres de los 17 indicadores de Familia 3 (Geopolíticos),
// Fontana_T10_Cierre_Paso2_v2.md §3 — dividida en 2 bloques para el
// incremento 2026-08-26 (corrección de Raúl: los indicadores que el
// catálogo original etiquetaba "INE vía Sefix" en realidad dependen de
// Sefix-AI/T06, app del ecosistema en pausa, no del dashboard Sefix):
//
// Bloque 1 (9, conector real): F3-1, F3-2, F3-3, F3-4, F3-7, F3-8, F3-15,
// F3-16, F3-17.
// Bloque 2 (8, reservados — solo definición en el registry, sin conector,
// celda "Pendiente — Sefix-AI"): F3-5, F3-6, F3-9 a F3-14.
//
// INDICATOR_REGISTRY.json es la fuente de verdad para definición/fuente/
// niveles; este catálogo es solo el respaldo de nombre/orden.

export const FAMILIA3_ORDEN: string[] = [
  "F3-1", "F3-2", "F3-3", "F3-4", "F3-5", "F3-6", "F3-7", "F3-8", "F3-9",
  "F3-10", "F3-11", "F3-12", "F3-13", "F3-14", "F3-15", "F3-16", "F3-17",
];

export const FAMILIA3_NOMBRES: Record<string, string> = {
  "F3-1": "Tasa de homicidios dolosos",
  "F3-2": "Incidencia delictiva",
  "F3-3": "Victimización (ENVIPE)",
  "F3-4": "Percepción de inseguridad (ENSU)",
  "F3-5": "Resultados electorales",
  "F3-6": "Participación electoral histórica",
  "F3-7": "Gasto federalizado per cápita",
  "F3-8": "Zonas de Atención Prioritaria",
  "F3-9": "Tasa de abstención histórica",
  "F3-10": "Índice de volatilidad electoral",
  "F3-11": "Voto nulo y no registrados",
  "F3-12": "Margen de victoria",
  "F3-13": "Continuidad de partido ganador",
  "F3-14": "Índice de competitividad electoral",
  "F3-15": "Presencia de organizaciones sociales",
  "F3-16": "Huelgas y paros laborales",
  "F3-17": "Índice de Paz México",
};

// Bloque 2 (2026-08-26) — dependen de Sefix-AI (T06), en pausa de
// desarrollo. Ningún conector ni cálculo se construye para estos 8 en este
// incremento — ver MOTIVO_PENDIENTE_SEFIX_AI (lib/fontana/ingesta/types.ts)
// para el texto de celda, y el bloque dedicado en
// resolverIndicadorFontana (lib/fontana/ingesta/index.ts).
export const FAMILIA3_PENDIENTES_SEFIX_AI = new Set<string>([
  "F3-5", "F3-6", "F3-9", "F3-10", "F3-11", "F3-12", "F3-13", "F3-14",
]);

// Distinto de FAMILIA3_PENDIENTES_SEFIX_AI: "diferidos" excluye un
// indicador del selector manual "+ Añadir" en la UI (FontanaMain.tsx,
// mismo criterio que FAMILIA1_DIFERIDOS/FAMILIA5_DIFERIDOS). Los 8 del
// Bloque 2 SÍ deben poder agregarse — el requisito es "reservar la
// columna/fila en la tabla" con estado "Pendiente" visible, nunca
// ocultarlos — así que quedan fuera de este set.
//
// NO es para indicadores en construcción dentro del mismo incremento
// (ej. F3-7/F3-8/F3-17 mientras se terminan esta ronda) — mientras no
// tengan bloque en resolverIndicadorFontana, ya caen al fallback genérico
// del dispatcher (MOTIVO_CONECTOR_PENDIENTE, "disponible en el siguiente
// incremento"), que es verdad tal cual mientras se construyen. "diferidos"
// es para indicadores permanentemente reclasificados a otro mecanismo (ej.
// F5-9/F5-10, movidos a contenido curado) o sin fuente viable a largo
// plazo — no para trabajo en progreso. Queda vacío para Familia 3 hasta
// que exista un caso real de ese tipo.
export const FAMILIA3_DIFERIDOS = new Set<string>();
