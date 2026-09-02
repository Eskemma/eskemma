// app/api/fontana/sesion/[sesionId]/narrativa/route.ts
// GET ?indicadorId=F5-1  — texto narrativo curado de un indicador
// narrativo de Familia 5 (F5-1/3/4/5/9/10) para el territorio de la
// sesión. Endpoint dedicado al agente conversacional "Fontana" (T10):
// F5 ya está cerrada y verificada, así que su texto real (que la tabla
// comparativa no expone — solo muestra una celda "valor:1 texto") se
// sirve aquí sin tocar familia/[familiaId]/route.ts ni tablaColumnas.ts.
//
// Solo lookup: reutiliza resolverTextoNarrativo() (contenidoCurado.ts),
// que resuelve el territorio vía claveCanonicaMunicipio() — nunca
// comparación de nombre como string plano (regla del Incidente 4,
// docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md). La
// `naturaleza` viene del registry ya clasificado, no se decide aquí.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { resolverTextoNarrativo, esIndicadorNarrativoCurado } from "@/lib/fontana/ingesta/contenidoCurado";
import { getIndicadorRegistro, type NaturalezaDato } from "@/lib/fontana/indicatorRegistry";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sesionId } = await context.params;
  const indicadorId = new URL(request.url).searchParams.get("indicadorId");
  if (!indicadorId) {
    return NextResponse.json({ error: "indicadorId es requerido" }, { status: 400 });
  }
  if (!esIndicadorNarrativoCurado(indicadorId)) {
    return NextResponse.json(
      { error: "no_narrativo", mensaje: `«${indicadorId}» no es un indicador narrativo curado (F5-1/3/4/5/9/10).` },
      { status: 400 }
    );
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion } = cargada;

  const [{ nivel, texto, motivo, fuenteEtiqueta }, registro] = await Promise.all([
    resolverTextoNarrativo(indicadorId, sesion.territorio),
    getIndicadorRegistro(indicadorId),
  ]);

  const naturaleza: NaturalezaDato | null =
    texto !== null
      ? registro?.niveles.find((n) => n.nivel === nivel)?.naturaleza ?? null
      : null;

  const territorioLabel =
    nivel === "estatal"
      ? sesion.territorio.estado ?? sesion.territorio.nombre
      : [sesion.territorio.municipio, sesion.territorio.estado].filter(Boolean).join(", ") ||
        sesion.territorio.nombre;

  return NextResponse.json(
    {
      indicadorId,
      nivel,
      territorio: territorioLabel,
      valor: texto, // string con contenido real | null
      naturaleza, // del registry; null cuando valor === null
      motivo, // presente sii valor === null
      fuenteEtiqueta: texto !== null ? fuenteEtiqueta : null,
    },
    { status: 200 }
  );
}
