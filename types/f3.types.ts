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
}

export interface AppContractConfig {
  tecnicaId: TecnicaId;
  componente: "sefix" | "centinela" | "recursos";
  pipModulos: string[];
  deliveryMechanism: "api-push" | "link-manual";
  payloadSchema?: string;
}

// Vacío por ahora — se puebla conforme cada técnica se construya.
export const APP_TO_F3_CONTRACTS: Partial<Record<TecnicaId, AppContractConfig>> = {};

// ==========================================
// CANAL 2 — CARGA MANUAL
// ==========================================

export type FamiliaMetodologica = "cuantitativa" | "cualitativa" | "documental" | "mixta";

export type MetodoUtilizado = { tecnicaId: TecnicaId } | { otro: string };

export interface MetadatosCargaManual {
  fuente: string;
  fechaObtencion: string; // ISO — cuándo se obtuvo el dato originalmente, no cuándo se sube
  metodoUtilizado: MetodoUtilizado;
  // auto-poblada si metodoUtilizado es tecnicaId (vía
  // FAMILIA_METODOLOGICA_POR_TECNICA); capturada del usuario si es 'otro'.
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
  T05: "cuantitativa", T06: "mixta", T07: "cuantitativa", T08: "mixta",
  T09: "cuantitativa", T10: "mixta", T11: "cualitativa", T12: "cualitativa",
  T13: "mixta", T14: "cualitativa", T15: "mixta", T16: "mixta",
  T17: "mixta", T18: "mixta", T19: "mixta", T20: "mixta",
  T21: "mixta", T22: "mixta", T23: "documental", T24: "mixta",
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
  metodoDeclarado: MetodoUtilizado;
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
}

export type { TecnicaId, AppSourceKind };
