// lib/moddulo/impactoReemplazoDVS.ts
// Impact of replacing the finalized F2 analysis (`phases.exploracion.dvs`) on
// what Phase 3 already built on top of it. PURE: no Firestore, no React.
//
// The identity that F3 depends on is `dvs.pip[].pipItemId` and
// `dvs.semaforo[].actorId`. A regeneration always creates NEW ids (nothing
// carries the previous ones: see sanitizeDVS in generate-dvs), while a manual
// edit keeps them. So the impact is computed for one of two modes:
//   - "reemplazo_total": every id changes (generate-dvs final / M8).
//   - { idsPipEliminados, idsActorEliminados }: only those ids disappear
//     (finalize-dvs, commit 3). Edits that keep every id => empty sets => no
//     impact, no confirmation, no block.
//
// Out of scope here (Grupo 2): authorship / date of the action (H03) and
// versioning with changelog.ts (H06/H08).

import type { DVSF2, TareaPIP } from "@/types/moddulo.types";
import { serializacionEstable } from "./serializacionEstable";

/**
 * "Real progress" on a task: anything other than "freshly proposed, untouched".
 * Deliberately broad: not only approved results, also a channel the user turned
 * off by hand. Extracted from tareas/generar (same behavior).
 */
export function tareaTieneProgreso(t: Pick<TareaPIP, "asignaciones">): boolean {
  return (t.asignaciones ?? []).some(
    (a) => a.estado !== "pendiente" || !!a.resultadoId || a.activada === false
  );
}

export type ModoReemplazo =
  | "reemplazo_total"
  | { idsPipEliminados: string[]; idsActorEliminados: string[] };

export interface ResultadoMin {
  resultadoId: string;
  aprobado?: boolean;
}

export interface EstadoParaImpacto {
  dvs?: DVSF2 | null;
  tareas?: TareaPIP[];
  resultados?: ResultadoMin[];
  sintesis?: {
    vaciosResiduales?: { pipItemId?: string }[];
    fodaAdversariosInsumo?: Record<string, unknown>;
  } | null;
  veredicto?: unknown;
  die?: unknown;
}

export interface ImpactoReemplazo {
  tareasAfectadas: number;
  tareasConAvance: number;
  resultadosRecibidos: number;
  resultadosAprobados: number;
  sintesisAfectada: boolean;
  /** The synthesis cites a question that would disappear (or all, in "total" mode). */
  sintesisPorPregunta: boolean;
  /** The synthesis holds the adversary FODA of an actor that would disappear. */
  sintesisPorActor: boolean;
  veredictoExiste: boolean;
  dieExiste: boolean;
  /** ids included in the fingerprint (not only counts) */
  idsTareasConAvance: string[];
  idsResultadosRecibidos: string[];
  idsResultadosAprobados: string[];
}

export interface DecisionReemplazo {
  /** PROVISIONAL: F3 already issued its verdict (DIE) and cannot be reopened yet. */
  bloquear: boolean;
  motivoBloqueo: string | null;
  /** Always true when a finalized dvs exists and something would change. */
  requiereConfirmacion: boolean;
  /** Whether the F3-impact lines are worth showing (real impact only). */
  hayImpactoF3: boolean;
  impacto: ImpactoReemplazo;
  /** Fingerprint of mode + impact, to validate a confirmation against the real state. */
  huella: string;
}

// PROVISIONAL. Wording uses what the user sees on screen, never "DIE": a DIE is
// written in the SAME update as the approved verdict (veredicto/aprobar), so
// "approved «M4 · Veredicto HEI»" is true by construction, and F3 shows the
// «Reporte F3» tab exactly when the DIE exists (`isLista = !!die`).
export type VerboReemplazo = "reemplazar" | "guardar" | "finalizar";

const BASE_BLOQUEO_DIE =
  "La Fase 3 ya aprobó su «M4 · Veredicto HEI» y cuenta con su «Reporte F3».";

/** Block reason worded for what the user is doing (replace / save an edit / finalize). */
export function motivoBloqueoDIE(verbo: VerboReemplazo): string {
  switch (verbo) {
    case "reemplazar":
      return `${BASE_BLOQUEO_DIE} Reemplazar el análisis las dejaría inconsistentes, y reabrir la Fase 3 aún no está disponible.`;
    case "guardar":
      return `${BASE_BLOQUEO_DIE} Guardar estos cambios las dejaría inconsistentes, y reabrir la Fase 3 aún no está disponible. Puedes guardar cambios que conserven todas las preguntas y actores.`;
    case "finalizar":
      return `${BASE_BLOQUEO_DIE} Finalizar este análisis las dejaría inconsistentes, y reabrir la Fase 3 aún no está disponible.`;
  }
}

export const MOTIVO_BLOQUEO_DIE = motivoBloqueoDIE("reemplazar");

function hashEstable(texto: string): string {
  // cyrb53: deterministic, dependency-free (also safe for client bundles). It
  // detects accidental state changes between "ask" and "confirm"; it is not a
  // security primitive.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const sortedUnique = (xs: string[]) => [...new Set(xs)].sort();

export function calcularImpactoReemplazoDVS(
  estado: EstadoParaImpacto,
  modo: ModoReemplazo
): DecisionReemplazo {
  const tareas = estado.tareas ?? [];
  const resultados = estado.resultados ?? [];
  const total = modo === "reemplazo_total";
  const idsPipEliminados = new Set(total ? [] : modo.idsPipEliminados);
  const idsActorEliminados = new Set(total ? [] : modo.idsActorEliminados);

  const tareasAfectadas = total ? tareas : tareas.filter((t) => idsPipEliminados.has(t.pipItemId));
  const conAvance = tareasAfectadas.filter(tareaTieneProgreso);

  // Results reachable from the affected tasks (every result in "total" mode).
  const resultadoIdsDeTareas = new Set(
    tareasAfectadas.flatMap((t) => (t.asignaciones ?? []).map((a) => a.resultadoId).filter((x): x is string => !!x))
  );
  const resultadosAfectados = total ? resultados : resultados.filter((r) => resultadoIdsDeTareas.has(r.resultadoId));
  const aprobados = resultadosAfectados.filter((r) => r.aprobado === true);

  const sintesis = estado.sintesis ?? null;
  const sintesisPorPregunta =
    !!sintesis &&
    (total || (sintesis.vaciosResiduales ?? []).some((v) => !!v.pipItemId && idsPipEliminados.has(v.pipItemId)));
  const sintesisPorActor =
    !!sintesis && !total && Object.keys(sintesis.fodaAdversariosInsumo ?? {}).some((k) => idsActorEliminados.has(k));
  const sintesisAfectada = sintesisPorPregunta || sintesisPorActor;

  const impacto: ImpactoReemplazo = {
    tareasAfectadas: tareasAfectadas.length,
    tareasConAvance: conAvance.length,
    resultadosRecibidos: resultadosAfectados.length,
    resultadosAprobados: aprobados.length,
    sintesisAfectada,
    sintesisPorPregunta,
    sintesisPorActor,
    veredictoExiste: !!estado.veredicto,
    dieExiste: !!estado.die,
    idsTareasConAvance: sortedUnique(conAvance.map((t) => t.pipItemId)),
    idsResultadosRecibidos: sortedUnique(resultadosAfectados.map((r) => r.resultadoId)),
    idsResultadosAprobados: sortedUnique(aprobados.map((r) => r.resultadoId)),
  };

  // The fingerprint also covers WHAT is being replaced (the current dvs): two
  // confirmations of the same impact cannot both replace it, and an edit of the
  // dvs between "ask" and "confirm" invalidates the confirmation.
  const huella = hashEstable(
    serializacionEstable({
      modo: total
        ? "total"
        : { pip: sortedUnique([...idsPipEliminados]), actor: sortedUnique([...idsActorEliminados]) },
      impacto,
      dvs: estado.dvs ?? null,
    })
  );

  const hayDvs = !!estado.dvs;
  const hayImpactoF3 =
    impacto.tareasAfectadas > 0 || impacto.resultadosRecibidos > 0 || impacto.sintesisAfectada;
  const algoCambia = total || idsPipEliminados.size > 0 || idsActorEliminados.size > 0;
  // DIE (F3 closed): block only when F3 content would actually be affected.
  const bloquear = hayDvs && impacto.dieExiste && algoCambia && (total || hayImpactoF3);

  return {
    bloquear,
    motivoBloqueo: bloquear ? MOTIVO_BLOQUEO_DIE : null,
    requiereConfirmacion: hayDvs && !bloquear && (total || hayImpactoF3),
    hayImpactoF3: hayDvs && hayImpactoF3,
    impacto,
    huella,
  };
}

// ── Server-side lock ─────────────────────────────────────────────────────────

export type AccionCandado =
  | "continuar"
  | "requiere_confirmacion"
  | "bloqueado"
  | "huella_vencida";

export interface ResultadoCandado {
  accion: AccionCandado;
  decision: DecisionReemplazo;
}

/**
 * The single decision used BEFORE calling Claude and again INSIDE the write
 * transaction. `huellaRecibida` is the fingerprint the user confirmed (null when
 * nothing was confirmed); it is compared with the fingerprint of the state read
 * at the moment of the check.
 */
export function decidirCandadoReemplazo(args: {
  decision: DecisionReemplazo;
  confirmar: boolean;
  huellaRecibida: string | null | undefined;
}): ResultadoCandado {
  const { decision, confirmar, huellaRecibida } = args;
  if (decision.bloquear) return { accion: "bloqueado", decision };
  if (!decision.requiereConfirmacion) return { accion: "continuar", decision };
  if (confirmar !== true || !huellaRecibida) return { accion: "requiere_confirmacion", decision };
  if (huellaRecibida !== decision.huella) return { accion: "huella_vencida", decision };
  return { accion: "continuar", decision };
}

/** Thrown inside the write transaction when the lock rejects the replacement. */
export class ReemplazoRechazadoError extends Error {
  constructor(
    public readonly accion: Exclude<AccionCandado, "continuar">,
    public readonly decision: DecisionReemplazo
  ) {
    super(`Reemplazo rechazado: ${accion}`);
    this.name = "ReemplazoRechazadoError";
  }
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/**
 * Impact lines for the confirmation modal, built with the labels the user sees
 * in F3 («M1 · Tablero de tareas», «M2 · Resultados recibidos», «M3 · Síntesis
 * de hallazgos», «M4 · Veredicto HEI») and the words F3 already uses when the
 * PIP changes («El PIP cambió desde que se generó el tablero de investigación»,
 * «Sincronizar tablero ↺»). F3 never flags the synthesis or the verdict as
 * stale (no such banner exists), so those lines say what will happen, not a
 * state F3 would display. Empty when there is no real impact on F3.
 */
export function lineasDeImpacto(decision: DecisionReemplazo): string[] {
  if (!decision.hayImpactoF3) return [];
  const i = decision.impacto;
  const lineas: string[] = [];
  if (i.tareasAfectadas > 0) {
    const avance = i.tareasConAvance > 0 ? ` (${i.tareasConAvance} con avance)` : "";
    lineas.push(
      `${i.tareasAfectadas} ${plural(i.tareasAfectadas, "tarea", "tareas")} de «M1 · Tablero de tareas»${avance} ${plural(i.tareasAfectadas, "quedará", "quedarán")} sin su pregunta: F3 avisará «El PIP cambió desde que se generó el tablero de investigación» y «Sincronizar tablero ↺» ${plural(i.tareasAfectadas, "la retirará", "las retirará")}.`
    );
  }
  if (i.resultadosRecibidos > 0) {
    const aprob =
      i.resultadosAprobados > 0
        ? ` (${i.resultadosAprobados} ${plural(i.resultadosAprobados, "aprobado", "aprobados")})`
        : "";
    lineas.push(
      `${i.resultadosRecibidos} ${plural(i.resultadosRecibidos, "resultado", "resultados")} de «M2 · Resultados recibidos»${aprob} ${plural(i.resultadosRecibidos, "quedará asociado", "quedarán asociados")} a preguntas que ya no existen en el análisis nuevo.`
    );
  }
  if (i.sintesisAfectada) {
    lineas.push(
      "«M3 · Síntesis de hallazgos» seguirá citando las preguntas y los actores del análisis anterior; F3 no lo señalará."
    );
  }
  if (i.veredictoExiste) {
    lineas.push("«M4 · Veredicto HEI» ya se generó sobre el análisis anterior y no se actualizará.");
  }
  return lineas;
}

/**
 * Impact lines when a manual edit (or a finalization of a regenerated draft)
 * removes ids that F3 uses. Same labels as `lineasDeImpacto`; the wording differs
 * because here only some questions / actors disappear and F3 reacts to each part
 * differently (verified in F3Tablero, tareas/sincronizar and F3Sintesis):
 *  - tareas: F3Tablero shows the banner and «Sincronizar tablero ↺» RETIRES the
 *    tasks of removed questions with their asignaciones and progress (the
 *    f3Resultados documents are not touched);
 *  - síntesis: a removed ACTOR keeps its frozen FODA with the note
 *    «(ya no está en el Semáforo vigente)»; a removed QUESTION is not flagged.
 */
export function lineasDeImpactoEdicion(decision: DecisionReemplazo): string[] {
  if (!decision.hayImpactoF3) return [];
  const i = decision.impacto;
  const lineas: string[] = [];
  if (i.tareasAfectadas > 0) {
    const avance = i.tareasConAvance > 0 ? ` (${i.tareasConAvance} con avance)` : "";
    const retira = i.tareasConAvance > 0 ? "junto con sus asignaciones y su avance" : "del tablero";
    lineas.push(
      `${i.tareasAfectadas} ${plural(i.tareasAfectadas, "tarea", "tareas")} de «M1 · Tablero de tareas»${avance} ${plural(i.tareasAfectadas, "quedará", "quedarán")} sin su pregunta: F3 avisará «El PIP cambió desde que se generó el tablero de investigación» y «Sincronizar tablero ↺» ${plural(i.tareasAfectadas, "la retirará", "las retirará")} ${retira}.`
    );
  }
  if (i.resultadosRecibidos > 0) {
    const aprob =
      i.resultadosAprobados > 0
        ? ` (${i.resultadosAprobados} ${plural(i.resultadosAprobados, "aprobado", "aprobados")})`
        : "";
    lineas.push(
      `${i.resultadosRecibidos} ${plural(i.resultadosRecibidos, "resultado", "resultados")} de «M2 · Resultados recibidos»${aprob} ${plural(i.resultadosRecibidos, "quedará asociado", "quedarán asociados")} a preguntas que ya no existen en el análisis.`
    );
  }
  if (i.sintesisPorPregunta) {
    lineas.push(
      "«M3 · Síntesis de hallazgos» seguirá citando preguntas que ya no existen en el análisis; F3 no lo señalará."
    );
  }
  if (i.sintesisPorActor) {
    lineas.push(
      "«M3 · Síntesis de hallazgos» conservará el insumo FODA de los actores eliminados, marcado «(ya no está en el Semáforo vigente)»."
    );
  }
  if (i.veredictoExiste) {
    lineas.push("«M4 · Veredicto HEI» ya se generó sobre el análisis anterior y no se actualizará.");
  }
  return lineas;
}
