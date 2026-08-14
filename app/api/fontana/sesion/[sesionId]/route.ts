// app/api/fontana/sesion/[sesionId]/route.ts
// PATCH { accion: "agregar"|"quitar", familiaId, indicadorId } — rechaza
// "quitar" si el indicador está en minimos (candado del PIP).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import type { FontanaSesion, FamiliaFontanaId } from "@/types/fontana.types";

const FAMILIAS_VALIDAS: FamiliaFontanaId[] = ["F1", "F2", "F3", "F4", "F5"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sesionId } = await context.params;

  let body: { accion?: "agregar" | "quitar"; familiaId?: FamiliaFontanaId; indicadorId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { accion, familiaId, indicadorId } = body;
  if (!accion || !familiaId || !indicadorId || !FAMILIAS_VALIDAS.includes(familiaId)) {
    return NextResponse.json(
      { error: "accion, familiaId (F1-F5) e indicadorId son requeridos" },
      { status: 400 }
    );
  }
  if (accion !== "agregar" && accion !== "quitar") {
    return NextResponse.json({ error: "accion debe ser 'agregar' o 'quitar'" }, { status: 400 });
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion, ref } = cargada;

  const familia = sesion.indicadoresPorFamilia[familiaId];

  if (accion === "quitar" && familia.minimos.includes(indicadorId)) {
    return NextResponse.json(
      {
        error: "indicador_es_minimo",
        mensaje: `No se puede quitar: ${indicadorId} es un indicador mínimo del PIP para este proyecto.`,
      },
      { status: 409 }
    );
  }

  const nuevaSeleccion =
    accion === "agregar"
      ? [...new Set([...familia.seleccionUsuario, indicadorId])]
      : familia.seleccionUsuario.filter((id) => id !== indicadorId);

  const nowIso = new Date().toISOString();
  await ref.update({
    [`indicadoresPorFamilia.${familiaId}.seleccionUsuario`]: nuevaSeleccion,
    fechaUltimoGuardado: nowIso,
  });

  const sesionActualizada: FontanaSesion = {
    ...sesion,
    sesionId,
    indicadoresPorFamilia: {
      ...sesion.indicadoresPorFamilia,
      [familiaId]: { ...familia, seleccionUsuario: nuevaSeleccion },
    },
    fechaUltimoGuardado: nowIso,
  };

  return NextResponse.json({ sesion: sesionActualizada }, { status: 200 });
}
