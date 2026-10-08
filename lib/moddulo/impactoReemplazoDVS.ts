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

export const MOTIVO_BLOQUEO_DIE =
  "La Fase 3 ya emitió su veredicto (DIE) y está cerrada. Reemplazar el análisis la dejaría inconsistente, y reabrir la Fase 3 aún no está disponible.";

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
  const sintesisAfectada = !sintesis
    ? false
    : total ||
      (sintesis.vaciosResiduales ?? []).some((v) => !!v.pipItemId && idsPipEliminados.has(v.pipItemId)) ||
      Object.keys(sintesis.fodaAdversariosInsumo ?? {}).some((k) => idsActorEliminados.has(k));

  const impacto: ImpactoReemplazo = {
    tareasAfectadas: tareasAfectadas.length,
    tareasConAvance: conAvance.length,
    resultadosRecibidos: resultadosAfectados.length,
    resultadosAprobados: aprobados.length,
    sintesisAfectada,
    veredictoExiste: !!estado.veredicto,
    dieExiste: !!estado.die,
    idsTareasConAvance: sortedUnique(conAvance.map((t) => t.pipItemId)),
    idsResultadosRecibidos: sortedUnique(resultadosAfectados.map((r) => r.resultadoId)),
    idsResultadosAprobados: sortedUnique(aprobados.map((r) => r.resultadoId)),
  };

  const huella = hashEstable(
    serializacionEstable({
      modo: total
        ? "total"
        : { pip: sortedUnique([...idsPipEliminados]), actor: sortedUnique([...idsActorEliminados]) },
      impacto,
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
