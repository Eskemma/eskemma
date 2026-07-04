// app/api/centinela/pestel/export-to-moddulo/route.ts
// POST { analysisId, modduloProjectId? }
// Links a PESTEL analysis to a Moddulo project so F2 (Exploración)
// can consume it. Optionally updates the Moddulo project with the
// pestAnalysisId reference.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { PestlAnalysisV2 } from "@/types/pestel.types";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { analysisId?: string; modduloProjectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { analysisId, modduloProjectId } = body;

  if (!analysisId) {
    return NextResponse.json(
      { error: "analysisId es requerido" },
      { status: 400 }
    );
  }

  // Fetch analysis and verify ownership via its parent project
  const analysisSnap = await adminDb
    .collection("pestel_analyses")
    .doc(analysisId)
    .get();

  if (!analysisSnap.exists) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }

  const analysis = { id: analysisSnap.id, ...analysisSnap.data() } as PestlAnalysisV2 & { id: string };

  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(analysis.projectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // If a Moddulo project is specified, attach the pestAnalysisId to F2
  if (modduloProjectId) {
    const modduloSnap = await adminDb
      .collection("moddulo_projects")
      .doc(modduloProjectId)
      .get();

    if (!modduloSnap.exists || modduloSnap.data()?.userId !== session.uid) {
      return NextResponse.json(
        { error: "Proyecto Moddulo no encontrado o sin permisos" },
        { status: 404 }
      );
    }

    await adminDb.collection("moddulo_projects").doc(modduloProjectId).update({
      "phases.exploracion.pestAnalysisId": analysisId,
      "phases.exploracion.pestProjectId": analysis.projectId,
    });

    const redirectUrl = `/moddulo/proyecto/${modduloProjectId}/exploracion?pest_analysis_id=${analysisId}`;
    return NextResponse.json({ pestAnalysisId: analysisId, redirectUrl }, { status: 200 });
  }

  return NextResponse.json({ pestAnalysisId: analysisId }, { status: 200 });
}
