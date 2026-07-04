// types/moddulo.types.ts
import type { Timestamp } from "firebase/firestore";
import type { Territorio, NivelTerritorial } from "./pestel.types";
export type { Territorio, NivelTerritorial };

// ==========================================
// ENUMERACIONES FUNDAMENTALES
// ==========================================

export type ProjectType =
  | "electoral"      // Conquista del poder — votos, registros
  | "gubernamental"  // Ejercicio del poder — administración pública
  | "legislativo"    // Institucionalización del poder — normativa, cabildeo
  | "ciudadano";     // Incidencia sobre el poder — sociedad civil

export type PhaseId =
  | "proposito"      // F1: ADN del proyecto, variables XPCTO
  | "exploracion"    // F2: Escaneo PEST-L, hipótesis estratégica
  | "investigacion"  // F3: Inteligencia de campo, datos duros
  | "diagnostico"    // F4: Dictamen de viabilidad, MEC
  | "estrategia"     // F5: Idea matriz, arquitectura de mensajes
  | "tactica"        // F6: Ingeniería de operaciones
  | "gerencia"       // F7: War Room, unidad de mando
  | "seguimiento"    // F8: KPIs, alertas, ruta crítica
  | "evaluacion";    // F9: Legado táctico, lecciones aprendidas

export const PHASE_ORDER: PhaseId[] = [
  "proposito",
  "exploracion",
  "investigacion",
  "diagnostico",
  "estrategia",
  "tactica",
  "gerencia",
  "seguimiento",
  "evaluacion",
];

export const PHASE_NAMES: Record<PhaseId, string> = {
  proposito: "Propósito",
  exploracion: "Exploración",
  investigacion: "Investigación",
  diagnostico: "Diagnóstico",
  estrategia: "Diseño Estratégico",
  tactica: "Diseño Táctico",
  gerencia: "Gerencia",
  seguimiento: "Seguimiento",
  evaluacion: "Evaluación",
};

export const PHASE_DESCRIPTIONS: Record<PhaseId, string> = {
  proposito: "Direccionamiento estratégico — ADN y variables XPCTO",
  exploracion: "Investigación preliminar — Escaneo PEST-L y contexto",
  investigacion: "Levantamiento de inteligencia — Datos de campo",
  diagnostico: "Análisis de viabilidad — Dictamen y MEC",
  estrategia: "Conceptualización — Idea matriz y activos",
  tactica: "Programación operativa — Ingeniería de operaciones",
  gerencia: "Mando y ejecución — Unidad de mando",
  seguimiento: "Monitoreo permanente — Vigilancia de ruta crítica",
  evaluacion: "Resultados y legado — Capitalización de aprendizajes",
};

export type PhaseStatus = "not-started" | "in-progress" | "completed" | "needs-review";

export type CollaboratorRole = "owner" | "co-consultant" | "analyst" | "client";

export type ProjectStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type IntegrityLevel = "green" | "yellow" | "red";

export type AILevel = "minimal" | "balanced" | "maximum";

// ==========================================
// MODELO XPCTO
// ==========================================

export interface XPCTO {
  hito: string;            // X: El resultado concreto e inamovible buscado
  sujeto: string;          // P: El actor político del proyecto
  capacidades: {
    financiero: string;    // C: Presupuesto y recursos económicos
    humano: string;        // C: Equipo y estructura organizacional
    logistico: string;     // C: Infraestructura y medios operativos
  };
  tiempo: {
    fechaLimite: string;   // T: Fecha límite inamovible (ISO string)
    duracionMeses: number; // T: Duración total del proyecto en meses
  };
  justificacion: string;   // O: El propósito superior y ético que legitima el proyecto
}

// ==========================================
// VECTORES MIA (Modelo de Interoperabilidad de Activos)
// ==========================================

export type VectorMIA =
  | "social"          // Legitimidad social — conexión emocional con el electorado
  | "transferencia"   // Transferencia gubernamental — ancla o motor
  | "movilizacion"    // Movilización — capacidad estructural
  | "opinion"         // Opinión independiente — votante racional no alineado
  | "defensa"         // Defensa y control — logística del día D
  | "validacion";     // Validación externa — alianzas y poderes fácticos

export interface VectorMIAEvaluation {
  vector: VectorMIA;
  score: number;           // 0-10
  diagnosis: string;       // Diagnóstico específico
  recommendation: string;
}

// ==========================================
// COLABORACIÓN
// ==========================================

export interface Collaborator {
  uid: string;
  email: string;
  displayName?: string;
  role: CollaboratorRole;
  addedAt: Timestamp;
  addedBy: string;
}

// ==========================================
// BITÁCORA / CHANGELOG
// ==========================================

export type ChangeSource = "user" | "ai-suggestion" | "propagation";

export interface ChangelogEntry {
  id: string;
  timestamp: Timestamp;
  userId: string;
  userDisplayName?: string;
  phaseId: PhaseId | "project";
  action: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  source: ChangeSource;
}

// ==========================================
// CHAT CON MODDULO
// ==========================================

export type ChatRole = "assistant" | "user";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string; // ISO string
  extractedData?: Record<string, unknown>;
  reasoning?: string; // Trazabilidad: por qué Moddulo tomó esta decisión o extrajo este dato
}

// ==========================================
// REPORTE DE FASE
// ==========================================

export interface PhaseReport {
  summary: string;
  integrity: IntegrityLevel;
  observations: string[];
  miaEvaluations?: VectorMIAEvaluation[];
  generatedAt: string; // ISO string
}

// ==========================================
// DICTAMEN DE COHERENCIA XPCTO (F1)
// ==========================================

export interface DictamenCruce {
  id: number;
  etiqueta: string;
  pregunta: string;
  veredicto: "coherente" | "requiere_ajuste";
  argumentacion: string;
}

export interface Dictamen {
  cruces: DictamenCruce[];
}

// ==========================================
// CRITERIOS DE SUFICIENCIA (F1)
// ==========================================

export type EstadoCriterio = "resuelto" | "pendiente";

export interface CriterioSuficiencia {
  id: number;
  nombre: string;
  nivel: "Prioritario" | "Con advertencia";
  estado: EstadoCriterio;
}

// ==========================================
// ESTADO DE FASE
// ==========================================

export interface PhaseState {
  status: PhaseStatus;
  data: Record<string, unknown>;
  chatHistory: ChatMessage[];
  completedAt?: string; // ISO string
  report?: PhaseReport;
  // Texto completo del reporte diagnóstico generado por Claude (markdown)
  reportText?: string;
  // Dictamen de Coherencia XPCTO (solo F1)
  dictamen?: Dictamen;
  // Registro de Deficiencias Activas (F1) — heredado en F2 como alerta
  rda?: {
    activo: boolean;
    items?: string[];
  };
  // DVS de Exploración (F2) — generado por generate-dvs
  dvs?: DVSF2;
  // ID del análisis PESTEL vinculado (F2)
  pestAnalysisId?: string;
  // ID del proyecto PESTEL vinculado (F2) — para navegar de vuelta a Centinela
  pestProjectId?: string;
  // MapaPESTEL transformado para F2 (señales tripartitas por dimensión)
  mapaPESTEL?: MapaPESTEL;
  // Estado semántico de la fase (F2: "lista" cuando DVS generado)
  estado?: string;
  // Fecha de aprobación/cierre de la fase
  aprobadoEn?: string;
  // Programa de Investigación Profunda heredado de F2 (F3)
  pip?: PIPItem[];
  // Incertidumbres heredadas de F2 (F3)
  incertidumbres?: IncertidumbreF2[];
}

// ==========================================
// ALERTA DE PROPAGACIÓN
// ==========================================

export interface PropagationAlert {
  sourcePhase: PhaseId;
  affectedPhases: PhaseId[];
  suggestions: {
    phaseId: PhaseId;
    suggestion: string;
  }[];
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

// ==========================================
// PROYECTO PRINCIPAL
// ==========================================

export interface ModduloProject {
  id: string;
  userId: string;
  type: ProjectType;
  name: string;
  description?: string;
  color?: string;            // Hex del color del proyecto, ej. "#026988"
  territorio?: Territorio;   // Alcance geográfico definido al crear el proyecto
  fasesCompletadas?: number[]; // Array de números de fase completadas, ej. [1, 2]
  faseActual?: number;       // Número de fase actual (1-9), alternativo a currentPhase
  xpcto: XPCTO;
  currentPhase: PhaseId;
  phases: Record<PhaseId, PhaseState>;
  collaborators: Collaborator[];
  status: ProjectStatus;
  settings: {
    aiLevel: AILevel;
    language: "es";
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastAccessedAt: Timestamp;
}

// ==========================================
// TIPOS PARA CREAR/ACTUALIZAR
// ==========================================

export interface CreateProjectInput {
  type: ProjectType;
  name: string;
  description?: string;
  color?: string;
  territorio?: Territorio;
  xpcto?: Partial<XPCTO>;
  pestelProjectId?: string;
}

export type UpdateProjectInput = Partial<
  Pick<ModduloProject, "name" | "description" | "color" | "xpcto" | "status" | "settings">
>;

// ==========================================
// FASE 2 — EXPLORACIÓN: DVS (Documento de Viabilidad Situacional)
// ==========================================

export interface HEIF2 {
  tensionCentral: string;
  contexto: string;
  condicionesFavorables: string[];
  condicionesAdversas: string[];
  premisaEstrategica: string;
}

export interface ContrasteXPCTO {
  dimension: "X" | "P" | "C" | "T" | "O";
  veredicto: "coherente" | "requiere_ajuste" | "requiere_investigacion";
  argumentacion: string;
  senalesPESTEL: string[];
}

export interface ActorVetoF2 {
  nombre: string;
  tipo: string;
  nivelRiesgo: "rojo" | "ambar" | "verde";
  capacidadVeto: string;
  motivacion: string;
  requiereInvestigacion: boolean;
}

export interface IncertidumbreF2 {
  descripcion: string;
  urgencia: "alta" | "media" | "baja";
  resolucion: "alta" | "media" | "baja";
  destino: "F3" | "SIP";
}

export interface PIPItem {
  numero: number;
  pregunta: string;
  metodo: string;
  vinculoHito: string;
}

export interface DVSF2 {
  hei: HEIF2;
  contrasteXPCTO: ContrasteXPCTO[];  // M2
  semaforo: ActorVetoF2[];           // M3
  incertidumbres: IncertidumbreF2[]; // M4
  pip: PIPItem[];
}

// ==========================================
// FASE 2 — MapaPESTEL (señales tripartitas desde Centinela)
// ==========================================

export interface F2Senal {
  descripcion: string;
  fuente: string;
  fechaCorte: string;
  nivelConfianza: "alto" | "medio" | "bajo";
  origenInternacional: boolean;
}

export interface F2DimensionPESTEL {
  code: string;
  label: string;
  clasificacion: "OPORTUNIDAD" | "NEUTRAL" | "AMENAZA";
  senalesFavorables: F2Senal[];
  senalesAdversas: F2Senal[];
  senalesInciertas: F2Senal[];
  narrativa?: string;
  confidence?: number;
}

export type MapaPESTEL = Partial<Record<string, F2DimensionPESTEL>>;

// ==========================================
// FASE 2 — EXPLORACIÓN: formulario
// ==========================================

export interface PestlDimension {
  contexto: string;          // Descripción del entorno en esta dimensión
  senalesCriticas: string;   // Señales de alerta u oportunidad identificadas
}

export interface PestlPolitico extends PestlDimension {
  actoresClave: string;      // Actores políticos con influencia en el proyecto
  actoresVeto: string;       // Actores con capacidad de bloqueo
}

export interface VetoActor {
  nombre: string;
  nivel: "alto" | "medio" | "bajo";
  descripcion: string;
}

export interface ExplorationForm {
  pestl: {
    politico: PestlPolitico;
    economico: PestlDimension;
    social: PestlDimension;
    tecnologico: PestlDimension;
    ecologico: PestlDimension;
    legal: PestlDimension;
  };
  semaforo: {
    actores: VetoActor[];
    resumen: string;
  };
  hipotesis: {
    enunciado: string;       // La premisa estratégica a validar en F3
    premisas: string;        // Supuestos que la sostienen
    implicaciones: string;   // Qué significa si es correcta o incorrecta
  };
  // Generados por Moddulo al cerrar la fase
  dictamenViabilidad?: string;
  matrizBrechas?: string;
  documentoRector?: string;
}

export const emptyExplorationForm = (): ExplorationForm => ({
  pestl: {
    politico:    { contexto: "", senalesCriticas: "", actoresClave: "", actoresVeto: "" },
    economico:   { contexto: "", senalesCriticas: "" },
    social:      { contexto: "", senalesCriticas: "" },
    tecnologico: { contexto: "", senalesCriticas: "" },
    ecologico:   { contexto: "", senalesCriticas: "" },
    legal:       { contexto: "", senalesCriticas: "" },
  },
  semaforo: { actores: [], resumen: "" },
  hipotesis: { enunciado: "", premisas: "", implicaciones: "" },
});

// ==========================================
// TIPOS PARA EL CHAT API
// ==========================================

export interface ChatAttachment {
  nombre: string;
  url: string;
  tipo: string;
}

export interface ChatRequest {
  message: string;
  projectId: string;
  phaseId: PhaseId;
  currentFormData?: Record<string, unknown>;
  chatHistory?: ChatMessage[];
  xpctoContext?: Record<string, unknown>;
  attachments?: ChatAttachment[];
}

export interface ChatResponseChunk {
  type: "text" | "extracted-data" | "done";
  content?: string;
  extractedData?: Record<string, unknown>;
}

// ==========================================
// METADATOS DE TIPOS DE PROYECTO Y ROLES
// ==========================================

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

export const PROJECT_TYPE_DESCRIPTIONS: Record<ProjectType, string> = {
  electoral: "Conquista del poder — votos, registros, participación ciudadana",
  gubernamental: "Ejercicio del poder — administración pública, políticas",
  legislativo: "Institucionalización del poder — normativa, cabildeo, representación",
  ciudadano: "Incidencia sobre el poder — sociedad civil, movilización social",
};

export const COLLABORATOR_ROLE_LABELS: Record<CollaboratorRole, string> = {
  owner: "Dueño del proyecto",
  "co-consultant": "Co-consultor",
  analyst: "Analista",
  client: "Cliente / Candidato",
};

export const COLLABORATOR_ROLE_PERMISSIONS: Record<CollaboratorRole, string[]> = {
  owner: ["read", "write", "manage-collaborators", "delete-project"],
  "co-consultant": ["read", "write"],
  analyst: ["read", "upload-documents"],
  client: ["read"],
};
