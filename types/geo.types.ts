import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { LatLngBounds, PathOptions } from "leaflet";

// ─────────────────────────────────────────────────────────────────────────────
// Geographic scope
// ─────────────────────────────────────────────────────────────────────────────

export type GeoNivelElectoral =
  | "nacional"
  | "entidad"
  | "distrito_fed"
  | "distrito_loc"
  | "municipio"
  | "seccion";

export interface GeoScopeElectoral {
  nivel: GeoNivelElectoral;
  estado_id?: string;         // "01"–"32"
  estado_nombre?: string;     // "JALISCO"
  cve_distrito_fed?: string;  // e.g. "010"
  cve_distrito_loc?: string;  // e.g. "015"
  cve_municipio?: string;     // e.g. "039"
  cve_seccion?: string;       // e.g. "0123"
  cve_secciones?: string[];   // multi-select, e.g. ["0123", "0456"]
  cve_ageb?: string;          // e.g. "1234" (INEGI AGEB code, 4 chars) — legacy single
  cve_agebs?: string[];       // multi-select, e.g. ["0900700012437", ...] (CVEGEO full codes)
  cve_loc?: string;           // e.g. "0001" (INEGI localidad code)
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer types (what shapes a layer displays)
// ─────────────────────────────────────────────────────────────────────────────

export type GeoLayerTipo =
  | "entidades"
  | "municipios"
  | "distritos_fed"
  | "distritos_loc"
  | "secciones"
  | "ageb_urbana"
  | "ageb_rural";

// ─────────────────────────────────────────────────────────────────────────────
// Choropleth style
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoColorRamp {
  min: number;
  max: number;
  colorLow: string;   // hex, e.g. "#EFF6FF"
  colorHigh: string;  // hex, e.g. "#1D4ED8"
  noDataColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoLayerConfig {
  id: string;
  tipo: GeoLayerTipo;
  visible: boolean;
  /** Map from feature key → numeric value for choropleth coloring.
   *  Key is the feature's unique ID derived from its properties. */
  data?: Record<string, number>;
  colorRamp?: GeoColorRamp;
  /** Returns tooltip HTML string for a feature. */
  tooltip?: (props: Record<string, unknown>) => string;
  /** Callback when a feature is clicked. */
  onClick?: (props: Record<string, unknown>) => void;
  /** Fixed style override (overrides choropleth). */
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  /** Feature keys (from getFeatureKey) that should receive selectedStyle. */
  selectedKeys?: Set<string>;
  /** Leaflet PathOptions applied to features whose key is in selectedKeys. */
  selectedStyle?: PathOptions;
  /** Map from feature key → hex color for categorical (party-based) coloring. */
  colorByKey?: Record<string, string>;
  /** Increment this value to force the GeoJSON layer to remount (refreshes tooltips and event handlers). */
  version?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GeoVisualizador props
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoVisualizadorProps {
  scope: GeoScopeElectoral;
  layers: GeoLayerConfig[];
  height?: string;
  className?: string;
  /** Increment to force all layers to unmount/remount on new consultation. */
  queryVersion?: number;
  onFeatureClick?: (layerId: string, featureProps: Record<string, unknown>) => void;
  /** Called when the user drills down to a new scope by clicking. */
  onScopeChange?: (newScope: GeoScopeElectoral) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// useGeoShapes return type
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoShapesResult {
  geojson: FeatureCollection | null;
  isLoading: boolean;
  error: string | null;
  bounds: LatLngBounds | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Properties preserved in TopoJSON (INE mgs_2025)
// These come from the SHP .dbf files after the pipeline processes them.
// ─────────────────────────────────────────────────────────────────────────────

export interface IneFeatureProps {
  CVE_ENT: string;           // "01"–"32"
  NOMBRE_ENT: string;        // "JALISCO"
  CVE_MUN?: string;          // "039"
  NOMGEO?: string;           // "Guadalajara"
  CVE_SECCION?: string;      // "0123"
  DISTRITO_FED?: string;     // "010"
  DISTRITO_LOC?: string;     // "015"
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geo options (for cascading dropdowns in GeoNavegador)
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoOption {
  cve: string;    // e.g. "039", "010", "0001"
  nombre: string; // e.g. "GUADALAJARA", "D.F. 010", "Sección 0001"
}

// Unique key per feature tipo:
// entidades     → CVE_ENT (e.g. "14")
// municipios    → CVE_ENT + CVE_MUN (e.g. "14039")
// distritos_fed → CVE_ENT + DISTRITO_FED (e.g. "14010")
// distritos_loc → CVE_ENT + DISTRITO_LOC (e.g. "14015")
// secciones     → CVE_ENT + CVE_SECCION (e.g. "140123")
export function getFeatureKey(tipo: GeoLayerTipo, props: IneFeatureProps): string {
  const ent = props.CVE_ENT ?? "";
  switch (tipo) {
    case "entidades":     return ent;
    case "municipios":    return ent + (props.CVE_MUN ?? "");
    case "distritos_fed": return ent + (props.DISTRITO_FED ?? "");
    case "distritos_loc": return ent + (props.DISTRITO_LOC ?? "");
    case "secciones":     return ent + (props.CVE_SECCION ?? "");
    case "ageb_urbana":
    case "ageb_rural":    return (props as unknown as InegAgebProps).CVEGEO ?? ent;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INEGI AGEB properties (Marco Geoestadístico 2025)
// ─────────────────────────────────────────────────────────────────────────────

export interface InegAgebProps {
  CVE_ENT:  string;  // "14"
  CVE_MUN:  string;  // "039"
  CVE_LOC:  string;  // "0001"
  CVE_AGEB: string;  // "1234"
  /** Unique 13-digit geographic code: CVE_ENT(2)+CVE_MUN(3)+CVE_LOC(4)+CVE_AGEB(4) */
  CVEGEO:   string;  // "14039000112345"
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// API shape route params (for /api/geo/shapes)
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoShapesParams {
  tipo: GeoLayerTipo;
  nivel: "nacional" | "estado";
  estado_id?: string;
}

// Re-export GeoJSON types used downstream
export type { FeatureCollection, Feature, Geometry };
