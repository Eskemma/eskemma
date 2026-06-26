/**
 * firestore-schema.ts
 * Tipos TypeScript de todas las colecciones de Firestore — Eskemma / Moddulo
 *
 * IMPORTANTE PARA CLAUDE CODE:
 * - Las colecciones marcadas con [EXISTENTE] ya existen en Firestore.
 *   Añade campos solo como opcionales (?). No elimines campos existentes.
 * - Las colecciones marcadas con [NUEVA] deben crearse.
 * - Importa Timestamp de 'firebase/firestore' o 'firebase-admin/firestore'
 *   según el contexto (client vs. server).
 */

import { Timestamp } from 'firebase/firestore'

// ─────────────────────────────────────────────────────────────────────────────
// USUARIOS [EXISTENTE — verificar nombre real de colección con AuthContext]
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string
  email: string
  displayName?: string
  photoURL?: string
  // NUEVO — añadir como campo opcional; asumir 'individual' si no existe
  planType?: 'individual' | 'collaborative'
  // NUEVO — rol de administrador de Eskemma (para actualizar base de conocimiento)
  eskemma_admin?: boolean
  creadoEn: Timestamp
  actualizadoEn?: Timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// PROYECTOS DE MODDULO [EXISTENTE — colección: moddulo_projects]
// ─────────────────────────────────────────────────────────────────────────────

export type TipoProyecto = 'electoral' | 'gubernamental' | 'legislativo' | 'ciudadano'
export type EstadoProyecto = 'Borrador' | 'Activo' | 'Cerrado'

export interface ModduloProject {
  // Campos existentes — NO CAMBIAR
  id: string
  userId: string                    // propietario
  nombre: string
  tipo: TipoProyecto
  descripcion?: string
  estado: EstadoProyecto
  faseActual: number                // 1–9

  // Campos existentes (confirmar nombres exactos al leer el código)
  phases?: {
    proposito?: F1PhaseData
    exploracion?: F2PhaseData
    investigacion?: F3PhaseData
    diagnostico?: F4PhaseData
    estrategia?: F5PhaseData
    tactica?: F6PhaseData
    gerencia?: F7PhaseData
    seguimiento?: F8PhaseData
    evaluacion?: F9PhaseData
  }

  // NUEVOS — añadir como opcionales
  nivel?: 'Nacional' | 'Estatal' | 'Municipal' | 'Local'
  pais?: string
  color?: string                    // hex, ej. '#026988'
  fasesCompletadas?: number[]       // [1, 2, 3, ...]
  raeVersionId?: string             // versión del RAE usada al crear el proyecto
  creadoEn: Timestamp
  actualizadoEn?: Timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// MIEMBROS DEL PROYECTO [NUEVA — subcollección]
// moddulo_projects/{projectId}/members/{uid}
// Solo existe para proyectos con planType = 'collaborative'
// ─────────────────────────────────────────────────────────────────────────────

export type RolMiembro = 'owner' | 'collaborator' | 'viewer'
export type EstadoInvitacion = 'pendiente' | 'activo' | 'rechazado'

export interface ProjectMember {
  uid: string
  email: string
  displayName?: string
  role: RolMiembro
  invitadoPor: string               // uid del invitante
  invitadoEn: Timestamp
  aceptadoEn?: Timestamp
  estado: EstadoInvitacion
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS POR FASE — subtipos del campo phases en ModduloProject
// ─────────────────────────────────────────────────────────────────────────────

// ── F1 Propósito ──

export interface VariableBase {
  aprobadaPor: string
  aprobadaEn: Timestamp
  version: number
}

export interface VariableX extends VariableBase {
  resultado: string
  ambito: string
  fecha: string                     // ISO date 'YYYY-MM-DD'
  criterioVerificacion: string
}

export interface DimensionCapacidad {
  disponibilidad: string
  capacidadAmpliacion: string
  restricciones: string
}

export interface VariableP extends VariableBase {
  identidad: string
  trayectoria: string
  imagenActual: string
  arquetipoEstilo: string
  fronterasEticas: string
}

export interface VariableC extends VariableBase {
  financiero: DimensionCapacidad
  humano: DimensionCapacidad
  organizacional: DimensionCapacidad
  material: DimensionCapacidad
}

export interface VariableT extends VariableBase {
  fechaInicio: string
  fechaHito: string
  hitosIntermedios: string[]
  restricciones: string
}

export interface VariableO extends VariableBase {
  problemaPublico: string
  beneficiarios: string
  conexionPO: string
  criterioIntegridad: string
}

export interface XPCTO {
  x?: VariableX
  p?: VariableP
  c?: VariableC
  t?: VariableT
  o?: VariableO
}

export type VeredictoEnum = 'coherente' | 'requiere_ajuste' | 'incoherente'

export interface ResultadoCruce {
  veredicto: VeredictoEnum
  argumentacion: string
  propuestaAjuste?: string
}

export interface DictamenCoherencia {
  cruce1_XT: ResultadoCruce
  cruce2_XC: ResultadoCruce
  cruce3_PO: ResultadoCruce
  cruce4_OX: ResultadoCruce
  cruce5_XPCTOTipo: ResultadoCruce
  veredictoGeneral: string
  generadoEn: Timestamp
}

export interface CriterioSuficiencia {
  id: number                        // 1–10
  nombre: string
  nivel: 'Prioritario' | 'Con advertencia'
  estado: 'resuelto' | 'pendiente'
}

export interface DeficienciaActiva {
  criterioId: number
  descripcion: string
  impactoEnFases: string[]
  rutaResolucion: string
  estado: 'activa' | 'resuelta' | 'aceptada'
}

export interface RDA {
  deficiencias: DeficienciaActiva[]
  generadoEn: Timestamp
  activo: boolean
}

export interface EPPSnapshot {
  version: number
  xpcto: XPCTO
  dictamen?: DictamenCoherencia
  criterios: CriterioSuficiencia[]
  rda?: RDA
  guardadoEn: Timestamp
}

export interface F1PhaseData {
  estado: 'en_progreso' | 'lista' | 'editando'
  xpcto?: XPCTO
  dictamen?: DictamenCoherencia
  criterios?: CriterioSuficiencia[]
  rda?: RDA
  eppVersion?: number
  historial?: EPPSnapshot[]
  aprobadoEn?: Timestamp
  aprobadoPor?: string
}

// ── F2 Exploración ──

export interface PestLFactor {
  categoria: 'Politico' | 'Economico' | 'Social' | 'Tecnologico' | 'Legal'
  descripcion: string
  tipo: 'oportunidad' | 'riesgo' | 'neutral'
  impacto: 'alto' | 'medio' | 'bajo'
  fuente?: string
}

export interface Actor {
  nombre: string
  tipo: 'aliado' | 'adversario' | 'neutro' | 'incierto'
  poder: 'alto' | 'medio' | 'bajo'
  descripcion: string
}

export interface F2PhaseData {
  estado: 'en_progreso' | 'lista'
  pestl?: PestLFactor[]
  actores?: Actor[]
  hipotesis?: string[]
  viabilidad?: string
  matrizBrechas?: Record<string, string>
  aprobadoEn?: Timestamp
}

// ── F3 Investigación ──
export interface F3PhaseData {
  estado: 'en_progreso' | 'lista'
  percepcionCiudadana?: string
  mapeoTerritorial?: string
  analisisCompetidores?: string
  diagnosticoAudiencias?: string
  aprobadoEn?: Timestamp
}

// ── F4 Diagnóstico ──
export interface F4PhaseData {
  estado: 'en_progreso' | 'lista'
  mec?: Record<string, unknown>       // resultado del MEC aplicado
  mvp?: Record<string, unknown>       // resultado del MVP
  foda?: Record<string, unknown>      // resultado del FODA-CAME-IBEA
  maniobra?: 'ofensiva' | 'defensiva' | 'combinada'  // output clave para F5/F6
  dictamenViabilidad?: string
  aprobadoEn?: Timestamp
}

// ── F5–F9 (estructura base, se completa en sus propias specs) ──
export interface F5PhaseData { estado: 'en_progreso' | 'lista'; contenido?: Record<string, unknown>; aprobadoEn?: Timestamp }
export interface F6PhaseData { estado: 'en_progreso' | 'lista'; contenido?: Record<string, unknown>; kpisSeleccionados?: string[]; aprobadoEn?: Timestamp }
export interface F7PhaseData { estado: 'en_progreso' | 'lista'; contenido?: Record<string, unknown>; aprobadoEn?: Timestamp }
export interface F8PhaseData { estado: 'en_progreso' | 'lista'; contenido?: Record<string, unknown>; aprobadoEn?: Timestamp }
export interface F9PhaseData { estado: 'en_progreso' | 'lista'; contenido?: Record<string, unknown>; legado?: string; aprobadoEn?: Timestamp }

// ─────────────────────────────────────────────────────────────────────────────
// SESIONES DE CHAT [verificar si ya existe como subcollección]
// moddulo_projects/{projectId}/chatSessions/{sessionId}
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'moddulo' | 'user'
  content: string
  variableCapturada?: 'x' | 'p' | 'c' | 't' | 'o'
  timestamp: Timestamp
}

export interface ChatSession {
  id: string
  projectId: string
  faseId: number
  stage: number
  messages: ChatMessage[]
  xpctoDraft?: Partial<Record<'x' | 'p' | 'c' | 't' | 'o', string>>
  creadaEn: Timestamp
  actualizadaEn: Timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE CONOCIMIENTO — RAE [NUEVA — colección: rae_versions]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Documento especial 'active' que apunta a la versión activa del RAE.
 * rae_versions/active → { versionId: '2.0', ref: ... }
 */
export interface RAEVersionPointer {
  versionId: string
  actualizadoEn: Timestamp
}

/**
 * rae_versions/{versionId}  — ej. rae_versions/2.0
 */
export interface RAEVersion {
  versionId: string                 // ej. '2.0'
  notas: string                     // ej. 'Ciclo 2026 — 22 axiomas'
  axiomas: RAEAxioma[]
  publicadoEn: Timestamp
  publicadoPor: string              // uid del admin
}

export interface RAEAxioma {
  id: string                        // ej. 'RAE-001'
  nombre: string                    // ej. 'Contraste Crítico'
  axioma: string                    // texto completo del axioma
  axioma_original: string           // formulación original del especialista
  variable_xpcto: ('X' | 'P' | 'C' | 'T' | 'O')[]
  fases_aplicacion: number[]        // [1, 2, 4, 5, 6, 9]
  tipos_proyecto: TipoProyecto[]    // vacío = aplica a todos
  protocolo_accion: string          // qué hace Moddulo con este axioma
  keywords: string[]                // ej. ['#Diferenciación', '#MEC']
  severidad: 'alta' | 'media' | 'baja'
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE CONOCIMIENTO — RPF [NUEVA — colección: rpf_entries]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * rpf_entries/{entryId}
 * Cada entrada es un programa táctico o componente del RPF
 */
export interface RPFEntry {
  id: string                        // ej. 'RPF-PT1-ELECTORAL'
  componente: string                // ej. 'Programas tácticos'
  sub_componente: string            // ej. 'PT1 · Ataque y Defensa'
  apartado: string
  tipos_proyecto: TipoProyecto[]
  descripcion_alcance: string
  // Las 4 columnas del marco PODC
  planeacion: string
  organizacion: string
  direccion: string
  control: string
  aporte_tactico: string
  // Personalización y vínculos
  variables_personalizacion: string  // qué outputs de F5/F6 configuran esto
  logica_coherencia: string          // condiciones bajo las que aplica
  vinculo_kpi: string               // KPI de F7/F8 asociado
  axiomas_rae: string[]             // IDs de axiomas del RAE (ej. ['RAE-001'])
  instrumentos_vinculados: string[] // ej. ['MEC', 'F7→F8']
  // Metadatos
  version: string                   // versión del RPF
  actualizadoEn: Timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE CONOCIMIENTO — MEC [NUEVA — colección: mec_instruments]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mec_instruments/{instrumentId}
 * Un documento por variante (Electoral, Gubernamental, Legislativo, Ciudadano)
 */
export interface MECInstrument {
  id: string                        // ej. 'MEC-ELECTORAL'
  tipo_proyecto: TipoProyecto
  nombre: string
  descripcion: string
  ejes: MECEje[]
  version: string
  actualizadoEn: Timestamp
}

export interface MECEje {
  id: string
  nombre: string
  descripcion: string
  polos: {
    positivo: string                // ej. 'Alineado'
    negativo: string                // ej. 'Desalineado'
  }
  narrativas: MECNarrativa[]
}

export interface MECNarrativa {
  id: string
  texto: string
  polo: 'positivo' | 'negativo'
  instruccion_moddulo: string
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE CONOCIMIENTO — MVP [NUEVA — colección: mvp_instruments]
// ─────────────────────────────────────────────────────────────────────────────

export interface MVPInstrument {
  id: string                        // 'MVP-GENERAL'
  nombre: string
  descripcion: string
  vectores: MVPVector[]
  version: string
  actualizadoEn: Timestamp
}

export interface MVPVector {
  id: string
  nombre: string
  descripcion: string
  indicadores: string[]
  umbral_critico: string
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE CONOCIMIENTO — FODA-CAME-IBEA [NUEVA — colección: foda_instruments]
// ─────────────────────────────────────────────────────────────────────────────

export interface FODAInstrument {
  id: string                        // 'FODA-CAME-IBEA'
  nombre: string
  descripcion: string
  marcos: FODAMarco[]
  version: string
  actualizadoEn: Timestamp
}

export interface FODAMarco {
  sigla: string                     // 'FODA' | 'CAME' | 'IBEA'
  nombre: string
  cuadrantes: {
    id: string
    nombre: string
    descripcion: string
    instruccion_moddulo: string
  }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE CONOCIMIENTO — KPIs [NUEVA — colección: kpi_catalog]
// ─────────────────────────────────────────────────────────────────────────────

export interface KPIEntry {
  id: string                        // ej. 'KPI-PT1-TIEMPO-NEUTRALIZACION'
  nombre: string
  descripcion: string
  bloque: string                    // ej. 'PT1 · Ataque y Defensa'
  tipos_proyecto: TipoProyecto[]
  formula?: string
  umbral_referencia?: string        // hipótesis, calibrar en F7
  umbral_confirmado: boolean        // false = hipótesis; true = validado por expertos
  fuente_datos: string
  fase_medicion: number[]           // [7, 8] = se mide en F7 y F8
  instrumento_vinculado?: string
  version: string
  actualizadoEn: Timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE UTILIDAD
// ─────────────────────────────────────────────────────────────────────────────

/** Resultado de calcular qué fases se ven afectadas al editar XPCTO */
export interface PropagacionAlert {
  fasesRetroactivas: number[]       // fases ya completadas a revisar
  fasesProspectivas: number[]       // fases pendientes impactadas
  detalles: string
}

/** Contexto de la base de conocimiento inyectado en el prompt de Claude */
export interface KnowledgeContext {
  axiomas: RAEAxioma[]
  rpfEntries?: RPFEntry[]
  mecInstrument?: MECInstrument
  mvpInstrument?: MVPInstrument
  fodaInstrument?: FODAInstrument
  kpiEntries?: KPIEntry[]
  raeVersionId: string
}
