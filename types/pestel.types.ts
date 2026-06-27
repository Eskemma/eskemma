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

export type DimensionCode = "P" | "E" | "S" | "T" | "L";

export type Trend = "ASCENDENTE" | "DESCENDENTE" | "ESTABLE";

export type Intensity = "ALTA" | "MEDIA" | "BAJA";

export type Classification = "OPORTUNIDAD" | "AMENAZA" | "NEUTRAL";

export type ReliabilityLevel = "HIGH" | "MEDIUM" | "LOW";

export type IndicatorType = "QUANTITATIVE" | "QUALITATIVE";

export type RiskLevel = "CRÍTICO" | "MODERADO" | "BAJO";

export type AnalysisStatus = "PENDING_REVIEW" | "REVIEWED" | "APPROVED";

// ==========================================
// INTERFACES COMPARTIDAS
// ==========================================

export interface Territorio {
  nivel: NivelTerritorial;
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
// NUEVAS INTERFACES — ETAPA 1-3
// ==========================================

export interface PESTELProject {
  id: string;
  userId: string;
  nombre: string;         // e.g. "Campaña Atizapán 2027"
  tipo: TipoProyecto;
  territorio: Territorio;
  horizonte: number;      // months, e.g. 6
  isActive: boolean;
  autoMonitorEnabled: boolean; // opt-in; false by default — cron skips if false
  alertas: AlertasConfig;
  currentStage: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  alertRules?: AlertRule[];
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
// NUEVAS INTERFACES — ETAPA 4
// ==========================================

export interface DataSource {
  id: string;
  projectId: string;
  userId: string;
  content: string;           // raw text or extracted content
  dimensionCode: DimensionCode;
  source: string;            // source name or URL
  capturedAt: Timestamp | string;
  reliabilityLevel: ReliabilityLevel;
  isManual: boolean;
}

export interface CoverageStatus {
  code: DimensionCode;
  status: "green" | "yellow" | "red";
  variablesWithData: number;
  confidence: number;        // 0-100
}

// ==========================================
// NUEVAS INTERFACES — ETAPA 5
// ==========================================

export interface DimensionAnalysis {
  code: DimensionCode;
  trend: Trend;
  intensity: Intensity;
  mainSignal: string;        // max 150 chars
  narrative: string;         // 2-3 paragraphs
  classification: Classification;
  confidence: number;        // 0-100
}

export interface ImpactChain {
  dimensions: DimensionCode[];
  description: string;       // max 200 chars
  riskLevel: RiskLevel;
  recommendation: string;    // max 100 chars
}

export interface BiasAlert {
  type: string;
  description: string;
  acknowledgedAt?: Timestamp | string;
  acknowledgedBy?: string;
}

export interface PestlAnalysisV2 {
  id: string;
  projectId: string;
  version: number;
  analyzedAt: Timestamp | string;
  globalConfidence: number;  // weighted average
  dimensions: DimensionAnalysis[];
  impactChains: ImpactChain[];
  biasAlerts: BiasAlert[];
  status: AnalysisStatus;
  vigente: boolean;
  // E6 — human-in-the-loop adjustments (max 5, one per dimension)
  adjustments?: HumanAdjustment[];
}

// ==========================================
// NUEVAS INTERFACES — ETAPA 6
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
// NUEVAS INTERFACES — ETAPA 8
// ==========================================

export interface AlertRule {
  id: string;
  type: "mentions_spike" | "sentiment_drop" | "economic_change";
  dimensionCode?: DimensionCode;
  threshold: number;  // percentage or absolute value
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
// UPDATED JOB INTERFACE
// ==========================================

export interface PESTELJob {
  id: string;
  projectId: string;       // replaces configId (legacy field kept @deprecated)
  /** @deprecated Use projectId */
  configId?: string;
  userId: string;
  status: JobStatus;
  startedAt: Timestamp | string;
  completedAt?: Timestamp | string;
  error?: string;
  analysisId?: string;     // replaces feedId for V2 analyses
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
