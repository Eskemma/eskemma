// lib/moddulo/pipPropagation.ts
// Propagación PIP (F2) → tablero de tareas (F3): detecta qué cambió en el
// PIP desde la última generación/sincronización del tablero, comparando por
// pipItemId (identidad estable) contra el snapshot persistido
// (phases.investigacion.pipSnapshotAtGeneration). NO reutiliza
// lib/moddulo/phasePropagation.ts — ese motor compara campos escalares de
// un objeto (PropagationDiff: {field, from, to}), pensado para XPCTO; este
// caso es un diff de arreglo por id, con una forma de dato distinta.

import type { PIPItem, TareaPIP, ModduloProject } from "@/types/moddulo.types";

export type PipCambio =
  | { tipo: "agregada"; pipItemId: string; pregunta: string }
  | { tipo: "editada"; pipItemId: string; pregunta: string; preguntaAnterior: string }
  | { tipo: "eliminada"; pipItemId: string; preguntaAnterior: string };

// Campos de CONTENIDO de una pregunta — un cambio en cualquiera de estos
// cuenta como "editada". `numero`/`orden` se excluyen deliberadamente: un
// reindexado por sí solo (agregar/quitar OTRA pregunta) no es una edición
// de ESTA pregunta.
function contenidoPIPItem(p: PIPItem): string {
  return JSON.stringify({ pregunta: p.pregunta, metodo: p.metodo, vinculoHito: p.vinculoHito, profundidad: p.profundidad });
}

/**
 * Compara el PIP tal como estaba cuando se generó/sincronizó por última vez
 * el tablero (`snapshotPip`) contra el PIP vigente (`currentPip`), por
 * `pipItemId`. Puro — no lee ni escribe Firestore.
 */
export function diffPip(snapshotPip: PIPItem[], currentPip: PIPItem[]): PipCambio[] {
  const snapshotPorId = new Map(snapshotPip.map((p) => [p.pipItemId, p]));
  const currentPorId = new Map(currentPip.map((p) => [p.pipItemId, p]));
  const cambios: PipCambio[] = [];

  for (const actual of currentPip) {
    const anterior = snapshotPorId.get(actual.pipItemId);
    if (!anterior) {
      cambios.push({ tipo: "agregada", pipItemId: actual.pipItemId, pregunta: actual.pregunta });
    } else if (contenidoPIPItem(anterior) !== contenidoPIPItem(actual)) {
      cambios.push({
        tipo: "editada",
        pipItemId: actual.pipItemId,
        pregunta: actual.pregunta,
        preguntaAnterior: anterior.pregunta,
      });
    }
  }

  for (const anterior of snapshotPip) {
    if (!currentPorId.has(anterior.pipItemId)) {
      cambios.push({ tipo: "eliminada", pipItemId: anterior.pipItemId, preguntaAnterior: anterior.pregunta });
    }
  }

  return cambios;
}

type ProjectForPipPropagation = Pick<ModduloProject, "phases">;

/**
 * Calcula los cambios del PIP contra `f3TareasPIP` existente, con fallback
 * cuando no hay snapshot real persistido (`pipSnapshotAtGeneration`) —
 * compartida entre `detectPipStaleness()` (detección para el banner) y
 * `tareas/sincronizar/route.ts` (aplicación real), para que ambos vean
 * exactamente el mismo diff sin duplicar la lógica de fallback.
 */
export function computePipCambios(
  currentPip: PIPItem[],
  tareas: TareaPIP[],
  rawSnapshot: string | undefined
): PipCambio[] {
  let snapshotPip: PIPItem[];
  if (rawSnapshot) {
    try {
      snapshotPip = JSON.parse(rawSnapshot) as PIPItem[];
    } catch {
      snapshotPip = [];
    }
  } else {
    // Tablero generado antes de que existiera pipSnapshotAtGeneration (todo
    // proyecto cuyo f3TareasPIP se generó antes de este mecanismo) — no hay
    // snapshot real que leer, así que se reconstruye uno best-effort: todo
    // PIPItem vigente cuyo pipItemId ya tiene una TareaPIP se asume "sin
    // cambios desde su generación" (no hay forma de saber si fue editado
    // entre medio sin un snapshot histórico real — misma limitación que
    // cualquier backfill de este archivo). Esto SÍ detecta correctamente
    // una pregunta agregada después (no tiene TareaPIP todavía), que es el
    // caso más común y el que se reportó en uso real. No detecta ediciones
    // de una pregunta que ya existía antes de este incremento.
    const pipItemIdsConTarea = new Set(tareas.map((t) => t.pipItemId));
    snapshotPip = currentPip.filter((p) => pipItemIdsConTarea.has(p.pipItemId));
  }

  const cambios = diffPip(snapshotPip, currentPip);

  // Limitación simétrica a la de arriba: el snapshot (real o sintético) por
  // sí solo nunca puede contener un pipItemId que ya no está en el PIP
  // vigente, así que diffPip() nunca podría, por construcción, detectar una
  // TareaPIP huérfana cuyo pipItemId jamás entró al snapshot que se le pasó
  // (exactamente el caso legado: el snapshot sintético se arma FILTRANDO el
  // PIP actual, así que una pregunta ya eliminada no puede aparecer ahí).
  // Se detecta aparte, comparando f3TareasPIP directamente contra el PIP
  // vigente — funciona con o sin snapshot real (no-op si ya se detectó).
  const idsDetectados = new Set(cambios.filter((c) => c.tipo === "eliminada").map((c) => c.pipItemId));
  const idsVigentes = new Set(currentPip.map((p) => p.pipItemId));
  for (const t of tareas) {
    if (!idsVigentes.has(t.pipItemId) && !idsDetectados.has(t.pipItemId)) {
      cambios.push({
        tipo: "eliminada",
        pipItemId: t.pipItemId,
        // Nunca se capturó el texto original — proyecto de antes de este
        // mecanismo, sin snapshot real ni sintético que lo tuviera.
        preguntaAnterior: "(pregunta no disponible — este tablero se generó antes de que el sistema guardara el texto original de cada pregunta)",
      });
    }
  }

  return cambios;
}

/**
 * `null` = no evaluable (no hay tablero generado todavía). `[]` = evaluable,
 * sin cambios. Array con elementos = divergencia real. Mismo contrato que
 * detectForwardStaleness() (lib/moddulo/phasePropagation.ts), forma de dato
 * distinta.
 */
export function detectPipStaleness(project: ProjectForPipPropagation): PipCambio[] | null {
  const tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
  if (tareas.length === 0) return null;

  const currentPip = (project.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];
  const raw = project.phases?.investigacion?.pipSnapshotAtGeneration as string | undefined;

  return computePipCambios(currentPip, tareas, raw);
}
