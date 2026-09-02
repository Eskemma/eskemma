// app/api/fontana/familia/[familiaId]/detalle/route.ts
// GET ?sesionId=&indicadorId=&estado=&municipio=&offset= — detalle
// paginado "Modo B". Lazy: se consulta solo al abrir el modal / cuando el
// agente lo pide, nunca en la carga inicial de la tabla.
//
// Indicadores con detalle:
//   F5-6 (top de giros DENUE por municipio)  — requiere estado + municipio
//   F5-8 (localidades GACP accesibilidad baja) — requiere estado + municipio
//   F3-8 (municipios en Zona de Atención Prioritaria rural, del estado)
//        — requiere estado (NO municipio: el desglose es a nivel estado)
//
// Paginación SIEMPRE del lado del servidor.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { familiaDeIndicador, type FamiliaFontanaId } from "@/types/fontana.types";
import { resolverDetalleGiros } from "@/lib/fontana/ingesta/denue";
import { resolverDetalleLocalidades } from "@/lib/fontana/ingesta/gacp";
import { resolverDetalleZapMunicipios } from "@/lib/fontana/ingesta/zap";

// Espejo del set del agente (lib/fontana/agente/tools.ts) y del de la UI
// (FontanaComparativeTable.tsx). Mantener en sync al agregar indicadores.
const INDICADORES_CON_DETALLE = new Set(["F5-6", "F5-8", "F3-8"]);
const REQUIERE_MUNICIPIO = new Set(["F5-6", "F5-8"]); // F3-8 solo necesita estado

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ familiaId: string }> }
) {
  const { familiaId } = await context.params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  const indicadorId = searchParams.get("indicadorId");
  const estado = searchParams.get("estado");
  const municipio = searchParams.get("municipio");
  const offset = Number(searchParams.get("offset") ?? "0");

  if (!sesionId || !indicadorId || !estado) {
    return NextResponse.json({ error: "sesionId, indicadorId y estado son requeridos" }, { status: 400 });
  }
  if (!INDICADORES_CON_DETALLE.has(indicadorId)) {
    return NextResponse.json({ error: "Este indicador no tiene detalle de Modo B" }, { status: 400 });
  }
  if (familiaDeIndicador(indicadorId) !== familiaId) {
    return NextResponse.json({ error: "familiaId no corresponde al indicadorId" }, { status: 400 });
  }
  if (REQUIERE_MUNICIPIO.has(indicadorId) && !municipio) {
    return NextResponse.json({ error: `El detalle de ${indicadorId} requiere 'municipio'` }, { status: 400 });
  }
  if (!Number.isFinite(offset) || offset < 0) {
    return NextResponse.json({ error: "'offset' debe ser un número >= 0" }, { status: 400 });
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion } = cargada;
  const familia = sesion.indicadoresPorFamilia[familiaId as FamiliaFontanaId];
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  if (!idsEnSesion.has(indicadorId)) {
    return NextResponse.json(
      { error: "indicador_no_en_sesion", mensaje: "No se pudo cargar el detalle para este indicador." },
      { status: 404 }
    );
  }

  if (indicadorId === "F3-8") {
    const resultado = await resolverDetalleZapMunicipios(estado, offset);
    return NextResponse.json(resultado, { status: 200 });
  }

  const territorio = { nivel: "municipal" as const, nombre: municipio!, estado, municipio: municipio! };
  if (indicadorId === "F5-6") {
    const resultado = await resolverDetalleGiros(territorio, offset);
    return NextResponse.json(resultado, { status: 200 });
  }
  // F5-8
  const resultado = await resolverDetalleLocalidades(territorio, offset);
  return NextResponse.json(resultado, { status: 200 });
}
