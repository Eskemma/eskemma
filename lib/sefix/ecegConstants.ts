// lib/sefix/ecegConstants.ts
// Curated ECEG 2020 indicators for Estadísticos Geoelectorales.

export type EcegGroup =
  | "demografia"
  | "educacion"
  | "economia"
  | "vivienda"
  | "conectividad"
  | "hogar";

export interface EcegIndicator {
  key: string;
  label: string;
  group: EcegGroup;
  unit?: string;
  description?: string;
}

export const ECEG_INDICATORS: EcegIndicator[] = [
  // ── Demografía ──────────────────────────────────────────────────────────
  { key: "POBTOT",    label: "Población total",             group: "demografia", unit: "personas" },
  { key: "POB0_14",   label: "Población 0-14 años",         group: "demografia", unit: "personas" },
  { key: "POB15_64",  label: "Población 15-64 años",        group: "demografia", unit: "personas" },
  { key: "POB65_MAS", label: "Población 65+ años",          group: "demografia", unit: "personas" },
  { key: "P3YM_HLI",  label: "Hablantes lengua indígena",   group: "demografia", unit: "personas" },
  { key: "POB_AFRO",  label: "Población afrodescendiente",  group: "demografia", unit: "personas" },
  { key: "REL_H_M",   label: "Relación hombres/mujeres",    group: "demografia", unit: "índice" },

  // ── Educación ───────────────────────────────────────────────────────────
  { key: "GRAPROES",  label: "Grado promedio de escolaridad", group: "educacion", unit: "años" },
  { key: "P15YM_AN",  label: "Población sin instrucción (15+)", group: "educacion", unit: "personas" },

  // ── Economía ────────────────────────────────────────────────────────────
  { key: "PEA",       label: "Población económicamente activa", group: "economia", unit: "personas" },
  { key: "POCUPADA",  label: "Población ocupada",               group: "economia", unit: "personas" },
  { key: "PDESOCUP",  label: "Población desocupada",            group: "economia", unit: "personas" },
  { key: "PSINDER",   label: "Sin derechohabiencia a salud",    group: "economia", unit: "personas" },

  // ── Vivienda ────────────────────────────────────────────────────────────
  { key: "VPH_PISODT", label: "Viviendas con piso de tierra",       group: "vivienda", unit: "viviendas" },
  { key: "VPH_AGUADV", label: "Viviendas sin agua disponible",      group: "vivienda", unit: "viviendas" },
  { key: "VPH_SINRTV", label: "Viviendas sin radio ni TV",          group: "vivienda", unit: "viviendas" },

  // ── Conectividad ────────────────────────────────────────────────────────
  { key: "VPH_INTER",  label: "Viviendas con internet",             group: "conectividad", unit: "viviendas" },
  { key: "VPH_CEL",    label: "Viviendas con teléfono celular",     group: "conectividad", unit: "viviendas" },
  { key: "VPH_PC",     label: "Viviendas con computadora",          group: "conectividad", unit: "viviendas" },
  { key: "VPH_SINCIN",  label: "Viviendas sin computadora/internet", group: "conectividad", unit: "viviendas" },

  // ── Hogar ────────────────────────────────────────────────────────────────
  { key: "TOTHOG",     label: "Total de hogares",                    group: "hogar", unit: "hogares" },
  { key: "VIVPAR_DES", label: "Viviendas deshabitadas",              group: "hogar", unit: "viviendas" },
  { key: "OCUPVIVPAR", label: "Promedio ocupantes por vivienda",     group: "hogar", unit: "personas/viv." },
  { key: "PRO_OCUP_C", label: "Promedio ocupantes por cuarto",      group: "hogar", unit: "personas/cuarto" },
];

export const ECEG_INDICATOR_MAP: Record<string, EcegIndicator> = Object.fromEntries(
  ECEG_INDICATORS.map((i) => [i.key, i])
);

export const ECEG_VALID_KEYS: Set<string> = new Set(ECEG_INDICATORS.map((i) => i.key));

export const ECEG_GROUPS: { id: EcegGroup; label: string }[] = [
  { id: "demografia",   label: "Demografía" },
  { id: "educacion",    label: "Educación" },
  { id: "economia",     label: "Economía" },
  { id: "vivienda",     label: "Vivienda" },
  { id: "conectividad", label: "Conectividad" },
  { id: "hogar",        label: "Hogar" },
];

// Color ramps per group — low = few/low, high = many/high
export const ECEG_COLOR_RAMPS: Record<EcegGroup, { low: string; high: string }> = {
  demografia:   { low: "#EFF6FF", high: "#1D4ED8" },
  educacion:    { low: "#F0FDF4", high: "#15803D" },
  economia:     { low: "#FFFBEB", high: "#B45309" },
  vivienda:     { low: "#FFF1F2", high: "#BE123C" },
  conectividad: { low: "#F5F3FF", high: "#7C3AED" },
  hogar:        { low: "#F0F9FF", high: "#0369A1" },
};

export const DEFAULT_ECEG_VARIABLE = "POBTOT";
