// lib/moddulo/phasePropagation.ts
// Motor genérico de propagación entre fases consecutivas: snapshot del
// output de una fase de origen guardado al momento de generar el output
// de la fase destino, comparado contra el estado actual del origen al
// cargar/guardar. Registro parcial — mismo patrón que
// PHASE_DOWNLOADABLE_DOCS (downloadableDocuments.ts) y
// FASES_CON_EVALUADOR (rda.ts): poblado solo con el único par real que
// existe hoy (F1→F2), extensible por diseño.
//
// Agregar un par nuevo (cuando exista, ej. F2→F3) consiste únicamente en:
// (a) una entrada nueva en PHASE_PROPAGATION_PAIRS, y (b) una función
// `diff` nueva específica de ese par — sin tocar diffXpcto ni el resto de
// este archivo. El lado de ESCRITURA del snapshot (ej.
// xpctoSnapshotAtGeneration) sigue viviendo en los endpoints que generan
// el output de cada fase — no se centraliza aquí, ver plan de este bloque.

import type { PhaseId, ModduloProject, XPCTO } from "@/types/moddulo.types";

export interface PropagationDiff {
  field: string;
  from: string;
  to: string;
}

export type ProjectForPropagation = Pick<ModduloProject, "xpcto" | "phases">;

export interface PhasePropagationPair<TSource = unknown> {
  sourcePhase: PhaseId;
  targetPhase: PhaseId;
  // Nombre del campo dentro de phases.{targetPhase}.* donde vive el snapshot.
  snapshotField: string;
  getSourceData(project: ProjectForPropagation): TSource;
  hasTargetOutput(project: ProjectForPropagation): boolean;
  diff(previous: TSource, current: TSource): PropagationDiff[];
}

// Movida desde exploracion/page.tsx — sin cambios de lógica. Compara los
// campos de XPCTO que definen el Propósito (F1) contra los que estaban
// vigentes cuando F2 generó su último M1/DVS.
export function diffXpcto(old: Partial<XPCTO>, next: Partial<XPCTO>): PropagationDiff[] {
  const diffs: PropagationDiff[] = [];
  const labelMap: Record<string, string> = {
    hito: "Hito",
    sujeto: "Sujeto",
    justificacion: "Justificación",
  };

  for (const key of ["hito", "sujeto", "justificacion"] as const) {
    const a = (old[key] ?? "") as string;
    const b = (next[key] ?? "") as string;
    if (a !== b) diffs.push({ field: labelMap[key], from: a || "(vacío)", to: b || "(vacío)" });
  }

  for (const sub of ["financiero", "humano", "logistico"] as const) {
    const a = old.capacidades?.[sub] ?? "";
    const b = next.capacidades?.[sub] ?? "";
    if (a !== b) diffs.push({ field: `Capacidad ${sub}`, from: a || "(vacío)", to: b || "(vacío)" });
  }

  const ta = old.tiempo?.fechaLimite ?? "";
  const tb = next.tiempo?.fechaLimite ?? "";
  if (ta !== tb) diffs.push({ field: "Fecha límite", from: ta || "(vacío)", to: tb || "(vacío)" });

  return diffs;
}

export const PHASE_PROPAGATION_PAIRS: Partial<Record<PhaseId, PhasePropagationPair<any>>> = {
  exploracion: {
    sourcePhase: "proposito",
    targetPhase: "exploracion",
    snapshotField: "xpctoSnapshotAtGeneration",
    getSourceData: (p) => p.xpcto ?? {},
    hasTargetOutput: (p) => !!p.phases?.exploracion?.mapaPESTEL,
    diff: diffXpcto,
  },
};

/**
 * Detecta si el output de `targetPhase` quedó desactualizado respecto a
 * su fase de origen registrada.
 *
 * `null` = no evaluable: sin par registrado para `targetPhase`, sin
 * snapshot guardado todavía, o el target aún no generó su output.
 * `[]` = evaluable, sin divergencia.
 * Array no vacío = evaluable, con divergencia real.
 *
 * Misma distinción null/[] que ya usa rda.ts (computeRDAItemsParaFase) —
 * no confundir "nada que reportar" con "no hay datos para evaluar".
 */
export function detectForwardStaleness(
  targetPhase: PhaseId,
  project: ProjectForPropagation
): PropagationDiff[] | null {
  const pair = PHASE_PROPAGATION_PAIRS[targetPhase];
  if (!pair) return null;
  if (!pair.hasTargetOutput(project)) return null;

  const targetPhaseData = project.phases?.[pair.targetPhase] as unknown as Record<string, unknown> | undefined;
  const raw = targetPhaseData?.[pair.snapshotField] as string | undefined;
  if (!raw) return null;

  const current = pair.getSourceData(project);
  if (raw === JSON.stringify(current)) return [];
  return pair.diff(JSON.parse(raw), current);
}
