// types/sefix.types.ts
// Tipos compartidos para el módulo Sefix (dashboard electoral)

// ============================================================
// NAVEGACIÓN
// ============================================================

export type SefixTabId =
  | "lne"
  | "elecciones_fed"
  | "elecciones_loc"
  | "geo"
  | "geoestadisticos"
  | "otros";

export interface SefixTab {
  id: SefixTabId;
  label: string;
  available: boolean;
}

export const SEFIX_TABS: SefixTab[] = [
  { id: "lne", label: "Padrón y Lista Nominal", available: true },
  { id: "elecciones_fed", label: "Elecciones Federales", available: true },
  { id: "elecciones_loc", label: "Elecciones Locales", available: true },
  { id: "geo", label: "Visualización Geográfica", available: true },
  { id: "geoestadisticos", label: "Estadísticos Geoelectorales", available: true },
  { id: "otros", label: "Otros Estadísticos", available: false },
];

// ============================================================
// FILTRO GEOGRÁFICO
// ============================================================

export type GeoNivel = "nacional" | "estatal" | "distrital" | "municipal" | "seccional";

export interface GeoScope {
  nivel: GeoNivel;
  entidad?: string;    // nombre del estado
  cveEntidad?: string; // clave 01-32
  distrito?: string;
  municipio?: string;
  seccion?: string;
}

export const GEO_SCOPE_NACIONAL: GeoScope = { nivel: "nacional" };

// ============================================================
// DATOS — SERIE PRE-AGREGADA (semanal_series/)
// ============================================================

/** Una fila del archivo serie_nacional_sexo.csv o serie_extranjero_sexo.csv */
export interface SexoSerieRow {
  fecha: string;
  padron_hombres: number;
  padron_mujeres: number;
  padron_no_binario: number;
  lista_hombres: number;
  lista_mujeres: number;
  lista_no_binario: number;
}

/** Una fila del archivo serie_nacional_edad.csv o serie_extranjero_edad.csv */
export interface EdadSerieRow {
  fecha: string;
  padron_18: number;
  lista_18: number;
  padron_19: number;
  lista_19: number;
  padron_20_24: number;
  lista_20_24: number;
  padron_25_29: number;
  lista_25_29: number;
  padron_30_34: number;
  lista_30_34: number;
  padron_35_39: number;
  lista_35_39: number;
  padron_40_44: number;
  lista_40_44: number;
  padron_45_49: number;
  lista_45_49: number;
  padron_50_54: number;
  lista_50_54: number;
  padron_55_59: number;
  lista_55_59: number;
  padron_60_64: number;
  lista_60_64: number;
  padron_65_y_mas: number;
  lista_65_y_mas: number;
  padron_total: number;
  lista_total: number;
}

/** Una fila de serie_nacional_origen.csv o serie_extranjero_origen.csv */
export interface OrigenSerieRow {
  fecha: string;
  // 32 estados + pad87/pad88 + ln87/ln88
  [key: string]: string | number;
}

// ============================================================
// DATOS — CORTE ÚNICO SEMANAL (archivos crudos procesados vía API)
// ============================================================

/** Fila procesada del archivo semanal _sexo (una sección electoral) */
export interface LneSemanalSexoRow {
  cve_entidad: string;
  nombre_entidad: string;
  cve_distrito: string;
  cabecera_distrital: string;
  cve_municipio: string;
  nombre_municipio: string;
  seccion: string;
  padron_hombres: number;
  padron_mujeres: number;
  padron_no_binario: number;
  padron_electoral: number;
  lista_hombres: number;
  lista_mujeres: number;
  lista_no_binario: number;
  lista_nominal: number;
}

/** Fila procesada del archivo histórico _base */
export interface LneHistoricoRow {
  fecha: string;  // YYYY-MM-DD
  padron_nacional: number;
  lista_nacional: number;
  padron_extranjero: number;
  lista_extranjero: number;
  padron_hombres?: number;
  padron_mujeres?: number;
  padron_no_binario?: number;
}

// ============================================================
// DATOS — RESULTADOS ELECTORALES
// ============================================================

/** Re-exportado desde lib/sefix/storage.ts para uso en componentes cliente */
export interface ResultadosChartData {
  estado: string;
  cargo: string;
  anio: number;
  totalVotos: number;
  lne: number;
  participacion: number;
  votosNulos: number;
  partidos: { partido: string; votos: number; porcentaje: number }[];
  coaliconesIncluidas: string[];
  fuente: string;
  /** Set when the target geo scope was found in a different district this year (redistricting). */
  distritoRedistritado?: string;
  /** Indicates whether the redistricting affected a municipio or selected secciones. */
  redistritadoScope?: "municipio" | "secciones";
}

// ============================================================
// FILTROS ELECCIONES FEDERALES
// ============================================================

export interface EleccionesFilterParams {
  anio: number;
  cargo: string;       // "dip" | "sen" | "pdte"
  estado: string;      // "" = Nacional
  partidos: string[];  // ["Todos"] o lista específica
  tipo: string;        // "ORDINARIA" | "EXTRAORDINARIA" | "AMBAS"
  principio: string;   // "MAYORIA RELATIVA" | "REPRESENTACION PROPORCIONAL"
  cabecera: string;    // "" = Todos
  municipio: string;   // "" = Todos
  secciones: string[]; // [] = Todas
  incluirExtranjero: boolean;
}

export interface EleccionesLocalesFilterParams {
  estado: string;      // Llave primaria de la cascada — obligatorio, sin vista "Nacional"
  anio: number;        // Se filtra por años disponibles para el estado seleccionado
  cargo: string;       // Se filtra por cargos disponibles para el estado+año seleccionado
  partidos: string[];  // ["Todos"] o lista específica
  tipo: string;        // "ORDINARIA" | "EXTRAORDINARIA" | "AMBAS"
  principio: string;   // "MAYORIA RELATIVA" | "REPRESENTACION PROPORCIONAL"
  cabecera: string;    // "" = Todos los distritos del estado
  municipio: string;   // "" = Todos los municipios del distrito
  secciones: string[]; // [] = Todas las secciones
}

export interface ParticipacionPorNivel {
  nacional?: number;
  estatal?: number;
  distrital?: number;
  municipal?: number;
  seccional?: number;
}

export interface ResultadosEleccionesData {
  estado: string;
  cargo: string;
  anio: number;
  totalVotos: number;
  lne: number;
  participacion: number;
  votosNulos: number;
  votosExtranjero?: number;
  partidos: { partido: string; votos: number; porcentaje: number; votosTotal: number }[];
  fuente: string;
  participacionPorNivel: ParticipacionPorNivel;
}

export interface GeoEleccionesOpcion {
  cve: string;
  nombre: string;
}

// ============================================================
// SUB-VIEWS DE LNE
// ============================================================

export type LneSubView = "historico" | "semanal";
export type SemanalDesglose = "edad" | "sexo" | "origen";

// ============================================================
// ESTADO DE LA MÁQUINA DE ESTADOS (filtro geográfico)
// ============================================================

export type GeoFilterState =
  | { status: "idle" }
  | { status: "entidad_selected"; entidad: string; cveEntidad: string }
  | { status: "distrito_selected"; entidad: string; cveEntidad: string; distrito: string }
  | { status: "municipio_selected"; entidad: string; cveEntidad: string; distrito: string; municipio: string }
  | { status: "seccion_selected"; entidad: string; cveEntidad: string; distrito: string; municipio: string; seccion: string[] };

export type GeoFilterAction =
  | { type: "SELECT_ENTIDAD"; entidad: string; cveEntidad: string }
  | { type: "SELECT_DISTRITO"; distrito: string }
  | { type: "SELECT_MUNICIPIO"; municipio: string }
  | { type: "SELECT_SECCION"; seccion: string[] }
  | { type: "RESET" };
