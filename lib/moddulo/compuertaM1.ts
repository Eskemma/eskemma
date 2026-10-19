// lib/moddulo/compuertaM1.ts
// SERVER-ONLY (uses the fingerprint, which needs node:crypto).
// The gate that makes the server enforce the M1 review: the routes that generate, approve, save or
// finalize the motors (M2–M5) refuse to work while the M1 that is on screen is not approved.
//
//   · Only projects that have BOTH an `m1` record and a payload are gated. A project without `m1`
//     (created before the review existed) or without payload (legacy form-based path, or after an
//     unlink) behaves exactly as before: `sin_m1`.
//   · When the M1 is approved the motors are generated from the FROZEN copy (`m1.aprobacion.mapa`),
//     not from the live payload, and the approval fingerprint is captured: the final write of the
//     route re-reads the document inside a transaction and compares with THAT fingerprint
//     (`coincideCompuertaM1`), so an edit + re-approval that happens while the model is generating
//     rejects the write instead of attaching old motors to new content.

import { NextResponse } from "next/server";
import type { MapaPESTEL } from "@/types/moddulo.types";
import { analizarM1, type ExploracionParaM1 } from "./m1Servidor";
import { huellaMapaPESTEL } from "./m1Huella";

export type MotivoBloqueoM1 = "no_aprobado" | "copia_inconsistente";

export type ResultadoCompuertaM1 =
  | { accion: "sin_m1" }
  | { accion: "pasa"; mapa: MapaPESTEL; huella: string }
  | { accion: "bloquea"; motivo: MotivoBloqueoM1 };

/** Does the approved M1 allow working on the motors? Pure: reads only the given `phases.exploracion`. */
export function decidirCompuertaM1(exp: ExploracionParaM1 | undefined): ResultadoCompuertaM1 {
  const a = analizarM1(exp);
  if (!a.m1 || !a.payload) return { accion: "sin_m1" };
  if (!a.estado.aprobacionValida) return { accion: "bloquea", motivo: "no_aprobado" };
  const ap = a.m1.aprobacion;
  const mapa = ap?.mapa;
  // The approval matches the live payload, but its frozen copy must match too: otherwise the copy is
  // not what was approved and nothing may be generated from it. Closed on purpose, and distinguishable
  // in the logs from a plain «not approved».
  if (!ap || !mapa || typeof mapa !== "object" || huellaMapaPESTEL(mapa) !== ap.huella) {
    return { accion: "bloquea", motivo: "copia_inconsistente" };
  }
  return { accion: "pasa", mapa, huella: ap.huella };
}

/**
 * Re-check at write time. `huellaCapturada` is the approval fingerprint the route used at the start
 * (null when the project was `sin_m1`). The document read now must still be in the same situation:
 * same approved fingerprint, or still without a gated M1.
 */
export function coincideCompuertaM1(
  exp: ExploracionParaM1 | undefined,
  huellaCapturada: string | null
): { ok: true } | { ok: false; motivo: MotivoBloqueoM1 } {
  const ahora = decidirCompuertaM1(exp);
  if (ahora.accion === "bloquea") return { ok: false, motivo: ahora.motivo };
  if (huellaCapturada === null) return ahora.accion === "sin_m1" ? { ok: true } : { ok: false, motivo: "no_aprobado" };
  return ahora.accion === "pasa" && ahora.huella === huellaCapturada ? { ok: true } : { ok: false, motivo: "no_aprobado" };
}

/** Thrown inside a transaction to abort BEFORE any write when the gate no longer holds. */
export class CompuertaM1Error extends Error {
  constructor(public readonly motivo: MotivoBloqueoM1) {
    super("m1_no_aprobado");
    this.name = "CompuertaM1Error";
  }
}

/**
 * The shared 409 body (same code as complete-phase). Logs the reason structurally (no project data)
 * so an inconsistent frozen copy can be told apart from a plain «not approved» in the diagnosis.
 */
export function respuestaM1NoAprobado(tag: string, motivo: MotivoBloqueoM1): NextResponse {
  console.warn(
    motivo === "copia_inconsistente"
      ? `[${tag}] compuerta M1 cerrada: copia aprobada inconsistente (la huella de la copia congelada no coincide con la de la aprobación)`
      : `[${tag}] compuerta M1 cerrada: el análisis no está aprobado`
  );
  return NextResponse.json({ error: "m1_no_aprobado" }, { status: 409 });
}
