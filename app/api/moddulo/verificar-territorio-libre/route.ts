// app/api/moddulo/verificar-territorio-libre/route.ts
// Fase 5 del rediseño de territorio (Ronda 8, 26-08-18) — "asistente
// puntual", Escenario A (Clase B, fuera de México). A diferencia de
// webContextFetcher.ts (los 3 tipos economic/legal/electoral se disparan
// AUTOMÁTICO en background para alimentar el análisis PESTEL), este
// endpoint es on-demand: lo dispara el usuario explícitamente desde
// TerritorySelector.tsx (botón "Verificar con asistente", rama
// !esMexico) — nunca automático, mismo criterio "nunca en silencio" de
// todo el workstream. Reutiliza extractContextWithClaude()/
// BraveSearchProvider directo, sin pasar por el pipeline de caché de
// webContextFetcher.ts (ese cachea resultados de PESTEL por territorio+
// fecha; aquí cada verificación es una consulta puntual del usuario, no
// tiene sentido cachearla de la misma forma).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { BraveSearchProvider } from "@/lib/search/BraveSearchProvider";
import { extractContextWithClaude } from "@/lib/search/extractContextWithClaude";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pais = typeof body?.pais === "string" ? body.pais.trim() : "";
  const estado = typeof body?.estado === "string" ? body.estado.trim() : "";
  const municipio = typeof body?.municipio === "string" ? body.municipio.trim() : "";

  if (!pais || (!estado && !municipio)) {
    return NextResponse.json({ error: "Falta 'pais' y al menos 'estado' o 'municipio'" }, { status: 400 });
  }

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ disponible: false, indicadores: [] }, { status: 200 });
  }

  const query = [municipio, estado, pais, "división administrativa"].filter(Boolean).join(", ");

  try {
    const provider = new BraveSearchProvider(apiKey);
    const results = await provider.search(query, { count: 6 });
    const extracted = await extractContextWithClaude(results, "geographic");
    return NextResponse.json(extracted);
  } catch (err) {
    console.error("[verificar-territorio-libre] error", err);
    // Nunca fabricar una confirmación — degradar explícito.
    return NextResponse.json({ disponible: false, indicadores: [] }, { status: 200 });
  }
}
