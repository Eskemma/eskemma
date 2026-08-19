// types/f3.types.ts
// Contrato de salida app→F3: cómo cualquier app del ecosistema (Sefix,
// Centinela, Recursos) entrega resultados que F3-Investigación consume.
// NOMBRES_COMERCIALES es el único lugar donde vive el nombre comercial de
// una técnica — todo lo demás referencia tecnicaId y resuelve el nombre
// aquí cuando necesite mostrarlo, para que un cambio de nombre no obligue
// a tocar el contrato.

import type {
  TecnicaId,
  AppSourceKind,
  OrigenTrazabilidad,
  CoberturaDeclarada,
  Territorio,
  EvaluacionCompatibilidad,
} from "./shared.types";
import type { ProjectType } from "./moddulo.types";

export const NOMBRES_COMERCIALES: Record<TecnicaId, string> = {
  T06: "Sefix", T10: "Fontana", T29: "Acervo", T21: "Persona", T18: "Nexus",
  T03: "Netvox", T26: "Lexis", T12: "Verba", T11: "Focus", T22: "Pestel",
  T27: "Fiscus", T07: "Pulso", T17: "Sentio", T34: "Radar", T35: "Vigía",
  T30: "Panorama", T32: "Prisma", T31: "Mosaico", T33: "Diana", T24: "Red",
  T19: "Cuadrante", T23: "Prensa", T08: "Marco", T16: "Trama", T01: "Contacto",
  T02: "Fonos", T15: "Glosa", T20: "Termómetro", T13: "Convergencia",
  T25: "Referencias", T05: "Bitácora", T09: "Memoria", T04: "Votum", T14: "Specto",
  T28: "Impulso",
};

export interface ResultadoF3<TPayload = unknown> {
  moduloPIP: string;
  origen: OrigenTrazabilidad;
  cobertura: CoberturaDeclarada;
  payload: TPayload;
  // M2 — aprobación explícita del usuario antes de que el resultado entre
  // a la síntesis (M3). Se hereda a ResultadoCargaManual/ResultadoFuenteExterna.
  aprobado?: boolean;
  notasUsuario?: string;
}

// Subconjunto deliberado de OrigenTrazabilidad["componente"]: solo las apps
// del ecosistema que pueden tener un contrato real con F3 (Canal 1). Excluye
// a propósito "external" | "moddulo" | "manual" — esos son orígenes sin app
// con contrato (carga manual, vínculo Canal 3, generado dentro de Moddulo),
// no aplican aquí. Derivado por Extract, no copiado como union literal
// aparte, para que un valor nuevo en OrigenTrazabilidad no quede
// desincronizado en silencio — mismo patrón que LinkedSourceRef.componente
// en moddulo.types.ts.
export type AppConContrato = Extract<
  OrigenTrazabilidad["componente"],
  "sefix" | "centinela" | "recursos"
>;

export interface AppContractConfig {
  tecnicaId: TecnicaId;
  componente: AppConContrato;
  pipModulos: string[];
  deliveryMechanism: "api-push" | "link-manual";
  payloadSchema?: string;
}

// Se puebla conforme cada técnica se construya. T10 (Fontana) es la
// primera entrada real — Paso 5, incremento Familia 1 vía ECEG. Habilita
// estadoApp: "disponible" en tareas/generar/route.ts para asignaciones
// canal1+T10, lo que a su vez activa la navegación real hacia Fontana en
// F3TareasPIP.tsx. deliveryMechanism: "api-push" está declarado por
// contrato (Arquitectura Paso3 v2, §4) pero el endpoint de entrega
// (/api/moddulo/f3/canal1/entregar) todavía no existe — queda para un
// incremento posterior.
export const APP_TO_F3_CONTRACTS: Partial<Record<TecnicaId, AppContractConfig>> = {
  T10: {
    tecnicaId: "T10",
    componente: "centinela",
    pipModulos: [
      "contexto_pestel_social",
      "contexto_pestel_economico",
      "contexto_pestel_politico",
      "contexto_pestel_ecologico",
      "contexto_pestel_tecnologico",
    ],
    deliveryMechanism: "api-push",
    payloadSchema: "FontanaContextoTerritorial",
  },
};

// ==========================================
// CANAL 2 — CARGA MANUAL
// ==========================================

export type FamiliaMetodologica = "cuantitativa" | "cualitativa" | "documental" | "mixta";

export interface MetadatosCargaManual {
  fuente: string;
  fechaObtencion: string; // ISO — cuándo se obtuvo el dato originalmente, no cuándo se sube
  // Texto libre (ej. "Entrevista a profundidad", "Encuesta telefónica
  // propia") — sin autocompletado contra el catálogo MMEE, no aplica aquí.
  tecnicaDescrita: string;
  // Sugerida por lib/moddulo/sugerirFamiliaMetodologica() a partir de
  // tecnicaDescrita, editable por el usuario — declarativa, no verificada.
  familiaMetodologica: FamiliaMetodologica;
  formato: "documento" | "audio" | "video" | "imagen" | "texto";
  viaAcademy?: boolean;
}

export interface ResultadoCargaManual<TPayload = { archivoUrl: string; extractoTexto?: string }>
  extends ResultadoF3<TPayload> {
  origen: OrigenTrazabilidad & { sourceKind: "manual"; componente: "manual" };
  metadatosCarga: MetadatosCargaManual;
}

// Familia metodológica declarada en el campo "Familia metodológica" de cada
// ficha de docs/specs/MMEE_v2_0.md (Sección 2). Valores compuestos en el MMEE
// (ej. T10 "Cuantitativa · Documental") se normalizan aquí a "mixta".
// Único lugar donde vive esta derivación — igual que NOMBRES_COMERCIALES,
// ningún otro código debe inferir familiaMetodologica por su cuenta cuando
// metodoUtilizado sea { tecnicaId }: siempre resolver vía este catálogo.
export const FAMILIA_METODOLOGICA_POR_TECNICA: Record<TecnicaId, FamiliaMetodologica> = {
  T01: "cuantitativa", T02: "cuantitativa", T03: "cuantitativa", T04: "cuantitativa",
  T05: "cuantitativa", T06: "documental", T07: "cuantitativa", T08: "mixta",
  T09: "cuantitativa", T10: "documental", T11: "cualitativa", T12: "cualitativa",
  T13: "cualitativa", T14: "cualitativa", T15: "cualitativa", T16: "mixta",
  T17: "cualitativa", T18: "mixta", T19: "mixta", T20: "mixta",
  T21: "mixta", T22: "documental", T23: "documental", T24: "mixta",
  T25: "mixta", T26: "documental", T27: "mixta", T28: "mixta",
  T29: "mixta", T30: "mixta", T31: "mixta", T32: "mixta",
  T33: "mixta", T34: "cuantitativa", T35: "mixta",
};

// ==========================================
// CANAL 3 — VINCULACIÓN DE FUENTE EXTERNA
// ==========================================

export interface MetadatosFuenteExterna {
  nombreHerramienta: string;
  territorioDeclarado: Territorio;
  fechaObtencion: string; // ISO
  // Texto libre (ej. "Encuesta cara a cara, contratada con terceros") —
  // mismo criterio que MetadatosCargaManual.tecnicaDescrita, sin
  // autocompletado contra el catálogo MMEE.
  metodoDeclarado: string;
  // Sugerida por lib/moddulo/sugerirFamiliaMetodologica() a partir de
  // metodoDeclarado, editable por el usuario — declarativa, no verificada.
  familiaMetodologica: FamiliaMetodologica;
  // Necesario para evaluar pertinencia (bloqueo duro) — no hay forma
  // determinística de comparar "¿aplica a mi proyecto?" sin este dato.
  tipoProyectoDeclarado: ProjectType;
}

export interface ResultadoFuenteExterna<TPayload = { archivoUrl: string; extractoTexto?: string }>
  extends ResultadoF3<TPayload> {
  origen: OrigenTrazabilidad & { sourceKind: "external"; componente: "external" };
  metadatosFuente: MetadatosFuenteExterna;
  // Evaluación que justificó el vínculo, conservada por trazabilidad.
  compatibilidad: EvaluacionCompatibilidad;
  // Ronda 13 (26-08-18) — propagación de cambios de territorio. Snapshot
  // (JSON de TerritorioEscalar, lib/territorio/staleness.ts) del territorio
  // del PROYECTO al momento de vincular — NO territorioDeclarado (ese es un
  // dato fijo de la fuente, no lo que puede desactualizarse). Aditivo —
  // fuentes vinculadas antes de esta ronda no lo tienen, el staleness
  // simplemente no es evaluable para ellas (nunca un falso positivo).
  proyectoTerritorioSnapshotAtVinculacion?: string;
}

// Títulos cortos de las 35 técnicas del MMEE (docs/specs/MMEE_v2_0.md,
// Sección 2) — usado por el prompt de M1 (tareas/generar) para evaluar el
// catálogo completo, no solo las técnicas con contrato poblado en
// APP_TO_F3_CONTRACTS. Extraído textualmente del documento, no inventado.
export const TECNICA_TITULOS: Record<TecnicaId, string> = {
  T01: "Encuesta de opinión pública (cara a cara)",
  T02: "Encuesta telefónica / CATI",
  T03: "Encuesta en línea / CAWI",
  T04: "Sondeo rápido de salida (exit poll)",
  T05: "Panel de seguimiento transversal",
  T06: "Investigación de electorado",
  T07: "Monitoreo de métricas digitales",
  T08: "Análisis de encuadre mediático (framing cuantitativo)",
  T09: "Registro y conteo de eventos",
  T10: "Análisis de datos abiertos",
  T11: "Grupo focal (focus group)",
  T12: "Entrevista en profundidad",
  T13: "Entrevista a expertos (Delphi simplificado)",
  T14: "Observación participante / etnografía política",
  T15: "Análisis de discurso político",
  T16: "Análisis de narrativas mediáticas",
  T17: "Análisis de sentimiento en redes sociales",
  T18: "Mapeo de actores y grupos de interés (mapa de poder real)",
  T19: "FODA participativo",
  T20: "Análisis de agenda setting",
  T21: "Análisis interno del sujeto P",
  T22: "Análisis PESTEL profundo",
  T23: "Revisión hemerográfica sistematizada",
  T24: "Mapeo de red de alianzas, multiplicadores y recursos disponibles",
  T25: "Benchmarking de campañas y proyectos similares",
  T26: "Análisis documental por tipo de proyecto",
  T27: "Evaluación de viabilidad financiera del proyecto",
  T28: "Investigación acción participativa (IAP)",
  T29: "Inventario de recursos internos",
  T30: "Investigación de medios",
  T31: "Psicografía y segmentación estratégica de audiencias",
  T32: "Análisis de necesidades por segmento",
  T33: "Microsegmentación: nichos, clústeres y segmentos meta",
  T34: "Monitoreo de medios (continuo)",
  T35: "Seguimiento de autoridades",
};

export type { TecnicaId, AppSourceKind };
