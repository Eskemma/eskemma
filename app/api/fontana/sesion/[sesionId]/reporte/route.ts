// app/api/fontana/sesion/[sesionId]/reporte/route.ts
// GET   — devuelve el markdown del reporte de sesión (subcolección
//         fontana_sesiones/{id}/reporte/actual) + el puntero `reporteSesion`.
// POST  — DISPARA la generación ASÍNCRONA: crea/reusa el job
//         (fontana_sesiones/{id}/reporte/job), corre la generación en
//         `after()` (Next 16, maxDuration 300) y devuelve { jobId, status }
//         de inmediato. El cliente hace polling con GET .../reporte/job.
// PATCH { contenidoMarkdown } — edición MANUAL del texto (autoguardado).
// DELETE — "Eliminar reporte": borra cuerpo + puntero + job. NO toca Storage.

import { after, type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { generarReporteSesion } from "@/lib/fontana/reporte/generarReporteSesion";
import { crearReporteJob, getReporteJob, jobEnCurso } from "@/lib/fontana/reporte/reporteJob";
import { invalidarReporteSesion } from "@/lib/fontana/reporte/invalidarReporteSesion";
import type { FontanaSesion, ReporteSesionFontana } from "@/types/fontana.types";

// El job encadena: resolverCeldasIndicadoresSesion (fetch a familia/[id] por
// familia, contra fuentes externas — el extremo medido lo domina F3-2 a
// ~62-81s) + una llamada a Claude (~23s prosa-only). Cabe con ~3× de margen.
export const maxDuration = 300;

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
  const { sesion, ref } = cargada;

  const snap = await ref.collection("reporte").doc("actual").get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: "sin_reporte", mensaje: "Esta sesión todavía no tiene un reporte generado." },
      { status: 404 }
    );
  }
  const reporte = snap.data() as ReporteSesionFontana;
  return NextResponse.json(
    { contenidoMarkdown: reporte.contenidoMarkdown, reporteSesion: sesion.reporteSesion ?? null },
    { status: 200 }
  );
}

/** true si hay al menos un indicador (Canvas o selección de tabla). */
function tieneContenido(sesion: FontanaSesion): boolean {
  const canvas = (sesion.canvasItems ?? []).filter((it) => !it.eliminado).length > 0;
  const tabla = Object.values(sesion.indicadoresPorFamilia).some(
    (f) => f.minimos.length + f.seleccionUsuario.length > 0
  );
  return canvas || tabla;
}

export async function POST(
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
  const { sesion } = cargada;

  // Pre-check barato ANTES de crear el job (no resuelve celdas).
  if (!tieneContenido(sesion)) {
    return NextResponse.json(
      {
        error: "sin_contenido",
        mensaje:
          "Esta sesión no tiene indicadores: agrega alguno a la tabla comparativa (pestaña Indicadores) o consulta uno en el chat antes de generar el reporte.",
      },
      { status: 400 }
    );
  }

  // Idempotencia: si ya hay un job en curso (no colgado), devolver ese.
  const jobExistente = await getReporteJob(sesionId);
  if (jobEnCurso(jobExistente)) {
    return NextResponse.json({ jobId: jobExistente!.jobId, status: jobExistente!.status }, { status: 200 });
  }

  const job = await crearReporteJob(sesionId);

  const cookie = request.headers.get("cookie") ?? "";
  const baseUrl = request.nextUrl.origin;
  after(async () => {
    await generarReporteSesion(sesionId, session.uid, { cookie, baseUrl });
  });

  return NextResponse.json({ jobId: job.jobId, status: "pending" }, { status: 202 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { sesionId } = await context.params;

  let body: { contenidoMarkdown?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (typeof body.contenidoMarkdown !== "string" || !body.contenidoMarkdown.trim()) {
    return NextResponse.json({ error: "contenidoMarkdown es requerido" }, { status: 400 });
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion, ref } = cargada;

  if (!sesion.reporteSesion) {
    return NextResponse.json(
      { error: "sin_reporte", mensaje: "No se puede editar un reporte que no existe. Genéralo primero." },
      { status: 400 }
    );
  }

  const editadoEn = new Date().toISOString();
  await ref.collection("reporte").doc("actual").update({
    contenidoMarkdown: body.contenidoMarkdown,
    editadoEn,
  });
  await ref.update({
    "reporteSesion.editadoEn": editadoEn,
    fechaUltimoGuardado: editadoEn,
  });

  const sesionActualizada: FontanaSesion = {
    ...sesion,
    reporteSesion: { ...sesion.reporteSesion, editadoEn },
    fechaUltimoGuardado: editadoEn,
  };
  return NextResponse.json(
    { sesion: sesionActualizada, contenidoMarkdown: body.contenidoMarkdown },
    { status: 200 }
  );
}

export async function DELETE(
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
  const { sesion, ref } = cargada;

  await invalidarReporteSesion(ref);

  const sesionActualizada: FontanaSesion = { ...sesion, reporteSesion: undefined };
  return NextResponse.json({ sesion: sesionActualizada }, { status: 200 });
}
