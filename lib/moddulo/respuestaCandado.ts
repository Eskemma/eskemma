// lib/moddulo/respuestaCandado.ts
// SERVER-ONLY. The 409 body shared by every route that guards a replacement of
// the finalized F2 analysis (generate-dvs, finalize-dvs): same codes, same shape.

import { NextResponse } from "next/server";
import {
  lineasDeImpacto,
  type AccionCandado,
  type DecisionReemplazo,
} from "./impactoReemplazoDVS";
import type { ResumenEliminados } from "./diffIdsDVS";

/**
 * Lo mínimo que usa el cuerpo del 409 (C4b-1b): el motivo del bloqueo, si el impacto en F3 es real y la huella. Una
 * `DecisionReemplazo` completa lo cumple (los llamadores de F2 no cambian); «volver» pasa solo estos campos y SUS
 * `lineas`. Las líneas por defecto (`lineasDeImpacto`) solo se calculan si la decisión trae `impacto`.
 */
export type DecisionCandadoMinima = Pick<DecisionReemplazo, "motivoBloqueo" | "hayImpactoF3" | "huella"> &
  Partial<Pick<DecisionReemplazo, "impacto">>;

export function respuestaCandado(
  accion: Exclude<AccionCandado, "continuar">,
  decision: DecisionCandadoMinima,
  opciones: { lineas?: string[]; eliminados?: ResumenEliminados; nombre?: string } = {}
): NextResponse {
  if (accion === "bloqueado") {
    return NextResponse.json(
      { error: "reemplazo_bloqueado", mensaje: decision.motivoBloqueo },
      { status: 409 }
    );
  }
  return NextResponse.json(
    {
      error: accion === "huella_vencida" ? "reemplazo_huella_vencida" : "reemplazo_requiere_confirmacion",
      lineas: opciones.lineas ?? (decision.impacto ? lineasDeImpacto(decision as DecisionReemplazo) : []),
      hayImpactoF3: decision.hayImpactoF3,
      huella: decision.huella,
      ...(opciones.eliminados ? { eliminados: opciones.eliminados } : {}),
      // C4b-1b (aditivo): nombre del resultado (su pregunta, recortada) para que la interfaz arme su frase; solo para quien ya tiene acceso.
      ...(opciones.nombre ? { nombre: opciones.nombre } : {}),
    },
    { status: 409 }
  );
}

/** H-M3: the F3 generators refuse to write because F3 is closed (PROVISIONAL). */
export function respuestaBloqueadoF3(mensaje: string): NextResponse {
  return NextResponse.json({ error: "reemplazo_bloqueado", mensaje }, { status: 409 });
}

/** H-M3: what would be generated already exists (stale screen). Nothing was written. */
export function respuestaYaExisteF3(): NextResponse {
  return NextResponse.json({ error: "f3_ya_existe" }, { status: 409 });
}

/** H25 #6: the verdict approval was refused; nothing was written. */
export function respuestaAprobacionRechazada(accion: "ya_aprobado" | "estado_cambio"): NextResponse {
  return NextResponse.json(
    { error: accion === "ya_aprobado" ? "f3_ya_aprobado" : "f3_estado_cambio" },
    { status: 409 }
  );
}
