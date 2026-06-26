// types/knowledge.types.ts
// Types for Moddulo knowledge base collections: RAE, RPF, MEC, MVP, FODA, KPI

// ==========================================
// RAE — Marco de Axiomas Estratégicos
// ==========================================

export interface RAEAxioma {
  id: string;
  nombre: string;
  axioma: string;
  axioma_original: string;
  variable_xpcto: string[];
  fases_aplicacion: number[];
  tipos_proyecto: string[];
  protocolo_accion: string;
  keywords: string[];
  severidad: string;
}

export interface RAEVersion {
  versionId: string;
  notas: string;
  axiomas: RAEAxioma[];
  publicadoEn: string;
  publicadoPor: string;
}

// ==========================================
// RPF — Registro de Patrones Funcionales
// ==========================================

export interface RPFEntry {
  id: string;
  componente: string;
  sub_componente: string;
  apartado: string;
  tipos_proyecto: string[];
  descripcion_alcance: string;
  planeacion: string;
  organizacion: string;
  direccion: string;
  control: string;
  aporte_tactico: string;
  variables_personalizacion: string;
  logica_coherencia: string;
  vinculo_kpi: string;
  axiomas_rae: string[];
  instrumentos_vinculados: string[];
  version: string;
  actualizadoEn: string;
}

// ==========================================
// MEC — Mapa de Espacio Competitivo
// ==========================================

export interface MECNarrativa {
  id: string;
  nombre: string;
  cuadrante: string;
  instruccion_moddulo: string;
}

export interface MECEje {
  id: string;
  nombre: string;
  descripcion: string;
  polos: { positivo: string; negativo: string };
}

export interface MECInstrument {
  id: string;
  tipo_proyecto: string;
  nombre: string;
  descripcion: string;
  ejes: MECEje[];
  narrativas: MECNarrativa[];
  version: string;
  actualizadoEn: string;
}

// ==========================================
// MVP — Marco de Vectores Políticos
// ==========================================

export interface MVPVector {
  id: string;
  nombre: string;
  descripcion: string;
  indicadores: string[];
  umbral_critico: string;
  especificidades?: {
    electoral: string;
    gubernamental: string;
    legislativo: string;
    ciudadano: string;
  };
}

export interface MVPInstrument {
  id: string;
  nombre: string;
  descripcion: string;
  vectores: MVPVector[];
  version: string;
  actualizadoEn: string;
}

// ==========================================
// FODA-CAME-IBEA
// ==========================================

export interface FODAComponente {
  nombre: string;
  definicion: string;
}

export interface FODAMarco {
  sigla: string;
  nombre: string;
  fase?: string;
  definicion?: string;
  componentes: FODAComponente[];
}

export interface FODAInstrument {
  id: string;
  nombre: string;
  descripcion: string;
  marcos: FODAMarco[];
  version: string;
  actualizadoEn: string;
}

// ==========================================
// KPI — Catálogo de Indicadores
// ==========================================

export interface KPIEntry {
  id: string;
  nombre: string;
  descripcion: string;
  bloque: string;
  tipos_proyecto: string[];
  formula: string;
  umbral_referencia: string;
  umbral_confirmado: string;
  fuente_datos: string;
  fase_medicion: number[];
  instrumento_vinculado: string;
  version: string;
  actualizadoEn: string;
}

// ==========================================
// Resultado del injector
// ==========================================

export interface KnowledgeContext {
  axiomas: RAEAxioma[];
  rpfEntries: RPFEntry[];
  mecInstrument: MECInstrument | null;
  mvpInstrument: MVPInstrument | null;
  fodaInstrument: FODAInstrument | null;
  kpiEntries: KPIEntry[];
  raeVersionId: string;
}
