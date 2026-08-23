// app/api/fontana/familia/F4/paises/route.ts
// GET ?sesionId=&indicadorId= — todos los países reales con dato para un
// indicador de Familia 4 (modal "Ver resto de países", Ronda 6,
// 2026-08-22). Lazy: se consulta solo al abrir el modal, nunca en la
// carga inicial de la tabla principal — mismo criterio que
// [familiaId]/municipios/route.ts para F1/F2.
//
// `sesionId` solo se usa para confirmar que el usuario autenticado es
// dueño de una sesión real (mismo patrón de seguridad que el resto de
// Fontana) — el resultado no depende del territorio de esa sesión, la
// lista de países es la misma para cualquier sesión que consulte el
// mismo indicador.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { resolverTodosLosPaisesF4 } from "@/lib/fontana/ingesta/familia4";
import { FAMILIA4_POLARIDAD, ALCANCE_LATAM } from "@/lib/fontana/familia4Catalogo";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  const indicadorId = searchParams.get("indicadorId");
  if (!sesionId || !indicadorId) {
    return NextResponse.json({ error: "sesionId e indicadorId son requeridos" }, { status: 400 });
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const paises = await resolverTodosLosPaisesF4(indicadorId);
  const polaridad = FAMILIA4_POLARIDAD[indicadorId];
  // mayor_mejor → descendente (el valor más alto primero); menor_mejor →
  // ascendente. Solo se ordena entre países con dato real (estadoConsulta
  // "ok") — los demás (sin dato/error) no tienen `valor` que comparar.
  const conDato = paises.filter((p) => p.celda.estadoConsulta === "ok");
  const ordenados = polaridad === "menor_mejor"
    ? conDato.sort((a, b) => a.celda.valor! - b.celda.valor!)
    : conDato.sort((a, b) => b.celda.valor! - a.celda.valor!);

  return NextResponse.json({
    paises: ordenados,
    alcanceLatam: ALCANCE_LATAM.has(indicadorId),
  });
}
