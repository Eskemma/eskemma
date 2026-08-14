// types/shared.types.ts
// Primitivas neutrales compartidas por más de un módulo (Moddulo, PESTEL,
// y futuras integraciones app→F3). No pertenecen a ningún dominio
// específico — un módulo importa de aquí, nunca al revés.

// ==========================================
// TERRITORIO (movido desde pestel.types.ts — usado por PESTEL y Moddulo)
// ==========================================

export type NivelTerritorial =
  | "nacional"           // Todo México
  | "estatal"            // Un estado (ej. Jalisco)
  | "municipal"          // Un municipio (ej. Zapopan)
  | "distrito"           // legacy — alias de distrito_federal (proyectos en Firestore pre-renaming)
  | "distrito_federal"   // Distrito electoral federal (Diputados Federales)
  | "distrito_local";    // Distrito electoral local (Diputados Locales)

export interface DistritoSeleccionado {
  cve: string;
  nombre: string;
}

export interface Territorio {
  nivel: NivelTerritorial;
  pais?: string;
  estado?: string;
  municipio?: string;
  nombre: string;
  cve_distrito?: string;
  // Campo aditivo (Fase 0 del rediseño de territorio, 26-08-13) — permite
  // declarar UNO O VARIOS distritos electorales estructurados (cve+nombre
  // reales del catálogo de lib/geo/, vía /api/geo/options), a diferencia de
  // cve_distrito (un solo string, solo distrito federal). No reemplaza a
  // estado/municipio/cve_distrito — proyectos existentes en Firestore no
  // tienen esta clave; usar lib/moddulo/territorioPlural.ts para leerlo con
  // fallback seguro hacia los campos legados. Ver CLAUDE.md — Deuda Técnica
  // Conocida, entrada "Captura de distrito electoral sin estructura".
  distritosSeleccionados?: DistritoSeleccionado[];
}

// ==========================================
// CATÁLOGO DE TÉCNICAS MMEE (docs/specs/MMEE_v2_0.md) Y TRAZABILIDAD DE ORIGEN
// ==========================================

export type TecnicaId =
  | "T01" | "T02" | "T03" | "T04" | "T05" | "T06" | "T07" | "T08" | "T09" | "T10"
  | "T11" | "T12" | "T13" | "T14" | "T15" | "T16" | "T17" | "T18" | "T19" | "T20"
  | "T21" | "T22" | "T23" | "T24" | "T25" | "T26" | "T27" | "T28" | "T29" | "T30"
  | "T31" | "T32" | "T33" | "T34" | "T35";

// "express" — resultado generado dentro de Moddulo (ej. M1 vía flujo express),
// sin una app externa del ecosistema como fuente.
// "manual" — carga manual de F3 Canal 2 (documento/audio/video/entrevista
// subido directamente, sin pasar por ninguna app del ecosistema).
export type AppSourceKind = TecnicaId | "external" | "express" | "manual";

export interface OrigenTrazabilidad {
  sourceKind: AppSourceKind;
  componente: "sefix" | "centinela" | "recursos" | "external" | "moddulo" | "manual";
  analisisId: string;
  fechaEntrega: string; // ISO date
}

export interface CoberturaDeclarada {
  completa: boolean;
  detalle?: string;
}

// ==========================================
// VINCULACIÓN EXTERNA GENÉRICA (generalización del picker Moddulo↔Centinela)
// ==========================================

// Territorio y tipo responden la misma pregunta ("¿esto aplica a mi
// proyecto?"), pero con distinto rigor: tipo es bloqueo duro sin bypass
// (cumple), territorio es bloqueable-con-confirmación (las dos señales
// viven en el mismo criterio, no en criterios separados).
export interface CriterioPertinencia {
  cumple: boolean; // false solo si el tipo no coincide — bloqueo duro, sin bypass
  detalle: string;
  territorioRequiereConfirmacion?: boolean; // true si territorio es mismatch/approximate
  territorioDetalle?: string;
}

export interface EvaluacionCompatibilidad {
  pertinencia: CriterioPertinencia;
  vigencia: { cumple: boolean; detalle: string }; // exclusivamente fecha vs. temporalidad del proyecto
  compatibilidadMetodologica: { cumple: boolean; detalle: string };
}

// Candidato externo evaluado antes de vincularlo — distinto del campo
// persistido `PhaseState.linkedSource` (types/moddulo.types.ts), que es el
// vínculo ya confirmado.
export interface LinkableSource<TCompat = EvaluacionCompatibilidad> {
  sourceKind: "external";
  compatibilidad: TCompat;
  origen: OrigenTrazabilidad;
}
