// app/api/fontana/familia/[familiaId]/detalle/route.ts
// GET ?sesionId=&indicadorId=&estado=&municipio=&offset= — detalle
// paginado "Modo B" para F5-6 (top de giros DENUE) y F5-8 (localidades
// GACP en accesibilidad Bajo/Muy bajo), 2026-08-24. Lazy: se consulta
// solo al abrir el modal, nunca en la carga inicial de la tabla.
//
// Paginación SIEMPRE del lado del servidor — nunca se manda la lista
// completa al cliente para truncarla ahí (medido en vivo: DENUE hasta
// 730 giros distintos por municipio; GACP hasta 1,039 localidades en
// el caso nacional más grande, Guadalupe y Calvo, Chihuahua). `estado`/
// `municipio` viajan explícitos en vez de re-derivarse de
// `sesion.territorio` porque el territorio del proyecto puede ser
// plural (varios municipios seleccionados) — el cliente decide cuál
// municipio ver, mismo criterio que el resto de los desgloses "Ver
// municipios" de Fontana, que también reciben la unidad específica
// como parámetro.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import type { FamiliaFontanaId } from "@/types/fontana.types";
import { resolverDetalleGiros } from "@/lib/fontana/ingesta/denue";
import { resolverDetalleLocalidades } from "@/lib/fontana/ingesta/gacp";

const INDICADORES_CON_DETALLE = new Set(["F5-6", "F5-8"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ familiaId: string }> }
) {
  const { familiaId } = await context.params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (familiaId !== "F5") {
    return NextResponse.json(
      { error: "familia_no_disponible", mensaje: `El detalle de Modo B no aplica a la familia ${familiaId}.` },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  const indicadorId = searchParams.get("indicadorId");
  const estado = searchParams.get("estado");
  const municipio = searchParams.get("municipio");
  const offset = Number(searchParams.get("offset") ?? "0");

  if (!sesionId || !indicadorId || !estado || !municipio) {
    return NextResponse.json({ error: "sesionId, indicadorId, estado y municipio son requeridos" }, { status: 400 });
  }
  if (!INDICADORES_CON_DETALLE.has(indicadorId)) {
    return NextResponse.json({ error: "Este indicador no tiene detalle de Modo B" }, { status: 400 });
  }
  if (!Number.isFinite(offset) || offset < 0) {
    return NextResponse.json({ error: "'offset' debe ser un número >= 0" }, { status: 400 });
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion } = cargada;
  const familia = sesion.indicadoresPorFamilia["F5" as FamiliaFontanaId];
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  if (!idsEnSesion.has(indicadorId)) {
    return NextResponse.json({ error: "indicador_no_en_sesion", mensaje: "No se pudo cargar el detalle para este indicador." }, { status: 404 });
  }

  const territorio = { nivel: "municipal" as const, nombre: municipio, estado, municipio };

  if (indicadorId === "F5-6") {
    const resultado = await resolverDetalleGiros(territorio, offset);
    return NextResponse.json(resultado, { status: 200 });
  }
  // F5-8
  const resultado = await resolverDetalleLocalidades(territorio, offset);
  return NextResponse.json(resultado, { status: 200 });
}
