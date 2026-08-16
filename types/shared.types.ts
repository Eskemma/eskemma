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
  // Aditivo (Fase 2 del rediseño de territorio, 26-08-13) — nombre del
  // estado al que pertenece este distrito. Necesario porque `cve` (3
  // dígitos) NO es único entre estados: un proyecto puede tener distritos
  // de varios estados desde Fase 2 (ej. distrito 005 de Jalisco Y distrito
  // 005 de otro estado). Opcional ÚNICAMENTE por la entrada legada única ya
  // escrita en producción durante la verificación de Fase 1
  // (nZvpYu4nnZrsw5hoGcVP) antes de que este campo existiera — nunca debe
  // quedar sin poblar en una entrada nueva (ver TerritorySelector.tsx,
  // agregarDistrito() exige `estado` no-opcional al construir). Un lector
  // que encuentre `estado` ausente debe asumir que es esa entrada legada (o
  // una migración manual equivalente) y usar `Territorio.estado` (el campo
  // legado singular) como fallback — nunca dejarlo en blanco en la UI.
  estado?: string;
}

// Municipio con estado por entrada (Decisión 2, Ronda 2/3 del rediseño de
// territorio, 26-08-16) — mismo espíritu que DistritoSeleccionado.estado:
// un proyecto puede declarar municipios de varios estados (ej. Guadalajara/
// Jalisco + Tepic/Nayarit). Campo NUEVO, aditivo — Territorio.municipiosSeleccionados
// (string[] plano, sin estado) NO se transforma ni se retira, porque ya
// pudo usarse en producción real (confirmado: proyecto O2RBnCPiyGJ6u6kyk1rS,
// ZMG, 10 municipios) antes de que este tipo existiera. `estado` no-opcional
// aquí (a diferencia de DistritoSeleccionado.estado, que sí es opcional por
// la única entrada legada que existía ANTES de que el campo existiera) —
// este tipo nace ya con `estado` obligatorio porque no hay entradas
// legadas de este tipo en Firestore todavía.
export interface MunicipioSeleccionado {
  nombre: string;
  estado: string;
}

// Taxonomía compartida de agregación territorial (Fase 2, 26-08-13) — no
// vive en Fontana ni en ningún módulo específico porque impacta a
// cualquier app que necesite combinar valores entre varias unidades
// territoriales seleccionadas por el usuario (Fontana, Sefix, Sefix-AI y
// futuras apps del catálogo MMEE). Cada app construye su PROPIA estructura
// de clasificación por indicador/campo (ver lib/fontana/indicatorRegistry.ts)
// importando este tipo — sin registro central que tocar al agregar una app
// nueva. Criterio de cada valor ya validado por Raúl para Fontana
// (lib/fontana/ingesta/index.ts, comentario "CRITERIO GENERAL"), aplicado
// aquí a la dirección peer-a-peer (varias unidades del mismo nivel elegidas
// por el usuario), no solo a la agregación vertical ya existente.
export type TipoAgregacionTerritorial =
  | "aditivo"                  // suma válida entre unidades (conteos, magnitudes absolutas)
  | "tasa_ponderada"           // reconstruir numerador/denominador y ponderar — nunca promediar el % ya calculado
  | "no_agregable"             // sin fórmula de recombinación válida (rankings relativos, índices sin metodología)
  | "narrativo_sintetizado";   // no es operación numérica — síntesis cualitativa entre unidades (PESTEL)

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
  // Campos aditivos (Fase 2, 26-08-13) — mismo criterio que
  // distritosSeleccionados: uno o varios estados/municipios, sin reemplazar
  // los campos legados singulares (estado/municipio), que siguen
  // poblándose con el primer elemento vía
  // lib/moddulo/territorioPlural.ts:resolverPrimerElemento(). No se unifica
  // en una sola estructura genérica con distritosSeleccionados porque
  // estado/municipio no tienen `cve` estructurado hoy (decisión ya
  // documentada: catálogo de municipios descartado por inmanejable fuera
  // de México).
  estadosSeleccionados?: string[];
  municipiosSeleccionados?: string[];
  // Campo aditivo (Decisión 2, 26-08-16) — fuente de verdad para
  // Municipal con multi-estado real. municipiosSeleccionados (arriba)
  // se sigue poblando en cada escritura como
  // municipiosPorEstado.map(m => m.nombre) para no romper lectores
  // viejos — lectores nuevos prefieren este campo; si está ausente,
  // caen a municipiosSeleccionados + estado (mismo patrón de fallback
  // que distritosSeleccionados[i].estado ausente → territorio.estado).
  municipiosPorEstado?: MunicipioSeleccionado[];
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
