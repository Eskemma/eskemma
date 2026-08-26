// lib/fontana/familia5Catalogo.ts
// Nombres de los 17 indicadores de Familia 5 (Características
// territoriales), Fontana_T10_Cierre_Paso2_v2.md §3, actualizado con la
// verificación en vivo de Ronda 9 (2026-08-23): SICT reemplazado por
// CONEVAL GACP en F5-8 (SICT decayó de 56 a 11 datasets reales,
// ninguno útil); DENUE (F5-6) con mecanismo simplificado (descarga
// masiva directa por estado). INDICATOR_REGISTRY.json es la fuente de
// verdad para definición/fuente/niveles; este catálogo es solo el
// respaldo de nombre.

export const FAMILIA5_ORDEN: string[] = [
  "F5-1", "F5-2", "F5-3", "F5-4", "F5-5", "F5-6", "F5-7", "F5-8", "F5-9",
  "F5-10", "F5-11", "F5-12", "F5-13", "F5-14", "F5-15", "F5-16", "F5-17",
];

export const FAMILIA5_NOMBRES: Record<string, string> = {
  "F5-1": "Factores geográficos",
  "F5-2": "Factores climáticos",
  "F5-3": "Historia del territorio",
  "F5-4": "Personajes célebres",
  "F5-5": "Tradiciones y fiestas",
  "F5-6": "Zonas de actividad económica",
  "F5-7": "Zonas habitacionales y comerciales",
  "F5-8": "Zonas menos comunicadas",
  "F5-9": "Atractivos turísticos",
  "F5-10": "Problemáticas ecológicas",
  "F5-11": "Incendios forestales (número)",
  "F5-12": "Superficie incendiada (ha)",
  "F5-13": "Declaratorias de desastre",
  "F5-14": "% Área natural protegida",
  "F5-15": "PIB municipal",
  "F5-16": "PIB turístico municipal",
  "F5-17": "Rezago de vivienda",
};

// F5-9 (Atractivos turísticos) y F5-10 (Problemáticas ecológicas) —
// dejaron de estar diferidos (2026-08-24, Modo C): pasan a ser
// contenido curado puro (mismo mecanismo que F5-3/F5-4,
// `contenidoCurado.ts`), no fuentes en vivo. F5-9 (IIEG Jalisco WFS)
// seguía caído en 2 rondas separadas con al menos un mes de diferencia
// (2026-07-26 y 2026-08-23): geo.jalisco.gob.mx rechaza conexión,
// datos.jalisco.gob.mx no resuelve DNS — sin fuente alterna aprobada.
// F5-10: ninguna de las 115 columnas del archivo INECC/ANVCC (mismo
// archivo que sí cubre F5-11 a F5-17) representa el concepto real de
// "problemáticas ecológicas" — evaluado con evidencia real
// (Guadalajara/Zapopan/Oaxaca de Juárez), las 3 candidatas más cercanas
// miden cosas distintas (tipo de área protegida, adopción de buenas
// prácticas agropecuarias, infraestructura de saneamiento). En vez de
// forzar un dato que se parece al concepto sin medirlo realmente, ambos
// se editorializan igual que historia/personajes célebres.
export const FAMILIA5_DIFERIDOS = new Set<string>();
