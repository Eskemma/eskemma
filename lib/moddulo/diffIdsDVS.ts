// lib/moddulo/diffIdsDVS.ts
// Which question / actor ids the finalized F2 analysis (`dvs`) has that the new
// one no longer has. PURE. These ids (`pip[].pipItemId`, `semaforo[].actorId`)
// are what Phase 3 hangs its work on, so an edit that keeps every id has no
// impact on F3 and only the REMOVED ids matter.
//
// Legacy data: items saved before ids existed have none. Both sides are
// normalized with the SAME rule that getProject()/finalize-dvs use
// (`legacy-${numero}` for questions, `legacy-${nombre}` for actors), so a legacy
// dvs compared with an identical one never yields false removals.

import type { DVSF2 } from "@/types/moddulo.types";

export interface PipEliminado {
  id: string;
  pregunta: string;
}
export interface ActorEliminado {
  id: string;
  nombre: string;
}
export interface IdsEliminados {
  pip: PipEliminado[];
  actores: ActorEliminado[];
}

type DvsParcial = Pick<Partial<DVSF2>, "pip" | "semaforo"> | null | undefined;

function pipPorId(dvs: DvsParcial): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of (dvs?.pip ?? []) as { pipItemId?: string; numero?: number; pregunta?: string }[]) {
    const id = p.pipItemId ?? `legacy-${p.numero}`;
    if (!m.has(id)) m.set(id, typeof p.pregunta === "string" ? p.pregunta : "");
  }
  return m;
}

function actoresPorId(dvs: DvsParcial): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of (dvs?.semaforo ?? []) as { actorId?: string; nombre?: string }[]) {
    const id = a.actorId ?? `legacy-${a.nombre}`;
    if (!m.has(id)) m.set(id, typeof a.nombre === "string" ? a.nombre : "");
  }
  return m;
}

/** Ids present in `anterior` and absent from `nuevo` (empty when there is no `anterior`). */
export function diffIdsDVS(anterior: DvsParcial, nuevo: DvsParcial): IdsEliminados {
  if (!anterior) return { pip: [], actores: [] };
  const pipNuevo = pipPorId(nuevo);
  const actNuevo = actoresPorId(nuevo);
  return {
    pip: [...pipPorId(anterior)].filter(([id]) => !pipNuevo.has(id)).map(([id, pregunta]) => ({ id, pregunta })),
    actores: [...actoresPorId(anterior)].filter(([id]) => !actNuevo.has(id)).map(([id, nombre]) => ({ id, nombre })),
  };
}

/** What the confirmation modal lists (bounded: the first 5 of each, text cut to 80 chars). */
export interface ResumenEliminados {
  totalPreguntas: number;
  totalActores: number;
  preguntas: string[];
  actores: string[];
}

const MAX_LISTADOS = 5;
const MAX_TEXTO = 80;
const recorta = (t: string) => (t.length > MAX_TEXTO ? `${t.slice(0, MAX_TEXTO - 1).trimEnd()}…` : t);

export function resumenEliminados(e: IdsEliminados): ResumenEliminados {
  return {
    totalPreguntas: e.pip.length,
    totalActores: e.actores.length,
    preguntas: e.pip.slice(0, MAX_LISTADOS).map((p) => recorta(p.pregunta.trim() || "(pregunta sin texto)")),
    actores: e.actores.slice(0, MAX_LISTADOS).map((a) => recorta(a.nombre.trim() || "(actor sin nombre)")),
  };
}
