// app/api/moddulo/f2/import-pestel/route.ts
// POST { projectId, pestAnalysisId }
// Importa un análisis de Centinela PESTEL al proyecto Moddulo F2.
// Transforma las señales tripartitas al formato MapaPESTEL de F2.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { MapaPESTEL } from "@/types/moddulo.types";
import { transformToMapaPESTEL, type RawDimension } from "@/lib/centinela/pestel/transformToMapaPESTEL";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; pestAnalysisId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, pestAnalysisId } = body;
  if (!projectId || !pestAnalysisId) {
    return NextResponse.json(
      { error: "projectId y pestAnalysisId son requeridos" },
      { status: 400 }
    );
  }

  // Verify Moddulo project ownership
  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Load PESTEL analysis
  const analysisSnap = await adminDb
    .collection("pestel_analyses")
    .doc(pestAnalysisId)
    .get();

  if (!analysisSnap.exists) {
    return NextResponse.json({ error: "Análisis PESTEL no encontrado" }, { status: 404 });
  }

  const analysis = analysisSnap.data()!;

  // Verify PESTEL analysis ownership via its parent project
  const pestelProjectSnap = await adminDb
    .collection("pestel_projects")
    .doc(analysis.projectId as string)
    .get();

  if (!pestelProjectSnap.exists || pestelProjectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos para este análisis PESTEL" }, { status: 403 });
  }

  // Guard: if mapaPESTEL already exists, do not overwrite.
  const existingAnalysisId = project.phases?.exploracion?.pestAnalysisId as string | undefined;
  const existingMapa = project.phases?.exploracion?.mapaPESTEL as MapaPESTEL | undefined;

  if (existingMapa) {
    if (existingAnalysisId === pestAnalysisId) {
      // Same analysis already imported — return existing data idempotently.
      const existingPestProjectId = project.phases?.exploracion?.pestProjectId as string | undefined;
      return NextResponse.json({ pestProjectId: existingPestProjectId, mapaPESTEL: existingMapa }, { status: 200 });
    }
    return NextResponse.json(
      { error: "conflict", message: "Este proyecto ya tiene un análisis PESTEL importado. Para vincularlo a uno diferente, contacta soporte." },
      { status: 409 }
    );
  }

  const mapaPESTEL: MapaPESTEL = transformToMapaPESTEL(
    (analysis.dimensions ?? []) as RawDimension[]
  );

  const pestProjectId = analysis.projectId as string;

  // Save to Moddulo project
  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.pestAnalysisId": pestAnalysisId,
    "phases.exploracion.pestProjectId": pestProjectId,
    "phases.exploracion.mapaPESTEL": mapaPESTEL,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ mapaPESTEL, pestProjectId }, { status: 200 });
}
