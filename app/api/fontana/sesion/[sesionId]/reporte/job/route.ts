// app/api/fontana/sesion/[sesionId]/reporte/job/route.ts
// GET — estado de la generación asíncrona del reporte de sesión
// (fontana_sesiones/{id}/reporte/job). El cliente (FontanaReportePanel)
// hace polling cada ~4s tras disparar POST .../reporte, y al montar la
// pestaña para reanudar un job en curso tras un reload.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { getReporteJob, jobEnCurso } from "@/lib/fontana/reporte/reporteJob";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { sesionId } = await context.params;

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const job = await getReporteJob(sesionId);
  if (!job) {
    return NextResponse.json({ status: "none" }, { status: 200 });
  }
  return NextResponse.json(
    {
      status: job.status,
      enCurso: jobEnCurso(job),
      jobId: job.jobId,
      error: job.error ?? null,
      completedAt: job.completedAt ?? null,
    },
    { status: 200 }
  );
}
