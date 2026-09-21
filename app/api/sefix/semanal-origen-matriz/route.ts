// app/api/sefix/semanal-origen-matriz/route.ts
// Devuelve la matriz origen×receptor para los heatmaps O1/O2 de la vista Semanal.
// Transforma las claves UPPERCASE del JSON almacenado a lowercase_underscore.

import { NextResponse } from "next/server";
import { claveEstadoSnake } from "@/lib/geo/estados";
import { getSemanalOrigenMatriz } from "@/lib/sefix/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const raw = await getSemanalOrigenMatriz();
  if (!raw) {
    return NextResponse.json({ error: "Sin datos de origen disponibles" }, { status: 404 });
  }

  const por_entidad: Record<string, { nacional: Record<string, number>; extranjero: Record<string, number> }> = {};
  for (const [k, v] of Object.entries(raw.por_entidad)) {
    por_entidad[claveEstadoSnake(k)] = v;
  }

  return NextResponse.json(
    { fecha: raw.fecha, por_entidad },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
  );
}
