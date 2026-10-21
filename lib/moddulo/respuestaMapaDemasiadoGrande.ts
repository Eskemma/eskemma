// lib/moddulo/respuestaMapaDemasiadoGrande.ts
// The 422 that generate-dvs and regenerate-m5 answer when the serialized PESTEL block is over the security cap.
// It is answered BEFORE the model is called and before any write. The body carries only numbers and the origin
// of the analysis (the screen picks the action that is true for that origin); never any text of the analysis.

import { NextResponse } from "next/server";
import type { MapaDemasiadoGrandeError } from "@/lib/ai/phases/prompts";
import type { OrigenAnalisis } from "./registroModelo";

export function respuestaMapaDemasiadoGrande(origen: OrigenAnalisis, err: MapaDemasiadoGrandeError): NextResponse {
  return NextResponse.json(
    {
      error: "El análisis es demasiado extenso para generar los motores",
      codigo: "mapa_demasiado_grande",
      origen,
      longitud: err.longitud,
      senales: err.estadisticas.senales,
    },
    { status: 422 }
  );
}
