// lib/sefix/ecegConstants.ts
// Curated ECEG 2020 indicators for Estadísticos Geoelectorales.

export type EcegGroup =
  | "demografia"
  | "educacion"
  | "economia"
  | "salud"
  | "vivienda"
  | "hogar"
  | "conectividad"
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
  { key: "POBTOT",     label: "Población total",                        group: "demografia", unit: "personas" },
  { key: "REL_H_M",    label: "Relación hombres/mujeres",               group: "demografia", unit: "índice" },
  { key: "P3YM_HLI",   label: "Hablantes lengua indígena",              group: "demografia", unit: "personas" },
  { key: "POB0_14",    label: "Población 0–14 años",                    group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POB15_64",   label: "Población 15–64 años",                   group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POB65_MAS",  label: "Población 65+ años",                     group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POBMAS",     label: "Población masculina",                    group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POBFEM",     label: "Población femenina",                     group: "demografia", unit: "personas",  showByDefault: false },
  { key: "P_60YMAS",   label: "Población 60+ años",                     group: "demografia", unit: "personas",  showByDefault: false },
  { key: "P_15A49_F",  label: "Mujeres 15–49 años",                     group: "demografia", unit: "personas",  showByDefault: false },
  { key: "P_18YMAS",   label: "Población 18+ años",                     group: "demografia", unit: "personas",  showByDefault: false },
  { key: "PROM_HNV",   label: "Promedio hijos nacidos vivos",           group: "demografia", unit: "hijos",     showByDefault: false },
  { key: "POB_EDADNE", label: "Población sin edad especificada",        group: "demografia", unit: "personas",  showByDefault: false },
  { key: "POB_AFRO",   label: "Población afrodescendiente",             group: "demografia", unit: "personas",  showByDefault: false },
  { key: "P3HLINHE",   label: "Hablantes LI que no hablan español",     group: "demografia", unit: "personas",  showByDefault: false },
  { key: "PHOG_IND",   label: "Población en hogares indígenas",         group: "demografia", unit: "personas",  showByDefault: false },
  { key: "PNACOE",     label: "Nacidos en otro estado",                 group: "demografia", unit: "personas",  showByDefault: false },

  // ── Educación ───────────────────────────────────────────────────────────────
  { key: "GRAPROES",   label: "Grado promedio de escolaridad",          group: "educacion", unit: "años" },
  { key: "P15YM_SE",   label: "Población sin escolaridad (15+)",        group: "educacion", unit: "personas" },
  { key: "P15A17A",    label: "Asistencia escolar 15–17 años",          group: "educacion", unit: "personas" },
  { key: "P15YM_AN",   label: "Población sin instrucción (15+)",        group: "educacion", unit: "personas",  showByDefault: false },
  { key: "P18YM_PB",   label: "Con educación básica incompleta (18+)",  group: "educacion", unit: "personas",  showByDefault: false },
  { key: "P15PRI_IN",  label: "Con primaria incompleta (15+)",          group: "educacion", unit: "personas",  showByDefault: false },
  { key: "P15PRI_CO",  label: "Con primaria completa (15+)",            group: "educacion", unit: "personas",  showByDefault: false },
  { key: "P15SEC_IN",  label: "Con secundaria incompleta (15+)",        group: "educacion", unit: "personas",  showByDefault: false },
  { key: "P15SEC_CO",  label: "Con secundaria completa (15+)",          group: "educacion", unit: "personas",  showByDefault: false },
  { key: "P18A24A",    label: "Asistencia escolar 18–24 años",          group: "educacion", unit: "personas",  showByDefault: false },

  // ── Economía y Empleo ────────────────────────────────────────────────────────
  { key: "PEA",        label: "Población económicamente activa",        group: "economia", unit: "personas" },
  { key: "PDESOCUP",   label: "Población desocupada",                   group: "economia", unit: "personas" },
  { key: "PDER_SS",    label: "Con seguridad social",                   group: "economia", unit: "personas" },
  { key: "POCUPADA",   label: "Población ocupada",                      group: "economia", unit: "personas",  showByDefault: false },
  { key: "PE_INAC",    label: "Población inactiva",                     group: "economia", unit: "personas",  showByDefault: false },
  { key: "PDER_IMSS",  label: "Derechohabiente IMSS",                   group: "economia", unit: "personas",  showByDefault: false },
  { key: "PDER_ISTE",  label: "Derechohabiente ISSSTE federal",         group: "economia", unit: "personas",  showByDefault: false },
  { key: "PDER_ISTEE", label: "Derechohabiente ISSSTE estatal",         group: "economia", unit: "personas",  showByDefault: false },
  { key: "PDER_SEGP",  label: "Seguro Popular / INSABI",                group: "economia", unit: "personas",  showByDefault: false },

  // ── Salud y Discapacidad ─────────────────────────────────────────────────────
  { key: "PSINDER",    label: "Sin derechohabiencia a salud",           group: "salud", unit: "personas" },
  { key: "PCON_DISC",  label: "Con alguna discapacidad",                group: "salud", unit: "personas" },
  { key: "PCDISC_MEN", label: "Discapacidad mental",                    group: "salud", unit: "personas" },
  { key: "PCDISC_MOT", label: "Discapacidad motriz",                    group: "salud", unit: "personas",  showByDefault: false },
  { key: "PCDISC_VIS", label: "Discapacidad visual",                    group: "salud", unit: "personas",  showByDefault: false },
  { key: "PCDISC_AUD", label: "Discapacidad auditiva",                  group: "salud", unit: "personas",  showByDefault: false },
  { key: "PCON_LIMI",  label: "Con alguna limitación",                  group: "salud", unit: "personas",  showByDefault: false },

  // ── Vivienda ─────────────────────────────────────────────────────────────────
  { key: "VPH_AGUADV", label: "Con agua de la red pública",             group: "vivienda", unit: "viviendas" },
  { key: "VPH_S_ELEC", label: "Sin servicio de electricidad",           group: "vivienda", unit: "viviendas" },
  { key: "VPH_MOTO",   label: "Viviendas con motocicleta",              group: "vivienda", unit: "viviendas" },
  { key: "VPH_PISODT", label: "Viviendas con piso de tierra",           group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_DRENAJ", label: "Con drenaje",                            group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_NODREN", label: "Sin drenaje",                            group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_EXCSA",  label: "Con excusado / sanitario",               group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_TINACO", label: "Con tinaco",                             group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_CISTER", label: "Con cisterna",                           group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_1CUART", label: "Viviendas de 1 cuarto",                  group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_NDEAED", label: "Viviendas no disponibles",               group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_SNBIEN", label: "Viviendas sin ningún bien",              group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_REFRI",  label: "Viviendas con refrigerador",             group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_LAVAD",  label: "Viviendas con lavadora",                 group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_AUTOM",  label: "Viviendas con automóvil",                group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_BICI",   label: "Viviendas con bicicleta",                group: "vivienda", unit: "viviendas", showByDefault: false },
  { key: "VPH_TV",     label: "Viviendas con televisión",               group: "vivienda", unit: "viviendas", showByDefault: false },

  // ── Hogar ────────────────────────────────────────────────────────────────────
  { key: "TOTHOG",     label: "Total de hogares",                       group: "hogar", unit: "hogares" },
  { key: "OCUPVIVPAR", label: "Promedio de ocupantes por vivienda",     group: "hogar", unit: "personas/viv." },
  { key: "HOGJEF_F",   label: "Hogares con jefatura femenina",          group: "hogar", unit: "hogares" },
  { key: "VIVPAR_DES", label: "Viviendas deshabitadas",                 group: "hogar", unit: "viviendas", showByDefault: false },
  { key: "PRO_OCUP_C", label: "Promedio de ocupantes por cuarto",       group: "hogar", unit: "personas/cuarto", showByDefault: false },
  { key: "HOGJEF_M",   label: "Hogares con jefatura masculina",         group: "hogar", unit: "hogares",   showByDefault: false },
  { key: "VIVPAR_HAB", label: "Viviendas particulares habitadas",       group: "hogar", unit: "viviendas", showByDefault: false },
  { key: "TVIVPAR",    label: "Total viviendas particulares",           group: "hogar", unit: "viviendas", showByDefault: false },

  // ── Conectividad ─────────────────────────────────────────────────────────────
  { key: "VPH_INTER",  label: "Viviendas con internet",                 group: "conectividad", unit: "viviendas" },
  { key: "VPH_CEL",    label: "Viviendas con teléfono celular",         group: "conectividad", unit: "viviendas" },
  { key: "VPH_SINTIC", label: "Sin TIC (teléfono, PC, internet)",       group: "conectividad", unit: "viviendas" },
  { key: "VPH_PC",     label: "Viviendas con computadora",              group: "conectividad", unit: "viviendas", showByDefault: false },
  { key: "VPH_SINCIN", label: "Sin computadora ni internet",            group: "conectividad", unit: "viviendas", showByDefault: false },
  { key: "VPH_TELEF",  label: "Viviendas con teléfono fijo",            group: "conectividad", unit: "viviendas", showByDefault: false },
  { key: "VPH_SINRTV", label: "Sin radio ni TV",                        group: "conectividad", unit: "viviendas", showByDefault: false },
  { key: "VPH_SINLTC", label: "Sin línea telefónica fija",              group: "conectividad", unit: "viviendas", showByDefault: false },

  // ── Religión ──────────────────────────────────────────────────────────────
  { key: "PCATOLICA",  label: "Población católica",                     group: "religion", unit: "personas" },
  { key: "PRO_CRIEVA", label: "Protestante / cristiano evangélico",     group: "religion", unit: "personas" },
  { key: "PSIN_RELIG", label: "Sin religión",                           group: "religion", unit: "personas" },
];

export const ECEG_INDICATOR_MAP: Record<string, EcegIndicator> = Object.fromEntries(
  ECEG_INDICATORS.map((i) => [i.key, i])
);

export const ECEG_VALID_KEYS: Set<string> = new Set(ECEG_INDICATORS.map((i) => i.key));

export const ECEG_GROUPS: { id: EcegGroup; label: string }[] = [
  { id: "demografia",   label: "Demografía" },
  { id: "educacion",    label: "Educación" },
  { id: "economia",     label: "Economía y Empleo" },
  { id: "salud",        label: "Salud y Discapacidad" },
  { id: "vivienda",     label: "Vivienda" },
  { id: "hogar",        label: "Hogar" },
  { id: "conectividad", label: "Conectividad" },
  { id: "religion",     label: "Religión" },
];

// Color ramps per group — low = few/low, high = many/high
export const ECEG_COLOR_RAMPS: Record<EcegGroup, { low: string; high: string }> = {
  demografia:   { low: "#F9EFF8", high: "#7D1E6F" },
  educacion:    { low: "#EDE6FC", high: "#7838E7" },
  economia:     { low: "#E4EFF2", high: "#064051" },
  salud:        { low: "#FCE9F0", high: "#E15383" },
  vivienda:     { low: "#ECEAF6", high: "#6358A0" },
  hogar:        { low: "#F3E9EF", high: "#70284A" },
  conectividad: { low: "#E3EDFC", high: "#0956DB" },
  religion:     { low: "#FCE9FD", high: "#CB4BD4" },
};

export const DEFAULT_ECEG_VARIABLE = "POBTOT";

// Natural denominators for each indicator.
// Indicators with no entry here are index/average values — shown as raw value, not %.
export const ECEG_DENOMINATORS: Partial<Record<string, string>> = {
  // Demografía → POBTOT
  P3YM_HLI: "POBTOT", P3HLINHE: "POBTOT", PHOG_IND: "POBTOT",
  POB_AFRO: "POBTOT", POB0_14: "POBTOT", POB15_64: "POBTOT",
  POB65_MAS: "POBTOT", P_60YMAS: "POBTOT", P_15A49_F: "POBTOT",
  P_18YMAS: "POBTOT", POBMAS: "POBTOT", POBFEM: "POBTOT",
  PNACOE: "POBTOT",
  // Educación → P_18YMAS (proxy 15+ años)
  P15YM_SE: "P_18YMAS", P15YM_AN: "P_18YMAS", P18YM_PB: "P_18YMAS",
  P15PRI_IN: "P_18YMAS", P15PRI_CO: "P_18YMAS",
  P15SEC_IN: "P_18YMAS", P15SEC_CO: "P_18YMAS",
  P15A17A: "P_18YMAS", P18A24A: "P_18YMAS",
  // Economía/Empleo → PEA o P_18YMAS
  PEA: "P_18YMAS", POCUPADA: "PEA", PDESOCUP: "PEA", PE_INAC: "P_18YMAS",
  PDER_SS: "POBTOT", PDER_IMSS: "POBTOT", PDER_ISTE: "POBTOT",
  PDER_ISTEE: "POBTOT", PDER_SEGP: "POBTOT",
  // Salud → POBTOT
  PSINDER: "POBTOT", PCON_DISC: "POBTOT", PCDISC_MOT: "POBTOT",
  PCDISC_VIS: "POBTOT", PCDISC_AUD: "POBTOT", PCDISC_MEN: "POBTOT",
  PCON_LIMI: "POBTOT",
  // Vivienda → VIVPAR_HAB (excl. VPH_NDEAED → TVIVPAR)
  VPH_AGUADV: "VIVPAR_HAB", VPH_S_ELEC: "VIVPAR_HAB", VPH_NODREN: "VIVPAR_HAB",
  VPH_DRENAJ: "VIVPAR_HAB", VPH_EXCSA: "VIVPAR_HAB", VPH_PISODT: "VIVPAR_HAB",
  VPH_1CUART: "VIVPAR_HAB", VPH_TINACO: "VIVPAR_HAB", VPH_CISTER: "VIVPAR_HAB",
  VPH_SNBIEN: "VIVPAR_HAB", VPH_REFRI: "VIVPAR_HAB", VPH_LAVAD: "VIVPAR_HAB",
  VPH_AUTOM: "VIVPAR_HAB", VPH_MOTO: "VIVPAR_HAB", VPH_BICI: "VIVPAR_HAB",
  VPH_TV: "VIVPAR_HAB", VPH_NDEAED: "TVIVPAR",
  // Conectividad → VIVPAR_HAB
  VPH_INTER: "VIVPAR_HAB", VPH_CEL: "VIVPAR_HAB", VPH_PC: "VIVPAR_HAB",
  VPH_TELEF: "VIVPAR_HAB", VPH_SINCIN: "VIVPAR_HAB", VPH_SINLTC: "VIVPAR_HAB",
  VPH_SINRTV: "VIVPAR_HAB", VPH_SINTIC: "VIVPAR_HAB",
  // Hogar
  HOGJEF_F: "TOTHOG", HOGJEF_M: "TOTHOG", VIVPAR_DES: "TVIVPAR",
  // Religión → POBTOT
  PCATOLICA: "POBTOT", PRO_CRIEVA: "POBTOT", PSIN_RELIG: "POBTOT",
  // Sin denominador (índices): GRAPROES REL_H_M OCUPVIVPAR PRO_OCUP_C PROM_HNV
  //   TOTHOG VIVPAR_HAB TVIVPAR POBTOT — muestran valor absoluto con unidad
};
