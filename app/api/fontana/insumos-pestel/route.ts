// app/api/fontana/insumos-pestel/route.ts
//
// Endpoint SIN sesión de Fontana — integración PESTEL↔Fontana (26-09-13,
// diseño aprobado por Raúl). Wrapper HTTP delgado de
// `resolverInsumosFontanaPestel` (lib/fontana/tabla/insumosPestel.ts) —
// toda la lógica real vive ahí, reusada también por Express (mismo
// runtime Next.js, importa esa función directo, sin pasar por este
// endpoint).
//
// Auth: llamada servicio-a-servicio. Este endpoint solo lo necesita el
// path Controlado (Cloud Function, `functions/src/pestel/generateFeed.ts`)
// por el límite de runtime cruzado (`functions/` no puede importar
// `lib/`). Sin usuario final aquí, así que NO se usa
// `getSessionFromRequest()` — se valida un token de servicio
// (`FONTANA_INTERNAL_TOKEN`, Firebase Secret Manager + `.env`, mismo
// patrón que INEGI_TOKEN/BANXICO_TOKEN) vía header `x-fontana-internal-token`.

import { type NextRequest, NextResponse } from "next/server";
import { resolverInsumosFontanaPestel } from "@/lib/fontana/tabla/insumosPestel";
import { INDICADORES_PESTEL_POR_DIMENSION, type DimensionPestelConFontana } from "@/lib/fontana/pestelInsumos";
import type { Territorio } from "@/types/shared.types";
import type { ProjectType } from "@/types/moddulo.types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const tokenEsperado = process.env.FONTANA_INTERNAL_TOKEN;
  if (!tokenEsperado) {
    console.error("[fontana/insumos-pestel] FONTANA_INTERNAL_TOKEN no configurado");
    return NextResponse.json({ error: "servicio_no_configurado" }, { status: 503 });
  }
  const tokenRecibido = request.headers.get("x-fontana-internal-token");
  if (tokenRecibido !== tokenEsperado) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  let body: { territorio?: Territorio; tipoProyecto?: ProjectType; dimension?: DimensionPestelConFontana };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const { territorio, tipoProyecto, dimension } = body;
  if (!territorio || !tipoProyecto || !dimension) {
    return NextResponse.json({ error: "faltan_campos", mensaje: "territorio, tipoProyecto y dimension son requeridos" }, { status: 400 });
  }
  if (!INDICADORES_PESTEL_POR_DIMENSION[dimension]) {
    return NextResponse.json({ error: "dimension_invalida" }, { status: 400 });
  }

  // `timeoutMs: 15_000` (corrección post-verificación, 26-09-13 — mismo
  // bug real del path Express, latente aquí también: sin este límite,
  // un indicador externo lento colgaba la resolución sin ningún tope).
  // El llamador (Cloud Function `generateFeed.ts`, `fetchFontanaInsumos`)
  // ya aborta su propio `fetch` a los 20s — 15s aquí deja margen para
  // que esta respuesta viaje de vuelta antes de que el CF la dé por
  // perdida, en vez de competir con ese límite externo.
  const insumos = await resolverInsumosFontanaPestel(dimension, territorio, tipoProyecto, { timeoutMs: 15_000 });
  return NextResponse.json({ dimension, insumos });
}
