// lib/moddulo/impactoRegeneracionF3.ts
// H15 / H-M3 (commit 4): what F3 may write over what already exists. PURE.
//
// The UI offers no "regenerate" for M3 / M4: «Generar síntesis (M3)» and
// «Generar veredicto (M4)» are only drawn when the thing does not exist yet, and
// F3 is read-only once the Reporte F3 exists. So these routes are reached with
// something already there only from a stale tab or a direct API call, and the
// rule is simple (no confirmation, no fingerprint: there is no regenerate
// function to confirm):
//   - the Reporte F3 exists, or the verdict is already approved (a verdict is
//     approved in the SAME update that writes the DIE, so "approved without DIE"
//     can only be anomalous data) -> BLOCKED, PROVISIONAL until F3 can be reopened;
//   - what would be generated already exists -> "ya_existe" (stale screen);
//   - nothing exists -> continue.
// When a regenerate button is built (product decision pending), THAT is where a
// confirmation modal and the discard of the verdict draft (in the same
// transaction) belong.

import { motivoBloqueoF3, type VerboF3 } from "./impactoReemplazoDVS";

export type DestinoF3 = "sintesis" | "veredicto" | "tablero";

export interface EstadoF3 {
  sintesis?: unknown;
  veredicto?: { aprobadoPorUsuario?: boolean } | null;
  die?: unknown;
}

export type DecisionGeneracionF3 =
  | { accion: "continuar" }
  | { accion: "ya_existe" }
  | { accion: "bloqueado"; mensaje: string };

/** Verb used in the block reason for each thing F3 may try to write. */
const VERBO_BLOQUEO: Record<DestinoF3 | "sincronizar_tablero", VerboF3> = {
  sintesis: "generar_sintesis",
  veredicto: "generar_veredicto",
  tablero: "generar_tablero",
  sincronizar_tablero: "sincronizar_tablero",
};

export function estadoF3Desde(investigacion: unknown): EstadoF3 {
  const inv = (investigacion ?? {}) as {
    f3Sintesis?: unknown;
    f3Veredicto?: EstadoF3["veredicto"];
    f3DIE?: unknown;
  };
  return { sintesis: inv.f3Sintesis, veredicto: inv.f3Veredicto, die: inv.f3DIE };
}

/** `destino` "sincronizar_tablero" shares the tablero rule (only the block applies). */
export function decidirGeneracionF3(
  estado: EstadoF3,
  destino: DestinoF3 | "sincronizar_tablero"
): DecisionGeneracionF3 {
  const conReporte = !!estado.die;
  const aprobado = estado.veredicto?.aprobadoPorUsuario === true;
  if (conReporte || aprobado) {
    return { accion: "bloqueado", mensaje: motivoBloqueoF3(VERBO_BLOQUEO[destino], conReporte) };
  }
  if (destino === "sintesis" && !!estado.sintesis) return { accion: "ya_existe" };
  if (destino === "veredicto" && !!estado.veredicto) return { accion: "ya_existe" };
  return { accion: "continuar" };
}

/** Thrown inside the conditional write when the state changed while Claude generated. */
export class GeneracionF3RechazadaError extends Error {
  constructor(public readonly decision: Exclude<DecisionGeneracionF3, { accion: "continuar" }>) {
    super(`Generación F3 rechazada: ${decision.accion}`);
    this.name = "GeneracionF3RechazadaError";
  }
}
