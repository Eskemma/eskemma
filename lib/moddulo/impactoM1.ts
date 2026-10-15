// lib/moddulo/impactoM1.ts
// PURE. What the user loses (and what is kept) when an action touches the reviewed M1: the lines of
// the confirmation notice, whether the server must demand a confirmation, the state fingerprint a
// confirmation is validated against, and the decision. Used by the routes (server) and, in later
// commits, by the screen to word the modals from the same real state. It never says internal words
// ("huella", "payload"): it uses what the user sees (M1/M2–M5, aprobación, ediciones, Reporte F2).

import { serializacionEstable } from "./serializacionEstable";
import type { AccionCandado } from "./impactoReemplazoDVS";
import type { EstadoM1 } from "./m1Aprobacion";

export type AccionM1 = "reabrir" | "nuevo_analisis" | "vincular" | "desvincular";

export interface EstadoParaImpactoM1 {
  estado: EstadoM1;
  hayPayload: boolean;
  /** There is a valid approval of M1. */
  aprobada: boolean;
  huellaPayload: string | null;
  huellaAprobacion: string | null;
  huellaGeneracion: string | null;
  /** Codes (P, E, S, T, Ec, L) of the dimensions with an edit in force. */
  dimensionesEditadas: string[];
  totalDimensiones: number;
  /** Approved motors, e.g. ["M2", "M3"]. */
  motoresAprobados: string[];
  hayBorrador: boolean;
  /** A finalized F2 report (dvs) exists. */
  hayDvs: boolean;
}

export const ETIQUETA_DIMENSION: Record<string, string> = {
  P: "Político", E: "Económico", S: "Social", T: "Tecnológico", Ec: "Ecológico", L: "Legal",
};

const lista = (xs: string[]) => xs.join(", ");

/** Does the action need an explicit confirmation given the real state? (the server enforces it). */
export function requiereConfirmacionM1(e: EstadoParaImpactoM1, accion: AccionM1): boolean {
  switch (accion) {
    case "reabrir":
      return e.aprobada; // the approval itself is lost
    case "desvincular":
    case "nuevo_analisis":
    case "vincular":
      // Anything that exists would be replaced or removed; a clean project asks nothing.
      return e.hayPayload || e.hayBorrador || e.motoresAprobados.length > 0;
  }
}

function lineaMotores(e: EstadoParaImpactoM1): string | null {
  const aprob = e.motoresAprobados.length > 0;
  if (e.hayBorrador && aprob) return `Se descartarán el borrador de motores y las aprobaciones de ${lista(e.motoresAprobados)}.`;
  if (e.hayBorrador) return "Se descartará el borrador de motores.";
  if (aprob) return `Se descartarán las aprobaciones de ${lista(e.motoresAprobados)}.`;
  return null;
}

/**
 * Lines of the notice, in the order the user reads them. Only the lines that apply to the REAL
 * state appear. Editions are only listed for "nuevo_analisis" and "vincular" (the M1 of Centinela,
 * which is what "desvincular" removes, has no edits). "reabrir" loses only the approval: M2–M5
 * wait (conservación diferida) and are discarded only if the content changes when approving again.
 */
export function lineasImpactoM1(e: EstadoParaImpactoM1, accion: AccionM1): string[] {
  const lineas: string[] = [];
  if (accion === "reabrir") {
    lineas.push("Se perderá la aprobación del análisis; podrás aprobarlo de nuevo.");
    if (e.hayBorrador || e.motoresAprobados.length > 0) {
      lineas.push("M2–M5 quedarán en pausa mientras esté abierto.");
      const que = e.hayBorrador && e.motoresAprobados.length > 0
        ? `el borrador de motores y las aprobaciones de ${lista(e.motoresAprobados)}`
        : e.hayBorrador ? "el borrador de motores" : `las aprobaciones de ${lista(e.motoresAprobados)}`;
      lineas.push(`Si al aprobar de nuevo el contenido es distinto, se descartarán ${que} y se regenerarán; si es idéntico, se conservan.`);
    }
  } else {
    if ((accion === "nuevo_analisis" || accion === "vincular") && e.dimensionesEditadas.length > 0) {
      const n = e.dimensionesEditadas.length;
      const nombres = e.dimensionesEditadas.map((c) => ETIQUETA_DIMENSION[c] ?? c);
      lineas.push(`Se perderán tus ediciones en ${n} de ${e.totalDimensiones} categorías (${lista(nombres)}).`);
    }
    if (e.aprobada) lineas.push("Se perderá la aprobación del análisis.");
    const motores = lineaMotores(e);
    if (motores) lineas.push(motores);
  }
  if (e.hayDvs) lineas.push("El Reporte F2 finalizado no cambia hasta que lo vuelvas a finalizar.");
  return lineas;
}

/** Canonical string of everything the notice depends on; the server hashes it. */
export function firmaImpactoM1(e: EstadoParaImpactoM1, accion: AccionM1): string {
  return serializacionEstable({
    accion,
    hayPayload: e.hayPayload,
    huellaPayload: e.huellaPayload,
    huellaAprobacion: e.huellaAprobacion,
    huellaGeneracion: e.huellaGeneracion,
    dimensionesEditadas: [...e.dimensionesEditadas].sort(),
    motoresAprobados: [...e.motoresAprobados].sort(),
    hayBorrador: e.hayBorrador,
    hayDvs: e.hayDvs,
  });
}

export type AccionCandadoM1 = Extract<AccionCandado, "continuar" | "requiere_confirmacion" | "huella_vencida">;

/**
 * Same decision as decidirCandadoReemplazo (reemplazoDVS), for M1: `huellaActual` is the impact
 * fingerprint of the state read NOW; `huellaRecibida` is the one the user confirmed.
 */
export function decidirCandadoM1(args: {
  requiere: boolean;
  huellaActual: string;
  confirmar: boolean;
  huellaRecibida: string | null | undefined;
}): AccionCandadoM1 {
  if (!args.requiere) return "continuar";
  if (args.confirmar !== true || !args.huellaRecibida) return "requiere_confirmacion";
  if (args.huellaRecibida !== args.huellaActual) return "huella_vencida";
  return "continuar";
}
