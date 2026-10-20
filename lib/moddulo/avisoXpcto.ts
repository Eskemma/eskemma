// lib/moddulo/avisoXpcto.ts
// PURE. What F2 says when the project's XPCTO (F1) differs from the XPCTO snapshot taken when the analysis was
// generated. Three outcomes:
//   · "regenerar_m1"        — the M1 itself is stale: only for an EXPRESS M1 (its prompt is framed by hito and sujeto)
//                             when hito or sujeto changed.
//   · "actualizar_contraste"— the motors' XPCTO-Entorno contrast is stale: motors exist and the XPCTO differs.
//   · "ninguno"             — nothing to say.
//
// A M1 imported from Centinela does NOT depend on the XPCTO (the Centinela generator never reads it), so it is never
// «stale» because of it; and an empty XPCTO at import time is not a stale analysis (there is no contrast yet).
// Total function: anything that is not `linkedSource.kind === "T22"` (unknown kind, absent linkedSource) is treated as
// express, so older projects behave as before.
//
// Closed Fase 2 = read-only: no notice. PROVISIONAL containment until the reopening of closed phases (Bloque 4).
// An M1 that has a record but is NOT approved (draft or reopened): no notice either, because with the paso 4 gate
// «Actualizar contraste XPCTO» would answer 409 m1_no_aprobado; the notice comes back once the M1 is approved again
// if the XPCTO still differs from the snapshot. A project with no `m1` record (older) behaves as before.

import type { EstadoM1 } from "./m1Aprobacion";
import { detectForwardStaleness, type ProjectForPropagation, type PropagationDiff } from "./phasePropagation";

export type ResultadoAvisoXpcto = "ninguno" | "regenerar_m1" | "actualizar_contraste";

/** Fields whose change makes an EXPRESS M1 stale (they frame the scan). Same labels diffXpcto produces. */
export const CAMPOS_QUE_REGENERAN_M1 = ["Sujeto", "Hito"] as const;

export interface EntradaAvisoXpcto {
  /** `linkedSource.kind` as recorded by the server; anything but "T22" counts as express. */
  kind: string | null | undefined;
  /** Are the motors on screen those of the current M1 (draft or finalized)? */
  hayMotores: boolean;
  /** Labels of the fields that differ from the snapshot (`PropagationDiff.field`); empty = same XPCTO. */
  camposCambiados: readonly string[];
  f2Cerrada: boolean;
  /** Estado of the M1 review; null / "sin_m1" / "anterior" = no `m1` record (behaves as before). */
  m1Estado: EstadoM1 | null | undefined;
}

export function decidirAvisoXpcto(e: EntradaAvisoXpcto): ResultadoAvisoXpcto {
  if (e.f2Cerrada) return "ninguno";
  if (e.camposCambiados.length === 0) return "ninguno";
  if (e.m1Estado === "borrador" || e.m1Estado === "reabierto") return "ninguno";

  if (e.kind === "T22") return e.hayMotores ? "actualizar_contraste" : "ninguno";

  // express (or anything unknown)
  if (e.camposCambiados.some((c) => (CAMPOS_QUE_REGENERAN_M1 as readonly string[]).includes(c))) return "regenerar_m1";
  return e.hayMotores ? "actualizar_contraste" : "ninguno";
}

/**
 * The XPCTO differences against the snapshot taken when the analysis was last generated. ONE source of truth for the
 * screen: used when the page loads AND every time the project is re-read (after approving, generating the motors,
 * «Reintentar generación», «Actualizar contraste»), so the list always reflects the snapshot that is stored now.
 * `[]` also covers «not evaluable» (no snapshot yet, no imported analysis).
 */
export function diffsXpctoDeProyecto(project: ProjectForPropagation): PropagationDiff[] {
  return detectForwardStaleness("exploracion", project) ?? [];
}
