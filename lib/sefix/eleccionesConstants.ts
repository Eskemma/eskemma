// lib/sefix/eleccionesConstants.ts
// Constantes para la pestaña Elecciones Federales de Sefix.
// Portado de partidos_colores.R y partidos_mapping.R (versión R Shiny).

// ============================================================
// ETIQUETAS DE CARGO (tal cual aparecen en los CSVs del INE)
// ============================================================

export const CARGO_CSV_LABELS: Record<string, string> = {
  dip: "DIPUTACION FEDERAL",
  sen: "SENADURIA",
  pdte: "PRESIDENCIA",
};

export const CARGO_DISPLAY_LABELS: Record<string, string> = {
  dip: "Diputación Federal",
  sen: "Senaduría",
  pdte: "Presidencia",
};

// ============================================================
// COMBINACIONES AÑO → CARGOS VÁLIDOS
// ============================================================

export const VALID_COMBINATIONS: Record<string, string[]> = {
  "2024": ["dip", "sen", "pdte"],
  "2023": ["sen"],
  "2021": ["dip", "sen"],
  "2018": ["dip", "sen", "pdte"],
  "2015": ["dip"],
  "2012": ["dip", "sen", "pdte"],
  "2009": ["dip"],
  "2006": ["dip", "sen", "pdte"],
};

export const AVAILABLE_YEARS = [2024, 2023, 2021, 2018, 2015, 2012, 2009, 2006];

// ============================================================
// CASOS ESPECIALES
// ============================================================

export const SPECIAL_CASES = {
  CASE_2023: { estado: "TAMAULIPAS", tipo: "EXTRAORDINARIA" as const },
  CASE_2021_SEN: { estado: "NAYARIT", tipo: "EXTRAORDINARIA" as const },
  CASE_2015_AGS_DIP: { year: 2015, cargo: "dip", estado: "AGUASCALIENTES" },
} as const;

// ============================================================
// MAPEO PARTIDOS/COALICIONES POR AÑO + CARGO
// Clave: `${año}_${cargoKey}` (ej: "2024_dip")
// Incluye vot_nul y no_reg como columnas seleccionables.
// ============================================================

export const PARTIDOS_MAPPING: Record<string, string[]> = {
  "2006_dip": ["PAN", "APM", "PBT", "NVALZ", "ASDC", "no_reg", "vot_nul"],
  "2006_sen": ["PAN", "APM", "PBT", "NVALZ", "ASDC", "no_reg", "vot_nul"],
  "2006_pdte": ["PAN", "APM", "PBT", "NVALZ", "ASDC", "no_reg", "vot_nul"],
  "2009_dip": ["PAN", "PRI", "PRD", "PVEM", "PT", "CONV", "NVALZ", "PSD", "PRIMERO_MEXICO", "SALVEMOS_MEXICO", "no_reg", "vot_nul"],
  "2012_dip": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVALZ", "PRI_PVEM", "PRD_PT_MC", "PRD_PT", "PRD_MC", "PT_MC", "no_reg", "vot_nul"],
  "2012_sen": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVALZ", "PRI_PVEM", "PRD_PT_MC", "PRD_PT", "PRD_MC", "PT_MC", "no_reg", "vot_nul"],
  "2012_pdte": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVALZ", "PRI_PVEM", "PRD_PT_MC", "PRD_PT", "PRD_MC", "PT_MC", "no_reg", "vot_nul"],
  "2015_dip": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVALZ", "MORENA", "PH", "ES", "PAN_NVALZ", "PRI_PVEM", "PRD_PT", "CAND_IND1", "CAND_IND2", "no_reg", "vot_nul"],
  "2018_dip": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVALZ", "MORENA", "ES", "PAN_PRD_MC", "PAN_PRD", "PAN_MC", "PRD_MC", "PRI_PVEM_NVALZ", "PRI_PVEM", "PRI_NVALZ", "PVEM_NVALZ", "PT_MORENA_ES", "PT_MORENA", "PT_ES", "MORENA_ES", "CAND_IND1", "CAND_IND2", "no_reg", "vot_nul"],
  "2018_sen": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVALZ", "MORENA", "ES", "PAN_PRD_MC", "PAN_PRD", "PAN_MC", "PRD_MC", "PRI_PVEM_NVALZ", "PRI_PVEM", "PRI_NVALZ", "PVEM_NVALZ", "PT_MORENA_ES", "PT_MORENA", "PT_ES", "MORENA_ES", "CAND_IND1", "CAND_IND2", "no_reg", "vot_nul"],
  "2018_pdte": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVALZ", "MORENA", "ES", "PAN_PRD_MC", "PAN_PRD", "PAN_MC", "PRD_MC", "PRI_PVEM_NVALZ", "PRI_PVEM", "PRI_NVALZ", "PVEM_NVALZ", "PT_MORENA_ES", "PT_MORENA", "PT_ES", "MORENA_ES", "CAND_IND1", "CAND_IND2", "no_reg", "vot_nul"],
  "2021_dip": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "MORENA", "PES", "RSP", "FXM", "PAN_PRI_PRD", "PAN_PRI", "PAN_PRD", "PRI_PRD", "PVEM_PT_MORENA", "PVEM_PT", "PVEM_MORENA", "PT_MORENA", "CAND_IND1", "no_reg", "vot_nul"],
  "2021_sen": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "MORENA", "PVEM_PT_MORENA", "PVEM_PT", "PVEM_MORENA", "PT_MORENA", "no_reg", "vot_nul"],
  "2023_sen": ["PAN", "PRI", "PRD", "PVEM", "PT", "MORENA", "PAN_PRI_PRD", "PAN_PRI", "PAN_PRD", "PRI_PRD", "PT_MORENA", "no_reg", "vot_nul"],
  "2024_dip": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "MORENA", "PAN_PRI_PRD", "PAN_PRI", "PAN_PRD", "PRI_PRD", "PVEM_PT_MORENA", "PVEM_PT", "PVEM_MORENA", "PT_MORENA", "CAND_IND1", "no_reg", "vot_nul"],
  "2024_sen": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "MORENA", "PAN_PRI_PRD", "PAN_PRI", "PAN_PRD", "PRI_PRD", "PVEM_PT_MORENA", "PVEM_PT", "PVEM_MORENA", "PT_MORENA", "no_reg", "vot_nul"],
  "2024_pdte": ["PAN", "PRI", "PRD", "PVEM", "PT", "MC", "MORENA", "PAN_PRI_PRD", "PAN_PRI", "PAN_PRD", "PRI_PRD", "PVEM_PT_MORENA", "PVEM_PT", "PVEM_MORENA", "PT_MORENA", "no_reg", "vot_nul"],
};

// ============================================================
// ETIQUETAS DE PARTIDOS PARA LA UI
// ============================================================

export const PARTIDO_LABELS: Record<string, string> = {
  PAN: "PAN", PRI: "PRI", PRD: "PRD", PVEM: "PVEM", PT: "PT",
  MC: "MC", MORENA: "MORENA", NVALZ: "NVALZ", ES: "ES", PES: "PES",
  RSP: "RSP", FXM: "FXM", PH: "PH", APM: "APM", PBT: "PBT",
  CONV: "CONV", PSD: "PSD", PRIMERO_MEXICO: "Primero México",
  SALVEMOS_MEXICO: "Salvemos México", ASDC: "ASDC",
  CAND_IND1: "Cand. Ind. 1", CAND_IND2: "Cand. Ind. 2",
  MORENA_ES: "MORENA-ES", PT_ES: "PT-ES",
  // Coaliciones PAN
  PAN_PRD_MC: "PAN-PRD-MC", PAN_PRD: "PAN-PRD", PAN_MC: "PAN-MC",
  PAN_PRI_PRD: "PAN-PRI-PRD", PAN_PRI: "PAN-PRI", PAN_NVALZ: "PAN-NVALZ",
  // Coaliciones PRI
  PRI_PVEM_NVALZ: "PRI-PVEM-NVALZ", PRI_PVEM: "PRI-PVEM",
  PRI_NVALZ: "PRI-NVALZ", PRI_PRD: "PRI-PRD",
  // Coaliciones PRD
  PRD_PT_MC: "PRD-PT-MC", PRD_PT: "PRD-PT", PRD_MC: "PRD-MC",
  // Coaliciones PVEM/PT
  PVEM_PT_MORENA: "PVEM-PT-MORENA", PVEM_PT: "PVEM-PT",
  PVEM_MORENA: "PVEM-MORENA", PVEM_NVALZ: "PVEM-NVALZ",
  PT_MORENA_ES: "PT-MORENA-ES", PT_MORENA: "PT-MORENA", PT_MC: "PT-MC",
  // Métricas especiales (en gráfica)
  vot_nul: "Votos nulos", no_reg: "Cand. no registrados",
};

// ============================================================
// COLORES OFICIALES DE PARTIDOS (portado de partidos_colores.R)
// Light mode — colores de identidad política exactos
// ============================================================

export const PARTY_COLORS: Record<string, string> = {
  APM: "#00AB52",
  ASDC: "#E02128",
  CAND_IND1: "#D05CF5",
  CAND_IND2: "#D05CF5",
  CONV: "#FF6B0D",
  ES: "#632D79",
  FXM: "#E85E91",
  MC: "#FF6B0D",
  MORENA: "#C0311A",
  MORENA_ES: "#C0311A",
  no_reg: "#3C303B",
  NVALZ: "#00A9C8",
  PAN: "#44559B",
  PAN_MC: "#44559B",
  PAN_NVALZ: "#44559B",
  PAN_PRD: "#44559B",
  PAN_PRD_MC: "#44559B",
  PAN_PRI: "#44559B",
  PAN_PRI_PRD: "#44559B",
  PBT: "#FFD300",
  PES: "#653EA2",
  PH: "#9F3B77",
  PRD: "#FFD300",
  PRD_MC: "#FFD300",
  PRD_PT: "#FFD300",
  PRD_PT_MC: "#FFD300",
  PRI: "#00AB52",
  PRI_NVALZ: "#00AB52",
  PRI_PRD: "#00AB52",
  PRI_PVEM: "#00AB52",
  PRI_PVEM_NVALZ: "#00AB52",
  PRIMERO_MEXICO: "#00AB52",
  PSD: "#E02128",
  PT: "#FE0100",
  PT_ES: "#FE0100",
  PT_MC: "#FE0100",
  PT_MORENA: "#C0311A",
  PT_MORENA_ES: "#C0311A",
  PVEM: "#5CD150",
  PVEM_MORENA: "#C0311A",
  PVEM_NVALZ: "#5CD150",
  PVEM_PT: "#5CD150",
  PVEM_PT_MORENA: "#C0311A",
  RSP: "#727478",
  SALVEMOS_MEXICO: "#FF6B0D",
  vot_nul: "#5A303B",
  DEFAULT: "#B0BEC5",
};

// ============================================================
// COLORES DARK MODE — versiones claras para fondo oscuro
// ============================================================

export const PARTY_COLORS_DARK: Record<string, string> = {
  // Partidos principales
  PAN: "#7B8FD4",
  PRI: "#4DC883",
  PRD: "#FFE04D",
  PVEM: "#7AE072",
  PT: "#FF7070",
  MC: "#FF9856",
  MORENA: "#E0766A",
  NVALZ: "#4DCFE8",
  ES: "#9B6BC0",
  PES: "#9B7BD0",
  RSP: "#A8AEB3",
  FXM: "#F097B4",
  PH: "#C87AAA",
  ASDC: "#E87070",
  PSD: "#E87070",
  APM: "#4DC883",
  PBT: "#FFE04D",
  CONV: "#FF9856",
  PRIMERO_MEXICO: "#4DC883",
  SALVEMOS_MEXICO: "#FF9856",
  CAND_IND1: "#D08AF5",
  CAND_IND2: "#D08AF5",
  MORENA_ES: "#E0766A",
  PT_ES: "#FF7070",
  // Coaliciones PAN → azul claro
  PAN_MC: "#7B8FD4",
  PAN_NVALZ: "#7B8FD4",
  PAN_PRD: "#7B8FD4",
  PAN_PRD_MC: "#7B8FD4",
  PAN_PRI: "#7B8FD4",
  PAN_PRI_PRD: "#7B8FD4",
  // Coaliciones PRI → verde claro
  PRI_NVALZ: "#4DC883",
  PRI_PRD: "#4DC883",
  PRI_PVEM: "#4DC883",
  PRI_PVEM_NVALZ: "#4DC883",
  // Coaliciones PRD → amarillo claro
  PRD_MC: "#FFE04D",
  PRD_PT: "#FFE04D",
  PRD_PT_MC: "#FFE04D",
  // Coaliciones PVEM → verde lima claro
  PVEM_NVALZ: "#7AE072",
  PVEM_PT: "#7AE072",
  // Coaliciones con MORENA → rojo-naranja claro
  PT_MC: "#FF7070",
  PT_MORENA: "#E0766A",
  PT_MORENA_ES: "#E0766A",
  PVEM_MORENA: "#E0766A",
  PVEM_PT_MORENA: "#E0766A",
  // Métricas especiales
  no_reg: "#8A7E8A",
  vot_nul: "#9A7080",
  DEFAULT: "#B0BEC5",
};

// ============================================================
// COLUMNAS METADATA (NO son votos, no aparecen en la gráfica)
// ============================================================

export const RESULTS_METADATA_COLS = new Set([
  "id", "anio", "cve_ambito", "ambito", "cve_cargo", "cargo",
  "cve_principio", "principio", "cve_tipo", "tipo",
  "cve_circunscripcion", "circunscripcion", "cve_estado", "estado",
  "cve_def", "cabecera", "cve_mun", "municipio", "seccion",
  "no_reg", "vot_nul", "total_votos", "lne", "part_ciud",
]);

// Etiquetas para columnas del DataTable
export const TABLA_COLUMN_LABELS: Record<string, string> = {
  anio: "Año",
  cargo: "Cargo",
  estado: "Estado",
  cabecera: "Cabecera Distrital",
  municipio: "Municipio",
  seccion: "Sección",
  tipo: "Tipo",
  principio: "Principio",
  total_votos: "Total de votos",
  lne: "Lista Nominal",
  part_ciud: "Participación Ciudadana (%)",
  no_reg: "Cand. no registrados",
  vot_nul: "Votos nulos",
};

// ============================================================
// HELPER: etiqueta dinámica de partido/candidatura
// ============================================================

export function getPartidoLabel(col: string): string {
  if (PARTIDO_LABELS[col]) return PARTIDO_LABELS[col];
  if (col === "CAND_IND") return "Cand. Ind.";
  const m = col.match(/^CAND_IND(\d+)$/);
  if (m) return `Cand. Ind. ${m[1]}`;
  return col;
}

// ============================================================
// DEFAULTS DE CONSULTA
// ============================================================

// ============================================================
// MAPEO NOMBRE DE ESTADO (UI/CSV electoral) → CVE_ENT INEGI
// Usado para construir el GeoScopeElectoral en la vista geo.
// Los nombres corresponden a los que aparecen en ESTADOS_LIST y en la columna
// "estado" de los CSVs del INE (sin acentos, sin artículos constitucionales).
// ============================================================

export const ESTADO_CVE_MAP: Record<string, string> = {
  "AGUASCALIENTES":      "01",
  "BAJA CALIFORNIA":     "02",
  "BAJA CALIFORNIA SUR": "03",
  "CAMPECHE":            "04",
  "COAHUILA":            "05",
  "COLIMA":              "06",
  "CHIAPAS":             "07",
  "CHIHUAHUA":           "08",
  "CIUDAD DE MEXICO":    "09",
  "DURANGO":             "10",
  "GUANAJUATO":          "11",
  "GUERRERO":            "12",
  "HIDALGO":             "13",
  "JALISCO":             "14",
  "ESTADO DE MEXICO":    "15",
  "MICHOACAN":           "16",
  "MORELOS":             "17",
  "NAYARIT":             "18",
  "NUEVO LEON":          "19",
  "OAXACA":              "20",
  "PUEBLA":              "21",
  "QUERETARO":           "22",
  "QUINTANA ROO":        "23",
  "SAN LUIS POTOSI":     "24",
  "SINALOA":             "25",
  "SONORA":              "26",
  "TABASCO":             "27",
  "TAMAULIPAS":          "28",
  "TLAXCALA":            "29",
  "VERACRUZ":            "30",
  "YUCATAN":             "31",
  "ZACATECAS":           "32",
};

export const ELECCIONES_DEFAULTS = {
  anio: 2024,
  cargo: "dip" as const,
  estado: "",
  partidos: ["Todos"] as string[],
  tipo: "ORDINARIA" as const,
  principio: "MAYORIA RELATIVA" as const,
  cabecera: "",
  municipio: "",
  secciones: [] as string[],
  incluirExtranjero: true,
};
