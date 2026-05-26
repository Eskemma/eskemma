// lib/sefix/ecegConstants.ts
// Curated ECEG 2020 indicators for Estadísticos Geoelectorales.

export type EcegGroup =
  | "demografia"
  | "educacion"
  | "economia"
  | "vivienda"
  | "hogar"
  | "conectividad"
  | "indigena"
  | "discapacidad"
  | "bienes_vivienda"
  | "religion";

export interface EcegIndicator {
  key: string;
  label: string;
  group: EcegGroup;
  unit?: string;
  description?: string;
  /** When false, appears in the "Más [grupo]" dropdown instead of as a default pill. */
  showByDefault?: boolean;
}

export const ECEG_INDICATORS: EcegIndicator[] = [
  // ── Demografía ──────────────────────────────────────────────────────────────
  { key: "POBTOT",    label: "Población total",               group: "demografia", unit: "personas" },
  { key: "REL_H_M",   label: "Relación hombres/mujeres",      group: "demografia", unit: "índice" },
  { key: "PROM_HNV",  label: "Promedio hijos nacidos vivos",  group: "demografia", unit: "hijos" },
  { key: "POB0_14",   label: "Población 0–14 años",           group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POB15_64",  label: "Población 15–64 años",          group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POB65_MAS", label: "Población 65+ años",            group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POBMAS",    label: "Población masculina",           group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POBFEM",    label: "Población femenina",            group: "demografia", unit: "personas",  showByDefault: false },
  { key: "P_60YMAS",  label: "Población 60+ años",            group: "demografia", unit: "personas",  showByDefault: false },
  { key: "P_15A49_F", label: "Mujeres 15–49 años",            group: "demografia", unit: "personas",  showByDefault: false },
  { key: "P_18YMAS",  label: "Población 18+ años",            group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POB_EDADNE",label: "Población sin edad especificada", group: "demografia", unit: "personas", showByDefault: false },
  { key: "PNACOE",    label: "Nacidos en otro estado",        group: "demografia", unit: "personas",  showByDefault: false },

  // ── Educación ───────────────────────────────────────────────────────────────
  { key: "GRAPROES",  label: "Grado promedio de escolaridad",        group: "educacion", unit: "años" },
  { key: "P18YM_PB",  label: "Con educación básica incompleta (18+)", group: "educacion", unit: "personas" },
  { key: "P15A17A",   label: "Asistencia escolar 15–17 años",        group: "educacion", unit: "personas" },
  { key: "P15YM_AN",  label: "Población sin instrucción (15+)",      group: "educacion", unit: "personas", showByDefault: false },
  { key: "P15YM_SE",  label: "Población sin escolaridad (15+)",      group: "educacion", unit: "personas", showByDefault: false },
  { key: "P15PRI_IN", label: "Primaria incompleta (15+)",            group: "educacion", unit: "personas", showByDefault: false },
  { key: "P15PRI_CO", label: "Primaria completa (15+)",              group: "educacion", unit: "personas", showByDefault: false },
  { key: "P15SEC_IN", label: "Secundaria incompleta (15+)",          group: "educacion", unit: "personas", showByDefault: false },
  { key: "P15SEC_CO", label: "Secundaria completa (15+)",            group: "educacion", unit: "personas", showByDefault: false },
  { key: "P18A24A",   label: "Asistencia escolar 18–24 años",        group: "educacion", unit: "personas", showByDefault: false },

  // ── Economía y Empleo ────────────────────────────────────────────────────────
  { key: "PEA",       label: "Población económicamente activa", group: "economia", unit: "personas" },
  { key: "POCUPADA",  label: "Población ocupada",               group: "economia", unit: "personas" },
  { key: "PSINDER",   label: "Sin derechohabiencia a salud",    group: "economia", unit: "personas" },
  { key: "PDESOCUP",  label: "Población desocupada",            group: "economia", unit: "personas", showByDefault: false },
  { key: "PE_INAC",   label: "Población inactiva",              group: "economia", unit: "personas", showByDefault: false },
  { key: "PDER_SS",   label: "Con seguridad social",            group: "economia", unit: "personas", showByDefault: false },
  { key: "PDER_IMSS", label: "Derechohabiente IMSS",            group: "economia", unit: "personas", showByDefault: false },
  { key: "PDER_ISTE", label: "Derechohabiente ISSSTE federal",  group: "economia", unit: "personas", showByDefault: false },
  { key: "PDER_ISTEE",label: "Derechohabiente ISSSTE estatal",  group: "economia", unit: "personas", showByDefault: false },
  { key: "PDER_SEGP", label: "Seguro Popular / INSABI",         group: "economia", unit: "personas", showByDefault: false },

  // ── Vivienda ─────────────────────────────────────────────────────────────────
  { key: "VPH_AGUADV", label: "Viviendas sin agua disponible",    group: "vivienda", unit: "viviendas" },
  { key: "VPH_SINRTV", label: "Viviendas sin radio ni TV",        group: "vivienda", unit: "viviendas" },
  { key: "VPH_S_ELEC", label: "Sin servicio de electricidad",     group: "vivienda", unit: "viviendas" },
  { key: "VPH_PISODT", label: "Viviendas con piso de tierra",     group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_DRENAJ", label: "Con drenaje",                      group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_NODREN", label: "Sin drenaje",                      group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_EXCSA",  label: "Con excusado / sanitario",         group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_TINACO", label: "Con tinaco",                       group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_CISTER", label: "Con cisterna",                     group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_1CUART", label: "Viviendas de 1 cuarto",            group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_NDEAED", label: "Viviendas no disponibles",         group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_SNBIEN", label: "Viviendas sin ningún bien",        group: "vivienda", unit: "viviendas", showByDefault: false },

  // ── Hogar ────────────────────────────────────────────────────────────────────
  { key: "TOTHOG",     label: "Total de hogares",                  group: "hogar", unit: "hogares" },
  { key: "OCUPVIVPAR", label: "Promedio ocupantes por vivienda",   group: "hogar", unit: "personas/viv." },
  { key: "HOGJEF_F",   label: "Hogares con jefatura femenina",     group: "hogar", unit: "hogares" },
  { key: "VIVPAR_DES", label: "Viviendas deshabitadas",            group: "hogar", unit: "viviendas", showByDefault: false },
  { key: "PRO_OCUP_C", label: "Promedio ocupantes por cuarto",     group: "hogar", unit: "personas/cuarto", showByDefault: false },
  { key: "HOGJEF_M",   label: "Hogares con jefatura masculina",    group: "hogar", unit: "hogares",   showByDefault: false },
  { key: "VIVPAR_HAB", label: "Viviendas particulares habitadas",  group: "hogar", unit: "viviendas", showByDefault: false },
  { key: "TVIVPAR",    label: "Total viviendas particulares",      group: "hogar", unit: "viviendas", showByDefault: false },

  // ── Conectividad ─────────────────────────────────────────────────────────────
  { key: "VPH_INTER",  label: "Viviendas con internet",             group: "conectividad", unit: "viviendas" },
  { key: "VPH_CEL",    label: "Viviendas con teléfono celular",     group: "conectividad", unit: "viviendas" },
  { key: "VPH_PC",     label: "Viviendas con computadora",          group: "conectividad", unit: "viviendas" },
  { key: "VPH_SINCIN", label: "Sin computadora ni internet",        group: "conectividad", unit: "viviendas", showByDefault: false },
  { key: "VPH_TELEF",  label: "Viviendas con teléfono fijo",        group: "conectividad", unit: "viviendas", showByDefault: false },
  { key: "VPH_SINLTC", label: "Sin línea telefónica fija",          group: "conectividad", unit: "viviendas", showByDefault: false },
  { key: "VPH_SINTIC", label: "Sin TIC (teléfono, PC, internet)",   group: "conectividad", unit: "viviendas", showByDefault: false },

  // ── Población Indígena y Afrodescendiente ─────────────────────────────────
  { key: "P3YM_HLI",  label: "Hablantes lengua indígena",        group: "indigena", unit: "personas" },
  { key: "POB_AFRO",  label: "Población afrodescendiente",       group: "indigena", unit: "personas" },
  { key: "P3HLINHE",  label: "Hablantes LI sin español",         group: "indigena", unit: "personas" },
  { key: "PHOG_IND",  label: "Población en hogares indígenas",   group: "indigena", unit: "personas", showByDefault: false },

  // ── Discapacidad y Salud ──────────────────────────────────────────────────
  { key: "PCON_DISC",  label: "Con alguna discapacidad",  group: "discapacidad", unit: "personas" },
  { key: "PCDISC_MOT", label: "Discapacidad motriz",      group: "discapacidad", unit: "personas" },
  { key: "PCDISC_MEN", label: "Discapacidad mental",      group: "discapacidad", unit: "personas" },
  { key: "PCDISC_VIS", label: "Discapacidad visual",      group: "discapacidad", unit: "personas", showByDefault: false },
  { key: "PCDISC_AUD", label: "Discapacidad auditiva",    group: "discapacidad", unit: "personas", showByDefault: false },
  { key: "PCON_LIMI",  label: "Con alguna limitación",    group: "discapacidad", unit: "personas", showByDefault: false },

  // ── Bienes Duraderos en Vivienda ─────────────────────────────────────────
  { key: "VPH_REFRI",  label: "Viviendas con refrigerador",   group: "bienes_vivienda", unit: "viviendas" },
  { key: "VPH_AUTOM",  label: "Viviendas con automóvil",      group: "bienes_vivienda", unit: "viviendas" },
  { key: "VPH_MOTO",   label: "Viviendas con motocicleta",    group: "bienes_vivienda", unit: "viviendas" },
  { key: "VPH_LAVAD",  label: "Viviendas con lavadora",       group: "bienes_vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_BICI",   label: "Viviendas con bicicleta",      group: "bienes_vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_TV",     label: "Viviendas con televisión",     group: "bienes_vivienda", unit: "viviendas", showByDefault: false },

  // ── Religión ──────────────────────────────────────────────────────────────
  { key: "PCATOLICA",  label: "Población católica",                    group: "religion", unit: "personas" },
  { key: "PRO_CRIEVA", label: "Protestante / cristiano evangélico",    group: "religion", unit: "personas" },
  { key: "PSIN_RELIG", label: "Sin religión",                         group: "religion", unit: "personas" },
];

export const ECEG_INDICATOR_MAP: Record<string, EcegIndicator> = Object.fromEntries(
  ECEG_INDICATORS.map((i) => [i.key, i])
);

export const ECEG_VALID_KEYS: Set<string> = new Set(ECEG_INDICATORS.map((i) => i.key));

export const ECEG_GROUPS: { id: EcegGroup; label: string }[] = [
  { id: "demografia",      label: "Demografía" },
  { id: "educacion",       label: "Educación" },
  { id: "economia",        label: "Economía y Empleo" },
  { id: "vivienda",        label: "Vivienda" },
  { id: "hogar",           label: "Hogar" },
  { id: "conectividad",    label: "Conectividad" },
  { id: "indigena",        label: "Pobl. Indígena y Afrodesc." },
  { id: "discapacidad",    label: "Discapacidad y Salud" },
  { id: "bienes_vivienda", label: "Bienes Duraderos" },
  { id: "religion",        label: "Religión" },
];

// Color ramps per group — low = few/low, high = many/high
export const ECEG_COLOR_RAMPS: Record<EcegGroup, { low: string; high: string }> = {
  demografia:      { low: "#EFF6FF", high: "#1D4ED8" },
  educacion:       { low: "#F0FDF4", high: "#15803D" },
  economia:        { low: "#FFFBEB", high: "#B45309" },
  vivienda:        { low: "#FFF1F2", high: "#BE123C" },
  hogar:           { low: "#F0F9FF", high: "#0369A1" },
  conectividad:    { low: "#F5F3FF", high: "#7C3AED" },
  indigena:        { low: "#F0FDF4", high: "#166534" },
  discapacidad:    { low: "#FFF7ED", high: "#C2410C" },
  bienes_vivienda: { low: "#F0F9FF", high: "#0369A1" },
  religion:        { low: "#F8FAFC", high: "#475569" },
};

export const DEFAULT_ECEG_VARIABLE = "POBTOT";
