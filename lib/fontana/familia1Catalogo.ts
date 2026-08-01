// lib/fontana/familia1Catalogo.ts
// Nombres de los 19 indicadores de Familia 1 (Fontana_T10_Cierre_Paso2_v2.md
// §3) — incluye los 7 diferidos a un sub-incremento posterior, para que la
// tabla comparativa pueda mostrar su nombre real aunque su conector todavía
// no exista (candado + "conector pendiente", nunca un id crudo sin
// contexto). INDICATOR_REGISTRY.json es la fuente de verdad para
// definición/fuente/niveles de los 12 ya construidos; este catálogo es
// solo el respaldo de nombre para el resto.

export const FAMILIA1_ORDEN: string[] = [
  "F1-1", "F1-2", "F1-3", "F1-4", "F1-5", "F1-6", "F1-7", "F1-8", "F1-9",
  "F1-10", "F1-11", "F1-12", "F1-13", "F1-14", "F1-15", "F1-16", "F1-17",
  "F1-18", "F1-19",
];

export const FAMILIA1_NOMBRES: Record<string, string> = {
  "F1-1": "Población total",
  "F1-2": "Pirámide de edades",
  "F1-3": "% Población indígena",
  "F1-4": "% Jefatura femenina",
  "F1-5": "Escolaridad promedio",
  "F1-6": "% Población inmigrante",
  "F1-7": "% Población mayor a 65 años",
  "F1-8": "% Vivienda con piso de tierra",
  "F1-9": "Promedio de ocupantes por cuarto",
  "F1-10": "% Vivienda con servicios básicos",
  "F1-11": "% Población urbana/rural",
  "F1-12": "Estado civil",
  "F1-13": "% Población sin escolaridad",
  "F1-14": "Educación pos-básica",
  "F1-15": "% Población con discapacidad",
  "F1-16": "Densidad de población",
  "F1-17": "Remesas recibidas per cápita",
  "F1-18": "Razón de dependencia demográfica",
  "F1-19": "% Población indígena monolingüe",
};

// Cierre de incremento (2026-07-31): F1-2, F1-11, F1-16, F1-17, F1-18 ya
// tienen conector real (lib/fontana/ingesta/{iter,compendio,banxico,conapo}.ts).
// Quedan solo F1-10 y F1-12, bloqueados en ECEG — sus claves crudas
// (VPH_C_SERV, P12YM_SOLT/CASA/SEPA) nunca se extrajeron del ECEG crudo,
// no están en CURATED_COLUMNS de scripts/eceg-data-pipeline.ts ni en
// ningún JSON ya subido a Storage. Pendiente de que se reprocesen los
// XLSX crudos (workstream aparte).
export const FAMILIA1_DIFERIDOS = new Set([
  "F1-10", "F1-12",
]);
