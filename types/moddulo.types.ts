// types/moddulo.types.ts
import type { Timestamp } from "firebase/firestore";
import type { Territorio, NivelTerritorial, AppSourceKind, OrigenTrazabilidad, TecnicaId } from "./shared.types";
export type { Territorio, NivelTerritorial };

// Vínculo persistido de F2 (Exploración) a una fuente externa (Centinela
// PESTEL, u otra app futura), o al M1 generado localmente vía flujo
// express (kind: "express", sin fuente externa real — sourceId es el
// propio ID del proyecto Moddulo). TPayload es unknown a este nivel porque
// PhaseState es genérico para cualquier fase/fuente; el código PESTEL lo
// castea a MapaPESTEL al leer.
export interface LinkedSourceRef<TPayload = unknown> {
  kind: AppSourceKind;
  componente: OrigenTrazabilidad["componente"];
  sourceId: string;
  sourceAnalysisId?: string;
  payload?: TPayload;
}

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
// RDA — REGISTRO DE DEFICIENCIAS ACTIVAS (acumulativo, F1→F2→...)
// ==========================================

export type EstadoRDAItem = "activo" | "resuelto" | "aceptado";

export interface RDAItem {
  id: string; // determinístico: `${faseOrigen}:${criterioId}`
  faseOrigen: PhaseId;
  origenMecanismo: "criterio_suficiencia" | "vacio_residual" | "asignacion_desactivada";
  criterioId?: string;
  nombre: string;
  descripcion: string;
  nivelImpacto: "prioritario" | "advertencia";
  recomendacion: string;
  estado: EstadoRDAItem;
  vinculadoA?: { tipo: string; valor: string }[];
  fechaCreacion: Timestamp;
  fechaResolucion?: Timestamp;
  resueltoPor?: "usuario" | "sistema";
  // Solo para origenMecanismo === "asignacion_desactivada": el usuario ya
  // tomó la decisión al desactivar la vía, así que no pasa por el flujo
  // normal de "Aceptar como condición del proyecto" — la UI lo trata como
  // aceptado sin pedir esa acción, aunque `estado` se mantenga en "activo"
  // para que el motor de reconciliación de rda.ts lo auto-resuelva solo en
  // cuanto la asignación se reactive (ver lib/moddulo/rda.ts).
  aceptadoAutomaticamente?: boolean;
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
  // DVS de Exploración (F2) — generado por generate-dvs
  dvs?: DVSF2;
  // DVS pre-generado pendiente de aprobación por motor (F2 nuevo flujo)
  draftDVS?: DVSF2;
  // Estado de aprobación secuencial por motor M2→M5 (F2 nuevo flujo)
  motorAprobaciones?: {
    M2?: boolean;
    M3?: boolean;
    M4?: boolean;
    M5?: boolean;
  };
  // Vínculo a la fuente que generó el M1 de F2: Centinela PESTEL (kind
  // "T22") o flujo express (kind "express"). payload es el MapaPESTEL
  // transformado (señales tripartitas por dimensión).
  linkedSource?: LinkedSourceRef<MapaPESTEL>;
  // Estado semántico de la fase (F2: "lista" cuando DVS generado)
  estado?: string;
  // Fecha de aprobación/cierre de la fase
  aprobadoEn?: string;
  // Programa de Investigación Profunda heredado de F2 (F3)
  pip?: PIPItem[];
  // Incertidumbres heredadas de F2 (F3)
  incertidumbres?: IncertidumbreF2[];
  // F3 — tablero de tareas (M1)
  f3TareasPIP?: TareaPIP[];
  // F3 — síntesis de hallazgos + insumos FODA (M3)
  f3Sintesis?: SintesisF3;
  // F3 — veredicto sobre la HEI, draft hasta aprobarPorUsuario (M4)
  f3Veredicto?: VeredictoHEI;
  // F3 — DIE final, snapshot análogo a `dvs` en F2
  f3DIE?: DIE;
  // F3 — ISO string de la última vez que el usuario visitó el chat, para
  // avisar de resultados nuevos al montar (ver page.tsx).
  chatUltimaVisita?: string;
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
  // Registro de Deficiencias Activas — acumulativo a través de todas las
  // fases, indexado por RDAItem.id. Mapa (no array) para permitir
  // actualizaciones atómicas de un solo ítem, mismo patrón que mapaPESTEL.
  rda?: Record<string, RDAItem>;
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
  pestAnalysisId?: string;
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
  orden: number;
  profundidad: "exploratoria" | "confirmatoria" | "descriptiva";
}

export interface DVSF2 {
  hei: HEIF2;
  contrasteXPCTO: ContrasteXPCTO[];  // M2
  semaforo: ActorVetoF2[];           // M3
  incertidumbres: IncertidumbreF2[]; // M4
  pip: PIPItem[];
}

// ==========================================
// FASE 3 — INVESTIGACIÓN
// ==========================================

// M1 — una tarea del PIP puede requerir más de un canal a la vez (ej. una
// técnica del ecosistema para señales públicas + gestión humana directa
// para entrevistas de élite) — asignaciones[] reemplaza el canal único.
export interface AsignacionCanal {
  // Estable, generado por el endpoint (no por Claude) — ej. `${numero}-${índice}`.
  // Es lo que vincula un resultado recibido a ESTA asignación específica,
  // independiente del canal (Canal 2/3 también pueden tener más de una
  // asignación por tarea, no solo Canal 1).
  asignacionId: string;
  tipo: "primaria" | "complementaria";
  canal: "canal1" | "canal2" | "canal3";
  tecnicaId?: TecnicaId; // solo si canal === "canal1"
  // Solo si canal === "canal1" — calculado server-side contra
  // APP_TO_F3_CONTRACTS, nunca confiado al modelo.
  estadoApp?: "disponible" | "proximamente";
  justificacion: string; // por qué esta asignación — propuesta por M1
  estado: "pendiente" | "en_curso" | "recibido" | "derivado";
  resultadoId?: string; // → moddulo_projects/{projectId}/f3Resultados/{resultadoId}
  // Activar/desactivar es independiente por asignación (no exclusivo entre
  // ellas, a diferencia del extinto intercambio de "tipo" primaria/
  // complementaria). Desactivar NUNCA modifica `estado` — solo oculta el
  // badge de estado en la UI y hace que esta asignación deje de contar
  // para tareaCubierta(), aunque su estado siga siendo "recibido"/etc.
  activada: boolean;
}

// M1 — tablero de tareas del PIP heredado de F2
export interface TareaPIP {
  numero: number; // vínculo a PIPItem.numero
  asignaciones: AsignacionCanal[];
}

// M3 — vacío residual con destino ya determinado
export interface VacioResidual {
  numero: number; // PIPItem.numero no cubierto por ningún canal
  // Presente solo cuando el vacío es de una asignación COMPLEMENTARIA
  // específica cuya tarea, en conjunto, sí está cubierta por su primaria —
  // ausente cuando el vacío es de la tarea completa (ninguna asignación
  // resuelta). Ver lib/moddulo/f3Suficiencia.ts.
  asignacionId?: string;
  pregunta: string;
  urgencia: "alta" | "media" | "baja";
  // alta urgencia + resolución pendiente → RDA; naturaleza continua o baja
  // resolución → SIP (Sistema de Investigación Permanente).
  destino: "RDA" | "SIP";
}

export interface FODAInsumo {
  fortalezas: string[];
  oportunidades: string[];
  debilidades: string[];
  amenazas: string[];
}

export interface SintesisF3 {
  convergencias: string[];
  contradicciones: string[];
  vaciosResiduales: VacioResidual[];
  fodaPropioInsumo: FODAInsumo;
  fodaAdversariosInsumo: Record<string, FODAInsumo>; // key = nombre del actor (Semáforo de Veto)
}

// M4
export interface VeredictoHEI {
  resultado: "validada" | "ajustada" | "refutada";
  contraste: string;
  argumentacion: string;
  premisaResultante: string;
  aprobadoPorUsuario: boolean;
}

// Snapshot final del DIE — análogo a `dvs` en PhaseState, se genera al
// aprobar el Veredicto HEI (mismo momento que finalize-dvs en F2).
export interface DIE {
  sintesisPorDimension: SintesisF3;
  tableroTareasPIP: TareaPIP[];
  veredictoHEI: VeredictoHEI;
  // RDA e IAI del DIE se leen en vivo de project.rda / IAI (fuera de
  // alcance) al renderizar el reporte — no se duplican en el snapshot.
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
  // true solo si esta dimensión es "de seguimiento" según
  // lib/moddulo/dimensionPriority.ts pero el modelo decidió tratarla como
  // prioritaria por relevancia del contexto local — señal auditable para no
  // depender de inferir el criterio leyendo la narrativa.
  escaladaPorRelevanciaLocal?: boolean;
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
  storagePath?: string;
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
