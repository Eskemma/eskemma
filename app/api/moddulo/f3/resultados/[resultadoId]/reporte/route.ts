// app/api/moddulo/f3/resultados/[resultadoId]/reporte/route.ts
// GET ?projectId=X — devuelve el markdown del reporte interpretativo de
// Fontana adjunto a un resultado de F3 (Canal 1 / Canal 3), leyéndolo de
// Storage en el servidor. El cliente (M2, F3ResultadosRecibidos) nunca
// recibe el storagePath crudo ni una signed URL.
//
// Aislamiento de M3: este es el ÚNICO camino que resuelve
// `payload.reporteInterpretativoUrl`. La síntesis M3 (sintesis/generar)
// serializa el objeto del resultado completo pero nunca descarga la URL —
// la prosa del reporte no entra a su prompt.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb, adminStorage } from "@/lib/firebase-admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resultadoId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { resultadoId } = await context.params;
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const snap = await adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .collection("f3Resultados")
    .doc(resultadoId)
    .get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Resultado no encontrado" }, { status: 404 });
  }

  const payload = (snap.data()?.payload ?? {}) as { reporteInterpretativoUrl?: string };
  if (!payload.reporteInterpretativoUrl) {
    return NextResponse.json(
      { error: "sin_reporte", mensaje: "Este resultado no incluye un reporte interpretativo." },
      { status: 404 }
    );
  }

  try {
    const [buf] = await adminStorage.bucket().file(payload.reporteInterpretativoUrl).download();
    return NextResponse.json({ markdown: buf.toString("utf-8") }, { status: 200 });
  } catch (err) {
    console.error("[f3/resultados/reporte] Error al leer de Storage:", err);
    return NextResponse.json(
      { error: "No se pudo leer el reporte interpretativo." },
      { status: 502 }
    );
  }
}
