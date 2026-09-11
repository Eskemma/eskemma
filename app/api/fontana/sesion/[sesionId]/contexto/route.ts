// app/api/fontana/sesion/[sesionId]/contexto/route.ts
// GET — arma el FontanaContextoTerritorial completo de una sesión (todos
// los indicadores seleccionados en F1/F2/F3/F5, minimos + seleccionUsuario,
// CeldaTablaFontana completo sin aplanar) — usado por Canal 1
// (canal1/entregar) y por "Vincular resultado externo" cuando se abre
// desde el banner fontanaPendiente (Piezas 2/5 del plan de escenarios
// b/c). Wrapper delgado sobre resolverCeldasIndicadoresSesion (lib/fontana),
// que también consume generarReporteSesion.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { resolverCeldasIndicadoresSesion } from "@/lib/fontana/resolverCeldasIndicadoresSesion";
import type { FontanaSesion, FontanaContextoTerritorial } from "@/types/fontana.types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { sesionId } = await context.params;

  const doc = await adminDb.collection("fontana_sesiones").doc(sesionId).get();
  if (!doc.exists || doc.data()?.uid !== session.uid) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const sesion = { sesionId: doc.id, ...doc.data() } as FontanaSesion;

  const indicadores = await resolverCeldasIndicadoresSesion(sesion, {
    cookie: request.headers.get("cookie") ?? "",
    baseUrl: request.nextUrl.origin,
  });

  const contexto: FontanaContextoTerritorial = { territorio: sesion.territorio, indicadores };
  return NextResponse.json({ contexto }, { status: 200 });
}
