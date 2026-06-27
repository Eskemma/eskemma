// app/api/centinela/pestel/sefix-data/route.ts
// GET /api/centinela/pestel/sefix-data?estado=jalisco
// Returns electoral results and voter roll data for a Mexican state.
// Used by the PESTEL trigger to enrich the Political (P) dimension.
// Returns { resultados, padron } or { resultados: null, padron: null }
// if the state is not found or data is unavailable.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import {
  getResultadosByEstado,
  getPadronByEstado,
} from "@/lib/sefix/storage";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");

  if (!estado) {
    return NextResponse.json({ error: "estado es requerido" }, { status: 400 });
  }

  const [resultados, padron] = await Promise.allSettled([
    getResultadosByEstado(estado, "diputados"),
    getPadronByEstado(estado),
  ]);

  return NextResponse.json({
    resultados: resultados.status === "fulfilled" ? resultados.value : null,
    padron: padron.status === "fulfilled" ? padron.value : null,
  });
}
