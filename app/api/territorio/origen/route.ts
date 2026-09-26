// app/api/territorio/origen/route.ts
// GET ?app=moddulo|pestel|fontana&id=<id> — territorio estructurado del proyecto/sesión de origen, para
// prellenar los wizards de creación de otra app (Paso 4b). Ver lib/territorio/origenTerritorio.ts.
// Un id inexistente, ajeno o mal formado responde SIEMPRE el mismo 404 (no revela qué ids existen).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { esAppOrigen, resolverTerritorioOrigen } from "@/lib/territorio/origenTerritorio";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const app = request.nextUrl.searchParams.get("app");
  const id = request.nextUrl.searchParams.get("id");
  if (!esAppOrigen(app) || !id) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const origen = await resolverTerritorioOrigen(app, id, session.uid);
  if (!origen) {
    return NextResponse.json({ error: "Origen no encontrado" }, { status: 404 });
  }
  return NextResponse.json(origen);
}
