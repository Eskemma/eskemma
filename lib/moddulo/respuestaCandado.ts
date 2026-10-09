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
