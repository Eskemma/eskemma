// app/api/centinela/pestel/analysis-meta/route.ts
// GET /api/centinela/pestel/analysis-meta?analysis_id=X
// Returns the minimal PESTEL project metadata needed to pre-fill the
// Moddulo orphan recovery form (nombre, tipo, territorio).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const analysisId = searchParams.get("analysis_id");

  if (!analysisId) {
    return NextResponse.json(
      { error: "Se requiere analysis_id" },
      { status: 400 }
    );
  }

  const analysisSnap = await adminDb
    .collection("pestel_analyses")
    .doc(analysisId)
    .get();

  if (!analysisSnap.exists) {
    return NextResponse.json(
      { error: "Análisis no encontrado" },
      { status: 404 }
    );
  }

  const pestelProjectId = analysisSnap.data()?.projectId as string | undefined;
  if (!pestelProjectId) {
    return NextResponse.json(
      { error: "Análisis sin proyecto asociado" },
      { status: 404 }
    );
  }

  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(pestelProjectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, tipo, territorio } = projectSnap.data()!;

  return NextResponse.json({ pestelProjectId, nombre, tipo, territorio });
}
