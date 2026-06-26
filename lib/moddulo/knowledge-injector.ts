// lib/moddulo/knowledge-injector.ts
// Builds the knowledge context block injected at the start of each Claude system prompt.
// Selection logic is per-phase, as defined in docs/moddulo/arquitectura/knowledge-base-injection.md.
import type { PhaseId } from "@/types/moddulo.types";
import type {
  RAEAxioma,
  RPFEntry,
  MECInstrument,
  MVPInstrument,
  FODAInstrument,
  KPIEntry,
} from "@/types/knowledge.types";
import {
  getActiveRAEVersion,
  getMECByType,
  getMVPGeneral,
  getFODAInstrument,
  getRPFEntries,
  getKPIsByType,
  getKPIsByIds,
} from "./knowledge-repository";

// ==========================================
// CAP DE AXIOMAS POR VARIABLE XPCTO
// ==========================================

// Cap provisional: el ordenamiento por severidad es efectivo cuando el RAE
// tenga datos diferenciados en ese campo. Con la versión actual (98.6% baja),
// el orden real dentro de cada bucket es arbitrario.
// Pendiente: revisión editorial del RAE para añadir campos 'peso_por_fase'
// y 'relevancia_por_tipo'. Cuando existan, actualizar severityScore() aquí.
const MAX_AXIOMAS_POR_VARIABLE = 8;

const SEVERIDAD_ORDER: Record<string, number> = {
  crítica: 5,
  muy_alta: 4,
  alta: 3,
  media: 2,
  baja: 1,
};

const XPCTO_VARS = ["X", "P", "C", "T", "O"] as const;

/**
 * Caps axioms at MAX_AXIOMAS_POR_VARIABLE per XPCTO variable, ordered by
 * severity descending (crítica → muy_alta → alta → media → baja).
 * Axioms with multiple variables are counted in each variable bucket but
 * appear only once in the result (deduplication by id).
 * Axioms with no XPCTO variable get their own capped bucket.
 */
function capAxiomasByVariable(axiomas: RAEAxioma[]): RAEAxioma[] {
  const severityScore = (a: RAEAxioma) => SEVERIDAD_ORDER[a.severidad] ?? 0;
  const seenIds = new Set<string>();
  const result: RAEAxioma[] = [];

  for (const variable of XPCTO_VARS) {
    const group = axiomas
      .filter((a) => a.variable_xpcto.includes(variable))
      .sort((a, b) => severityScore(b) - severityScore(a))
      .slice(0, MAX_AXIOMAS_POR_VARIABLE);

    for (const a of group) {
      if (!seenIds.has(a.id)) {
        seenIds.add(a.id);
        result.push(a);
      }
    }
  }

  // Axioms with no XPCTO variable: own capped bucket
  const noVar = axiomas
    .filter((a) => a.variable_xpcto.length === 0 && !seenIds.has(a.id))
    .sort((a, b) => severityScore(b) - severityScore(a))
    .slice(0, MAX_AXIOMAS_POR_VARIABLE);

  for (const a of noVar) {
    seenIds.add(a.id);
    result.push(a);
  }

  return result;
}

// ==========================================

const PHASE_NUMBER: Record<PhaseId, number> = {
  proposito: 1,
  exploracion: 2,
  investigacion: 3,
  diagnostico: 4,
  estrategia: 5,
  tactica: 6,
  gerencia: 7,
  seguimiento: 8,
  evaluacion: 9,
};

export interface BuildPhaseContextParams {
  phaseId: PhaseId;
  projectType: string;
  raeVersionId?: string;
  maniobra?: string;
  // IDs of KPIs confirmed in F6 — used in F7 and F8
  kpisSeleccionados?: string[];
}

export async function buildPhaseContext(
  params: BuildPhaseContextParams
): Promise<string> {
  const { phaseId, projectType, maniobra, kpisSeleccionados } = params;
  const phaseNum = PHASE_NUMBER[phaseId];

  const sections: string[] = [];

  // ---- RAE ----
  const rae = await getActiveRAEVersion();
  const raeVersion = rae?.versionId ?? "";

  if (rae && [1, 2, 3, 4, 5, 6, 9].includes(phaseNum)) {
    let axiomas = filterRAEByType(rae.axiomas, projectType);

    if (phaseNum === 1) {
      // F1: axioms with XPCTO variable mapping that apply to phase 1
      axiomas = axiomas.filter(
        (a) => a.variable_xpcto.length > 0 && a.fases_aplicacion.includes(1)
      );
    } else if (phaseNum === 9) {
      // F9: all axioms for project type
    } else {
      // F2, F3, F5, F6: filter by phase
      axiomas = axiomas.filter((a) => a.fases_aplicacion.includes(phaseNum));
    }

    // Cap per XPCTO variable, ordered by severity — applies to all RAE phases
    axiomas = capAxiomasByVariable(axiomas);

    if (axiomas.length > 0) {
      sections.push(formatRAE(axiomas, raeVersion));
    }
  }

  // ---- MEC, MVP, FODA (F4 only) ----
  if (phaseNum === 4) {
    const [mec, mvp, foda] = await Promise.all([
      getMECByType(projectType),
      getMVPGeneral(),
      getFODAInstrument(),
    ]);

    if (mec) sections.push(formatMEC(mec, projectType));
    if (mvp) sections.push(formatMVP(mvp, projectType));
    if (foda) sections.push(formatFODA(foda));
  }

  // ---- RPF (F5 and F6) ----
  if (phaseNum === 5 || phaseNum === 6) {
    const rpf = await getRPFEntries(
      projectType,
      phaseNum === 5 ? maniobra : undefined
    );
    if (rpf.length > 0) sections.push(formatRPF(rpf));
  }

  // ---- KPIs (F6, F7, F8, F9) ----
  if (phaseNum >= 6) {
    let kpis: KPIEntry[] = [];

    if (phaseNum === 6 || phaseNum === 9) {
      kpis = await getKPIsByType(projectType);
    } else if (phaseNum === 7 || phaseNum === 8) {
      // Use confirmed KPIs from F6; fallback to all by type
      if (kpisSeleccionados && kpisSeleccionados.length > 0) {
        kpis = await getKPIsByIds(kpisSeleccionados);
      } else {
        kpis = await getKPIsByType(projectType);
      }
    }

    if (kpis.length > 0) sections.push(formatKPIs(kpis));
  }

  return sections.join("\n\n");
}

// ==========================================
// HELPERS DE FILTRADO
// ==========================================

function filterRAEByType(axiomas: RAEAxioma[], tipo: string): RAEAxioma[] {
  return axiomas.filter(
    (a) => a.tipos_proyecto.length === 0 || a.tipos_proyecto.includes(tipo)
  );
}

// ==========================================
// FORMATTERS
// ==========================================

function formatRAE(axiomas: RAEAxioma[], version: string): string {
  const lines: string[] = [
    `=== AXIOMAS DE REFERENCIA (RAE${version ? ` v${version}` : ""}) ===`,
    "Los siguientes axiomas de comunicación política deben orientar el análisis de esta fase.",
    "",
  ];

  for (const a of axiomas) {
    lines.push(`${a.id}: ${a.nombre}`);
    lines.push(`Axioma: ${a.axioma_original}`);
    if (a.variable_xpcto.length > 0) {
      lines.push(`Variable XPCTO: ${a.variable_xpcto.join(", ")}`);
    }
    lines.push(`Aplicación: ${a.protocolo_accion}`);
    lines.push("---");
  }

  return lines.join("\n");
}

function formatRPF(entries: RPFEntry[]): string {
  const lines: string[] = [
    "=== PATRONES FUNCIONALES (RPF) ===",
    "Componentes estratégicos de referencia para esta fase.",
    "",
  ];

  for (const e of entries) {
    lines.push(`**${e.componente} / ${e.sub_componente}**`);
    if (e.apartado) lines.push(`Apartado: ${e.apartado}`);
    lines.push(`Alcance: ${e.descripcion_alcance}`);
    if (e.aporte_tactico) lines.push(`Aporte táctico: ${e.aporte_tactico}`);
    if (e.logica_coherencia) lines.push(`Lógica: ${e.logica_coherencia}`);
    lines.push("---");
  }

  return lines.join("\n");
}

function formatMEC(mec: MECInstrument, projectType: string): string {
  const lines: string[] = [
    `=== MAPA DE ESPACIO COMPETITIVO (MEC ${projectType}) ===`,
    mec.descripcion,
    "",
  ];

  for (const eje of mec.ejes) {
    lines.push(`**Eje: ${eje.nombre}**`);
    if (eje.descripcion) lines.push(eje.descripcion);
    lines.push(`Polo positivo: ${eje.polos.positivo} | Polo negativo: ${eje.polos.negativo}`);
    lines.push("---");
  }

  if (mec.narrativas && mec.narrativas.length > 0) {
    lines.push("");
    lines.push("**Narrativas disponibles (nombre + instrucción estratégica):**");
    for (const n of mec.narrativas) {
      lines.push(`[${n.cuadrante}] ${n.nombre}: ${n.instruccion_moddulo}`);
    }
  }

  return lines.join("\n");
}

function formatMVP(mvp: MVPInstrument, projectType: string): string {
  const lines: string[] = [
    "=== MARCO DE VECTORES POLÍTICOS (MVP) ===",
    mvp.descripcion,
    "",
  ];

  for (const v of mvp.vectores) {
    lines.push(`**${v.nombre}**: ${v.descripcion}`);

    // Inject type-specific specicities when available
    const typeKey = projectType.toLowerCase() as keyof NonNullable<typeof v.especificidades>;
    if (v.especificidades?.[typeKey]) {
      lines.push(`Especificidad (${projectType}): ${v.especificidades[typeKey]}`);
    }

    if (v.indicadores.length > 0) {
      lines.push(`Indicadores: ${v.indicadores.join(", ")}`);
    }
    lines.push("---");
  }

  return lines.join("\n");
}

function formatFODA(foda: FODAInstrument): string {
  const lines: string[] = [
    "=== FODA-CAME-IBEA ===",
    foda.descripcion,
    "",
  ];

  for (const marco of foda.marcos) {
    const header = marco.fase
      ? `**${marco.sigla} — ${marco.nombre}** [${marco.fase}]`
      : `**${marco.sigla} — ${marco.nombre}**`;
    lines.push(header);
    if (marco.definicion) lines.push(marco.definicion);
    for (const comp of marco.componentes) {
      if (comp.nombre) {
        lines.push(`  ${comp.nombre}: ${comp.definicion}`);
      }
    }
    lines.push("---");
  }

  return lines.join("\n");
}

function formatKPIs(kpis: KPIEntry[]): string {
  const lines: string[] = [
    "=== INDICADORES DE DESEMPEÑO (KPIs) ===",
    "Indicadores aplicables para evaluación y seguimiento.",
    "",
  ];

  for (const k of kpis) {
    lines.push(`**${k.nombre}** [${k.bloque}]`);
    lines.push(k.descripcion);
    if (k.formula) lines.push(`Fórmula: ${k.formula}`);
    if (k.umbral_referencia) lines.push(`Umbral: ${k.umbral_referencia}`);
    lines.push("---");
  }

  return lines.join("\n");
}
