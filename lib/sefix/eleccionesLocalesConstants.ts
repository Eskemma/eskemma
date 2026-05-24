// lib/sefix/eleccionesLocalesConstants.ts
// Constantes para la pestaña Elecciones Locales de Sefix.

import {
  PARTY_COLORS as FED_COLORS,
  PARTY_COLORS_DARK as FED_COLORS_DARK,
} from "@/lib/sefix/eleccionesConstants";

// getPartidoLabel federal se re-exporta directamente
export { getPartidoLabel } from "@/lib/sefix/eleccionesConstants";

// ============================================================
// ETIQUETAS DE CARGO
// ============================================================

export const CARGO_DISPLAY_LABELS_LOC: Record<string, string> = {
  ayun:     "Ayuntamiento",
  dip_loc:  "Diputación Local",
  gob:      "Gubernatura",
  junta:    "Junta Municipal",
  jef_gob:  "Jefatura de Gobierno",
  alc:      "Alcaldía",
  jef_del:  "Jefatura Delegacional",
  sind:     "Sindicatura",
  reg:      "Regiduría",
  asm:      "Asambleísta",
  pres_com: "Presidencia Comunitaria",
};

// ============================================================
// COMBINACIONES AÑO → CARGOS VÁLIDOS
// Se actualiza al agregar nuevos años de datos.
// ============================================================

export const VALID_COMBINATIONS_LOC: Record<string, string[]> = {
  "2015": ["ayun", "dip_loc", "gob", "junta", "jef_del"],
  // 2016 (CDMX): asm disponible — descomentar al procesar ese año
  // "2016": ["asm"],
  "2021": ["ayun", "dip_loc", "gob", "junta", "pres_com", "reg", "sind"],
};

export const AVAILABLE_YEARS_LOC = [2015, 2021];

// ============================================================
// CARGOS EXCLUSIVOS DE CDMX/DF
// Solo se muestran cuando estado === "CIUDAD DE MEXICO" o "DISTRITO FEDERAL"
// asm (Asambleísta) aplica solo a CDMX, disponible desde 2016.
// ============================================================

export const CDMX_ONLY_CARGOS = new Set(["jef_gob", "jef_del", "alc", "asm"]);

// ============================================================
// EQUIVALENCIA DE CARGOS PARA CDMX (trazabilidad histórica)
// jef_del (2015) = ayun (2021) = alc (futuro): mismo nivel de gobierno,
// distinta denominación legal. Solo se aplica en vistas históricas (all_years).
// asm (2016) queda fuera: fue una asamblea constituyente única, sin par histórico.
// ============================================================
export const CDMX_EQUIV_GROUP = ["jef_del", "ayun", "alc"] as const;

// ============================================================
// MAPEO PARTIDOS/COALICIONES POR AÑO + CARGO
// Clave: `${año}_${cargoKey}` — unión de todos los estados para ese año/cargo.
// Las entradas de cargos sin datos aún (sind, reg, asm, pres_com) se
// documentan con array vacío para ser completadas al procesar esos años.
// ============================================================

export const PARTIDOS_MAPPING_LOC: Record<string, string[]> = {
  "2015_ayun": [
    // Partidos nacionales
    "PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVA_ALIANZA", "MORENA", "ES", "PH", "PSD",
    // Candidatura Común (genérica)
    "CC",
    // Coaliciones PAN
    "PAN_MC", "PAN_NVA_ALIANZA", "PAN_PRS", "PAN_PRD", "PAN_PRD_PT", "PAN_PRD_PT_MC",
    "PAN_PVEM_NVA_ALIANZA", "PAN_PCP", "PAN_PT", "PAN_PT_MC",
    "PAN_PRD_PT_PVEM_MC_NVA_ALIANZA",
    // Coaliciones PRD
    "PRD_MC", "PRD_PT", "PRD_PT_MC", "PRD_NVA_ALIANZA", "PRD_PAN", "PRD_PCP", "PRD_PCP_MC",
    "PRD_PT_MC_NVA_ALIANZA", "PRD_PT_NVA_ALIANZA", "PRD_PT_PCP", "PRD_PT_PCP_MC",
    "PRD_PVEM_PCP",
    // Coaliciones PRI
    "PRI_ES", "PRI_NVA_ALIANZA", "PRI_NVA_ALIANZA_ES", "PRI_NVA_ALIANZA_PCU",
    "PRI_NVA_ALIANZA_PD", "PRI_NVA_ALIANZA_PH_ES", "PRI_NVA_ALIANZA_PT",
    "PRI_NVA_ALIANZA_PVEM", "PRI_NVA_ALIANZA_PVEM_PT", "PRI_PCU", "PRI_PD", "PRI_PH",
    "PRI_PH_ES", "PRI_PT", "PRI_PVEM", "PRI_PVEM_ES", "PRI_PVEM_NVA_ALIANZA",
    "PRI_PVEM_NVA_ALIANZA_ES", "PRI_PVEM_NVA_ALIANZA_PCU", "PRI_PVEM_NVA_ALIANZA_PD",
    "PRI_PVEM_NVA_ALIANZA_PH", "PRI_PVEM_NVA_ALIANZA_PH_ES", "PRI_PVEM_PCU", "PRI_PVEM_PD",
    "PRI_PVEM_PH_ES", "PRI_PVEM_PT",
    // Coaliciones PVEM / PT
    "PVEM_MC", "PVEM_NVA_ALIANZA", "PVEM_NVA_ALIANZA_PCU", "PVEM_NVA_ALIANZA_PD",
    "PVEM_PCU", "PVEM_PD", "PVEM_PT", "PT_MC", "PT_PAN",
    // Coaliciones NVA_ALIANZA
    "NVA_ALIANZA_PCU", "NVA_ALIANZA_PD", "NVA_ALIANZA_PT", "NVA_ALIANZA_PVEM",
    "NVA_ALIANZA_PVEM_PT",
    // Candidaturas Comunes nombradas (CC_*)
    "CC_PAN_MC", "CC_PAN_PH", "CC_PAN_PRD", "CC_PAN_PRD_NVA_ALIANZA", "CC_PAN_PRD_PT",
    "CC_PAN_PRD_PT_NVA_ALIANZA_ES", "CC_PAN_PRD_PT_NVA_ALIANZA_PH",
    "CC_PAN_PRI_PRD_NVA_ALIANZA_PH_ES", "CC_PAN_PRI_PVEM", "CC_PAN_PT",
    "CC_PRD_ES", "CC_PRD_NVA_ALIANZA", "CC_PRD_NVA_ALIANZA_ES",
    "CC_PRD_PT", "CC_PRD_PT_ES", "CC_PRD_PT_NVA_ALIANZA", "CC_PRD_PT_NVA_ALIANZA_ES",
    "CC_PRD_PT_NVA_ALIANZA_PH", "CC_PRD_PT_PH",
    "CC_PRI_PVEM", "CC_PRI_PVEM_PT",
    "CC_PT_ES", "CC_PT_MC", "CC_PT_NVA_ALIANZA_PH", "CC_PT_PH", "CC_PT_PH_ES",
    // Candidaturas Comunitarias
    "COMUN_PRD_PT", "COMUN_PRD_PT_PAN", "COMUN_PRI_PVEM", "COMUN_PRI_PVEM_NVA_ALIANZA",
    // Partidos locales
    "MHTG", "MVC", "PCP", "PCP_MC_NVA_ALIANZA", "PCP_NVA_ALIANZA", "PCU", "PD", "PFD", "PPG",
    // Candidatos independientes
    "CAND_IND1", "CAND_IND2", "CAND_IND3", "CAND_IND4", "CAND_IND5",
    "CAND_IND6", "CAND_IND7", "CAND_IND8", "CAND_IND9", "CAND_IND10",
    "CAND_IND11", "CAND_IND13", "CAND_IND14", "CAND_IND15", "CAND_IND16",
    "CAND_IND17", "CAND_IND18", "CAND_IND19", "CAND_IND20", "CAND_IND21", "CAND_IND22",
    "no_reg", "vot_nul",
  ],
  "2015_dip_loc": [
    "PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVA_ALIANZA", "MORENA", "ES", "PH", "PSD", "CC",
    // Partidos locales BCS
    "BS", "FACA", "ISRM", "JLCM", "JRM", "MARM",
    // Coalición explícita
    "COALICION_PRI_PVEM",
    // Coaliciones PAN
    "PAN_PRS", "PAN_PT", "PAN_PVEM",
    // Coaliciones PRD
    "PRD_NVA_ALIANZA", "PRD_PT", "PRD_PT_MC", "PRD_PT_NVA_ALIANZA", "PRD_PT_PCP",
    // Coaliciones PRI
    "PRI_NVA_ALIANZA", "PRI_NVA_ALIANZA_PCU", "PRI_NVA_ALIANZA_PVEM", "PRI_PCU",
    "PRI_PT", "PRI_PVEM", "PRI_PVEM_NVA_ALIANZA", "PRI_PVEM_NVA_ALIANZA_PCU",
    "PRI_PVEM_PCU", "PRI_PVEM_PT",
    // Coaliciones PVEM / PT / NVA
    "PVEM_NVA_ALIANZA", "PVEM_NVA_ALIANZA_PCU", "PVEM_PCU", "PVEM_PT",
    "NVA_ALIANZA_PCU", "NVA_ALIANZA_PVEM", "PT_NVA_ALIANZA",
    // Candidaturas Comunes
    "CC_PAN_PT", "CC_PRD_ES", "CC_PRD_NVA_ALIANZA", "CC_PRD_PT", "CC_PRD_PT_ES",
    "CC_PRD_PT_PH", "CC_PRD_PT_PH_ES", "CC_PT_ES", "CC_PT_PH_ES",
    // Candidaturas Comunitarias
    "COMUN_PRD_PT",
    // Partidos locales
    "MVC", "PCP", "PCU", "PD", "PFD", "PPG",
    // Candidatos independientes
    "CAND_IND1", "CAND_IND2", "CAND_IND3", "CAND_IND4", "CAND_IND5", "CAND_IND6",
    "CAND_IND7", "CAND_IND8", "CAND_IND9", "CAND_IND10", "CAND_IND11", "CAND_IND12",
    "no_reg", "vot_nul",
  ],
  "2015_gob": [
    "PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVA_ALIANZA", "MORENA", "ES", "PH",
    "BRE", "PAN_PRS", "PCP", "PD", "PPG",
    // Coaliciones PRD
    "PRD_PT_MC", "PRD_PT_NVA_ALIANZA", "PRD_PT_PCP",
    // Coaliciones PRI
    "PRI_NVA_ALIANZA", "PRI_NVA_ALIANZA_PD", "PRI_NVA_ALIANZA_PT",
    "PRI_NVA_ALIANZA_PVEM", "PRI_NVA_ALIANZA_PVEM_PT",
    "PRI_PD", "PRI_PT", "PRI_PVEM", "PRI_PVEM_NVA_ALIANZA",
    "PRI_PVEM_NVA_ALIANZA_PD", "PRI_PVEM_PD", "PRI_PVEM_PT",
    // Coaliciones PVEM / NVA
    "PVEM_NVA_ALIANZA", "PVEM_NVA_ALIANZA_PD", "PVEM_PD", "PVEM_PT",
    "NVA_ALIANZA_PD", "NVA_ALIANZA_PT", "NVA_ALIANZA_PVEM", "NVA_ALIANZA_PVEM_PT",
    // Candidaturas Comunitarias
    "COMUN_PRD_PT", "COMUN_PRI_PVEM",
    "CAND_IND1",
    "no_reg", "vot_nul",
  ],
  "2015_jef_del": [
    "PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVA_ALIANZA", "MORENA", "ES", "PH",
    "PRD_NVA_ALIANZA", "PRD_PT", "PRD_PT_NVA_ALIANZA",
    "PRI_PVEM",
    "PT_NVA_ALIANZA",
    "CAND_IND5", "CAND_IND6", "CAND_IND7", "CAND_IND8", "CAND_IND9",
    "CAND_IND10", "CAND_IND11",
    "no_reg", "vot_nul",
  ],
  "2015_junta": [
    "PAN", "PRI", "PRD", "PVEM", "PT", "MC", "NVA_ALIANZA", "MORENA", "ES", "PH",
    "PRI_PVEM",
    "no_reg", "vot_nul",
  ],
  // Cargos pendientes de datos — se completan al procesar años posteriores
  "2015_sind":     [],
  "2015_reg":      [],
  "2015_pres_com": [],
  // asm aplica solo a CDMX, disponible desde 2016
  "2016_asm":      [],
};

// ============================================================
// ETIQUETAS DE PARTIDO PARA LA UI (nacionales + locales)
// ============================================================

export const PARTIDO_LABELS_LOC: Record<string, string> = {
  // Nacionales
  PAN: "PAN", PRI: "PRI", PRD: "PRD", PVEM: "PVEM", PT: "PT",
  MC: "MC", MORENA: "MORENA", ES: "ES", PH: "PH", PSD: "PSD",
  // Locales / regionales
  NVA_ALIANZA: "Nueva Alianza",
  CC: "Candidatura Común",
  BRE: "BRE", BS: "BS", FACA: "FACA", ISRM: "ISRM",
  JLCM: "JLCM", JRM: "JRM", MARM: "MARM", MHTG: "MHTG", MVC: "MVC",
  PAN_PRS: "PAN-PRS", PCP: "PCP", PCU: "PCU", PD: "PD", PFD: "PFD", PPG: "PPG",
  // Coaliciones PAN
  PAN_MC: "PAN-MC", PAN_NVA_ALIANZA: "PAN-NVA", PAN_PRD: "PAN-PRD",
  PAN_PRD_PT: "PAN-PRD-PT", PAN_PRD_PT_MC: "PAN-PRD-PT-MC",
  PAN_PVEM_NVA_ALIANZA: "PAN-PVEM-NVA", PAN_PCP: "PAN-PCP",
  PAN_PT: "PAN-PT", PAN_PT_MC: "PAN-PT-MC", PAN_PVEM: "PAN-PVEM",
  PAN_PRD_PT_PVEM_MC_NVA_ALIANZA: "PAN-PRD-PT-PVEM-MC-NVA",
  // Coaliciones PRD
  PRD_MC: "PRD-MC", PRD_PT: "PRD-PT", PRD_PT_MC: "PRD-PT-MC",
  PRD_NVA_ALIANZA: "PRD-NVA", PRD_PAN: "PRD-PAN", PRD_PCP: "PRD-PCP",
  PRD_PCP_MC: "PRD-PCP-MC", PRD_PT_MC_NVA_ALIANZA: "PRD-PT-MC-NVA",
  PRD_PT_NVA_ALIANZA: "PRD-PT-NVA", PRD_PT_PCP: "PRD-PT-PCP",
  PRD_PT_PCP_MC: "PRD-PT-PCP-MC", PRD_PVEM_PCP: "PRD-PVEM-PCP",
  // Coaliciones PRI
  PRI_ES: "PRI-ES", PRI_NVA_ALIANZA: "PRI-NVA", PRI_NVA_ALIANZA_ES: "PRI-NVA-ES",
  PRI_NVA_ALIANZA_PCU: "PRI-NVA-PCU", PRI_NVA_ALIANZA_PD: "PRI-NVA-PD",
  PRI_NVA_ALIANZA_PH_ES: "PRI-NVA-PH-ES", PRI_NVA_ALIANZA_PT: "PRI-NVA-PT",
  PRI_NVA_ALIANZA_PVEM: "PRI-NVA-PVEM", PRI_NVA_ALIANZA_PVEM_PT: "PRI-NVA-PVEM-PT",
  PRI_PCU: "PRI-PCU", PRI_PD: "PRI-PD", PRI_PH: "PRI-PH", PRI_PH_ES: "PRI-PH-ES",
  PRI_PT: "PRI-PT", PRI_PVEM: "PRI-PVEM", PRI_PVEM_ES: "PRI-PVEM-ES",
  PRI_PVEM_NVA_ALIANZA: "PRI-PVEM-NVA", PRI_PVEM_NVA_ALIANZA_ES: "PRI-PVEM-NVA-ES",
  PRI_PVEM_NVA_ALIANZA_PCU: "PRI-PVEM-NVA-PCU", PRI_PVEM_NVA_ALIANZA_PD: "PRI-PVEM-NVA-PD",
  PRI_PVEM_NVA_ALIANZA_PH: "PRI-PVEM-NVA-PH", PRI_PVEM_NVA_ALIANZA_PH_ES: "PRI-PVEM-NVA-PH-ES",
  PRI_PVEM_PCU: "PRI-PVEM-PCU", PRI_PVEM_PD: "PRI-PVEM-PD",
  PRI_PVEM_PH_ES: "PRI-PVEM-PH-ES", PRI_PVEM_PT: "PRI-PVEM-PT",
  COALICION_PRI_PVEM: "PRI-PVEM",
  // Coaliciones PVEM / PT
  PVEM_MC: "PVEM-MC", PVEM_NVA_ALIANZA: "PVEM-NVA",
  PVEM_NVA_ALIANZA_PCU: "PVEM-NVA-PCU", PVEM_NVA_ALIANZA_PD: "PVEM-NVA-PD",
  PVEM_PCU: "PVEM-PCU", PVEM_PD: "PVEM-PD", PVEM_PT: "PVEM-PT",
  PT_MC: "PT-MC", PT_PAN: "PT-PAN", PT_NVA_ALIANZA: "PT-NVA",
  // Coaliciones NVA_ALIANZA
  NVA_ALIANZA_PCU: "NVA-PCU", NVA_ALIANZA_PD: "NVA-PD",
  NVA_ALIANZA_PT: "NVA-PT", NVA_ALIANZA_PVEM: "NVA-PVEM",
  NVA_ALIANZA_PVEM_PT: "NVA-PVEM-PT",
  // Candidaturas Comunes nombradas
  CC_PAN_MC: "CC PAN-MC", CC_PAN_PH: "CC PAN-PH", CC_PAN_PRD: "CC PAN-PRD",
  CC_PAN_PRD_NVA_ALIANZA: "CC PAN-PRD-NVA", CC_PAN_PRD_PT: "CC PAN-PRD-PT",
  CC_PAN_PRD_PT_NVA_ALIANZA_ES: "CC PAN-PRD-PT-NVA-ES",
  CC_PAN_PRD_PT_NVA_ALIANZA_PH: "CC PAN-PRD-PT-NVA-PH",
  CC_PAN_PRI_PRD_NVA_ALIANZA_PH_ES: "CC PAN-PRI-PRD-NVA-PH-ES",
  CC_PAN_PRI_PVEM: "CC PAN-PRI-PVEM", CC_PAN_PT: "CC PAN-PT",
  CC_PRD_ES: "CC PRD-ES", CC_PRD_NVA_ALIANZA: "CC PRD-NVA",
  CC_PRD_NVA_ALIANZA_ES: "CC PRD-NVA-ES", CC_PRD_PT: "CC PRD-PT",
  CC_PRD_PT_ES: "CC PRD-PT-ES", CC_PRD_PT_NVA_ALIANZA: "CC PRD-PT-NVA",
  CC_PRD_PT_NVA_ALIANZA_ES: "CC PRD-PT-NVA-ES",
  CC_PRD_PT_NVA_ALIANZA_PH: "CC PRD-PT-NVA-PH", CC_PRD_PT_PH: "CC PRD-PT-PH",
  CC_PRI_PVEM: "CC PRI-PVEM", CC_PRI_PVEM_PT: "CC PRI-PVEM-PT",
  CC_PT_ES: "CC PT-ES", CC_PT_MC: "CC PT-MC",
  CC_PT_NVA_ALIANZA_PH: "CC PT-NVA-PH", CC_PT_PH: "CC PT-PH", CC_PT_PH_ES: "CC PT-PH-ES",
  // Candidaturas Comunitarias
  COMUN_PRD_PT: "Com. PRD-PT", COMUN_PRD_PT_PAN: "Com. PRD-PT-PAN",
  COMUN_PRI_PVEM: "Com. PRI-PVEM", COMUN_PRI_PVEM_NVA_ALIANZA: "Com. PRI-PVEM-NVA",
  // Candidatos independientes
  CAND_IND1: "Cand. Ind. 1",   CAND_IND2: "Cand. Ind. 2",   CAND_IND3: "Cand. Ind. 3",
  CAND_IND4: "Cand. Ind. 4",   CAND_IND5: "Cand. Ind. 5",   CAND_IND6: "Cand. Ind. 6",
  CAND_IND7: "Cand. Ind. 7",   CAND_IND8: "Cand. Ind. 8",   CAND_IND9: "Cand. Ind. 9",
  CAND_IND10: "Cand. Ind. 10", CAND_IND11: "Cand. Ind. 11", CAND_IND12: "Cand. Ind. 12",
  CAND_IND13: "Cand. Ind. 13", CAND_IND14: "Cand. Ind. 14", CAND_IND15: "Cand. Ind. 15",
  CAND_IND16: "Cand. Ind. 16", CAND_IND17: "Cand. Ind. 17", CAND_IND18: "Cand. Ind. 18",
  CAND_IND19: "Cand. Ind. 19", CAND_IND20: "Cand. Ind. 20", CAND_IND21: "Cand. Ind. 21",
  CAND_IND22: "Cand. Ind. 22",
  // Métricas especiales
  vot_nul: "Votos nulos",
  no_reg:  "Cand. no registrados",
};

// ============================================================
// COLORES DE PARTIDO — LIGHT MODE
// Extiende los colores federales con entradas locales.
// Partidos locales sin color asignado usan DEFAULT (gris neutro).
// Para asignar un color definitivo: agregar la entrada aquí y en _DARK.
// ============================================================

// Color "Otro" para partidos locales sin color asignado aún
const COLOR_OTRO_LIGHT = "#90A4AE"; // blue-grey 300
const COLOR_OTRO_DARK  = "#B0BEC5"; // blue-grey 200

export const PARTY_COLORS_LOC: Record<string, string> = {
  // ── Herencia federal (colores de identidad política exactos) ──────────────
  ...FED_COLORS,
  // ── Nueva Alianza (nombre distinto en locales vs NVALZ federal) ───────────
  NVA_ALIANZA: "#00A9C8",
  // ── Candidatura Común: azul-gris oscuro neutral ───────────────────────────
  CC: "#546E7A",
  // Candidaturas Comunes nombradas heredan el color del partido dominante
  // (PAN, PRD o PRI según el prefijo) — el fallback en la UI usará DEFAULT
  // ── Candidaturas Comunitarias ─────────────────────────────────────────────
  COMUN_PRD_PT:              FED_COLORS["PRD"]  ?? COLOR_OTRO_LIGHT,
  COMUN_PRD_PT_PAN:          FED_COLORS["PRD"]  ?? COLOR_OTRO_LIGHT,
  COMUN_PRI_PVEM:            FED_COLORS["PRI"]  ?? COLOR_OTRO_LIGHT,
  COMUN_PRI_PVEM_NVA_ALIANZA: FED_COLORS["PRI"] ?? COLOR_OTRO_LIGHT,
  // ── Coalición explícita ───────────────────────────────────────────────────
  COALICION_PRI_PVEM: FED_COLORS["PRI_PVEM"] ?? COLOR_OTRO_LIGHT,
  // ── Partidos locales — pendiente de color definitivo ─────────────────────
  BRE:  COLOR_OTRO_LIGHT,
  BS:   COLOR_OTRO_LIGHT,
  FACA: COLOR_OTRO_LIGHT,
  ISRM: COLOR_OTRO_LIGHT,
  JLCM: COLOR_OTRO_LIGHT,
  JRM:  COLOR_OTRO_LIGHT,
  MARM: COLOR_OTRO_LIGHT,
  MHTG: COLOR_OTRO_LIGHT,
  MVC:  COLOR_OTRO_LIGHT,
  PCP:  COLOR_OTRO_LIGHT,
  PCP_MC_NVA_ALIANZA: COLOR_OTRO_LIGHT,
  PCP_NVA_ALIANZA:    COLOR_OTRO_LIGHT,
  PCU:  COLOR_OTRO_LIGHT,
  PD:   COLOR_OTRO_LIGHT,
  PFD:  COLOR_OTRO_LIGHT,
  PPG:  COLOR_OTRO_LIGHT,
  // PAN_PRS: variante PAN
  PAN_PRS: FED_COLORS["PAN"] ?? COLOR_OTRO_LIGHT,
  DEFAULT: COLOR_OTRO_LIGHT,
};

// ============================================================
// COLORES DE PARTIDO — DARK MODE
// ============================================================

export const PARTY_COLORS_DARK_LOC: Record<string, string> = {
  // ── Herencia federal ──────────────────────────────────────────────────────
  ...FED_COLORS_DARK,
  // ── Nueva Alianza ─────────────────────────────────────────────────────────
  NVA_ALIANZA: "#4DCFE8",
  // ── Candidatura Común ─────────────────────────────────────────────────────
  CC: "#90A4AE",
  // ── Candidaturas Comunitarias ─────────────────────────────────────────────
  COMUN_PRD_PT:              FED_COLORS_DARK["PRD"]  ?? COLOR_OTRO_DARK,
  COMUN_PRD_PT_PAN:          FED_COLORS_DARK["PRD"]  ?? COLOR_OTRO_DARK,
  COMUN_PRI_PVEM:            FED_COLORS_DARK["PRI"]  ?? COLOR_OTRO_DARK,
  COMUN_PRI_PVEM_NVA_ALIANZA: FED_COLORS_DARK["PRI"] ?? COLOR_OTRO_DARK,
  // ── Coalición explícita ───────────────────────────────────────────────────
  COALICION_PRI_PVEM: FED_COLORS_DARK["PRI_PVEM"] ?? COLOR_OTRO_DARK,
  // ── Partidos locales — pendiente de color definitivo ─────────────────────
  BRE:  COLOR_OTRO_DARK,
  BS:   COLOR_OTRO_DARK,
  FACA: COLOR_OTRO_DARK,
  ISRM: COLOR_OTRO_DARK,
  JLCM: COLOR_OTRO_DARK,
  JRM:  COLOR_OTRO_DARK,
  MARM: COLOR_OTRO_DARK,
  MHTG: COLOR_OTRO_DARK,
  MVC:  COLOR_OTRO_DARK,
  PCP:  COLOR_OTRO_DARK,
  PCP_MC_NVA_ALIANZA: COLOR_OTRO_DARK,
  PCP_NVA_ALIANZA:    COLOR_OTRO_DARK,
  PCU:  COLOR_OTRO_DARK,
  PD:   COLOR_OTRO_DARK,
  PFD:  COLOR_OTRO_DARK,
  PPG:  COLOR_OTRO_DARK,
  PAN_PRS: FED_COLORS_DARK["PAN"] ?? COLOR_OTRO_DARK,
  DEFAULT: COLOR_OTRO_DARK,
};

// ============================================================
// COLUMNAS METADATA — no son votos de partido
// Versión local: sin circunscripción, con ambito; cve_del en lugar de cve_def.
// ============================================================

export const RESULTS_METADATA_COLS_LOC = new Set([
  "id", "anio", "cve_ambito", "ambito", "cve_cargo", "cargo",
  "cve_principio", "principio", "cve_tipo", "tipo",
  "cve_estado", "estado", "cve_del", "cabecera",
  "cve_mun", "municipio", "seccion",
  "total_votos", "lne", "part_ciud",
]);

// ============================================================
// ETIQUETAS PARA COLUMNAS DEL DATATABLE
// ============================================================

export const TABLA_COLUMN_LABELS_LOC: Record<string, string> = {
  anio:        "Año",
  cargo:       "Cargo",
  tipo:        "Tipo",
  principio:   "Principio",
  estado:      "Estado",
  cabecera:    "Cabecera Distrital",
  municipio:   "Municipio",
  seccion:     "Sección",
  total_votos: "Total de votos",
  lne:         "Lista Nominal",
  part_ciud:   "Participación Ciudadana (%)",
  no_reg:      "Cand. no registrados",
  vot_nul:     "Votos nulos",
};

// ============================================================
// HELPER: color de partido para locales (con fallback a DEFAULT)
// ============================================================

export function getPartidoColorLoc(col: string, dark = false): string {
  const map = dark ? PARTY_COLORS_DARK_LOC : PARTY_COLORS_LOC;
  return map[col] ?? map["DEFAULT"] ?? "#B0BEC5";
}

// ============================================================
// HELPER: etiqueta de partido para locales (con fallback al nombre)
// ============================================================

export function getPartidoLabelLoc(col: string): string {
  if (PARTIDO_LABELS_LOC[col]) return PARTIDO_LABELS_LOC[col];
  const m = col.match(/^CAND_IND(\d+)$/);
  if (m) return `Cand. Ind. ${m[1]}`;
  return col;
}

// ============================================================
// DEFAULTS DE CONSULTA
// estado es obligatorio — no existe vista "nacional" en elecciones locales
// ============================================================

export const ELECCIONES_LOCALES_DEFAULTS = {
  anio:      2021,
  cargo:     "dip_loc" as string,
  estado:    "AGUASCALIENTES" as string,
  partidos:  ["Todos"] as string[],
  tipo:      "ORDINARIA" as const,
  principio: "MAYORIA RELATIVA" as const,
  cabecera:  "" as string,
  municipio: "" as string,
  secciones: [] as string[],
};
