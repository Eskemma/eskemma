// types/pestel.types.ts
import type { Timestamp } from "firebase/firestore";

// ==========================================
// ENUMERACIONES FUNDAMENTALES
// ==========================================

export type NivelTerritorial =
  | "nacional"    // Todo México
  | "estatal"     // Un estado (ej. Jalisco)
  | "municipal"   // Un municipio (ej. Zapopan)
  | "distrito";   // Un distrito electoral específico

/** @deprecated Use TipoProyecto instead */
export type ModoAnalisis =
  | "ciudadano"
  | "gubernamental";

export type TipoProyecto =
  | "electoral"
  | "gubernamental"
  | "legislativo"
  | "ciudadano";

export type TendenciaPESTL =
  | "creciente"
  | "estable"
  | "decreciente";

/** @deprecated Use Trend (ASCENDENTE/DESCENDENTE/ESTABLE) instead */
export type ImpactoFactor =
  | "alto"
  | "medio"
  | "bajo";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

// C2: "Ec" (Ecológico) es la nueva 6ta dimensión — "L" pasa a ser solo Legal
export type DimensionCode = "P" | "E" | "S" | "T" | "L" | "Ec";

export type Trend = "ASCENDENTE" | "DESCENDENTE" | "ESTABLE";

export type Intensity = "ALTA" | "MEDIA" | "BAJA";

export type Classification = "OPORTUNIDAD" | "AMENAZA" | "NEUTRAL";

export type ReliabilityLevel = "HIGH" | "MEDIUM" | "LOW";

export type IndicatorType = "QUANTITATIVE" | "QUALITATIVE";

export type RiskLevel = "CRÍTICO" | "MODERADO" | "BAJO";

export type AnalysisStatus = "PENDING_REVIEW" | "REVIEWED" | "APPROVED";

// ==========================================
// CATÁLOGO DE DIMENSIONES (C2)
// ==========================================

export interface DimensionMeta {
  label: string;
  initial: string;
}

export const DIMENSION_META: Record<DimensionCode, DimensionMeta> = {
  P:  { label: "Político",    initial: "P"  },
  E:  { label: "Económico",   initial: "E"  },
  S:  { label: "Social",      initial: "S"  },
  T:  { label: "Tecnológico", initial: "T"  },
  L:  { label: "Legal",       initial: "L"  },
  Ec: { label: "Ecológico",   initial: "Ec" },
};

export const DIMENSION_ORDER: DimensionCode[] = ["P", "E", "S", "T", "Ec", "L"];

// ==========================================
// INTERFACES COMPARTIDAS
// ==========================================

export interface Territorio {
  nivel: NivelTerritorial;
  pais?: string;
  estado?: string;
  municipio?: string;
  nombre: string;
}

export interface AlertasConfig {
  vectorRiesgoUmbral: number;
  notificarEmail: boolean;
  notificarInApp: boolean;
}

// ==========================================
// INTERFACES — ETAPA 1-3
// ==========================================

export interface PESTELProject {
  id: string;
  userId: string;
  nombre: string;
  tipo: TipoProyecto;
  territorio: Territorio;
  horizonte: number;            // months
  isActive: boolean;
  autoMonitorEnabled: boolean;
  alertas: AlertasConfig;
  currentStage: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  alertRules?: AlertRule[];
  // C6: color de identificación de la card en el Hub
  color?: string;               // hex string, e.g. "#026988"
  // C5/C8: integración con Moddulo
  modduloOrigenEscenario?: "A" | "B";
  modduloProjectId?: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface PestlIndicator {
  description: string;
  type: IndicatorType;
  dataSource: string;
  isCustom: boolean;
}

export interface PestlVariable {
  id: string;
  name: string;
  weight: 1 | 2 | 3 | 4 | 5;
  isPriority: boolean;
  isDefault: boolean;
  indicators: PestlIndicator[];
}

export interface PestlDimensionConfig {
  code: DimensionCode;
  variables: PestlVariable[];
}

export interface PestlConfig {
  projectId: string;
  dimensions: PestlDimensionConfig[];
  templateId?: string;
  savedAt: Timestamp | string;
}

// ==========================================
// INTERFACES — ETAPA 4
// ==========================================

export interface DataSource {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  dimensionCode: DimensionCode;
  source: string;
  capturedAt: Timestamp | string;
  reliabilityLevel: ReliabilityLevel;
  isManual: boolean;
}

export interface CoverageStatus {
  code: DimensionCode;
  status: "green" | "yellow" | "red";
  variablesWithData: number;
  confidence: number;           // 0-100
}

// ==========================================
// INTERFACES — ETAPA 5
// ==========================================

// C3: señal individual del análisis tripartito
export interface Senal {
  descripcion: string;
  fuente: string;
  fechaCorte: string;
  nivelConfianza: "alto" | "medio" | "bajo";
  origenInternacional: boolean;
}

export interface DimensionAnalysis {
  code: DimensionCode;
  trend: Trend;
  intensity: Intensity;
  mainSignal: string;           // max 150 chars
  narrative: string;            // 2-3 paragraphs
  classification: Classification;
  confidence: number;           // 0-100
  // C3: señales tripartitas (opcionales para migración graceful de análisis legacy)
  senalesFavorables?: Senal[];
  senalesAdversas?: Senal[];
  senalesInciertas?: Senal[];
}

export interface ImpactChain {
  dimensions: DimensionCode[];
  description: string;          // max 200 chars
  riskLevel: RiskLevel;
  recommendation: string;       // max 100 chars
  source?: "ia" | "analyst";
  addedByUserId?: string;
}

export interface BiasAlert {
  type: string;
  description: string;
  acknowledgedAt?: Timestamp | string;
  acknowledgedBy?: string;
}

// C7: informe generado con datos estructurados para consumo por Moddulo F2
export interface ScorecardItem {
  code: DimensionCode;
  label: string;
  confidence: number;
  classification: Classification;
  dimWeight: number;
  score: number;
}

export interface InformeGenerado {
  id: string;
  formato: "ejecutivo" | "tecnico" | "foda_lista" | "escenarios";
  contenidoTexto: string;
  datosEstructurados: {
    escenarios?: { optimista: string; base: string; pesimista: string };
    fodaLista?: { oportunidades: string[]; amenazas: string[] };
    scorecard: ScorecardItem[];
    mapaPESTEL: Partial<Record<DimensionCode, Partial<DimensionAnalysis>>>;
  };
  generadoEn: string;
}

export interface PestlAnalysisV2 {
  id: string;
  projectId: string;
  version: number;
  analyzedAt: Timestamp | string;
  globalConfidence: number;     // weighted average
  dimensions: DimensionAnalysis[];
  impactChains: ImpactChain[];
  biasAlerts: BiasAlert[];
  status: AnalysisStatus;
  vigente: boolean;
  adjustments?: HumanAdjustment[];
  // C7: informes generados con datos estructurados
  informes?: InformeGenerado[];
}

// ==========================================
// INTERFACES — ETAPA 6
// ==========================================

export interface HumanAdjustment {
  dimensionCode: DimensionCode;
  adjustedBy: string;
  adjustedAt: Timestamp | string;
  originalClassification: Classification;
  newClassification: Classification;
  justification: string;
  originalPosition: { x: number; y: number };
  newPosition: { x: number; y: number };
}

// ==========================================
// INTERFACES — ETAPA 8
// ==========================================

export interface AlertRule {
  id: string;
  type: "mentions_spike" | "sentiment_drop" | "economic_change";
  dimensionCode?: DimensionCode;
  threshold: number;
  enabled: boolean;
}

export interface PESTELAlertV2 {
  id: string;
  projectId: string;
  type: AlertRule["type"] | "bias_detected" | "coverage_low";
  dimensionCode?: DimensionCode;
  description: string;
  isCrisis: boolean;
  generadoEn: Timestamp | string;
  readAt?: Timestamp | string | null;
}

// ==========================================
// JOB
// ==========================================

export interface PESTELJob {
  id: string;
  projectId: string;
  /** @deprecated Use projectId */
  configId?: string;
  userId: string;
  status: JobStatus;
  startedAt: Timestamp | string;
  completedAt?: Timestamp | string;
  error?: string;
  analysisId?: string;
  /** @deprecated Use analysisId */
  feedId?: string;
}

// ==========================================
// LEGACY INTERFACES — @deprecated
// ==========================================

/** @deprecated Use PESTELProject instead */
export interface PESTELConfig {
  id: string;
  userId: string;
  territorio: Territorio;
  modo: ModoAnalisis;
  isActive: boolean;
  alertas: AlertasConfig;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

/** @deprecated Use DimensionAnalysis instead */
export interface Factor {
  descripcion: string;
  impacto: ImpactoFactor;
  sentiment: number;
  fuente: string;
  isManual: boolean;
}

/** @deprecated Use DimensionAnalysis instead */
export interface DimensionPESTL {
  contexto: string;
  factores: Factor[];
  tendencia: TendenciaPESTL;
  fuentes: string[];
}

/** @deprecated Use PestlAnalysisV2 instead */
export interface PESTLAnalysis {
  politico: DimensionPESTL;
  economico: DimensionPESTL;
  social: DimensionPESTL;
  tecnologico: DimensionPESTL;
  legal: DimensionPESTL;
}

/** @deprecated Use PestlAnalysisV2 instead */
export interface PESTELFeed {
  id: string;
  configId: string;
  userId: string;
  generadoEn: Timestamp | string;
  territorio: string;
  vigente: boolean;
  pestl: PESTLAnalysis;
  vectorRiesgo: number;
  indicePresionSocial: number;
  indiceClimaInversion: number;
  syncedToModdulo: boolean;
}

export interface PESTELAlert {
  id: string;
  feedId: string;
  territorio: string;
  vectorRiesgo: number;
  generadoEn: Timestamp | string;
  readAt?: Timestamp | string | null;
}
