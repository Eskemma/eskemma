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

export function respuestaCandado(
  accion: Exclude<AccionCandado, "continuar">,
  decision: DecisionReemplazo,
  opciones: { lineas?: string[]; eliminados?: ResumenEliminados } = {}
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
      lineas: opciones.lineas ?? lineasDeImpacto(decision),
      hayImpactoF3: decision.hayImpactoF3,
      huella: decision.huella,
      ...(opciones.eliminados ? { eliminados: opciones.eliminados } : {}),
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
